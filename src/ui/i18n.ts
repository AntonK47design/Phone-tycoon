import { signal } from '@preact/signals';
import en from '../data/i18n/en.json';
import de from '../data/i18n/de.json';

export type Lang = 'en' | 'de';
const DICTS: Record<Lang, unknown> = { en, de };
// v2: earlier builds auto-saved the browser language; only explicit choices count now.
const LANG_KEY = 'phone-empire-lang-v2';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'de') return saved;
  } catch {
    /* ignore */
  }
  // English is the default; German is opt-in via settings.
  return 'en';
}

export const lang = signal<Lang>(detect());

export function setLang(l: Lang, persist = true) {
  lang.value = l;
  document.documentElement.lang = l;
  if (!persist) return;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* ignore */
  }
}

function lookupRaw(dict: unknown, key: string): unknown {
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else return undefined;
  }
  return cur;
}

/** Translated string list (e.g. founder barks). */
export function tList(key: string): string[] {
  const v = lookupRaw(DICTS[lang.value], key) ?? lookupRaw(DICTS.en, key);
  return Array.isArray(v) ? (v as string[]) : [];
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
