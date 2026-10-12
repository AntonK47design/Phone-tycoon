import { signal } from '@preact/signals';
import en from '../data/i18n/en.json';
import de from '../data/i18n/de.json';

export type Lang = 'en' | 'de';
const DICTS: Record<Lang, unknown> = { en, de };
const LANG_KEY = 'phone-empire-lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'de') return saved;
  } catch {
    /* ignore */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export const lang = signal<Lang>(detect());

export function setLang(l: Lang) {
  lang.value = l;
  document.documentElement.lang = l;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* ignore */
  }
}

function lookup(dict: unknown, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** Translate `key`, replacing `{name}` placeholders. Reads `lang` so components re-render. */
export function t(key: string, params?: Record<string, string | number>): string {
  const str = lookup(DICTS[lang.value], key) ?? lookup(DICTS.en, key) ?? key;
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}
