# Assets & Licenses

Phone Empire 3D ships **no third-party art, audio or font files** in M1. Everything visible
or audible is generated at runtime:

| Asset | Source | License |
|---|---|---|
| Garage diorama, furniture, founder figure, phones, turntable | Procedural geometry (`src/render/**`) | Original work (project) |
| Textures (concrete, wood, pegboard, poster, whiteboard, rug, phone UI, laptop UI, sky, background) | Canvas-generated (`src/render/textures.ts`) | Original work (project) |
| Reflections / environment | `RoomEnvironment` + PMREM generated at runtime | three.js (MIT) |
| Sound effects | WebAudio synthesis (`src/audio/sfx.ts`) | Original work (project) |
| Fonts | System font stack, nothing downloaded | – |

## Runtime libraries

| Library | License |
|---|---|
| three.js (incl. `examples/jsm` passes and helpers) | MIT |
| Preact, @preact/signals | MIT |

## Planned (later milestones)

Optional CC0 packs (e.g. Kenney, Quaternius) may be added for office/factory props. Each
pack will be listed here with its source URL and license before it is committed.
