"""Worker regressions without GPU, model downloads, or installed ML packages."""
import importlib.util
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

sys.modules['ctranslate2'] = SimpleNamespace(get_cuda_device_count=Mock(return_value=0), get_supported_compute_types=Mock(return_value={'int8_float16'}))
sys.modules['faster_whisper'] = SimpleNamespace(WhisperModel=Mock(), BatchedInferencePipeline=Mock())
spec = importlib.util.spec_from_file_location('transcribe', Path(__file__).parents[1] / 'scripts' / 'transcribe.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

class TranscriptionTests(unittest.TestCase):
    def setUp(self):
        self.events=[]
        self.emit=patch.object(worker,'emit',side_effect=lambda **event:self.events.append(event))
        self.emit.start()
        self.addCleanup(self.emit.stop)

    def test_no_gpu_avoids_cuda_initialization(self):
        with patch.object(worker,'WhisperModel',return_value='cpu') as model:
            self.assertEqual(worker.load_model('base','auto'),('cpu','cpu'))
            model.assert_called_once_with('base',device='cpu',compute_type='int8')

    def test_explicit_cuda_load_failure_recovers_on_cpu(self):
        with patch.object(worker,'WhisperModel',side_effect=[RuntimeError('cublas missing'),'cpu']):
            self.assertEqual(worker.load_model('small','cuda'),('cpu','cpu'))
            self.assertEqual(self.events[-1]['fallback'],'cpu')
            self.assertIn('cublas',self.events[-1]['diagnostic'])

    def test_gpu_uses_quantization_and_batched_inference(self):
        with patch.object(worker,'WhisperModel',return_value='gpu') as model:
            self.assertEqual(worker.load_model('base','cuda'),('gpu','cuda'))
            model.assert_called_once_with('base',device='cuda',compute_type='int8_float16')
        pipeline=Mock();pipeline.transcribe.return_value=(iter([SimpleNamespace(start=0,end=1,text=' hello ')]),SimpleNamespace(duration=10,language='en'))
        with tempfile.TemporaryDirectory() as folder,patch.object(worker,'BatchedInferencePipeline',return_value=pipeline):
            output=str(Path(folder)/'captions.vtt')
            worker.transcribe_to_vtt('gpu','movie',output,{'beam_size':1},'cuda',4)
            pipeline.transcribe.assert_called_once_with('movie',batch_size=4,beam_size=1)
            self.assertIn('00:00:01.000\nhello',Path(output).read_text())

    def test_failed_lazy_generator_preserves_previous_sidecar_and_cleans_partial(self):
        def broken():
            yield SimpleNamespace(start=0,end=1,text='partial')
            raise RuntimeError('CUDA failed during iteration')
        model=Mock();model.transcribe.return_value=(broken(),SimpleNamespace(duration=20))
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'captions.vtt';output.write_text('existing captions')
            with self.assertRaises(RuntimeError):worker.transcribe_to_vtt(model,'movie',str(output),{})
            self.assertEqual(output.read_text(),'existing captions')
            self.assertFalse(Path(str(output)+'.part').exists())

    def test_runtime_gpu_failure_retries_same_model_on_cpu(self):
        info=SimpleNamespace(language='en')
        with patch.object(sys,'argv',['transcribe','--input','movie','--output','captions','--device','cuda']),patch.object(worker,'load_model',return_value=('gpu','cuda')),patch.object(worker,'WhisperModel',return_value='cpu'),patch.object(worker,'transcribe_to_vtt',side_effect=[RuntimeError('CUDA runtime failure'),info]) as transcribe:
            worker.main()
            self.assertEqual(transcribe.call_count,2)
            self.assertEqual(transcribe.call_args.args[0],'cpu')
            self.assertEqual(self.events[-1]['kind'],'complete')
            self.assertEqual(self.events[-1]['device'],'cpu')

    def test_silent_audio_does_not_publish_an_empty_success_or_replace_existing_captions(self):
        model=Mock();model.transcribe.return_value=(iter([]),SimpleNamespace(duration=20))
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'captions.vtt';output.write_text('existing captions')
            with self.assertRaisesRegex(ValueError,'No speech was detected'):
                worker.transcribe_to_vtt(model,'silent movie',str(output),{})
            self.assertEqual(output.read_text(),'existing captions')
            self.assertFalse(Path(str(output)+'.part').exists())

if __name__=='__main__': unittest.main()
