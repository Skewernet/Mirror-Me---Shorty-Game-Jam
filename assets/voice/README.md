# Kokoro voice performances

The seventeen shipped Ogg Vorbis takes are **synthetic**, produced offline with **Kokoro-82M v1.0**, replacing the earlier Piper/LJ Speech engine. No human actor performance, real-person voice clone or live speech service is represented. The game plays local files; it needs no API key, inference runtime or browser text-to-speech.

Casting uses three of Kokoro's supplied synthetic British-English presets:

| Character/source | Preset | Speaker ID | Treatment |
| --- | --- | --- | --- |
| Mara, including the second telephone caller | `bf_emma` | 21 | Close, clear speech at the character's natural pitch |
| The glass | `bf_emma` | 21 | The same identity, steadier pace and a restrained short reflection |
| Mum on the first telephone call | `bf_isabella` | 22 | A distinct woman, passed through telephone bandwidth |
| Kitchen weather service | `bm_george` | 26 | A distinct man, radio filtering and an eighteen-second quiet tail |

The model is not a substitute for directed acting: phrase delivery is controlled through the written punctuation, preset and pace, with role-specific post-processing. The glass retains Mara's real preset and pitch instead of becoming a pitch-shifted monster. Human performances remain a possible final improvement.

Exact text, preset, speaker ID and pace are in `lines.json`. `production.json` records the engine/runtime versions, model-file hashes, synthesis settings, durations, decoded true peaks and SHA256 of each rendered take. Game subtitle text remains in `src/story.mjs`; changes must be synchronized with the synthesis input and script.

## Provenance and license

Kokoro's upstream project describes its weights as Apache licensed. The official sherpa-onnx Kokoro v1.0 model package includes Apache License 2.0; an unmodified copy is retained as `LICENSE_APACHE_2.0.txt`. See `MODEL_CARD.txt` for source URLs, the exact package hash and tested input hashes. The model weights, voice embeddings, eSpeak data and inference libraries are development tools stored outside the game checkout; they are not shipped to players.

These are supplied synthetic preset names, not claims to have employed or imitated actors named Emma, Isabella or George. The weather bulletin is original game writing, not a recording from a real station.

## Reproduce

Use Python 3.12, `sherpa-onnx==1.13.8` CPU and ffmpeg with libvorbis. In the prepared cloud environment the Python package is installed outside the checkout at `/workspace/mirror-me-tools/python`.

Download the official model archive over verified HTTPS:

```sh
curl --fail --location --output kokoro-multi-lang-v1_0.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2
```

Verify SHA256 **`c5f7e2d2caf082bc1d20fb70334a61d99d20b484500aad32e7cf84c128ea3298`** before extracting. This is the observed hash of the official package used for these takes, pinned for repeatability; it is not a claim that upstream published a signed checksum. Extract outside the checkout, then from the repository:

```sh
PYTHONPATH=/workspace/mirror-me-tools/python python3 tools/generate_voice.py /path/to/kokoro-multi-lang-v1_0
```

Append line IDs such as `arrival recording` to render only those takes. `--output-dir` makes an audition without overwriting shipped files. The runtime uses the bundled Great Britain lexicon and eSpeak language name `en`; the installed eSpeak dataset does not accept `en-gb` as a direct voice-file name.

Audio is encoded at 24 kHz mono, Vorbis quality 5. Speech is loudness-normalized with a -4 dB true-peak synthesis target, leaving headroom for codec reconstruction and the game mixer. Each encoded file is decoded and measured; the renderer rejects any take exceeding -3 dBFS true peak. The radio's quiet tail is added after normalization. Listen on headphones before final release to judge acting, intelligibility and scene balance.
