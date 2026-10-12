# Phone Empire 3D – Umsetzungsplan

> Begleitdokument zu [GDD.md](./GDD.md). Beschreibt Architektur, Tooling, Budgets und Meilensteine.

---

## 1. Tech-Stack

| Bereich | Wahl | Begründung / Größe (gz) |
|---|---|---|
| Sprache | TypeScript (strict) | – |
| Build | Vite | Code-Splitting, schnelle Dev-Builds |
| 3D | three.js (aktuelle Version, ES-Module, tree-shaken) | ~150 KB |
| Postprocessing | three/examples `EffectComposer`, `GTAOPass` (SSAO), `SMAAPass`, `UnrealBloomPass`, `OutputPass` | im three-Bundle enthalten; Vignette/Grade & Tilt-Shift als eigene Shader-Passes (~2 KB). *n8ao verworfen: zieht die komplette `postprocessing`-Bibliothek als Peer-Dependency nach.* |
| UI | **Preact + @preact/signals**, HTML/CSS-Overlay | ~6 KB |
| Tests | Vitest (nur dev) | – |
| Asset-Pipeline | `@gltf-transform/cli` (Draco/Meshopt, KTX2) – nur dev | – |
| Audio | WebAudio, synthetisiert + wenige kleine OGG | < 300 KB initial |
| Plattform | CrazyGames HTML5 SDK v3 (per `<script>` vom CDN, nicht gebündelt) | 0 KB im Bundle |

Keine weiteren Runtime-Abhängigkeiten ohne Größenbegründung im PR.

---

## 2. Verzeichnisstruktur

```
/
├─ index.html                 # lädt SDK-Script, Loader-Overlay, main.ts
├─ docs/
│  ├─ GDD.md  PLAN.md
│  └─ balancing/M1.md …       # Bot-Reports je Meilenstein
├─ ASSETS_LICENSES.md
├─ scripts/
│  ├─ check-size.mjs          # Build-Gate: initial ≤ 10 MB (Ziel) / ≤ 20 MB (hart), gesamt ≤ 250 MB, ≤ 1500 Dateien
│  ├─ compress-assets.mjs     # gltf-transform: Draco/Meshopt + KTX2
│  └─ sim-bot.ts              # headless Balancing-Bot (vite-node)
├─ public/assets/             # komprimierte GLB/KTX2/Audio (lazy)
└─ src/
   ├─ main.ts                 # Bootstrap: Platform → Save laden → Sim → Render → UI
   ├─ sim/                    # reine Logik, KEIN three.js, KEIN DOM
   │  ├─ state.ts             # GameState-Typen (serialisierbar, nur JSON-Daten)
   │  ├─ store.ts             # Store: getState, dispatch(action), subscribe
   │  ├─ actions.ts           # alle Spieler-Aktionen (discriminated union)
   │  ├─ tick.ts              # advanceDay(state, rng) – fixer Tagesschritt
   │  ├─ rng.ts               # seeded PRNG (mulberry32), im State gespeichert
   │  ├─ time.ts              # Kalender, Geschwindigkeit
   │  ├─ scoring/             # design.ts tech.ts features.ts review.ts (GDD §5)
   │  ├─ economy/             # costs.ts pricing.ts market.ts sales.ts brand.ts (GDD §6–7)
   │  ├─ development.ts       # Entwicklungspunkte & Qualität
   │  ├─ production.ts        # Garage / Fertiger / Fabrik, Lager
   │  ├─ research.ts
   │  ├─ team.ts  buildings.ts
   │  ├─ competitors.ts  events.ts  regions.ts  contracts.ts
   │  ├─ progression.ts       # Phasen-Gates, Freischaltungen
   │  ├─ goals.ts  achievements.ts
   │  ├─ offline.ts           # Offline-Fortschritt (GDD §20.1)
   │  ├─ forecast.ts          # Live-Prognose für den Editor (ruft scoring + market)
   │  ├─ save/                # serialize.ts, migrations.ts (version → version+1)
   │  └─ sim.test.ts …        # Vitest neben den Modulen (*.test.ts)
   ├─ data/                   # Content als Daten (typisiert)
   │  ├─ eras.ts  components/{chips,displays,cameras,batteries,memory,materials,finishes,extras,os}.ts
   │  ├─ research-tree.ts  competitors.ts  events.ts  regions.ts  goals.ts  achievements.ts
   │  ├─ names.ts             # Firmennamen-/Handynamen-Generator-Silben
   │  └─ i18n/{en,de}/*.json
   ├─ render/                 # three.js – liest State, schreibt nie Spiellogik
   │  ├─ renderer.ts          # WebGLRenderer, Tonemapping (AgX), PMREM RoomEnvironment
   │  ├─ quality.ts           # Low/Medium/High, FPS-Auto-Erkennung, Pixel-Ratio-Cap
   │  ├─ post/                # composer.ts, vignette.ts, tiltshift.ts
   │  ├─ loop.ts              # Render-on-demand (dirty flag), Interpolation
   │  ├─ camera/              # Kamera-Rig, Fahrten (Spline + Easing)
   │  ├─ phone/               # PhoneBuilder: Parameter → Mesh (Gehäuse, Display, Kamera-Insel, Tasten)
   │  ├─ rooms/               # garage.ts office.ts studio.ts lab.ts factory.ts store.ts showcase.ts (lazy)
   │  ├─ characters/          # stilisierte Figuren + prozedurale Animation
   │  ├─ fx/                  # Konfetti, Münzpartikel, Glanz-Sweeps
   │  └─ bridge.ts            # abonniert Store-Diffs/Sim-Events → Szenen-Updates
   ├─ ui/                     # Preact-Komponenten
   │  ├─ hud/  tabs/  editor/  launch/  welcome-back/  tutorial/  debug/
   │  ├─ format.ts            # 12,4K / 3,1M, Intl je Sprache
   │  ├─ i18n.ts
   │  └─ styles/              # Glas-Panels, Tokens
   ├─ audio/                  # synth.ts, sfx.ts, mixer.ts
   └─ platform/               # CrazyGames-Adapter
      ├─ platform.ts          # Interface: init, loading, gameplay, ads, data, happytime
      ├─ crazygames.ts        # SDK v3
      └─ stub.ts              # lokal/sonstige Umgebung; Ads = no-op
```

