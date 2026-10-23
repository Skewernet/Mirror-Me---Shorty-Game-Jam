"""Render MIRROR ME's synthetic Kokoro v1.0 performances offline.

Usage:
  PYTHONPATH=/path/to/sherpa-packages python3 tools/generate_voice.py MODEL_DIR [LINE_ID ...]
Requires sherpa-onnx==1.13.8 and ffmpeg. See assets/voice/README.md.
The browser ships only rendered Ogg files; it runs no inference or external service.
"""
from __future__ import annotations

import argparse
import array
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time
import wave

import sherpa_onnx

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "voice"
MODEL_FILES = ("model.onnx", "voices.bin", "tokens.txt", "lexicon-gb-en.txt")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def effects_for(role: str) -> str:
    # Preserve recognizable speech and the woman's actual pitch. Character contrast
    # comes from distinct Kokoro presets and pace, not a low-pitched monster effect.
    if role == "glass":
        return "highpass=f=85,lowpass=f=7500,aecho=0.8:0.15:32:0.055,loudnorm=I=-21:TP=-4:LRA=8"
    if role == "phone":
        return "highpass=f=300,lowpass=f=3400,loudnorm=I=-19:TP=-4:LRA=8"
    if role == "radio":
        return "highpass=f=400,lowpass=f=3200,loudnorm=I=-21:TP=-4:LRA=7,apad=pad_dur=18"
    return "highpass=f=75,lowpass=f=9500,loudnorm=I=-20:TP=-4:LRA=8"


def decoded_true_peak(path: Path) -> float:
    """Measure the encoded file, including any Vorbis reconstruction overshoot."""
    result = subprocess.run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
        "-af", "ebur128=peak=true:framelog=verbose", "-f", "null", "-",
    ], capture_output=True, text=True, check=True)
    match = re.search(r"True peak:\s+Peak:\s+([-\d.]+) dBFS", result.stderr)
    if not match:
        raise RuntimeError("Could not measure decoded true peak: " + str(path))
    peak = float(match[1])
    if peak > -3:
        raise RuntimeError(f"Decoded take exceeds -3 dBFS headroom: {path.name} ({peak} dBFS)")
    return peak


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("lines", nargs="*", help="Omit to render every take.")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT)
    parser.add_argument("--threads", type=int, default=2)
    args = parser.parse_args()
    lines = json.loads((OUTPUT / "lines.json").read_text())
    selected = set(args.lines)
    unknown = selected - lines.keys()
    if unknown:
        parser.error("Unknown line IDs: " + ", ".join(sorted(unknown)))
    model = args.model.resolve()
    for filename in MODEL_FILES:
        if not (model / filename).is_file():
            parser.error("Missing Kokoro v1.0 input: " + str(model / filename))
    model_hashes = {name: digest(model / name) for name in MODEL_FILES}
    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=str(model / "model.onnx"),
                voices=str(model / "voices.bin"),
                tokens=str(model / "tokens.txt"),
                data_dir=str(model / "espeak-ng-data"),
                lexicon=str(model / "lexicon-gb-en.txt"),
                # This bundled espeak data registers Great Britain under 'en'.
                lang="en",
            ),
            num_threads=args.threads,
            provider="cpu",
            debug=False,
        ),
        max_num_sentences=1,
    )
    tts = sherpa_onnx.OfflineTts(config)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    report_path = args.output_dir / "production.json"
    report = {
        "engine": "Kokoro-82M v1.0 / sherpa-onnx",
        "runtime_version": sherpa_onnx.__version__,
        "synthetic": True,
        "sample_rate": 24000,
        "model_files_sha256": model_hashes,
        "clips": {},
    }
    if selected and report_path.exists():
        previous = json.loads(report_path.read_text())
        if previous.get("model_files_sha256") == model_hashes:
            report["clips"] = previous.get("clips", {})
    for name, line in lines.items():
        if selected and name not in selected:
            continue
        started = time.monotonic()
        audio = tts.generate(line["text"], sid=line["speaker_id"], speed=line["speed"])
        if not audio.sample_rate or not len(audio.samples):
            raise RuntimeError("Kokoro produced no speech for " + name)
        if not any(abs(float(s)) > 0.005 for s in audio.samples):
            raise RuntimeError("Kokoro produced a silent take for " + name)
        pcm = array.array("h", (round(max(-1, min(1, float(s))) * 32767) for s in audio.samples))
        target = args.output_dir / (name + ".ogg")
        effects = effects_for(line["role"])
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "take.wav"
            with wave.open(str(raw), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(audio.sample_rate)
                wav.writeframes(pcm.tobytes())
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw),
                "-af", effects, "-ar", "24000", "-c:a", "libvorbis", "-q:a", "5", str(target),
            ], check=True)
        duration = float(subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(target),
        ], text=True).strip())
        true_peak = decoded_true_peak(target)
        report["clips"][name] = {
            "voice": line["voice"], "speaker_id": line["speaker_id"],
            "role": line["role"], "speed": line["speed"], "text": line["text"],
            "speech_seconds": round(len(audio.samples) / audio.sample_rate, 3),
            "file_seconds": round(duration, 3), "effects": effects, "sha256": digest(target),
            "decoded_true_peak_dbfs": true_peak,
        }
        report_path.write_text(json.dumps(report, indent=2) + "\n")
        print(f"{name}: {line['voice']}, {duration:.2f}s, rendered in {time.monotonic()-started:.2f}s", flush=True)


if __name__ == "__main__":
    main()
