// Team tab: staff, applicants, office upgrades, lab and studio (GDD §10).

import { sfx } from '../../audio/sfx';
import { APPLICANT_REFRESH_DAYS, LAB_LEVELS, OFFICE_LEVELS, ROLE_COLORS, STUDIO_LEVELS } from '../../data/team';
import type { SimEvent } from '../../sim/events';
import type { Employee, GameState } from '../../sim/state';
import {
  bonusCost,
  bonusReady,
  hireFee,
  isWorking,
  labCost,
  marketingBoost,
  officeUpgradeCost,
  payroll,
  salary,
  seats,
  studioCost,
  teamQuality,
  teamRates,
  trainingCost,
} from '../../sim/team';
import { yearOf } from '../../sim/time';
import { decimal, money } from '../format';
import { game, toast } from '../game';
import { lang, t } from '../i18n';

function moraleWord(m: number) {
  return m >= 75 ? 'great' : m >= 55 ? 'ok' : m >= 35 ? 'meh' : 'bad';
}

function Person({ e, state, applicant }: { e: Employee; state: GameState; applicant?: boolean }) {
  const { store } = game();
  const l = lang.value;
  const year = yearOf(state.day);
  const full = state.team.staff.length >= seats(state);
  const run = (ev: SimEvent[], ok: SimEvent['type'], sound: () => void) => {
    if (ev[0]?.type === ok) sound();
    else if (ev[0]?.type === 'rejected') toast(t(ev[0].reason === 'noSeats' ? 'team.noSeats' : ev[0].reason === 'noCash' ? 'toast.noCash' : 'team.busy'), 'warn');
  };
  const training = !isWorking(e, state.day);
  return (
    <div class={`person ${training ? 'away' : ''}`}>
      <span class="avatar" style={{ background: ROLE_COLORS[e.role] }}>{e.first.charAt(0)}{e.last.charAt(0)}</span>
      <div class="person-main">
        <div class="person-head">
          <b>{e.first} {e.last}</b>
          <span class="role-chip" style={{ color: ROLE_COLORS[e.role] }}>{t(`team.role.${e.role}`)}</span>
        </div>
        <div class="person-sub">
          <span data-tip={t(`team.traitTip.${e.trait}`)}>{t(`team.trait.${e.trait}`)}</span>
          {' · '}
          {t('team.perWeek', { amount: money(salary(e, year), l) })}
          {!applicant && <> · <span class={`morale ${moraleWord(e.morale)}`}>{t(`team.morale.${moraleWord(e.morale)}`)}</span></>}
        </div>
        <div class="skill">
          <span class="label">{t('team.skill')}</span>
          <div class="bar light"><i style={{ width: `${e.skill}%`, background: ROLE_COLORS[e.role] }} /></div>
          <b>{e.skill}</b>
        </div>
      </div>
      <div class="person-actions">
        {applicant ? (
          <button class="btn-secondary" disabled={full} onClick={() => run(store.dispatch({ type: 'hire', id: e.id }), 'hired', () => sfx.unlock2())}>
            {t('team.hire', { amount: money(hireFee(e, year), l) })}
          </button>
        ) : training ? (
          <span class="muted">{t('team.training', { days: (e.trainingUntil ?? 0) - state.day })}</span>
        ) : (
          <>
            <button class="btn-secondary" disabled={e.skill >= 100} data-tip={t('team.trainTip')} onClick={() => run(store.dispatch({ type: 'train', id: e.id }), 'trainingStarted', () => sfx.whoosh())}>
              {t('team.train', { amount: money(trainingCost(e, year), l) })}
            </button>
            <button class="btn-secondary danger" onClick={() => (store.dispatch({ type: 'fire', id: e.id }), sfx.click())}>{t('team.fire')}</button>
          </>
        )}
      </div>
    </div>
  );
}

function Building({ title, desc, cost, action, disabled }: { title: string; desc: string; cost: number | null; action: () => void; disabled?: boolean }) {
  const l = lang.value;
  return (
    <div class="building">
      <div>
        <b>{title}</b>
        <div class="muted">{desc}</div>
      </div>
      {cost !== null ? (
        <button class="btn-secondary" disabled={disabled} onClick={action}>{money(cost, l)}</button>
      ) : (
        <span class="node-note ok">{t('team.maxed')}</span>
      )}
    </div>
  );
}

