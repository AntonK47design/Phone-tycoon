import type { Lang } from './i18n';

const UNITS: Record<Lang, string[]> = {
  en: ['', 'K', 'M', 'B', 'T', 'Qa'],
  de: ['', 'K', 'M', 'Mrd', 'Bio', 'Brd'],
};

/** Short number: 12.4K / 3.1M (EN) – 12,4K / 3,1M (DE). */
export function shortNum(n: number, lang: Lang, digits = 1): string {
  const sign = n < 0 ? '-' : '';
  let v = Math.abs(n);
  if (v < 1000) return sign + Math.round(v).toString();
  let i = 0;
  while (v >= 1000 && i < UNITS[lang].length - 1) {
    v /= 1000;
    i++;
  }
  const fixed = v >= 100 ? Math.round(v).toString() : v.toFixed(digits).replace(/\.0$/, '');
  return sign + (lang === 'de' ? fixed.replace('.', ',') : fixed) + UNITS[lang][i];
}

export function money(n: number, lang: Lang): string {
  return lang === 'de' ? `${shortNum(n, lang)} $` : `${n < 0 ? '-' : ''}$${shortNum(Math.abs(n), lang)}`;
}

/** Full money value with grouping, e.g. $12,345 / 12.345 $. */
export function moneyFull(n: number, lang: Lang): string {
  const s = Math.round(n).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
  return lang === 'de' ? `${s} $` : `$${s}`;
}

export function decimal(n: number, lang: Lang, digits = 1): string {
  const s = n.toFixed(digits);
  return lang === 'de' ? s.replace('.', ',') : s;
}
