#!/usr/bin/env python3
"""Generate a WebVTT sidecar with faster-whisper.

The Node server treats stdout as newline-delimited JSON progress events. The
completed file is moved atomically so Vault never exposes half-written cues.
"""

import argparse
import json
import os
import sys

from faster_whisper import WhisperModel


def emit(**payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def timestamp(seconds):
    milliseconds = max(0, round(float(seconds) * 1000))
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    secs, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{milliseconds:03d}"


def load_model(name, requested_device):
    if requested_device != "auto":
        compute = "float16" if requested_device == "cuda" else "int8"
        return WhisperModel(name, device=requested_device, compute_type=compute), requested_device

    try:
        model = WhisperModel(name, device="cuda", compute_type="float16")
        return model, "cuda"
    except Exception as error:
        emit(kind="notice", message=f"CUDA unavailable, using CPU: {error}")
        return WhisperModel(name, device="cpu", compute_type="int8"), "cpu"


def transcribe_to_vtt(model, source, output, options):
    segments, info = model.transcribe(source, **options)
    duration = float(
        getattr(info, "duration", 0)
        or getattr(info, "duration_after_vad", 0)
        or 0
    )
    temp = output + ".part"
    emit(kind="phase", phase="transcribing", message="Decoding speech", progress=3,
         language=getattr(info, "language", None))
    try:
        with open(temp, "w", encoding="utf-8", newline="\n") as handle:
            handle.write("WEBVTT\n\n")
            for segment in segments:
                text = " ".join(str(segment.text).strip().split())
                if text:
                    handle.write(
                        f"{timestamp(segment.start)} --> {timestamp(segment.end)}\n{text}\n\n"
                    )
                    # Persist cues incrementally. This prevents a whole episode's
                    # segment objects from sitting in memory until the very end.
                    handle.flush()
                progress = min(99.5, (float(segment.end) / duration * 100)) if duration else 3
                emit(kind="progress", phase="transcribing", progress=max(3, progress),
                     at=float(segment.end), duration=duration)
        os.replace(temp, output)
    finally:
        if os.path.exists(temp):
            os.remove(temp)
    return info


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="small")
    parser.add_argument("--device", choices=("auto", "cuda", "cpu"), default="auto")
    parser.add_argument("--language", default="auto")
    args = parser.parse_args()

    emit(kind="phase", phase="loading-model", message=f"Loading {args.model} model", progress=1,
         model=args.model, device=args.device)
    model, device = load_model(args.model, args.device)
    emit(kind="start", phase="starting", progress=2, device=device, model=args.model)
    options = {
        # Greedy decoding is dramatically faster for server-side captions and
        # avoids the long apparent stall caused by a five-beam CPU search.
        "beam_size": 1,
        "best_of": 1,
        "vad_filter": True,
        "condition_on_previous_text": True,
    }
    if args.language != "auto":
        options["language"] = args.language

    try:
        info = transcribe_to_vtt(model, args.input, args.output, options)
    except Exception as error:
        if args.device != "auto" or device != "cuda":
            raise
        emit(kind="notice", message=f"CUDA transcription failed, retrying on CPU: {error}")
        model = WhisperModel(args.model, device="cpu", compute_type="int8")
        device = "cpu"
        info = transcribe_to_vtt(model, args.input, args.output, options)
    emit(kind="complete", progress=100, language=getattr(info, "language", None), device=device)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        emit(kind="error", message=str(error))
        sys.exit(1)
