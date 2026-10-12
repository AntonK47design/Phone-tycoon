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
  return '';
}

export function shapeName(id: string): string {
  if (id === 'blade') return t('shapeName.blade');
  void shapeById(id);
  return t(`editor.shape.${id}`);
}