### Architektur-Regeln
1. `src/sim` importiert nie aus `render`, `ui`, `platform`. Erzwungen durch
   `scripts/check-boundaries.mjs` (kein ESLint nötig; prüft auch `Math.random`/`Date.now`/DOM in `sim`).
2. Der State ist **reines JSON** (keine Klassen, Maps, Dates) → triviales Speichern.
3. Sim ist **deterministisch**: gleiche Seed + gleiche Aktionen ⇒ gleicher State.
   Kein `Math.random`, kein `Date.now` in `sim/` (Echtzeit wird als Parameter übergeben).
4. Die Sim tickt in ganzen Tagen. `render/loop.ts` akkumuliert Echtzeit × Speed und ruft
   `advanceDay` auf; zwischen Tagen wird nur visuell interpoliert.
5. Sim erzeugt **Events** (`{type:'launch', …}`, `{type:'researchDone', …}`) in einer
   Queue im Tick-Ergebnis; Render/UI/Audio reagieren darauf (Juice), ändern aber nichts.
6. Render-Code enthält keine Formeln aus dem GDD – nur Darstellung.

---

## 3. Spielzustand & Speichern

```ts
interface SaveFile {
  version: number;          // Schema-Version, startet bei 1
  savedAt: number;          // Echtzeit ms (für Offline-Fortschritt)
  state: GameState;
}
```
- `migrations.ts`: Liste `[(s_v1) => s_v2, …]`; Laden wendet alle fehlenden an. Jede
  Migration hat einen Vitest mit eingefrorenem Fixture-Save.
- Speicherorte: CrazyGames `SDK.data` (Cloud) → Fallback `localStorage`. Beim Laden wird
  der neuere (`savedAt`) genommen.
- Autosave alle 30 s, bei `visibilitychange` (hidden), nach Launch/Kauf.
- Speichergröße < 200 KB (Vitrine speichert Parameter, keine Meshes).

---

## 4. Rendering-Konzept

- **Licht/Look:** AgX-Tonemapping, PMREM aus `RoomEnvironment`, 1 Key-Directional mit
  weichen PCF-Soft-Schatten (Shadow-Map 1024/2048), Hemisphere-Fill, Rim-Spot auf dem
  Drehteller. Dioramen als Schnittmodelle (Boden + 2 Wände), warme/kühle Farbtrennung.
