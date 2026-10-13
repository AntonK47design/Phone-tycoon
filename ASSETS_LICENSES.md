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

## Platform SDK (not bundled)

| Component | Source | License |
|---|---|---|
| CrazyGames HTML5 SDK v3 | Loaded at runtime from `sdk.crazygames.com` (only on CrazyGames; the game falls back to a local stub elsewhere) | CrazyGames terms of service; not redistributed with the build |

## Status (M7, final)

No third-party art, models, textures or audio packs were added. The CC0 packs considered
earlier (Kenney, Quaternius) were not needed: all rooms (garage, office, factory, store, hall)
are procedural. Build output: one game chunk ≈ 1.1 MB (≈ 320 KB gzip) plus CSS and fonts,
far below the 10 MB initial target (checked by `scripts/check-size.mjs` on every build).