export function TeamPanel({ state }: { state: GameState }) {
  const { store } = game();
  const l = lang.value;
  const team = state.team;
  const rates = teamRates(state);
  const q = teamQuality(state);
  const pay = payroll(state);
  const recent = state.history.profit.slice(-4);
  const profit = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length + pay : 0;
  const share = profit > 0 ? pay / profit : pay > 0 ? 1 : 0;
  const nextOffice = OFFICE_LEVELS[team.office];
  const nextLab = LAB_LEVELS[team.lab];
  const nextStudio = STUDIO_LEVELS[team.studio];
  const build = (type: 'upgradeOffice' | 'buildLab' | 'buildStudio') => {
    const ev = store.dispatch({ type });
    if (ev[0]?.type === 'rejected') toast(t(ev[0].reason === 'noCash' ? 'toast.noCash' : 'team.needOffice2'), 'warn');
    else sfx.fanfare();
  };
  const bonus = () => {
    const ev = store.dispatch({ type: 'payBonus' });
    if (ev[0]?.type === 'bonusPaid') sfx.coin(1.2);
    else toast(t('toast.noCash'), 'warn');
  };
  const avgMorale = team.staff.length ? team.staff.reduce((a, e) => a + e.morale, 0) / team.staff.length : 0;
  const poolIn = Math.max(0, APPLICANT_REFRESH_DAYS - (state.day - team.poolDay));
  const staff = [...team.staff].sort((a, b) => a.role.localeCompare(b.role) || b.skill - a.skill);
  return (
    <>
      <h3 class="drawer-title">
        {t('team.title')} <small>{t('team.seats', { n: team.staff.length, max: seats(state) })}</small>
      </h3>
      <div class="kpis">
        <div class="kpi" data-tip={t('team.ratesTip')}>
          <span class="label">{t('team.points')}</span>
          <b class="rates">
            <i style={{ color: 'var(--design)' }}>{decimal(rates.design, l, 1)}</i>
            <i style={{ color: 'var(--tech)' }}>{decimal(rates.tech, l, 1)}</i>
            <i style={{ color: 'var(--software)' }}>{decimal(rates.software, l, 1)}</i>
          </b>
        </div>
        <div class="kpi"><span class="label">{t('team.rp')}</span><b>{decimal(rates.rp, l, 1)}</b></div>
        <div class="kpi" data-tip={t('team.qualityTip')}>
          <span class="label">{t('team.quality')}</span>
          <b class={q < 0.97 ? 'neg' : q > 1.01 ? 'pos' : ''}>{q >= 1 ? '+' : '−'}{Math.abs(Math.round((q - 1) * 100))}%</b>
        </div>
        <div class="kpi"><span class="label">{t('team.hype')}</span><b>+{Math.round((marketingBoost(state) - 1) * 100)}%</b></div>
        <div class="kpi"><span class="label">{t('team.payroll')}</span><b>{money(pay, l)}</b></div>
        <div class="kpi"><span class="label">{t('team.moraleAvg')}</span><b>{team.staff.length ? t(`team.morale.${moraleWord(avgMorale)}`) : '—'}</b></div>
      </div>
      {share > 0.6 && <div class="warn-line">{t('team.payrollWarn', { pct: Math.round(share * 100) })}</div>}
      {q < 0.97 && <div class="hint-line">{t('team.qualityHint')}</div>}

      <h4 class="drawer-sub">{t('team.staff')}</h4>
      {staff.length === 0 && <p class="muted">{t('team.empty')}</p>}
      {staff.map((e) => <Person key={e.id} e={e} state={state} />)}
      {staff.length > 0 && (
        <button class="btn-secondary bonus-btn" disabled={!bonusReady(state)} onClick={bonus}>
          {bonusReady(state) ? t('team.bonus', { amount: money(bonusCost(state), l) }) : t('team.bonusWait')}
        </button>
      )}

      <h4 class="drawer-sub">
        {t('team.applicants')} <small class="muted">{t('team.newIn', { days: poolIn })}</small>
      </h4>
      {team.applicants.length === 0 && <p class="muted">{t('team.noApplicants')}</p>}
      {team.applicants.map((e) => <Person key={e.id} e={e} state={state} applicant />)}
      <p class="hint-line">{t('team.roleHint')}</p>

      <h4 class="drawer-sub">{t('team.buildings')}</h4>
      <Building
        title={nextOffice ? t('team.officeNext', { level: nextOffice.level }) : t('team.officeMax')}
        desc={nextOffice ? t('team.officeDesc', { seats: nextOffice.seats, bonus: Math.round((nextOffice.bonus - 1) * 100), rent: money(nextOffice.rent * (officeUpgradeCost(state)! / nextOffice.price), l) }) : ''}
        cost={officeUpgradeCost(state)}
        action={() => build('upgradeOffice')}
      />
      <Building
        title={nextLab ? t('team.labNext', { level: nextLab.level }) : t('team.labMax')}
        desc={nextLab ? t('team.labDesc', { pct: Math.round(nextLab.bonus * 100) }) : ''}
        cost={labCost(state)}
        disabled={team.office < 2}
        action={() => build('buildLab')}
      />
      <Building
        title={nextStudio ? t('team.studioNext', { level: nextStudio.level }) : t('team.studioMax')}
        desc={nextStudio ? t('team.studioDesc', { pct: Math.round(nextStudio.bonus * 100), polish: decimal(nextStudio.polish, l, 1) }) : ''}
        cost={studioCost(state)}
        disabled={team.office < 2}
        action={() => build('buildStudio')}
      />
      {team.office < 2 && <p class="hint-line">{t('team.needOffice2')}</p>}
    </>
  );
}