- **Materialien:** `MeshPhysicalMaterial` – Gehäuse mit Clearcoat, Alu/Titan metallisch mit
  Anisotropie-Imitat (gebürstet via prozedurale Normal-Map aus Canvas), Glas mit
  Transmission (High) bzw. Fake-Transmission (Low/Medium).
- **Prozedurales Handy (`render/phone/`):**
  - Gehäuse: `ExtrudeGeometry` aus abgerundetem Rechteck (Eckenradius) mit Bevel.
  - Display: separates Mesh mit emissivem Canvas-Screen (Homescreen-Mock, Uhrzeit),
    Aussparung (Notch/Tropfen/Punch-Hole) als Maske im Shader.
  - Kamera-Insel: Layouts für 1–5 Linsen (Daten), Linsen mit Glas + Ring.
  - Tasten, Rahmenmaterial, Logo als Decal.
  - Parameteränderung → Tween (200–400 ms) von Alt- zu Neu-Parametern, Geometrie wird
    nur bei Formänderungen neu gebaut (debounced), Farbe/Material sofort.
- **Hero-Shot:** Drehteller mit Leuchtring, Spot + Rim, dezentes Bloom, Bodenspiegelung
  (Medium/High: `Reflector`-Ersatz via Fake-Reflexion bzw. Screen-Space nur auf High).
- **Postprocessing je Stufe:**

  | | Low | Medium | High |
  |---|---|---|---|
  | Pixel-Ratio-Cap | 1,0 | 1,5 | 2,0 |
  | Schatten | 1 Map 1024, harte Kanten | 2048 PCFSoft | 2048 PCFSoft + Kontaktschatten |
  | AO | – | GTAO 8 Samples | GTAO 16 Samples |
  | Bloom | – | ✓ | ✓ |
  | SMAA | – (FXAA-frei, MSAA aus) | ✓ | ✓ |
  | Tilt-Shift/Vignette | Vignette | ✓ | ✓ |
  | Transmission | Fake | Fake | echt |

- **Auto-Qualität:** Start auf Medium (Mobile: Low), nach 3 s FPS-Messung (Median der
  Frame-Zeiten) auf-/abstufen; max. zwei Anpassungen, dann fix; Spieler kann fixieren.
- **Tonemapping:** ACES Filmic + eigener Grade-Pass (Sättigung, sanfte S-Kurve). AgX wurde
  getestet, wirkte für den Diorama-Look zu flau.
- **Render-on-demand:** Rendering stoppt komplett bei verstecktem Tab, Ads und Menüs.
  Steht die Spielzeit still und läuft keine Animation/Eingabe seit 3 s, drosselt die
  Schleife auf ~15 FPS (Diorama bleibt lebendig, spart Akku).
- **Lazy Loading:** Jeder Raum ist ein dynamischer `import()`-Chunk; Garage + Handy +
  Editor + Launch sind im Initial-Bundle. Optionale CC0-GLBs nur ab Büro.

---

## 5. Budgets

| Budget | Ziel | Hartes Limit (Build schlägt fehl) |
|---|---|---|
| Initial-Download bis erster Frame | ≤ 10 MB (angestrebt ≤ 3 MB) | 20 MB |
| Gesamtgröße | ≤ 60 MB | 250 MB |
| Dateien | ≤ 300 | 1500 |
| JS initial (gz) | ≤ 400 KB | – (Warnung) |
| FPS | 60 Laptop / 30+ Mittelklasse-Handy | – |
| Draw Calls Garage | ≤ 150 | – |

`scripts/check-size.mjs` läuft in `npm run build` nach Vite: summiert `dist/`, ermittelt
Initial-Set (index.html + statisch importierte Chunks aus dem Vite-Manifest + Preloads),
gibt Tabelle aus, `process.exit(1)` bei Überschreitung.

---

## 6. CrazyGames-Integration

