# Kokoro voice performances

The forty-two shipped Ogg Vorbis takes are **synthetic**, produced offline with **Kokoro-82M v1.0**, replacing the earlier Piper/LJ Speech engine. No human actor performance, real-person voice clone or live speech service is represented. The game plays local files; it needs no API key, inference runtime or browser text-to-speech.

Casting uses three of Kokoro's supplied synthetic British-English presets:

| Character/source                                    | Preset        | Speaker ID | Treatment                                                                   |
| --------------------------------------------------- | ------------- | ---------- | --------------------------------------------------------------------------- |
| Mara         | `bf_emma`     | 21         | Close, clear speech at the character's natural pitch                        |
| The glass                                           | `bf_emma`     | 21         | The same base identity with an original lower/raspy layer, short reflection and authored glottal clicks          |
| Mum on all three calls, final recognition and attack          | `bf_isabella` | 22         | Telephone bandwidth for the call; clear, full-range accusation and “Goodnight” |
| Kitchen weather service / funeral news reader         | `bm_george`   | 26         | Radio filtering; only the weather loop carries an eighteen-second quiet tail |

The model is not a substitute for directed acting: phrase delivery is controlled through the written punctuation, preset and pace, with role-specific post-processing. The glass retains Mara's recognizable bf_emma base. A clearer main layer sits above a quieter lowered/rough layer and deterministic original glottal clicks; no film clip, actor recording or borrowed creature sound is used. Human performances remain a possible final improvement.

There are thirty-nine other story performances, one finite broken-word crying take, one funeral news report and one ambient kitchen weather loop. The narrative pass added the hall photograph memory and three crime-scene evidence lines, with matching arrival, confession, accusation and news. The current visual/parlor pass revises Mum's fuse/goodnight telephone message and the direct 03:17 mirror observation, and adds “Goodnight” at the attack. All three calls, the accusation and attack word all use the same bf_isabella preset and speaker ID; the attack word is faster and full-range, without pitch shifting or telephone filtering. The second call now pleads through an explicit seven-phrase plan, with uneven pauses and measured phrase-start caption cues. It names the music box, bath and radio without replacing the diary’s puzzle instructions. A third call becomes available once the keepsakes are returned, directs Mara to the diary beside the bed, and explicitly gives the reverse sequence: music box, bathroom tap, kitchen radio. It has eight measured phrase captions and uneven pauses. Eight additional post-key mirror lines offer indirect reminders without stating the final confession; three clock-chapter lines connect turning hands, cold bathwater and Mum without giving the time or a direct instruction; all fifteen glass takes use the new original vocal treatment. The funeral report is original fictional news, not a real broadcast. It is a single finite take with no artificial padding tail. The crying take uses the existing Mara preset, separated phrases, scripted pauses and restrained amplitude modulation; it is not a recorded human sob. Exact text, phrase plans, preset, speaker ID and pace are in `lines.json`. `production.json` records the engine/runtime versions, model-file hashes, synthesis settings, durations, decoded true peaks and SHA256 of each rendered take. Game subtitle text remains in `src/story.mjs`; changes must be synchronized with the synthesis input and script.

## Provenance and license

Kokoro's upstream project describes its weights as Apache licensed. The official sherpa-onnx Kokoro v1.0 model package includes Apache License 2.0; an unmodified copy is retained as `LICENSE_APACHE_2.0.txt`. See `MODEL_CARD.txt` for source URLs, the exact package hash and tested input hashes. The model weights, voice embeddings, eSpeak data and inference libraries are development tools stored outside the game checkout; they are not shipped to players.

These are supplied synthetic preset names, not claims to have employed or imitated actors named Emma, Isabella or George. The weather bulletin and funeral news report are original game writing, not recordings from real stations.

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

Audio is encoded at 24 kHz mono, Vorbis quality 5. Speech is loudness-normalized with a -4 dB true-peak synthesis target, leaving headroom for codec reconstruction and the game mixer. Each encoded file is decoded and measured; the renderer rejects any take exceeding -3 dBFS true peak. The kitchen weather loop's quiet tail is added after normalization; the funeral news report has no such tail. Listen on headphones before final release to judge acting, intelligibility and scene balance.
