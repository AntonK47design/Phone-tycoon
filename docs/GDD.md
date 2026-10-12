# Phone Empire 3D – Game Design Document

> Version 0.1 · Stand: Schritt 1 (vor M1)
> Alle Namen, Marken, Firmen, Chips und Betriebssysteme in diesem Dokument sind fiktiv.

---

## 0. Inhalt

1. Vision & Säulen
2. Zielgruppe, Plattform, Rahmenbedingungen
3. Zeitmodell
4. Kern-Loop im Detail
5. Formeln: Design-, Technik-, Gesamt- und Review-Score
6. Formeln: Kosten, Preise, Entwicklung
7. Formeln: Markt, Verkäufe, Hype, Marke, Fans
8. Epochen & Erwartungskurven
9. Produktion & Fabrik
10. Team & Gebäude
11. Forschung
12. KI-Konkurrenz
13. Events & Trends
14. Regionen, Stores, Aufträge
15. Late Game: eigener Chip, eigenes OS, Nebenprodukte, Übernahmen
16. Endgame & Prestige
17. Progression & Phasen-Gates
18. Ziele, Erfolge, Vitrine
19. First Minute (Skript)
20. Retention-Systeme
21. Monetarisierung (CrazyGames-Ads)
22. UI/UX-Grundsätze
23. Audio
24. Balancing-Ziele & Bot-Simulation
25. Offene Fragen & getroffene Annahmen

---

## 1. Vision & Säulen

**Elevator Pitch:** Gründe in einer Garage eine Handyfirma, designe Smartphones in einem
haptischen 3D-Editor, bring sie mit großer Show auf den Markt und wachse über Jahrzehnte
zum Tech-Giganten – vom ersten Touchscreen bis zum holografischen Display.

**Design-Säulen** (jede Feature-Entscheidung muss mindestens eine bedienen):

| Säule | Bedeutung | Konsequenz |
|---|---|---|
| **Stolz aufs eigene Design** | Das Handy ist der Star. | Hero-Shot, Live-3D-Editor, Vitrine, Ruhmeshalle. |
| **Bedeutsame Entscheidungen** | Jede Option verschiebt sichtbar Kosten, Scores, Zeit. | Live-Prognose im Editor, klare Trade-offs, keine „immer beste" Option. |
| **Ständiges Vorankommen** | Immer ein nächstes Ziel in Reichweite. | 2–3 sichtbare Ziele, Teaser nach jedem Launch, gestaffelte Freischaltung. |
| **Zeit macht alt** | Die Welt bewegt sich weiter. | Erwartungen steigen pro Epoche; ein Top-Handy veraltet. |

**Erfolgsmetriken:**
1. First-Minute-Conversion: erstes Handy designt, gelauncht, Belohnung gesehen in < 60 s.
2. Day-1-Retention: Offline-Fortschritt, laufende Projekte, Tagesbelohnungen.
3. Spielzeit 20+ h: sechs Phasen, offenes Ende, Prestige.

---

## 2. Zielgruppe, Plattform, Rahmenbedingungen

- **Plattform:** CrazyGames (Web), Chrome & Edge, Desktop + Mobile (Touch, Querformat).
- **Zielgruppe:** 13–35, Casual-bis-Midcore, Tycoon-/Idle-affin, Tech-interessiert.
- **Session-Länge:** 5–40 min, mehrmals täglich.
- **Altersfreigabe:** PEGI-12-tauglich – keine Gewalt, keine Glücksspielmechanik mit Echtgeld,
  Events wie „Skandal" bleiben harmlos (z. B. „Akku-Rückruf", „Datenpanne").
- **Sprachen:** EN + DE ab Tag 1.
- **Download:** erster spielbarer Frame ≤ 10 MB (hartes Limit CrazyGames: 20 MB initial,
  250 MB gesamt, 1500 Dateien).

---

## 3. Zeitmodell

| Einheit | Wert |
|---|---|
| 1 Spieltag bei 1x | **5 s Echtzeit** |
| 1 Woche | 7 Tage = 35 s |
| 1 Monat (Spiel) | 4 Wochen (vereinfachter Kalender, 13 Monate × 28 Tage = 364 Tage) |
| 1 Jahr | 52 Wochen ≈ 30 min bei 1x |
| Geschwindigkeiten | Pause / 1x / 2x / 4x (Dev: x100) |

- Die Simulation tickt in **ganzen Tagen** (deterministisch); der Renderer interpoliert.
- Wochenabschluss (Verkäufe, Gehälter, Lagerkosten) passiert an jedem 7. Tag.
- Bei typischem Mix aus 1x/2x/4x vergeht etwa **1 Spieljahr pro 15–20 Echtzeitminuten**.
  - 2 h Spielzeit ≈ 2013, 5 h ≈ 2022, 15 h ≈ 2050 → Zukunftsepochen tragen das Endgame.
