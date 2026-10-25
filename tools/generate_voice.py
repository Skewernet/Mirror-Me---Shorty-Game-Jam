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
    # Keep the original identity readable above an original, rough lower layer.
    # No film performance or external vocal/click sample enters this treatment.
    if role == "glass":
        return (
            "asplit=3[clear][low][rough];"
            "[clear]highpass=f=100,lowpass=f=5600,volume=0.70[c];"
            "[low]asetrate=19680,aresample=24000,atempo=1.219512,"
            "highpass=f=75,lowpass=f=1900,volume=0.27[l];"
            "[rough]highpass=f=260,lowpass=f=2300,tremolo=f=31:d=0.78,"
            "acompressor=threshold=0.075:ratio=5:attack=2:release=35,volume=0.19[r];"
            "[c][l][r]amix=inputs=3:duration=longest:normalize=0,"
            "aecho=0.8:0.18:43:0.08,loudnorm=I=-21:TP=-4:LRA=8[glass]"
        )
    if role == "phone":
        return "highpass=f=300,lowpass=f=3400,loudnorm=I=-19:TP=-4:LRA=8"
    if role == "radio":
        return "highpass=f=400,lowpass=f=3200,loudnorm=I=-21:TP=-4:LRA=7,apad=pad_dur=18"
    if role == "news":
        # A finite, intelligible report at the wake; unlike the sparse kitchen
        # weather loop it must not carry an eighteen-second artificial tail.
        return "highpass=f=250,lowpass=f=5200,loudnorm=I=-20:TP=-4:LRA=7"
    if role == "sobbing":
        # Keep the broken words recognizable. This is a directed synthetic
        # take with restrained breath-like amplitude, not a recorded human cry.
        return "highpass=f=90,lowpass=f=8500,tremolo=f=4.7:d=0.12,loudnorm=I=-23:TP=-4:LRA=9"
    if role == "whisper":
        # The same Mum preset, close and airy rather than telephone-filtered.
        # Preserve her natural pitch; the quiet high band adds breath texture
        # without replacing her identity or importing a recorded performance.
        return (
            "asplit=2[voice][air];"
            "[voice]highpass=f=170,lowpass=f=6500,volume=0.84[v];"
            "[air]highpass=f=2700,lowpass=f=7500,volume=0.20[a];"
            "[v][a]amix=inputs=2:duration=longest:normalize=0,"
            "aecho=0.75:0.16:79:0.12,loudnorm=I=-24:TP=-5:LRA=9[whisper]"
        )
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


def add_glass_rattle(samples: list[float], rate: int, name: str) -> list[float]:
    """Original deterministic glottal closures, never a borrowed sound clip."""
    import math
    lead = round(rate * .14)
    out = [0.] * lead + samples + [0.] * round(rate * .22)
    seed = int.from_bytes(hashlib.sha256(name.encode()).digest()[:4], 'little')
    onsets = [.015, .066, .142]
    position = .64
    while position < len(out) / rate - .2:
        onsets.append(position)
        position += .58 + ((seed >> 8) & 255) / 255 * .37
        seed = (1664525 * seed + 1013904223) & 0xffffffff
    for onset in onsets:
        begin = round(onset * rate)
        for index in range(round(rate * .037)):
            if begin + index >= len(out):
                break
            seed = (1664525 * seed + 1013904223) & 0xffffffff
            white = seed / 2147483648 - 1
            t = index / rate
            closure = math.exp(-t * 165) * (1 - math.exp(-t * 1800))
            resonance = (math.sin(t * math.tau * 770) * .44 +
                         math.sin(t * math.tau * 1390) * .27 + white * .29)
            out[begin + index] += closure * resonance * .075
    return out


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
        # An optional finite phrase plan gives a broken take actual space to
        # breathe, without asking TTS to speak a stage direction such as [sob].
        segments = line.get("segments") or [line["text"]]
        pauses = line.get("pauses_after_seconds", [])
        samples = []
        phrase_starts = []
        sample_rate = None
        for index, text in enumerate(segments):
            audio = tts.generate(text, sid=line["speaker_id"], speed=line["speed"])
            if not audio.sample_rate or not len(audio.samples):
                raise RuntimeError("Kokoro produced no speech for " + name)
            if sample_rate is not None and sample_rate != audio.sample_rate:
                raise RuntimeError("Sample rate changed within " + name)
            sample_rate = audio.sample_rate
            phrase_starts.append(round(len(samples) / sample_rate, 3))
            samples.extend(audio.samples)
            if index < len(segments) - 1 and index < len(pauses):
                samples.extend([0.] * round(float(pauses[index]) * sample_rate))
        if not any(abs(float(s)) > 0.005 for s in samples):
            raise RuntimeError("Kokoro produced a silent take for " + name)
        if line["role"] == "glass":
            samples = add_glass_rattle(samples, sample_rate, name)
        pcm = array.array("h", (round(max(-1, min(1, float(s))) * 32767) for s in samples))
        target = args.output_dir / (name + ".ogg")
        effects = effects_for(line["role"])
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "take.wav"
            with wave.open(str(raw), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(sample_rate)
                wav.writeframes(pcm.tobytes())
            processing = (["-filter_complex", effects, "-map", "[" + line["role"] + "]"]
                          if line["role"] in {"glass", "whisper"} else ["-af", effects])
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw),
                *processing, "-ar", "24000", "-c:a", "libvorbis", "-q:a", "5", str(target),
            ], check=True)
        duration = float(subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(target),
        ], text=True).strip())
        true_peak = decoded_true_peak(target)
        report["clips"][name] = {
            "voice": line["voice"], "speaker_id": line["speaker_id"],
            "role": line["role"], "speed": line["speed"], "text": line["text"],
            "speech_seconds": round(len(samples) / sample_rate, 3),
            "file_seconds": round(duration, 3), "effects": effects, "sha256": digest(target),
            "decoded_true_peak_dbfs": true_peak,
        }
        if line.get("segments"):
            report["clips"][name]["segments"] = segments
            report["clips"][name]["pauses_after_seconds"] = pauses
            report["clips"][name]["phrase_starts_seconds"] = phrase_starts
        if line["role"] == "glass":
            report["clips"][name]["original_rattle"] = "deterministic glottal closure PCM; no external recording"
        report_path.write_text(json.dumps(report, indent=2) + "\n")
        print(f"{name}: {line['voice']}, {duration:.2f}s, rendered in {time.monotonic()-started:.2f}s", flush=True)


if __name__ == "__main__":
    main()
