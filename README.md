# Phone Empire 3D

A stylized 3D smartphone tycoon for the web (CrazyGames). Found a company in a garage,
design phones in a live 3D editor, launch them with a show and grow into a tech giant.

- Design: [`docs/GDD.md`](docs/GDD.md) · Plan & milestones: [`docs/PLAN.md`](docs/PLAN.md)
- Balancing reports: [`docs/balancing/`](docs/balancing/)
- Asset licenses: [`ASSETS_LICENSES.md`](ASSETS_LICENSES.md)

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build + size gate (fails over CrazyGames limits)
npm run preview      # serve the production build
npm test             # Vitest (simulation, saves, i18n, pacing)
npm run check        # typecheck + architecture boundaries + tests + build
npm run sim:bot -- --minutes 120 --profile average,optimizer,weak
```

Dev build only: press **F1** (or `` ` ``) for the debug panel – cash, x100 speed, +1 year,
quality override, FPS/draw calls and the first-minute funnel timer.

## Structure

| Folder | Content |
|---|---|
| `src/sim` | Pure, deterministic game logic (no three.js, no DOM). Tested with Vitest. |
| `src/data` | Content as data: eras, components, colors, goals, competitors, i18n (EN/DE). |
| `src/render` | three.js: engine, procedural phone, garage diorama, camera rig, post FX. |
| `src/ui` | Preact HUD/editor/launch overlay, juice, clock, persistence. |
| `src/platform` | CrazyGames SDK v3 adapter with a stub fallback. |
| `src/audio` | Synthesized WebAudio sound effects. |
| `scripts` | Size gate, architecture boundary check, balancing bot. |
