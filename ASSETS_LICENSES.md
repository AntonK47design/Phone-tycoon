# Assets & Licenses

Phone Empire 3D ships **no third-party art or audio**. Apart from three open-licensed fonts
(below), everything visible or audible is generated at runtime:

| Asset | Source | License |
|---|---|---|
| Garage diorama, furniture, founder figure, phones, turntable | Procedural geometry (`src/render/**`) | Original work (project) |
| Textures (concrete, wood, pegboard, poster, whiteboard, rug, phone UI, laptop UI, sky, background) | Canvas-generated (`src/render/textures.ts`) | Original work (project) |
| Reflections / environment | `RoomEnvironment` + PMREM generated at runtime | three.js (MIT) |
| Sound effects | WebAudio synthesis (`src/audio/sfx.ts`) | Original work (project) |
| Fonts: Bungee (display), Barlow Semi Condensed (UI), Space Mono (numbers) | Bundled latin subsets via `@fontsource/*` (no external requests) | SIL Open Font License 1.1 |

## Runtime libraries

| Library | License |
|---|---|
| three.js (incl. `examples/jsm` passes and helpers) | MIT |
| Preact, @preact/signals | MIT |
| @fontsource/bungee, @fontsource/barlow-semi-condensed, @fontsource/space-mono | OFL-1.1 (fonts), MIT (packaging) |

## Planned (later milestones)

Optional CC0 packs (e.g. Kenney, Quaternius) may be added for office/factory props. Each
pack will be listed here with its source URL and license before it is committed.