- Spielstart: **Januar 2007** (fiktive „Ära der ersten Touchscreens").

---

## 4. Kern-Loop im Detail

```
 ┌─────────► 1. DESIGN (Editor) ──► 2. ENTWICKLUNG (Team-Punkte) ──┐
 │                                                                  ▼
 6. REINVESTIEREN ◄── 5. VERKAUF (Wochenkurve) ◄── 4. LAUNCH ◄── 3. PRODUKTION
 (Forschung, Team, Gebäude)   Reviews, Fans, Marke     Hype, Show      Stückzahl, Lager
```

### 4.1 Design (Editor)
Kategorien (werden gestaffelt freigeschaltet, siehe §17):

| Kategorie | Optionen | Wirkt auf |
|---|---|---|
| **Gehäuse** | Größe (Höhe/Breite aus Displaygröße + Rand), Dicke, Eckenradius, Material (Kunststoff → Alu → Glas → Titan → Keramik → Zukunftsmaterialien), Farbe, Finish (glänzend, matt, gebürstet, Soft-Touch, Perlmutt) | Design, Kosten, Gewicht/Dicke |
| **Display** | Diagonale, Technologie (TFT → IPS → OLED → LTPO → MicroLED → Rollbar → Holo), Auflösung, Bildrate (60–240 Hz), Aussparung (Rand, Notch, Tropfen, Punch-Hole, unter Display) | Technik, Design (Screen-to-Body), Kosten, Akkulast |
| **Hardware** | Chip (fiktive Hersteller, später eigener), RAM, Speicher, Akku (mAh), Kameras (1–5 Linsen, Sensor-Tier) | Technik, Kosten, Entwicklungspunkte |
| **Extras** | Fingerabdruck, Face-Unlock, Wasserschutz, Wireless Charging, 5G, Stylus, Faltbar, (später) Satellit, Rollbar | Feature-Bonus/Malus je Epoche, Kosten |
| **Software** | Lizenziertes OS (zwei fiktive Anbieter) oder eigenes OS | OS-Score, Lizenzkosten pro Stück |
| **Paket & Marke** | Verpackung (Basic/Premium/Öko), Name, Logo, Segment, Preis | Design-Bonus, Kosten, Markt |

Jede Wahl liefert fünf Kennzahlen: **Design-Beitrag, Technik-Beitrag, Stückkosten,
Entwicklungspunkte, benötigte Forschung.** Der Editor zeigt rechts live: Stückkosten,
Design-Score, Technik-Score, Entwicklungszeit, **Review-Prognose (±0,5)** und
**Absatzprognose (Band)**.

### 4.2 Entwicklung
Designer → Designpunkte, Ingenieure → Technikpunkte, Programmierer → Softwarepunkte.
Fortschritt ist im 3D-Büro sichtbar (Monitore zeigen CAD/Code/Schaltpläne). Formeln §6.3.

### 4.3 Produktion
Spieler wählt Stückzahl. Kapazität und Stückkosten hängen von Produktionsweg ab
(Garage → Auftragsfertiger → eigene Fabrik). Über-/Unterproduktion: Lagerkosten bzw.
„Ausverkauft" mit Nachproduktion. §9.

### 4.4 Launch
Optional: **Präsentation** (Bühne mieten → Hype), **Marketingbudget**, dann
Launch-Cinematic (Kamerafahrt, Konfetti, Vorbestellungen zählen hoch, 3 Review-Karten).

### 4.5 Verkauf
Verkaufskurve über Spielwochen (§7). Reviews (0–10) relativ zur Epoche und zum Segment.
Ergebnis: Umsatz, Fans, Markenwert, Marktanteil.

### 4.6 Reinvestieren
Forschung, Team, Gebäude, Vertrieb → nächstes Handy wird besser.

---

## 5. Formeln: Scores

Notation: `y` = aktuelles Spieljahr als Dezimalzahl (z. B. 2009,5), `y0 = 2007`,
`clamp(x,a,b)`, `log2`, `e`.

### 5.1 Technik-Index & Erwartungskurve

Alle Hardware-Werte leben auf einer gemeinsamen Skala, dem **Technik-Index** (TI).
Die **Flaggschiff-Erwartung** wächst exponentiell:

```
E_T(y) = 100 · 1.30^(y − 2007)          (≈ +30 % pro Jahr)
```

Segmente erwarten einen Anteil davon:

| Segment | Erwartungsfaktor `σ_s` | verfügbar ab |
|---|---|---|
| Budget | 0,35 | 2007 |
| Mittelklasse | 0,60 | 2007 |
| Flaggschiff | 1,00 | 2007 |
| Senioren | 0,30 (Technik), Design zählt weniger, Extras „Notruf/Großtasten" Pflicht | 2011 |
| Gaming | 1,10 für Chip/Display-Hz, 0,7 Kamera | 2017 |
| Faltbar | 1,00 + Pflicht-Extra „Faltbar" | 2019 |

Komponenten-Tiers in `src/data/components/*.ts` werden so angelegt, dass ein
Flaggschiff-Tier bei Erscheinen genau `TI = E_T(y_release)` hat, ein Mittelklasse-Tier
`0,6 · E_T`, ein Budget-Tier `0,35 · E_T`.

### 5.2 Kategorie-Rating

Für jede Technik-Kategorie `k ∈ {Chip, RAM, Speicher, Akku, Kamera, Display}`:

```
r_k = TI_k / (σ_s · E_T(y))                     relative Leistung
s_k = clamp(7 + 3 · log2(r_k), 0, 10)           Kategorie-Rating
```

| r_k | s_k | Bedeutung |
|---|---|---|
| 2,0 | 10 | zwei Jahre voraus |
| 1,3 | 8,1 | „voraus" (Forschung früh / Pionier) |
| 1,0 | 7,0 | erfüllt Erwartung |
| 0,77 | 5,9 | ein Jahr alt |
| 0,59 | 4,7 | zwei Jahre alt |
| 0,27 | 1,3 | fünf Jahre alt → „Ein Top-Handy von 2009 ist 2014 schlecht." |

**Akku** wird zusätzlich gegen den Verbrauch bewertet:
`TI_Akku_eff = TI_Akku · (Verbrauchsreferenz / Verbrauch)`, Verbrauch steigt mit
Displaygröße, Hz und Chip-Tier. So ist ein 120-Hz-Display mit kleinem Akku ein echter
Trade-off.

### 5.3 Technik-Score T

```
T = Σ_k w_k(epoch, segment, region) · s_k        mit Σ w_k = 1
```

Default-Gewichte 2007: Chip 0,25 · Display 0,25 · Akku 0,15 · Kamera 0,15 · Speicher 0,10 · RAM 0,10.
Gewichte verschieben sich je Epoche (z. B. Kamera 0,25 ab 2014) und durch Trends
(„Kamera-Hype": Kamera ×1,5, danach renormieren).

### 5.4 Design-Score D

Design-Komponenten `j` mit eigenem Rating 0–10:

| j | Berechnung | Gewicht |
|---|---|---|
| Material | `d_mat = base_mat − 0,15 · max(0, y − y_mat)` (Materialien altern langsam), min 2 | 0,25 |
| Dicke | `d_th = clamp(7 + 6 · (E_th(y) − th) / E_th(y) · 2, 0, 10)` | 0,15 |
| Screen-to-Body | `d_stb = clamp(7 + 25 · (stb − E_stb(y)), 0, 10)` | 0,20 |
| Displaygröße | `d_size = clamp(10 − 4 · |size − E_size_s(y)| , 0, 10)` (Sweet-Spot je Segment) | 0,10 |
| Farbe & Finish | Basis 6; +2 wenn Trendfarbe der Saison; +1 Premium-Finish; −1 wenn Finish nicht zu Material passt | 0,15 |
| Proportion/Harmonie | Eckenradius im Sweet-Spot relativ zur Breite, Kamera-Insel symmetrisch, Rahmen passend | 0,10 |
| Verpackung | Basic 5, Premium 8, Öko 7 (+1 ab 2019) | 0,05 |

```
D = clamp(Σ_j v_j · d_j, 0, 10)
```

Erwartungskurven (Design):

```
E_size(y)  = 3,5 + 3,2 · (1 − e^(−(y−2007)/5))      [Zoll, Flaggschiff; Budget −0,3, Senioren +0,2]
E_th(y)    = 7,2 + 5,3 · e^(−(y−2007)/5)             [mm]
E_stb(y)   = 0,93 − 0,38 · e^(−(y−2007)/6)           [Anteil Display an Front]
```

### 5.5 Feature-Anpassung F

Jedes Extra hat pro Segment ein Erwartungsjahr `y_exp,s` (§8.2).

```
fehlt, aber erwartet (y ≥ y_exp,s):          −0,4 je Feature (max −2,0)
vorhanden, aber noch nicht erwartet:          +0,35 · Innovationsfaktor (max +1,5)
   Innovationsfaktor = clamp((y_exp,s − y) / 2, 0, 1)
vorhanden und erwartet:                        0
```

### 5.6 OS-Anpassung O

```
O = (OS_score − 6) · 0,15        → Spanne ≈ −0,9 … +0,6
```
Lizenz-OS „Leafline" (kostenlos, OS_score 5), „Mosaic" (Lizenzgebühr/Stück, OS_score 7).
Eigenes OS: §15.2.

### 5.7 Gesamtwertung P

```
P = α · D + (1 − α) · T + F + O
α = α_epoch · α_segment · α_region   (Default 0,40; Flaggschiff 0,45; Budget 0,30; Senioren 0,25)
```

### 5.8 Entwicklungsqualität q

```
q_team   = clamp(0,85 + 0,25 · (Skill_Ø / Komplexität − 0,6), 0,85, 1,05)
q_polish = 1 + 0,05 · polishStufe          (Stufe 0–2, kostet +25 %/+50 % Entwicklungspunkte)
q = clamp(q_team · q_polish, 0,85, 1,10)
```
`Komplexität` = Summe der Komponenten-Komplexitäten / Referenz der Epoche (≈ 1,0 für
ein Durchschnittshandy der Epoche). Niedriges q erzeugt „Bugs"-Review-Kommentare.

### 5.9 Preis-Leistung V

```
P_fair = anchor_s(y) · (P / 7)^1,6                 fairer Preis für dieses Handy
V = clamp(1,2 · log2(P_fair / price), −2,0, +1,0)
anchor_s(y) = anchor_s(2007) · 1,02^(y − 2007)     (Inflation 2 %)
```

| Segment | anchor 2007 |
|---|---|
| Budget | 149 |
| Mittelklasse | 299 |
| Flaggschiff | 599 |
| Senioren | 199 |
| Gaming | 699 |
| Faltbar | 1 499 |

Währung: neutrales `$`, Formatierung lokalisiert (`12.4K` / `12,4K`).

### 5.10 Hype-Malus H_pen

```
erwartetes Review aus Hype:  R_hype = 5 + 4 · Hype/100
H_pen = 0,3 · max(0, R_hype − P · q)
```
Übertriebener Hype bei schwachem Produkt kostet Review-Punkte und Fans (§7.5).

### 5.11 Review-Score R

```
R = clamp(P · q + V − H_pen, 0, 10)       auf 0,1 gerundet, angezeigt als x,x / 10
```

**Review-Karten:** 3 fiktive Magazine (z. B. „Pocket Byte", „Gadgetwelt", „TechBlitz")
mit Bias und Fokus:

```
R_i = clamp(R + bias_i + f_i · (D − T) · 0,15 + N(0, 0,3), 0, 10)    gerundet auf 0,5
```
Jede Karte zeigt die Note und einen Satz, generiert aus den stärksten/schwächsten
Teilwerten (Vorlagen in `src/data/i18n/*/reviews.json`).

### 5.12 Aktueller Score über die Zeit

Reviews sind bei Launch fix. Für den laufenden Verkauf zählt der **aktuelle** Score:
```
R_cur(y_now) = clamp(R − (P(y_launch) − P(y_now)), 0, 10)
```
`P(y_now)` wird jede Woche gegen die aktuelle Erwartungskurve neu berechnet →
Handys veralten automatisch.

---

## 6. Formeln: Kosten, Preise, Entwicklung

### 6.1 Stückkosten

```
c_comp(y) = c0 · max(0,25, e^(−0,25 · (y − y_release)))      Bauteile werden ~22 %/Jahr billiger
Stückkosten = (Σ c_comp + c_material + c_finish + c_pack + c_assembly + c_license_os)
              · volumeDiscount
volumeDiscount = clamp(1 − 0,08 · log10(Charge / 1 000), 0,75, 1,0)
```

### 6.2 Preisempfehlung
Der Editor schlägt `P_fair` vor (§5.9) und zeigt Marge, Break-Even-Stückzahl und
Prognose bei ±20 % Preis (kleine Sparkline).

### 6.3 Entwicklungspunkte

Jede Komponente hat Punkte-Kosten (Design / Technik / Software). Benötigt:
```
Req_type = Σ Komponentenpunkte_type · (1 + 0,25 · polishStufe)
Punkte/Tag je Mitarbeiter = Skill/10 · Moral (0,7–1,2) · Bürobonus (1,0–1,6) · Spezialisierung
Gründer (Garage) = 2 Punkte/Tag in jedem Typ
Entwicklungszeit = max_type(Req_type / Σ Punkte/Tag_type)
```
Referenz: Ein Mittelklasse-Handy 2008 braucht ≈ 30/30/20 Punkte → mit 3 Mitarbeitern
(Skill 30) ≈ 10 Tage (≈ 50 s bei 1x). Spätere Handys: 4–10 Wochen.

---

## 7. Formeln: Markt, Verkäufe, Hype, Marke, Fans

### 7.1 Marktgröße (Einheiten pro Woche, weltweit)

```
M(y) = 50 000 + 12 000 000 / (1 + e^(−0,6 · (y − 2012,5))) · (1 + 0,01 · max(0, y − 2020))
```
2007 ≈ 0,48 M/Woche · 2010 ≈ 2,2 M · 2015 ≈ 9,8 M · 2020 ≈ 12 M · danach +1 %/Jahr.

### 7.2 Segmentanteile `m_s(y)` (Anteil an M)

| Jahr | Budget | Mittel | Flaggschiff | Senioren | Gaming | Faltbar |
|---|---|---|---|---|---|---|
| 2007 | 0,45 | 0,35 | 0,20 | – | – | – |
| 2011 | 0,42 | 0,33 | 0,20 | 0,05 | – | – |
| 2017 | 0,38 | 0,32 | 0,20 | 0,05 | 0,05 | – |
| 2019 | 0,36 | 0,31 | 0,20 | 0,05 | 0,05 | 0,03 |
| 2030 | 0,30 | 0,30 | 0,20 | 0,06 | 0,06 | 0,08 |

Zwischenjahre linear interpoliert. Regionen (§14) haben eigene Mischungen.

### 7.3 Attraktivität und Marktanteil

Für jedes Produkt `i` (Spieler und KI) in Segment `s`, Region `r`, Woche `t` seit Launch:

```
A_i = (R_cur,i / 10)^κ                       κ = 3  (Qualität dominiert)
    · (P_ref,i / price_i)^ε_s                Preiselastizität
    · BrandF_i
    · MktF_i(t)
    · Life_i(t)
    · Fit_i,r                                 Regionspassung (0,7 – 1,3)

P_ref,i = anchor_s(y) · (P_i / 7)^1,6         (= P_fair)
ε_s:  Budget 2,2 · Mittel 1,6 · Flaggschiff 1,1 · Senioren 1,8 · Gaming 1,3 · Faltbar 0,9

share_i = A_i / (A_0,s + Σ_j A_j)             A_0,s = Restmarkt (No-Name/Feature-Phones), 1,5 → 0,3 bis 2015
Units_i,r(t) = M(y) · m_s · m_r · ρ_i,r · share_i
```

**Reichweite `ρ`** (Vertrieb) ist der wichtigste Progressionshebel für Absatzmengen:

| Stufe | ρ |
|---|---|
| Garage (Onlineshop) | 0,0025 |
| Startup-Büro | 0,0025 |
| + Händlerpartner (Forschung) | 0,0035 |
| + Mobilfunker-Deals | 0,0055 |
| + Landesweiter Vertrieb | 0,008 |
| Region erschlossen | 0,25 |
| + eigene Stores | +0,05 je Store, max 0,75 |
| Global (Phase 5) | bis 1,0 |

KI-Konkurrenten haben eigene `ρ` (0,3–1,0).

### 7.4 Lebenszyklus & Hype

```
Life(t) = (1 + h · e^(−t/2)) · e^(−t/τ_life)       τ_life = 40 Wochen
h = 1,5 · Hype/100                                 Launch-Spitze
MktF(t) = 1 + 0,6 · Hype(t)/100
Hype(t+1) = 0,9 · Hype(t) + laufendes Marketing
```

**Hype-Aufbau vor Launch:**
```
ΔHype_Marketing = 25 · log2(1 + Budget / C_m(y))      C_m(y) = 5 000 · M(y)/M(2007) · max(ρ, 0,01)/0,01
ΔHype_Präsentation = Bühnenstufe (10/20/30) · (0,5 + 0,1 · Innovationen)
Hype ≤ 100
```

**Vorbestellungen beim Launch** (sofortiger Geld-Moment in der Cinematic):
```
Preorders = Fans · 0,2 · (R/10) · (1 + Hype/100) + Units(t=0)
```

### 7.5 Fans & Marke

```
Fans += Units_verkauft · 0,05 · max(0, R − 5)            pro Woche
Fans −= Fans · 0,02                                        pro Monat
bei H_pen > 0:  Fans −= Fans · 0,1 · H_pen

Markenwert B ∈ [0, 100]:
  nach jedem Launch: B += k · (10 · R − B),  k = 0,25 wenn 10R > B, sonst 0,35
  Marketing: +0,02 · ΔHype pro Woche
  Events/Skandale: direkt
BrandF = 0,4 + 1,2 · B/100                                (0,4 … 1,6)
```

### 7.6 Lager, Ausverkauf, Nachproduktion

```
verkauft = min(Nachfrage, Lagerbestand)
Rückstau = 0,3 · (Nachfrage − verkauft)   bleibt 2 Wochen bestehen, Rest verloren
Lagerkosten/Woche = Bestand · Stückkosten · 0,005 + Überlauf · Stückkosten · 0,01
Abverkauf (Produkt vom Markt nehmen): Restbestand zu 40 % der Stückkosten
```
UI-Signal „Ausverkauft!" mit 1-Klick-Nachproduktion.

### 7.6b Händleranteil, Kredit (seit M2)

```
Erlös je Einheit = Preis · (1 − Händleranteil)     Onlineshop 10 %, Händler 25 %, Mobilfunker 30 %
Bankkredit: fällt Kapital < 0, springt die Bank ein (Puffer 15K $); Zinsen 0,2 %/Woche.
            Tilgung (seit M3) wöchentlich: max(25 % des Wochengewinns, Kapital − Reserve),
            Reserve = max(1,5 · 15K $ · Inflation, 4 Wochen laufende Kosten).
            Zusätzlich manuelle Tilgung im Firmen-Tab.
Kreditrahmen für Produktion = 40K $ · Inflation + 10 % des Jahresumsatzes − Schulden.
            Eine Mindest-Charge (100 Stück) wird immer finanziert → kein Deadlock.
Auftragsfertiger: Stückkosten · 1,2 + Montage 12 $, Lieferzeit 14 Tage, Mindestcharge 100.
Betriebskosten (ab Büro): 12 % des Wochenumsatzes (Support, Logistik, Garantie).
Auto-Preis = max(0,85 · P_fair, Stückkosten / (1 − Händleranteil) · 1,3).
Laborbudget: je 2 500 $ · Inflation pro Woche +1 Forschungspunkt/Tag (zusätzlich zu 4 FP des Gründers).
```

### 7.7 Marktanteil & Rangliste
Marktanteil = verkaufte Einheiten der letzten 52 Wochen / Gesamtmarkt der letzten 52 Wochen.
Rangliste: Spieler + 8 KI-Firmen, sortiert nach Marktanteil; Nebenansichten: Umsatz,
Markenwert, Ø-Review.

### 7.8 Firmenbewertung (für Gates & Prestige)
```
Valuation = Cash + 4 · Gewinn(letzte 52 Wochen) + 2 000 · B · sqrt(M(y)/M(2007)) + 0,5 · Gebäude/Assets
```

---

## 8. Epochen & Erwartungskurven

### 8.1 Epochentabelle

| Epoche | Jahre | Thema | α_epoch | Gewichts-Shift | Trendfarben (Beispiele) | Neue Tech (Forschung) |
|---|---|---|---|---|---|---|
| E1 Touch-Pioniere | 2007–2009 | erste Kapazitiv-Displays | 0,40 | Display ↑ | Schwarz, Weiß, Silber | Kapazitiv-Touch, 3G, 2-MP-Kamera |
| E2 App-Boom | 2010–2012 | Apps, Frontkamera | 0,40 | Chip ↑ | Weiß, Rot | IPS, Dual-Core, Frontkamera, Alu |
| E3 Phablets | 2013–2015 | große Displays, Fingerabdruck | 0,42 | Display, Akku ↑ | Gold, Roségold | OLED, 4G, Fingerabdruck, Glasrücken |
| E4 Randlos | 2016–2018 | Notch, Dual-Kamera | 0,45 | Kamera ↑ | Mitternachtsblau, Verlauf | Notch, Dual-/Triple-Kamera, Wasserschutz, Wireless Charging, Face-Unlock |
| E5 Vernetzt | 2019–2022 | 5G, Faltbar, Punch-Hole | 0,45 | Kamera, Konnektivität ↑ | Pastell, Grün | 5G, Faltbar, 120 Hz, Titan |
| E6 Smart-KI | 2023–2027 | On-Device-KI, Satellit | 0,45 | Chip (KI) ↑ | Naturtöne, Titanfarben | KI-Kern, Satellit, LTPO, Keramik |
| E7 Rollbar | 2028–2034 | rollbare Displays | 0,50 | Display ↑ | Holo-Schimmer | Rollbar, Festkörperakku, Unter-Display-Kamera |
| E8 Holo | 2035–2044 | holografische Projektion | 0,50 | Display, Design ↑ | Chrom, Transparent | Holo-Display, Transparentgehäuse |
| E9 Neural (offen) | 2045+ | Gedankensteuerung (sanft, PEGI-12), Nano-Materialien | 0,55 | frei | prozedural | Endlos-Forschung (§16) |

### 8.2 Feature-Erwartungsjahre `y_exp,s`

| Feature | Budget | Mittel | Flaggschiff |
|---|---|---|---|
| Kapazitiv-Touch | 2010 | 2008 | 2007 |
| Frontkamera | 2013 | 2011 | 2010 |
| Fingerabdruck | 2017 | 2015 | 2014 |
| Wasserschutz | 2021 | 2018 | 2016 |
| Wireless Charging | – | 2021 | 2018 |
| Face-Unlock | 2022 | 2019 | 2018 |
| 5G | 2023 | 2021 | 2020 |
| Satellit | – | 2030 | 2025 |
| Stylus, Faltbar | nie erwartet (nur Bonus; Faltbar Pflicht im Segment Faltbar) |

### 8.3 Erwartungswerte (Referenz)

| Jahr | E_T (Flaggschiff) | E_size (″) | E_th (mm) | E_stb |
|---|---|---|---|---|
| 2007 | 100 | 3,5 | 12,5 | 0,55 |
| 2010 | 220 | 4,9 | 10,1 | 0,70 |
| 2014 | 627 | 5,9 | 8,5 | 0,81 |
| 2018 | 1 792 | 6,3 | 7,8 | 0,87 |
| 2022 | 5 119 | 6,5 | 7,5 | 0,90 |
| 2030 | 41 754 | 6,7 | 7,3 | 0,92 |

(Ab 2045 wird der Technik-Index intern logarithmisch normalisiert, um Fließkomma-Überlauf
und unlesbare Zahlen zu vermeiden; die UI zeigt nur Ratings.)

---

## 9. Produktion & Fabrik

### 9.1 Produktionswege

| Weg | Freischaltung | Kapazität | Montage/Stück | Vorlauf | Mindestmenge |
|---|---|---|---|---|---|
| Garage (Handarbeit, Made-to-Order) | Phase 1 | 50/Woche | 18 $ | 0 | 0 – kein Lagerrisiko |
| Auftragsfertiger | Phase 2 | unbegrenzt | 12 $ · 1,25 Aufschlag | 2 Wochen | 500 |
| Eigene Fabrik | Phase 3 | je Linie | `12 · 0,85^(L−1)` $ | 0 | 0 |

### 9.2 Fabriklinien
```
Kapazität/Tag je Linie = 300 · L^1,5            L = Linienstufe 1–10
Ausschussrate d = (4 % − 0,35 % · (L−1)) · Tempofaktor
Tempo-Regler: Qualität (0,8× Tempo, 0,5× Ausschuss) · Normal · Tempo (1,3×, 2× Ausschuss)
Ausschuss kostet Stückkosten und senkt R_cur um 0,1 je 2 % Ausschuss (Kundenrückläufer)
Linienupgrade-Kosten = 50 000 · 2,2^(L−1) · Inflation
```
Max. Linien: Kleine Fabrik 2, Fabrik 4, Megafabrik 8, (Phase 5) Werke in Regionen.

**Lagerhalle:** Kapazität 10 000 · 3^Stufe Einheiten, darüber Überlaufkosten (§7.6).

### 9.3 3D-Darstellung
Fließbänder mit instanzierten Handys (zeigen das aktuell produzierte Modell und dessen
Farbe), Roboterarme, Prüfstation mit Ausschuss-Rutsche. Linienstufe sichtbar (mehr
Roboter, schnellere Bänder).

---

## 10. Team & Gebäude

### 10.1 Rollen
| Rolle | Erzeugt | Freischaltung |
|---|---|---|
| Designer | Designpunkte | Phase 2 |
| Ingenieur | Technikpunkte, im Labor: Forschungspunkte | Phase 2 |
| Programmierer | Softwarepunkte, OS-Qualität | Phase 2 |
| Marketing | +Hype-Effizienz (+5 %/Kopf), Fans | Phase 2 (2. Büro-Stufe) |
| Produktionsleiter | Ausschuss −10 %, Tempo +5 % je Linie | Phase 3 |
| Forscher (Labor) | Forschungspunkte ×1,5 | Phase 3 |
| Manager | Moral +, Gehaltsverhandlung | Phase 4 |

### 10.2 Werte
```
Skill 1–100 (Start-Pool: 10–40; besser in späteren Phasen und mit Ruf)
Gehalt/Woche = (300 + 25 · Skill) · 1,02^(y−2007)
Einstellungsgebühr = 2 Wochengehälter
Moral 0–100 → Faktor 0,7 + 0,5 · Moral/100
   Moral sinkt bei Crunch (Polish 2 hintereinander), steigt mit Bürokomfort, Erfolgen, Boni
Training: Kosten 4 Wochengehälter, 2 Wochen Abwesenheit, Skill += 8 · (1 − Skill/120)
Traits (1 je Person, kosmetisch + kleiner Effekt): „Perfektionist" (+q, −Tempo), „Schnell" usw.
```

### 10.3 Gebäude

| Gebäude | Stufen | Effekt | Erste Kosten |
|---|---|---|---|
| Garage | 1 | Start, 1 Platz (Gründer) | – |
| Startup-Büro | 1–4 | 4/8/14/24 Plätze, Bürobonus 1,0/1,1/1,25/1,4 | 25 000 |
| Designstudio | 1–3 | Designpunkte +20/35/50 %, schaltet Materialien/Finishes frei | 250 000 |
| Labor | 1–4 | Forschung +25 % je Stufe, Pionier-Forschung | 150 000 |
| Fabrik | 1–3 (+ Linien) | §9 | 400 000 |
| Store | je Region × n | Reichweite, Marke, Vitrinen-Raum | 1 000 000 |
| Campus (Phase 5) | 1–3 | alle Boni +, Chip-/OS-Abteilung | 50 000 000 |

Kosten skalieren mit Inflation. Laufende Kosten: Miete 1 %/Woche des Kaufpreises.

### 10.4 Umsetzung M3 (Zahlen nach Bot-Balancing)

```
Rollen ab Büro 1: Designer (Design), Ingenieur (Technik), Programmierer (Software),
                  Forscher (FP); Marketing ab Büro 2 (+5 % Hype je Ø-Kopf, max. +60 %).
Punkte/Tag je Person = Skill/10 · Moralfaktor · Bürobonus · Trait-Tempo
                       (+ Gründer 2/2/2 Punkte und 4 FP; Studio ×1,2–1,5 Design, Labor ×1,25–1,75 FP)
Entwicklungspunkte ab Büro = 3 × Garagenwert (Büro-Handys sind ambitionierter → Team lohnt sich)
Qualität q = clamp(1 + 0,3 · (Skill_Team / Skill_erwartet − 1), 0,90, 1,08)
             Skill_erwartet(y) = min(95, 30 + 2,5 · (y − 2007)), Gründer zählt mit Skill 30
Studio-Feinschliff: +0,1/0,2/0,3 Review-Punkte
Büro-Stufen: Preis 25K/120K/600K/3M, Miete 3K/7K/18K/45K pro Woche, Komfort +0/5/10/15 Moral
Labor 150K/500K/2M, Studio 250K/800K/3M (Miete 1 %/Woche), beide ab Büro-Stufe 2
Bewerber: 4, neu jede Woche; Skill = 10 + min(45, Marke/4 + 2,5 · Jahre) + 0–30
Moral-Ziel = 58 + Komfort + Sonnenscheine (max. 10) + Bonus + 10 · Erfolg letzter Launch
             − 8 bei Schulden & knapper Kasse; Moral nähert sich wöchentlich um 30 %;
             unter 25 kündigen Leute mit 25 %/Woche.
Bonus: 1 Wochen-Gehaltssumme, +20 Moral-Ziel (klingt ab), Cooldown 4 Wochen
Entlassen: 1 Wochengehalt Abfindung, −4 Moral für alle
Traits: Flink (+15 % Tempo, −Qualität), Perfektionist, Nachteule, Sonnenschein, Bescheiden, Mentor
```

7-Tage-Kalender (§20.3): Belohnung max(Basis 500…4 000 $ · Inflation, 0,5 · Ø-Wochenumsatz ·
0,5…1,5); Tag 7 schaltet einmalig das Aurora-Finish frei. Mini-Aufträge (§20.4): 3 pro
Echtzeittag, deterministisch aus Datum + Seed (verkaufen, Umsatz, Launch ≥ X, Forschung,
Einstellen, Training, Nachbestellen); Belohnung Geld (max(1 500 $, 0,3 · Ø-Wochenumsatz)) oder Hype.

---

## 11. Forschung

- **Forschungspunkte (RP)/Tag** = Σ Ingenieure/Forscher im Labor · Skill/20 · Laborbonus.
  Gründer in Phase 1: 0 (Forschung erst ab Phase 2).
- **Baum:** 11 Äste: Display, Chip, Speicher, Akku, Kamera, Gehäuse/Material,
  Konnektivität, Software/OS, Produktion, Marketing/Vertrieb, Business.
  ca. 160 Knoten bis 2045, danach endlose Stufen.
- **Kosten** Knoten n im Ast: `RP = 40 · 1,22^n`, Geld = `RP · 25 · Inflation`.
- **Epochen-Gate:** Knoten mit Release-Jahr `y_i` ist ab `y_i − 1` erforschbar.
  Pionier-Kosten: `× (1 + 1,5 · max(0, y_i − y))`. Pionier-Tech gibt `r > 1` → hohe Reviews.
- Max. 1 parallele Forschung (Phase 2), 2 (Labor 2), 3 (Campus).
- Abgeschlossene Forschung wird mit „Neu!"-Badge im Editor markiert und angeteasert:
  „Noch 1 Forschung bis OLED!".

---

## 12. KI-Konkurrenz

8 fiktive Firmen (Namen final in `src/data/competitors.ts`):

| Firma | Strategie | Segmente | Tech-Aggressivität τ | Kadenz | Start-Marke | ρ |
|---|---|---|---|---|---|---|
| **Tellmark** | Alter Riese (Tastenhandys), verschläft Touch | Budget, Mittel | 0,75 → fällt | 52 Wo. | 85 | 1,0 |
| **Novaphone** | Premium-Innovator | Flaggschiff | 1,10 | 52 Wo. | 40 | 0,4 → 1,0 |
| **Kitecell** | Budget-Flutung | Budget | 0,9 | 20 Wo. | 30 | 0,6 |
| **Orbis Mobile** | Fast Follower (kopiert Bestseller-Features) | alle | 0,95 | 26 Wo. | 50 | 0,8 |
| **Sunpeak** | Kamera-Spezialist | Mittel, Flaggschiff | 1,0 (Kamera 1,3) | 39 Wo. | 25 | 0,4 |
| **Lumo** | Design-Haus | Mittel, Flaggschiff | 0,9, Design +1,0 | 39 Wo. | 20 | 0,3 |
| **Vantor** | Gaming-Nische (ab 2016 stark) | Gaming, Mittel | 1,05 Chip/Hz | 30 Wo. | 15 | 0,3 |
| **Pebblecom** | Regionalchampion Asien, Preisbrecher | Budget, Mittel | 0,95 | 26 Wo. | 35 | 0,5 (Asien 1,0) |

KI-Produktgenerierung:
```
P_ai = 7 + 3 · log2(τ · (1 + 0,1 · Budgetstärke)) + DesignBias + N(0, 0,35)
R_ai = clamp(P_ai + V_ai, 0, 10)        Preise nahe anchor · (P_ai/7)^1,6 · Preisstrategie
```
- KI-Budgets wachsen mit ihrem Umsatz; schlechte Jahre senken τ (Abwärtsspirale möglich).
- KI-Firmen reagieren: Wenn der Spieler ein Segment dominiert (> 30 %), senkt die Nr. 2
  dort Preise um 10–15 %.
- **Übernahme** (Phase 5): Firma mit Marke < 20 und Valuation < 25 % der eigenen kaufbar →
  Marktanteil, Fans, Patente (Forschung).
- Launches der KI werden als News-Ticker und kleine 3D-Karte im Markt-Tab gezeigt.

---

## 13. Events & Trends

Pro Woche würfelt der Event-Director (seeded RNG) mit Cooldowns; max. 1 großes Event
gleichzeitig. Alle Events zeigen eine Karte mit Wahl oder Countdown.

| Event | Bedingung | Wahrscheinlichkeit/Woche | Wirkung | Dauer |
|---|---|---|---|---|
| Chipmangel | ab 2009 | 0,4 % | Chipkosten +40 %, Fertigerkapazität −30 %; Wahl: teuer einkaufen / Lager nutzen / warten | 12–20 Wo. |
| Kamera-Hype | ab 2012 | 0,5 % | Kamera-Gewicht ×1,5 | 26 Wo. |
| Rezession | ab 2008 | 0,2 % | M −15 %, ε +0,3 (preissensibler) | 30–52 Wo. |
| Konkurrenz-Skandal | KI-Firma launcht | 0,3 % | deren Marke −20, Spieler-Chance +Fans | 8 Wo. |
| Eigener Rückruf | Ausschuss > 5 % | abh. Ausschuss | Wahl: Rückruf (Kosten, Marke stabil) / ignorieren (Marke −15) | sofort |
| Messe-Einladung | Marke > 30 | 1 %/Quartal | Präsentation zum halben Preis, Hype +20 | 4 Wo. |
| Influencer-Review | Launch | 5 % je Launch | Hype +15 | – |
| Farbtrend | jedes Jahr | fix | neue Trendfarben | 52 Wo. |
| Starmitarbeiter bewirbt sich | Phase 2+ | 1 %/Monat | Skill 70+ Kandidat, 2 Wochen Frist | 2 Wo. |
| Zollstreit | Phase 4, Regionen | 0,2 % | Kosten in Region +15 % | 26 Wo. |
| Patentstreit | Phase 5 | 0,2 % | Wahl: Lizenz zahlen / vor Gericht (Münzwurf gewichtet nach Forschungsstand) | – |
| Tech-Durchbruch | Forschung | 0,5 % | eine laufende Forschung −50 % | – |

Trends verschieben Gewichte `w_k`, `α`, Segmentanteile oder Farben, nie mehr als ±30 %.

---

## 14. Regionen, Stores, Aufträge (Phase 4)

### 14.1 Regionen

| Region | m_r (Anteil am Weltmarkt) | α-Mod. | Preissensibilität | Vorlieben | Markteintritt |
|---|---|---|---|---|---|
| Heimatmarkt Nordamerika | 0,18 | 1,0 | 1,0 | Flaggschiff, OS-Qualität | Start |
| Europa | 0,20 | 1,1 | 1,1 | Design, Öko-Verpackung, Akku | 2 M$ |
| Asien-Pazifik | 0,40 | 0,9 | 1,2 | Kamera, Hz, Budget-Mittel | 5 M$ |
| Lateinamerika | 0,10 | 1,0 | 1,4 | Budget, Akku | 1,5 M$ |
| Afrika & Nahost | 0,12 | 0,9 | 1,5 | Budget, Akku, Robustheit (Wasserschutz) | 1,5 M$ |

`Fit_i,r = 0,7 … 1,3` aus Vorlieben-Übereinstimmung (gewichtete Kosinus-Ähnlichkeit
zwischen Handy-Profil und Regionsprofil). Phase 1–3 verkaufen nur im Heimatmarkt.

### 14.2 Eigene Stores
Pro Store: Reichweite +0,05 in Region, Marke +2 (einmalig), Fans +, Miete/Woche.
Store-Diorama mit Vitrinen zeigt die eigenen Handys.

### 14.3 Auftragsarbeiten (schnelles Geld)
Kunden (Mobilfunker, Firmen, Behörden – fiktiv) schreiben aus:
```
Anforderung: Segment, min. Review-Score X, max. Stückkosten C, N Einheiten bis Woche W
Auszahlung = N · C · (1,3 … 1,8) + Bonus bei Score-Übererfüllung
Strafe bei Verspätung: −10 %/Woche
```
Nutzt den normalen Editor mit eingeblendeten Grenzen. Max. 3 Angebote gleichzeitig.

---

## 15. Late Game (Phase 5)

### 15.1 Eigener Chip
- Chip-Abteilung im Campus; Chipprojekte wie Handyentwicklung (Technikpunkte).
- `TI_chip = E_T(y) · (0,9 + 0,05 · Chip-Stufe + 0,1 · Pionierforschung)` (max 1,4),
  Kosten 0,6 × Marktchip gleicher Stufe.
- Verkauf an KI-Firmen: Lizenzumsatz = deren Einheiten · Gebühr, wenn ihr TI-Vorteil ≥ 5 %.

### 15.2 Eigenes OS
```
Installierte Basis U = Σ verkaufte Geräte mit eigenem OS · e^(−Alter/156 Wochen)
App-Ökosystem E = 10 · U / (U + 20 M)
OS_score = 0,5 · OS-Qualität (Programmierer-Punkte, 0–10) + 0,5 · E
Lizenzeinnahmen = Σ Lizenznehmer-Einheiten · Gebühr     (KI übernimmt OS ab OS_score ≥ 7,5 und Gebühr < Mosaic)
```
Henne-Ei-Problem ist gewollt: Ein eigenes OS ist anfangs schlechter als Mosaic.

### 15.3 Nebenprodukte
Smartwatch, Earbuds, Tablet – vereinfachter Editor (3–5 Parameter), gleiche Score-Logik
mit eigenen Erwartungskurven. Absatz:
```
Units_side = Fans · Attach-Rate_typ · (R_side/10)^2 · Preisfaktor
Attach-Rate: Watch 0,08, Earbuds 0,15, Tablet 0,05
Ökosystem-Bonus: alle drei Kategorien aktiv → A_phone ×1,05, Fans-Bindung +
```

### 15.4 Übernahmen
Siehe §12. Übernommene Firma → wird Sub-Marke (eigene Segment-Linie mit deren Marke).

---

## 16. Endgame & Prestige (Phase 6)

- **Zukunftstechnologien** (E7–E9): Rollbar, Holo, Festkörperakku, Transparentgehäuse,
  Nano-Materialien; ab 2045 **endlose Forschungsstufen** (`RP = Basis · 1,15^n`,
  +2 % TI je Stufe).
- **Ruhmeshalle:** beste Reviews, meistverkaufte Handys, Rekorde, Meilensteine – 3D-Galerie.
- **Neue Firma gründen (Prestige):**
  ```
  Legacy-Punkte LP = floor(sqrt(Peak-Valuation / 10 M$))
  Boni (kaufbar mit LP): Startkapital ×(1 + 0,25·n), Forschung +5 %/Stufe,
       Startmarke +5, ein Gebäude vorgebaut, Skill-Pool +10, Designteile vorfreigeschaltet
  ```
  **Szenarien** (freigeschaltet durch Erfolge): „Spätstart 2016", „Dauerrezession",
  „Nur Budget", „Kein Marketing", „Asien-Start", „Speedrun auf 10 % Marktanteil".
- Vitrine und Ruhmeshalle bleiben über Prestige erhalten (Stolz-Säule).

---

## 17. Progression & Phasen-Gates

| Phase | Ziel-Spielzeit | Gate zum Betreten | Neu freigeschaltet |
|---|---|---|---|
| **1 Garage** | 0–5 min | Start (Startkapital 2 000 $) | Mini-Editor (Farbe, Form-Preset, Displaygröße, Preis-Preset), Garage-Produktion, Launch |
| **2 Startup-Büro** | 5–30 min | 2 Launches **und** 25 000 $ → Büro mieten | Team, Forschung, Marketing, Präsentation, Editor: Material, Hardware-Tiers, Auftragsfertiger, Segmentwahl |
| **3 Designstudio + Fabrik** | 30–90 min | Valuation 1 M$ **und** Marke ≥ 25 | Designstudio, Labor, eigene Fabrik, Lager, Qualität vs. Tempo, Extras, Finish, volle Zeitsteuerung-Ziele |
| **4 Expansion** | 2–5 h | kumulierter Umsatz 25 M$ **und** 10 Launches | Regionen, Stores, Auftragsarbeiten, Events voll, Senioren-/Gaming-Segment |
| **3-Gate (M2)** | – | Firmenwert 10 M$ **und** Marke ≥ 35 (ersetzt 1 M$/25 nach Bot-Balancing) | – |
| **5 Tech-Gigant** | 5–15 h | Valuation 1 Mrd $ **oder** Marktanteil 10 % | Campus, eigener Chip, eigenes OS, Nebenprodukte, Übernahmen |
| **6 Endgame** | 15 h+ | Marktanteil 20 % **oder** Jahr ≥ 2035 **und** Valuation 50 Mrd $ | Zukunftstech, Ruhmeshalle, Prestige, Szenarien |

Freischaltungen erscheinen mit kurzer Fanfare und einem kontextuellen Hinweis; nie mehr
als **eine neue UI-Fläche pro Freischaltung**.

Editor-Freischaltung (Auszug):
- Phase 1: 4 Optionen (Farbe, Form-Preset, Displaygröße, Preis-Preset)
- Phase 2: + Material, Chip, Speicher, Kamera-Tier, Segment, freier Preis, Name
- Phase 3: + Dicke, Eckenradius, Finish, Extras, Display-Tech/Hz, Aussparung, Akku, Verpackung
- Phase 4: + Regionen-Fokus, Logo-Editor
- Phase 5: + eigener Chip, eigenes OS, Faltbar
- Phase 6: + Zukunftsformfaktoren

---

## 18. Ziele, Erfolge, Vitrine

### 18.1 Ziele
Immer 2–3 sichtbare Ziele (oben links, einklappbar), mit Fortschrittsbalken und
Belohnung (Geld, RP, Hype, kosmetische Farbe). Ziel-Generator: feste Story-Ziele pro Phase
+ dynamische Ziele (Lücke zum nächsten Gate, schwächste Kategorie verbessern,
„Erreiche Review ≥ 8").

Beispiele Phase 1–2: „Launche dein erstes Handy" → „Verdiene 10 000 $" → „Launche ein
zweites Handy" → „Miete ein Büro" → „Stelle deinen ersten Ingenieur ein" → „Erforsche
Alu-Gehäuse" → „Erreiche Review 7,0".

### 18.2 Erfolge (Achievements)
~60 Erfolge, z. B. „Garagenwunder" (Review ≥ 8 in Phase 1), „Ausverkauft!",
„Zehn Millionen", „Perfekte 10", „Zeitreisender" (Pionierforschung 2 Jahre voraus),
„Underdog" (Tellmark überholt). Große Erfolge rufen `happytime()` auf.

### 18.3 Vitrine
3D-Raum (lazy geladen) mit Sockeln für jedes eigene Handy: Modell, Name, Jahr, Review,
verkaufte Einheiten, Umsatz. Antippen → Hero-Shot-Drehteller. Teilbares Screenshot-Bild
(lokaler Download, keine externen Links).

---

## 19. First Minute (Skript)

**Ziel: < 60 s vom ersten Frame bis „Belohnung gesehen + nächstes Ziel sichtbar".**

| Zeit | Was passiert | Spieler-Aktion |
|---|---|---|
| 0 s | Ladebalken (≤ 10 MB), `loadingStart` | – |
| ~3 s | 3D-Garage erscheint, Kamera fährt auf Drehteller mit grauem Rohling. Firmenname vorgeschlagen („Pixelkraft Labs", änderbar). `gameplayStart` | – |
| 3–10 s | Farbpalette (6 Swatches) erscheint mit Pfeil + 1 Satz „Wähle eine Farbe". Handy färbt sich animiert. | 1 Tap |
| 10–20 s | „Form": 3 Presets (Rund, Kantig, Schlank). Gehäuse morpht. | 1 Tap |
| 20–30 s | „Display": 3 Größen. Live-Score-Leiste wächst sichtbar. | 1 Tap |
| 30–33 s | Großer **„Launch!"**-Button pulsiert (Preis-Preset bereits gesetzt, Name auto). | 1 Tap |
| 33–36 s | „Nacht durchgearbeitet"-Zeitraffer (Lampe, Uhr dreht, 3 s) | – |
| 36–45 s | Kamerafahrt um den Drehteller, Konfetti, Spotlight, Vorbestellungen zählen hoch (Geldzähler rollt: +8 000 bis 15 000 $), 3 Review-Karten fliegen ein (tutorial-garantiert 6,5–8,0) | – |
| 45–55 s | Freischaltung: „Neue Farbe: Mitternachtsblau" + nächstes Ziel „Verdiene 25 000 $ für dein erstes Büro" mit Fortschrittsbalken | 1 Tap „Weiter" |
| 55–60 s | Zeit läuft (1x), Verkäufe tröpfeln mit kleinen Münz-Partikeln ein | – |

Regeln:
- Erste Launch-Bewertung ist **tutorial-kalibriert**: Für den ersten Launch gilt
  `σ_s` so, dass jede Kombination 6,5–8,0 ergibt; die beste Kombination (passende
  Größe + Trendfarbe) ergibt ~8 → Lernmoment ohne Frust.
- Hinweise: Pfeil + ein Satz, „Überspringen" immer sichtbar, Zeit bis Launch wird im
  Dev-Overlay gemessen (Funnel-Timer: `t_firstFrame`, `t_firstInput`, `t_launch`,
  `t_reward`).
- Keine Werbung in den ersten 5 Minuten Gesamtspielzeit.
- Kein Hauptmenü; Einstellungen über Zahnrad oben rechts.

---

## 20. Retention-Systeme

### 20.1 Offline-Fortschritt
- Echtzeit-Abwesenheit `t_off`, gedeckelt bei **8 h**.
- **Kalender läuft offline höchstens 4 Spielwochen** weiter (sonst würden Handys
  „über Nacht" um Jahre veralten und KI-Firmen unkontrolliert releasen).
- In diesen ≤ 4 Wochen wird normal simuliert (Verkäufe, Produktion, Gehälter).
- Zusätzlich **Offline-Arbeitsgutschrift** für die restliche Zeit:
  `Gutschrift = laufende Raten (RP, Dev-Punkte, Passiveinkommen) · min(t_off, 8 h) · 0,25`,
  gedeckelt auf Fertigstellung des aktuellen Projekts.
- „Willkommen zurück"-Screen: animierte Bilanz (Geld zählt hoch, fertige Forschung,
  fertige Entwicklung, verkaufte Einheiten), Rewarded-Option „Offline-Ertrag verdoppeln".

### 20.2 Immer etwas Unfertiges
Beim Speichern/Verlassen prüft das Spiel, ob mindestens eines läuft: Forschung,
Entwicklung, Produktion, Event-Countdown, Auftragsfrist. Falls nicht, wird ein Ziel
vorgeschlagen („Starte eine Forschung, bevor du gehst – sie läuft offline weiter").

### 20.3 7-Tage-Kalender
Echtzeittage, Belohnung skaliert mit Fortschritt: `max(Basis, 0,5 · Ø-Wochenumsatz)`.
Tag 7: kosmetisches Material (z. B. „Aurora-Finish"). Verpasster Tag setzt nicht zurück,
pausiert nur (freundlich).

### 20.4 Tägliche Mini-Aufträge
3 pro Echtzeittag aus Pool (z. B. „Launche ein Handy mit Review ≥ 7", „Verkaufe
5 000 Einheiten", „Trainiere einen Mitarbeiter"). Belohnung: Geld/RP/Hype.

### 20.5 Teaser nach Launch
Ergebnis-Screen endet immer mit einer Zeile „Als Nächstes": nächste Forschung mit
Abstand, nächstes Gate oder nächstes Ziel.

---

## 21. Monetarisierung (nur CrazyGames-SDK)

| Ad-Typ | Wann | Regel |
|---|---|---|
| Midgame | nach dem Launch-Ergebnis-Screen, nach Phasenwechsel | nie in den ersten 5 min, min. 6 min Abstand, max. 1 je 3 Launches |
| Rewarded | freiwillig: Launch-Einnahmen ×2, Entwicklung −50 %, Bonus-Forschung (+20 % RP auf aktuelle), Offline-Ertrag ×2 | Cooldown je Typ 5 min, Belohnung skaliert, nie Pflicht |

- `adStarted` → Sim pausieren, Audio stumm, `gameplayStop`; `adFinished`/`adError` → fortsetzen.
- Mit Adblocker: Rewarded-Buttons werden ausgeblendet; Spiel bleibt voll spielbar und
  balanciert ohne Rewarded-Boni.

---

## 22. UI/UX-Grundsätze

- **Hauptreiter (unten, groß):** Firma · Design · Forschung · Team · Fabrik · Markt
  (Reiter erscheinen erst bei Freischaltung).
- **HUD oben:** Firmenname, Geld (rollender Zähler), Datum, Zeitsteuerung, Marke, Ziele.
- **Editor-Layout:** links Kategorien · Mitte 3D-Handy · rechts Kosten, Scores,
  Entwicklungszeit, Review-Prognose, Absatzband. Mobile: rechts wird ein ausklappbares
  Bottom-Sheet.
- Glas-Panels (backdrop-filter mit Fallback), Touch-Ziele ≥ 44 px, kurze Zahlenformate
  (12,4K / 3,1M / 2,5Mrd bzw. 2.5B), **Tooltip für jeden Wert** (Desktop: Hover;
  Mobile: Long-Press oder „i").
- Jede Score-Änderung im Editor zeigt Delta-Chips (+0,3 Design, −12 $).
- Farbcode: Design = Violett, Technik = Cyan, Software = Grün, Geld = Gold.

---

## 23. Audio

WebAudio, synthetisiert oder winzige OGG/MP3-Samples (< 300 KB gesamt im Initial-Bundle):
UI-Klick, Swatch-Pop, Morph-Whoosh, Launch-Fanfare, Kassen-Ticker (pitch steigt mit
Betrag), Review-Karten-Swoosh, Erfolg-Jingle, ambient Garage/Büro/Fabrik (lazy).
Lautstärke-Regler Musik/SFX, Stummschaltung bei Ads.

---

## 24. Balancing-Ziele & Bot-Simulation

### 24.1 Pacing-Ziele

| Echtzeit | Erwartete Phase | Cash (Richtwert) | Spieljahr |
|---|---|---|---|
| 1 min | 1 | 10–15K | 2007 |
| 5 min | 1 → 2 | 25–40K | 2007 |
| 30 min | 2 → 3 | 0,5–1,5 M | 2008–2009 |
| 90 min | 3 → 4 | 10–30 M | 2010–2011 |
| 2 h | 4 | 20–60 M | 2011–2012 |
| 5 h | 4 → 5 | 0,5–2 Mrd | 2016–2022 |
| 15 h | 5 → 6 | 50+ Mrd | 2035–2050 |

### 24.2 Plausibilitätsrechnung Phase 1

Werte nach dem M1-Tuning (Bot-Report `docs/balancing/M1.md`): 2007, Mittelklasse,
ρ = 0,0025, Garage 50 Einheiten/Woche, Wochenmiete 500 $.
Erster Launch ≈ 40 Vorbestellungen (≈ 10K $ Umsatz), danach läuft die Garage am
Kapazitätslimit (≈ 50/Woche · ≈ 115 $ Marge). Gate „25K $ + 2 Launches“ nach ≈ 5,4 min
(average), 7,0 min (weak).

### 24.3 Bot
`npm run sim:bot -- --hours 2 --speed mix --seed 42` läuft headless über `src/sim/` und
gibt CSV + ASCII-Chart aus: `Echtzeit-Minute, Spieldatum, Phase, Cash, Valuation, Marke,
Marktanteil, Ø-Review, Mitarbeiter`.

Bot-Strategie (bewusst „durchschnittlicher Spieler", nicht optimal):
- Designt immer das beste verfügbare Handy für das Segment mit der höchsten erwarteten
  Marge, Preis = P_fair.
- Produziert 1,1 × prognostizierte 8-Wochen-Nachfrage.
- Forscht nach Epochen-Erwartung (günstigster Knoten, der eine Kategorie verbessert).
- Stellt ein, solange Gehälter < 30 % des Wochenumsatzes.
- Kauft Gate-Gebäude sobald Cash ≥ 1,5 × Preis.
- Geschwindigkeits-Mix: 40 % 1x, 30 % 2x, 30 % 4x.

Varianten: „Optimierer" (Pionierforschung, aggressive Preise) und „Schwach" (zufällige
Wahl) – das Pacing muss für alle drei in einem Korridor ±50 % liegen, und niemand darf
dauerhaft bankrott gehen (Bankrott-Schutz: Notkredit + Hinweis).

Jeder Meilenstein liefert den Bot-Report in `docs/balancing/Mx.md`.

---

## 25. Offene Fragen & getroffene Annahmen

Folgende Punkte sind mit einem Default festgelegt; sie ändern das Design grundlegend,
falls anders gewünscht:

1. **Zeitskala:** 1 Spieltag = 5 s bei 1x (≈ 30 min/Spieljahr). Alternative: schneller
   (z. B. 3 s/Tag) → weniger Endgame-Inhalt pro Epoche.
2. **Offline-Kalender:** max. 4 Spielwochen + Arbeitsgutschrift (statt voller 8 h
   Simulation, die das Spiel „überspringen" würde).
3. **Segmentwahl explizit** im Editor (statt implizit aus dem Preis) – klarer für
   Spieler, verhindert Sprungeffekte an Preisgrenzen.
4. **Phase 1 = Made-to-Order** ohne Lagerrisiko; Stückzahl-Entscheidung erst ab
   Phase 2 (Auftragsfertiger). Hält die First Minute frei von Planungsfragen.
5. **Währung** neutrales `$`, keine reale Inflation über 2 %/Jahr.
6. **UI-Technologie:** Preact + Signals (~6 KB gz) für Panels; HTML/CSS-Overlay.
7. **Regionen** sind reale Kontinente (generisch, keine Marken) – fiktive Länder wären
   möglich, falls gewünscht.
