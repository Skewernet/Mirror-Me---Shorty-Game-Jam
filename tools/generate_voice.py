"""Render synthetic placeholder performances offline; see assets/voice/README.md.
Usage: python tools/generate_voice.py /path/to/vits-piper-en_US-ljspeech-medium
Requires sherpa-onnx==1.13.8 and ffmpeg. Runtime game needs neither.
"""
import json
import pathlib
import subprocess
import sys
import tempfile
import wave
import array
import sherpa_onnx

root = pathlib.Path(__file__).resolve().parents[1]
model = pathlib.Path(sys.argv[1])
config = sherpa_onnx.OfflineTtsConfig(
    model=sherpa_onnx.OfflineTtsModelConfig(
        vits=sherpa_onnx.OfflineTtsVitsModelConfig(
            model=str(model / 'en_US-ljspeech-medium.onnx'),
            tokens=str(model / 'tokens.txt'),
            data_dir=str(model / 'espeak-ng-data'),
        ),
        num_threads=2, provider='cpu', debug=False,
    ),
    max_num_sentences=1,
)
tts = sherpa_onnx.OfflineTts(config)
lines = json.loads((root / 'assets/voice/lines.json').read_text())
for name, line in lines.items():
    audio = tts.generate(line['text'], sid=0, speed=line['speed'])
    with tempfile.TemporaryDirectory() as tmp:
        raw = pathlib.Path(tmp) / 'take.wav'
        pcm = array.array('h', (int(max(-1, min(1, float(s))) * 32767) for s in audio.samples))
        with wave.open(str(raw), 'wb') as out:
            out.setnchannels(1); out.setsampwidth(2); out.setframerate(audio.sample_rate)
            out.writeframes(pcm.tobytes())
        effects = 'highpass=f=100,lowpass=f=6000,loudnorm=I=-20:TP=-3:LRA=8'
        if line['role'] == 'glass':
            effects = f'asetrate={audio.sample_rate}*0.94,aresample=22050,highpass=f=120,lowpass=f=3200,aecho=0.8:0.35:74:0.12,loudnorm=I=-21:TP=-3:LRA=7'
        if line['role'] == 'phone':
            effects = 'highpass=f=350,lowpass=f=2300,loudnorm=I=-20:TP=-3:LRA=8'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(raw), '-af', effects, '-ar', '22050', '-c:a', 'libvorbis', '-q:a', '3', str(root / 'assets/voice' / f'{name}.ogg')], check=True)
    print(name, round(len(audio.samples) / audio.sample_rate, 2), 'seconds', flush=True)
