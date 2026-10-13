// Phase-2 spec sheet: accordion sections for every design decision.

import { useState } from 'preact/hooks';
import { LICENSED_OS, TECH_CATEGORIES, type TechCategory } from '../../data/components';
import { COLORS } from '../../data/design';
import { expectedTech } from '../../data/eras';
import { SEGMENTS, type Segment } from '../../data/market';
import { FEATURES, partById, type PartDef } from '../../data/parts';
import type { DraftPatch } from '../../sim/game';
import { osEcosystem, osQuality, osScore } from '../../sim/giant';
import {
  availableSegments,
  availableFeatures,
  availableFinishes,
  availableMaterials,
  availableOs,
  availableParts,
  availableShapes,
  availableSizes,
} from '../../sim/research';
import { isTrendColor, priceAnchor, ratingFromRatio } from '../../sim/scoring/score';
import type { GameState } from '../../sim/state';
import { yearOf } from '../../sim/time';
import { decimal, money } from '../format';
import { useGameState } from '../game';
import { lang, t } from '../i18n';
import { shapeName } from '../labels';

type Section = 'position' | 'paint' | 'body' | 'screen' | TechCategory | 'extras' | 'software';

interface Props {
  state: GameState;
  suggestedPrice: number;
  missing: string[];
  onChange: (kind: string, patch: DraftPatch) => void;
}

function scoreClass(s: number) {
  return s >= 8 ? 'good' : s >= 6 ? 'ok' : 'bad';
}