`platform.ts` Interface:
```ts
interface Platform {
  init(): Promise<void>;
  loadingStart(): void; loadingStop(): void;
  gameplayStart(): void; gameplayStop(): void;
  happytime(): void;
  requestAd(type: 'midgame' | 'rewarded'): Promise<'finished' | 'error' | 'unavailable'>;
  onAdStart(cb: () => void): void;   // Sim pausieren, Audio stumm
  data: { get(key: string): Promise<string | null>; set(key: string, v: string): Promise<void> };
  adblock: boolean;
}
```
- `crazygames.ts`: wartet auf `window.CrazyGames.SDK`, `await SDK.init()`, prüft
  `SDK.environment` (`local` / `crazygames` → echter Adapter, sonst Stub).
- Script-Tag in `index.html` (async). Fehlt das SDK (offline/Adblock) → Stub.
- `gameplayStop` bei Pause, Menüs/Modals, Ads, `visibilitychange`.
- Ad-Gate in `sim`-unabhängigem `ui/ads.ts`: Midgame-Regeln (≥ 5 min Gesamtspielzeit,
  ≥ 6 min Abstand, natürliche Pause).

---

## 7. Qualitätssicherung

- **Vitest** für `src/sim`: Formeln gegen GDD-Referenzwerte (Tabellen in GDD §5.2, §8.3),
  Determinismus-Test (2× gleiche Seed → identischer State-Hash nach 5 Spieljahren),
  Save-Roundtrip & Migrationen, Offline-Deckelung.
- **Bot-Simulation** (`npm run sim:bot`) als Pacing-Regressionstest; CI-tauglich mit
  Korridor-Assertions.
- `npm run check`: `tsc --noEmit`, ESLint (inkl. Import-Grenzen), Vitest, Build + Größencheck.
- Manuelle Testmatrix: Chrome/Edge Desktop, Chrome Android (Mittelklasse), Touch, Querformat,
  Adblock an.

---

## 8. Debug-Panel (nur `import.meta.env.DEV`)

Taste `F1` bzw. 3-Finger-Tap: Geld +, Zeitraffer x100, alle Forschung freischalten,
Phase setzen, Event auslösen, Jahr springen, Qualität erzwingen, FPS/Draw-Calls,
**Funnel-Timer** (`t_firstFrame`, `t_firstInput`, `t_launch`, `t_reward`, Ampel bei > 60 s).
Wird per Tree-Shaking aus dem Produktions-Build entfernt (geprüft im Größencheck).

---

## 9. Meilensteine

Jeder Meilenstein endet **spielbar, getestet, committet** und liefert:
Was ist fertig? · Wie teste ich es? · Bekannte Probleme · Bot-Report (`docs/balancing/Mx.md`).

### M1 – Vertical Slice (First Minute)
**Ziel:** Die komplette First Minute in finaler Grafikqualität.
- Projekt-Setup: Vite, TS strict, ESLint-Importgrenzen, Vitest, Preact, Größencheck-Skript.
- `sim`: State, Store, RNG, Kalender, Zeitsteuerung, Scoring-Kern (§5, Phase-1-Teilmenge),
  Garage-Verkauf (Made-to-Order, §7 vereinfacht: Heimatmarkt, 2007er-Konkurrenz als
  statische Attraktivität), Fans/Marke Basis, Ziele Phase 1, Save v1 + localStorage,
  Autosave.
- `render`: Renderer, PMREM, Licht, Postprocessing + Qualitätsstufen, Garage-Diorama
  (prozedural, polierte Materialien, Werkbank, Lampen, Regale, Fenster mit Licht),
  prozedurales Handy mit animierten Übergängen, Drehteller-Hero-Shot, Kamera-Rig mit
  Intro-Fahrt und Launch-Fahrt, Konfetti, Münzpartikel.
- `ui`: HUD (rollender Geldzähler, Datum, Speed), Mini-Editor (Farbe, Form, Display,
  Launch), Tutorial-Hinweise (Pfeil + Satz, überspringbar), Launch-Ergebnis mit 3
  Review-Karten, Freischaltungs-Fanfare, Ziele-Widget, i18n EN/DE, Zahlenformat.
- Audio: synthetisierte SFX für alle Aktionen.
- `platform`: Stub + CrazyGames-Grundgerüst (init, loading, gameplayStart/Stop).
- Dev: Debug-Panel mit Funnel-Timer.
- **Abnahme:** First Minute < 60 s (Funnel-Timer), Initial-Download ≤ 10 MB, 60 FPS
  Laptop / 30 FPS Handy in der Garage, Reload behält Stand, keine Platzhaltergrafik.

