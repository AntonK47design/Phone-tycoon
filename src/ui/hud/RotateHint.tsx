// Phones held upright get a friendly "turn sideways" hint (GDD/PLAN M7). The game stays
// playable in portrait; the hint can be dismissed for the session.

import { useState } from 'preact/hooks';
import { t } from '../i18n';

const KEY = 'phone-empire-rotate-ok';

function dismissed(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function RotateHint() {
  const [hidden, setHidden] = useState(dismissed);
  if (hidden) return null;
  const close = () => {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
  };
  // Visibility is decided in CSS (touch + portrait), so turning the phone hides it at once.
  return (
    <div class="rotate-hint" role="dialog" aria-label={t('rotate.title')}>
      <div class="rotate-phone" aria-hidden="true" />
      <b>{t('rotate.title')}</b>
      <p>{t('rotate.text')}</p>
      <button class="btn-secondary" onClick={close}>
        {t('rotate.anyway')}
      </button>
    </div>
  );
}
