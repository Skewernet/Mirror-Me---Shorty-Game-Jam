# MIRROR ME — Shorty Game Jam 2026

A first-person PS1-inspired psychological horror game about an unreliable reflection and a looping house. Theme: **INVERTED**.

Development started October 22, 2026. Created by Skewernet with AI-assisted prototyping using ChatGPT/Codex.

## Prototype 0.1

Playable 3D looping hallway with WASD/mouse controls, interactable mirror and drawer, a locked door, progressive visual anomalies and introductory/end states. This is a technical prototype, not the final game; mirror rendering is presently scripted, not physically accurate. The current loop/door/puzzle logic needs refinement.

### Controls
WASD move, mouse look, E interact, Esc pause, Shift planned for sprint.

### Running
Serve the repo root with a static HTTP server (e.g. `python -m http.server 8000`) or Cloudflare Pages. The Three.js module loads from jsDelivr, so an internet connection is required.

### Roadmap
1. Reliable hallway looping and puzzle progression
2. Convincing animated reflection that deviates from player input
3. Mirrored world state and psychological scares
4. Audio, polish, accessibility and submission testing

No P.T. assets or game code are used. Record external asset attributions before submission.
