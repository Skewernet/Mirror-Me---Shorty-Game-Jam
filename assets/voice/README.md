# Provisional voice performances

These seven Ogg Vorbis clips are **synthetic**, generated for MIRROR ME. No human acting is claimed. Script and direction: `GAME_DIRECTION.md`; exact synthesis input: `lines.json`. Subtitles use the same lines in `src/story.mjs`.

Model: `vits-piper-en_US-ljspeech-medium`, distributed by the sherpa-onnx project at https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models . The supplied model card is preserved in `MODEL_CARD.txt`; it identifies the LJ Speech dataset as public domain and credits the model's training source. Dataset: https://keithito.com/LJ-Speech-Dataset/ . The game ships only rendered speech, not the model weights, phonemizer, or inference runtime.

Generated with `sherpa-onnx==1.13.8` (CPU, two threads), then encoded with ffmpeg. The glass uses modest pitch/filter/echo treatment; all takes are loudness-normalized with controlled peaks. To regenerate, install the runtime outside the game checkout, download/extract the release model over verified HTTPS, then run:

```sh
python tools/generate_voice.py /path/to/vits-piper-en_US-ljspeech-medium
```

Generation tools are development-only; playback needs no service, account, secret, internet access or browser text-to-speech. Replace these takes with directed licensed performances when available. Keep filenames and subtitle timing in sync.
