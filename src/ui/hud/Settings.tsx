import { useState } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import type { QualitySetting } from '../../render/quality';
import { game, settingsOpen } from '../game';
import { lang, setLang, t, type Lang } from '../i18n';

const PREFS_KEY = 'phone-empire-prefs';

interface Prefs {
  quality: QualitySetting;
  sound: boolean;
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { quality: 'auto', sound: true, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { quality: 'auto', sound: true };
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function Settings() {
  const { engine, reset } = game();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [confirm, setConfirm] = useState(false);
  const update = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    savePrefs(next);
    if (p.quality) engine.setQuality(p.quality);
    if (p.sound !== undefined) sfx.setEnabled(p.sound);
    sfx.click();
  };
  const close = () => {
    sfx.click();
    settingsOpen.value = false;
  };
  const langs: Lang[] = ['en', 'de'];
  const qualities: QualitySetting[] = ['auto', 'low', 'medium', 'high'];
  return (
    <div class="modal-back" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="glass modal" role="dialog" aria-label={t('settings.title')}>
        <h3>{t('settings.title')}</h3>
        <div class="field">
          {t('settings.language')}
          <div class="seg">
            {langs.map((l) => (
              <button key={l} class={lang.value === l ? 'on' : ''} onClick={() => (setLang(l), sfx.click())}>
                {l === 'en' ? 'English' : 'Deutsch'}
              </button>
            ))}
          </div>
        </div>
        <div class="field">
          {t('settings.quality')}
          <div class="seg">
            {qualities.map((q) => (
              <button key={q} class={prefs.quality === q ? 'on' : ''} onClick={() => update({ quality: q })}>
                {t(`settings.${q}`)}
              </button>
            ))}
          </div>
        </div>
        <div class="field">
          {t('settings.sound')}
          <div class="seg">
            <button class={prefs.sound ? 'on' : ''} onClick={() => update({ sound: true })}>{t('settings.on')}</button>
            <button class={!prefs.sound ? 'on' : ''} onClick={() => update({ sound: false })}>{t('settings.off')}</button>
          </div>
        </div>
        {confirm ? (
          <button class="btn-danger" onClick={() => reset()}>{t('settings.resetConfirm')}</button>
        ) : (
          <button class="btn-danger" onClick={() => setConfirm(true)}>{t('settings.reset')}</button>
        )}
        <button class="btn-primary" onClick={close}>{t('settings.close')}</button>
      </div>
    </div>
  );
}
