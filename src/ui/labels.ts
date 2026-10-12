// Human-readable labels for content defined as data.

import { researchById, type ResearchNode } from '../data/research';
import { shapeById } from '../data/design';
import { decimal } from './format';
import { lang, t } from './i18n';

export function researchName(node: ResearchNode): string {
  const u = node.unlock;
  if (u.partGen) return t('research.partName', { cat: t(`research.branch.${u.partGen.category}`), yy: String(u.partGen.gen).slice(2) });
  return t(`research.names.${node.id}`);
}

export function researchNameById(id: string): string {
  const n = researchById(id);
  return n ? researchName(n) : id;
}

export function researchEffect(node: ResearchNode, currentReach: number): string {
  const u = node.unlock;
  if (u.partGen) return t('research.unlock.part', { cat: t(`cat.${u.partGen.category}`) });
  if (u.material) return t('research.unlock.material', { name: t(`material.${u.material}`) });
  if (u.finish) return t('research.unlock.finish', { name: t(`finish.${u.finish}`) });
  if (u.feature) return t('research.unlock.feature', { name: t(`feature.${u.feature}`) });
  if (u.shape) return t('research.unlock.shape', { name: shapeName(u.shape) });
  if (u.sizes) return t('research.unlock.sizes', { list: u.sizes.map((s) => `${decimal(s, lang.value)}″`).join(', ') });
  if (u.reach) return t('research.unlock.reach', { mul: decimal(u.reach / currentReach, lang.value) });
  if (u.marketing) return t('research.unlock.marketing');
  if (u.presentation) return t('research.unlock.presentation', { n: u.presentation });
  if (u.os) return t('research.unlock.os', { name: t(`os.${u.os}`) });
  if (u.frontier) return t('research.unlock.frontier');
  return '';
}

export function shapeName(id: string): string {
  if (id === 'blade' || id === 'edge' || id === 'fullscreen') return t(`shapeName.${id}`);
  void shapeById(id);
  return t(`editor.shape.${id}`);
}

/** One news ticker line. */
export function newsText(n: import('../sim/state').NewsItem): string {
  const rival = n.rival ? rivalName(n.rival) : '';
  return t(`news.${n.kind}`, {
    rival,
    name: n.text ?? '',
    score: n.value !== undefined ? decimal(n.value, lang.value) : '',
    pct: n.value ?? '',
    segment: n.segment ? t(`segment.${n.segment}`) : '',
    region: n.rival && n.kind === 'event.tariff' ? t(`region.${n.rival}`) : '',
  });
}

export function rivalName(id: string): string {
  return COMPETITOR_NAMES[id] ?? id;
}

import { COMPETITORS } from '../data/market';
const COMPETITOR_NAMES: Record<string, string> = Object.fromEntries(COMPETITORS.map((c) => [c.id, c.name]));