### M2 – Ökonomie
- Vollständige Score-Formeln, Segmente, Preiselastizität, Verkaufskurve, Lager-Basis
  (Auftragsfertiger), Hype/Marketing/Präsentation, Marke/Fans, Forschung (Baum bis ~2012,
  Datenstruktur für alles), Epochen & Erwartungen, Ziele-Generator, Teaser nach Launch,
  voller Editor rechts mit Live-Prognose, Markt-Tab mit Rangliste (statische KI).
- Offline-Fortschritt + „Willkommen zurück"-Screen, Phase-2-Gate.
- **Abnahme:** Bot erreicht Phase 2 bei 3–8 min, Phase 3-Gate bei 25–45 min.

### M3 – Team & Büro
- Bewerberpool, Einstellen/Entlassen, Training, Moral, Traits, Gehälter.
- Büro-Diorama (4 Ausbaustufen), Designstudio, Labor; stilisierte Figuren (Low-Poly,
  prozedural oder CC0) mit Tipp-/Lauf-/Idle-Animation, leuchtende Monitore.
- Entwicklungspunkte sichtbar (Fortschrittsbalken über Teams, Monitor-Inhalte).
- 7-Tage-Kalender, tägliche Mini-Aufträge.

### M4 – Fabrik
- Fabrik-Diorama mit Linien, instanzierte Handys auf Bändern, Roboterarme, Prüfstation.
- Kapazität, Linienupgrades, Qualität vs. Tempo, Ausschuss, Lagerhalle, Ausverkauf &
  Nachproduktion, Abverkauf.
- **Abnahme:** Bot Phase 3 → 4 bei 75–120 min.

### M5 – Konkurrenz, Events, Regionen, Aufträge
- 8 KI-Firmen mit Strategien, Releases, Reaktionen, News-Ticker, Rangliste.
- Event-Director mit allen Events aus GDD §13.
- Regionen, Markteintritt, Stores (Store-Diorama), Auftragsarbeiten.
- Senioren-/Gaming-Segment.

### M6 – Tech-Gigant & Endgame
- Campus, eigener Chip, eigenes OS (Installierte Basis, Lizenzen), Nebenprodukte,
  Übernahmen, Faltbar.
- Zukunftsepochen E7–E9, endlose Forschung, Ruhmeshalle, Vitrine (3D), Prestige mit
  Legacy-Boni und Szenarien, Erfolge komplett.
- **Abnahme:** Bot (Optimierer) erreicht Phase 5 bei 4–6 h, Phase 6 bei 12–18 h.

### M7 – Plattform & Politur
- SDK komplett: Midgame/Rewarded mit Regeln, Ad-Pause/Mute, Cloud-Save via `SDK.data`
  mit Konfliktauflösung, `happytime`.
- Performance-Pass (Profiling, Instancing, Draw-Call-Budget, Shader-Warmup),
  Auto-Qualität verfeinern, Mobile-Test (Touch, Querformat-Hinweis bei Hochformat).
- Größencheck final, Asset-Kompression, `ASSETS_LICENSES.md` vollständig.
- Accessibility-Basics (Farbenblind-sichere Score-Farben, Textgröße).

---

## 10. Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Grafik zu schwer für Mobile | Qualitätsstufen ab M1, Low-Stufe ohne Postprocessing, Pixel-Ratio-Cap, frühes Testen auf echtem Gerät |
| Transmission/SSAO teuer | nur High; Fake-Glas mit Env-Map + Fresnel als Standard |
| First Minute zu lang | Funnel-Timer im Dev-Overlay, harte Zeitskript-Tabelle (GDD §19), Shader-Warmup während Loader |
| Balancing driftet | Bot-Report nach jedem Meilenstein, Korridor-Assertions |
| Zahlen-Explosion im Endgame | logarithmische TI-Normalisierung ab 2045, Kurzformate bis „Qa" |
| Save-Brüche | Versionierung + Migrations-Tests mit Fixtures ab v1 |
| Bundle wächst | Größencheck im Build, Abhängigkeits-Regel, Lazy-Chunks je Raum |

---

## 11. Nächster Schritt

Nach Freigabe der offenen Punkte in GDD §25 → **M1 Vertical Slice**.