export function AdvancedEditor({ suggestedPrice, missing, onChange }: Props) {
  // Subscribe directly; the draft is mutated in place, so props alone don't change.
  const state = useGameState();
  const [open, setOpen] = useState<Section>('position');
  const d = state.draft;
  const l = lang.value;
  const year = yearOf(state.day);
  const sigma = SEGMENTS[d.segment].sigma;

  const Head = ({ id, title, summary }: { id: Section; title: string; summary: string }) => (
    <button class={`acc-head ${open === id ? 'open' : ''}`} onClick={() => setOpen(open === id ? ('' as Section) : id)}>
      <span class="acc-title">{title}</span>
      <span class="acc-sum">{summary}</span>
      <span class="acc-chev">{open === id ? '−' : '+'}</span>
    </button>
  );

  const osScoreOf = (o: string) => (o === 'own' ? osScore(state) : LICENSED_OS[o as keyof typeof LICENSED_OS]?.score ?? 5);
  const partRating = (p: PartDef) => ratingFromRatio(p.ti / (sigma * expectedTech(year)));

  const PartPicker = ({ category }: { category: TechCategory }) => {
    const all = availableParts(state, category);
    const newest = Math.max(...all.map((p) => p.gen));
    const gens = [...new Set(all.map((p) => p.gen))].sort((a, b) => b - a).slice(0, 3);
    return (
      <div class="part-grid">
        {gens.map((gen) => (
          <div class="part-row" key={gen}>
            <span class="part-gen">’{String(gen).slice(2)}{gen === newest && gen > 2007 ? <i class="badge new inline">{t('editor.newPart')}</i> : null}</span>
            {all
              .filter((p) => p.gen === gen)
              .map((p) => {
                const r = partRating(p);
                return (
                  <button key={p.id} class={`part ${d.parts[category] === p.id ? 'sel' : ''}`} onClick={() => onChange('part', { part: { category, id: p.id } })}>
                    <span class="part-tier">{t(`tier.${p.tier}`)}</span>
                    <span class="part-label">{p.label}</span>
                    <span class="part-foot">
                      <i class={`score-pill ${scoreClass(r)}`}>{decimal(r, l)}</i> {money(p.cost, l)}
                    </span>
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    );
  };

  const part = (c: TechCategory) => partById(d.parts[c]);
  const feats = availableFeatures(state);
  const sizes = availableSizes(state);
  const segs: Segment[] = availableSegments(state);
  const custom = d.customPrice !== null;
  const fair = suggestedPrice;

  return (
    <div class="acc">
      <Head id="position" title={t('segment.title')} summary={`${t(`segment.${d.segment}`)} · ${money(d.price, l)}`} />
      {open === 'position' && (
        <div class="acc-body">
          <div class="seg-pick">
            {segs.map((s) => (
              <button key={s} class={d.segment === s ? 'on' : ''} onClick={() => onChange('segment', { segment: s })}>
                {t(`segment.${s}`)}
                <small>{t('segment.anchor', { price: money(priceAnchor({ segment: s }, year), l) })}</small>
              </button>
            ))}
          </div>
          <div class="price-row">
            <span class="label">{t('price.title')}</span>
            <div class="seg mini">
              <button class={!custom ? 'on' : ''} onClick={() => onChange('price', { customPrice: null })}>{t('price.auto')}</button>
              <button class={custom ? 'on' : ''} onClick={() => onChange('price', { customPrice: d.price })}>{t('price.custom')}</button>
            </div>
          </div>
          {custom && (
            <input
              class="slider"
              type="range"
              min={Math.round(fair * 0.4)}
              max={Math.round(fair * 2)}
              step={10}
              value={d.price}
              onInput={(e) => onChange('priceSlide', { customPrice: Number((e.target as HTMLInputElement).value) })}
            />
          )}
          <div class="hint-line">{t('price.fair', { price: money(fair, l) })}</div>
        </div>
      )}

      <Head id="paint" title={t('editor.cat.color')} summary={`${d.colorId ? t(`color.${d.colorId}`) : '—'} · ${t(`finish.${d.finishId}`)}`} />
      {open === 'paint' && (
        <div class="acc-body">
          <div class="swatches">
            {COLORS.filter((c) => state.unlockedColors.includes(c.id)).map((c) => (
              <button
                key={c.id}
                class={`swatch ${d.colorId === c.id ? 'sel' : ''}`}
                style={{ background: c.hex }}
                data-tip={t(`color.${c.id}`)}
                aria-label={t(`color.${c.id}`)}
                onClick={() => onChange('color', { colorId: c.id })}
              >
                {isTrendColor(c.id, year) && <span class="badge">{t('editor.trend')}</span>}
              </button>
            ))}
          </div>
          <div class="chips">
            {availableFinishes(state).map((f) => (
              <button key={f} class={`chip ${d.finishId === f ? 'on' : ''}`} onClick={() => onChange('finish', { finishId: f })}>
                {t(`finish.${f}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <Head id="body" title={t('cat.body')} summary={`${shapeName(d.shapeId)} · ${t(`material.${d.materialId}`)}`} />
      {open === 'body' && (
        <div class="acc-body">
          <div class="chips">
            {availableShapes(state).map((s) => (
              <button key={s} class={`chip ${d.shapeId === s ? 'on' : ''}`} onClick={() => onChange('shape', { shapeId: s })}>
                {shapeName(s)}
              </button>
            ))}
          </div>
          <div class="chips">
            {availableMaterials(state).map((m) => (
              <button key={m} class={`chip ${d.materialId === m ? 'on' : ''}`} onClick={() => onChange('material', { materialId: m })}>
                {t(`material.${m}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <Head id="screen" title={t('editor.cat.display')} summary={`${decimal(d.displaySize, l)}″ · ${part('display')?.label ?? ''}`} />
      {open === 'screen' && (
        <div class="acc-body">
          <div class="chips">
            {sizes.map((s) => (
              <button key={s} class={`chip ${d.displaySize === s ? 'on' : ''}`} onClick={() => onChange('display', { displaySize: s })}>
                {decimal(s, l)}″
              </button>
            ))}
          </div>
          <PartPicker category="display" />
        </div>
      )}

      {TECH_CATEGORIES.filter((c) => c !== 'display').map((c) => (
        <div key={c}>
          <Head id={c} title={t(`cat.${c}`)} summary={part(c)?.label ?? ''} />
          {open === c && (
            <div class="acc-body">
              <PartPicker category={c} />
            </div>
          )}
        </div>
      ))}

      <Head
        id="extras"
        title={t('cat.extras')}
        summary={d.features.map((f) => t(`feature.${f}`)).join(', ') || '—'}
      />
      {open === 'extras' && (
        <div class="acc-body">
          <div class="chips">
            {FEATURES.filter((f) => feats.includes(f.id)).map((f) => {
              const on = d.features.includes(f.id);
              const warn = missing.includes(f.id);
              return (
                <button
                  key={f.id}
                  class={`chip ${on ? 'on' : ''} ${warn ? 'warn' : ''}`}
                  onClick={() => onChange('feature', { features: on ? d.features.filter((x) => x !== f.id) : [...d.features, f.id] })}
                >
                  {t(`feature.${f.id}`)} <small>+{money(f.cost, l)}</small>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Head id="software" title={t('cat.software')} summary={`${t(`os.${d.osId}`)} · ${decimal(osScoreOf(d.osId), l, 1)}`} />
      {open === 'software' && (
        <div class="acc-body">
          <div class="chips">
            {availableOs(state).map((o) => {
              const score = osScoreOf(o);
              return (
                <button key={o} class={`chip ${d.osId === o ? 'on' : ''}`} onClick={() => onChange('os', { osId: o })}>
                  {o === 'own' ? t('empire.osName', { name: state.company.name, n: state.giant.os.level }) : t(`os.${o}`)}{' '}
                  <i class={`score-pill ${scoreClass(score)}`}>{decimal(score, l, 1)}</i>
                </button>
              );
            })}
          </div>
          {state.giant.os.level > 0 && (
            <p class="hint-line">
              {t('editor.ownOsHint', { quality: decimal(osQuality(state), l, 1), apps: decimal(osEcosystem(state), l, 1) })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
