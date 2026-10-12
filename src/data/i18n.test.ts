import { describe, expect, it } from 'vitest';
import en from './i18n/en.json';
import de from './i18n/de.json';
import { shortNum } from '../ui/format';

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('i18n', () => {
  it('EN and DE have the same keys', () => {
    expect(keys(de).sort()).toEqual(keys(en).sort());
  });

  it('formats short numbers per language', () => {
    expect(shortNum(12_400, 'en')).toBe('12.4K');
    expect(shortNum(12_400, 'de')).toBe('12,4K');
    expect(shortNum(3_100_000, 'de')).toBe('3,1M');
    expect(shortNum(999, 'en')).toBe('999');
    expect(shortNum(2_500_000_000, 'de')).toBe('2,5Mrd');
    expect(shortNum(-1500, 'en')).toBe('-1.5K');
  });
});
