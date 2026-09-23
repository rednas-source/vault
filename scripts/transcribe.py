#!/usr/bin/env python3
"""Generate a WebVTT sidecar with faster-whisper.

The Node server treats stdout as newline-delimited JSON progress events. The
completed file is moved atomically so Vault never exposes half-written cues.
"""

import argparse
import gc
import json
import math
import os
import sys

import ctranslate2
from faster_whisper import WhisperModel, BatchedInferencePipeline


def emit(**payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def timestamp(seconds):
    milliseconds = max(0, round(float(seconds) * 1000))
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    secs, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{milliseconds:03d}"


def load_model(name, requested_device):
    if requested_device == "cpu":
        return WhisperModel(name, device="cpu", compute_type="int8"), "cpu"
    if requested_device == "auto":
        try:
            has_gpu = ctranslate2.get_cuda_device_count() > 0
        except Exception as error:
            emit(kind="notice", fallback="cpu", diagnostic=str(error),
                 message="GPU acceleration is unavailable. Continuing on CPU.")
            has_gpu = False
        if not has_gpu:
            emit(kind="notice", message="No usable NVIDIA GPU detected. Using CPU transcription.")
            return WhisperModel(name, device="cpu", compute_type="int8"), "cpu"
    try:
        supported = ctranslate2.get_supported_compute_types("cuda")
        compute = "int8_float16" if "int8_float16" in supported else "float16" if "float16" in supported else "float32"
        model = WhisperModel(name, device="cuda", compute_type=compute)
        return model, "cuda"
    except Exception as error:
        emit(kind="notice", fallback="cpu", diagnostic=str(error),
             message="GPU acceleration is unavailable. Continuing on CPU.")
        return WhisperModel(name, device="cpu", compute_type="int8"), "cpu"


def caption_segments(segment):
    """Split at speech gaps and use the last spoken word, not a chunk's end."""
    words = getattr(segment, "words", None) or []
    group = []
    start = end = 0
    for word in words:
        text = str(word.word)
        begin, finish = float(word.start), float(word.end)
        if not text.strip() or not math.isfinite(begin) or not math.isfinite(finish):
            continue
        # Alignment can give a single word the duration of a silent interval.
        if finish - begin > 4:
            finish = begin + max(.5, min(2, len(text.strip()) / 8))
        finish = max(begin + .05, finish)
        if group and (begin - end > .8 or finish - start > 6 or len("".join(group) + text) > 84):
            yield start, min(end + .15, begin), "".join(group).strip()
            group = []
        if not group:
            start = max(0, begin)
        group.append(text)
        end = finish
    if group:
        yield start, end + .15, "".join(group).strip()
    elif not words:
        # Older runtimes may not supply words. Never span minutes of silence.
        text = " ".join(str(segment.text).strip().split())
        if text:
            start, end = float(segment.start), float(segment.end)
            if end - start > 15:
                end = start + max(3, min(12, len(text) / 15 + 1))
            yield max(0, start), max(start + .05, end), text


def transcribe_to_vtt(model, source, output, options, device="cpu", batch_size=4):
    emit(kind="phase", phase="preparing-audio", message="Preparing audio and detecting speech", progress=2)
    if device == "cuda" and batch_size > 1:
        segments, info = BatchedInferencePipeline(model=model).transcribe(source, batch_size=batch_size, **options)
    else:
        segments, info = model.transcribe(source, **options)
    duration = float(
        getattr(info, "duration", 0)
        or getattr(info, "duration_after_vad", 0)
        or 0
    )
    temp = output + ".part"
    emit(kind="phase", phase="transcribing", message=f"Transcribing on {'GPU' if device == 'cuda' else 'CPU'}", progress=3,
         language=getattr(info, "language", None), device=device, duration=duration)
    try:
        caption_count = 0
        with open(temp, "w", encoding="utf-8", newline="\n") as handle:
            handle.write("WEBVTT\n\n")
            for segment in segments:
                for start, end, text in caption_segments(segment):
                    caption_count += 1
                    handle.write(
                        f"{timestamp(start)} --> {timestamp(end)}\n{text}\n\n"
                    )
                    # Persist cues incrementally. This prevents a whole episode's
                    # segment objects from sitting in memory until the very end.
                    handle.flush()
                progress = min(99.5, (float(segment.end) / duration * 100)) if duration else 3
                emit(kind="progress", phase="transcribing", progress=max(3, progress),
                     at=float(segment.end), duration=duration)
        if not caption_count:
            raise ValueError("No speech was detected; no subtitle captions were generated. Try another model or check the video's audio track.")
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
    parser.add_argument("--batch-size", type=int, default=4)
    args = parser.parse_args()

    emit(kind="phase", phase="loading-model", message=f"Loading {args.model} model (first use may download it)", progress=1,
         model=args.model, device=args.device)
    model, device = load_model(args.model, args.device)
    emit(kind="start", phase="starting", progress=2, device=device, model=args.model)
    options = {
        # Greedy decoding is dramatically faster for server-side captions and
        # avoids the long apparent stall caused by a five-beam CPU search.
        "beam_size": 1,
        "best_of": 1,
        "vad_filter": True,
        "word_timestamps": True,
        "vad_parameters": {"min_silence_duration_ms": 500},
        "condition_on_previous_text": True,
    }
    if args.language != "auto":
        options["language"] = args.language

    try:
        info = transcribe_to_vtt(model, args.input, args.output, options, device, max(1, min(8, args.batch_size)))
    except Exception as error:
        if device != "cuda" or str(error).startswith("No speech was detected"):
            raise
        emit(kind="notice", fallback="cpu", diagnostic=str(error),
             message="GPU transcription failed. Retrying on CPU.")
        del model
        gc.collect()
        model = WhisperModel(args.model, device="cpu", compute_type="int8")
        device = "cpu"
        info = transcribe_to_vtt(model, args.input, args.output, options, device)
    emit(kind="complete", progress=100, language=getattr(info, "language", None), device=device)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        emit(kind="error", message=str(error))
        sys.exit(1)
