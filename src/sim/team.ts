// Team & buildings (GDD §10): staff output, salaries, morale, training and upgrades.

import { FOUNDER_RP_PER_DAY } from '../data/components';
import { inflation } from '../data/eras';
import {
  APPLICANT_COUNT,
  APPLICANT_REFRESH_DAYS,
  BONUS_COOLDOWN_DAYS,
  BONUS_MORALE,
  BUILDING_RENT_RATE,
  FIRST_NAMES,
  FOUNDER_SKILL,
  HIRE_FEE_WEEKS,
  LAB_LEVELS,
  LAST_NAMES,
  OFFICE_DEV_SCALE,
  OFFICE_LEVELS,
  QUIT_MORALE,
  ROLE_MIN_OFFICE,
  ROLE_OUTPUT,
  ROLES,
  SALARY_BASE,
  SALARY_PER_SKILL,
  STUDIO_LEVELS,
  TRAINING_DAYS,
  TRAINING_WEEKS_COST,
  TRAITS,
  traitById,
  type Role,
} from '../data/team';
import { devPoints, FOUNDER_POINTS_PER_DAY } from './economy/market';
import type { SimEvent } from './events';
import { createRng, type Rng } from './rng';
import { clamp } from './scoring/score';
import type { Employee, GameState, PhoneDesign } from './state';
import { yearOf } from './time';

export function newTeam(): GameState['team'] {
  return { staff: [], applicants: [], nextId: 1, poolDay: -999, office: 0, lab: 0, studio: 0, boost: 0, lastBonusDay: -999 };
}

export function salary(e: Pick<Employee, 'skill' | 'trait'>, year: number): number {
  return (SALARY_BASE + SALARY_PER_SKILL * e.skill) * inflation(Math.floor(year)) * traitById(e.trait).salary;
}

export function hireFee(e: Employee, year: number): number {
  return HIRE_FEE_WEEKS * salary(e, year);
}

export function trainingCost(e: Employee, year: number): number {
  return TRAINING_WEEKS_COST * salary(e, year);
}

export function payroll(state: GameState): number {
  const year = yearOf(state.day);
  return state.team.staff.reduce((a, e) => a + salary(e, year), 0);
}

export function seats(state: GameState): number {
  return state.team.office > 0 ? OFFICE_LEVELS[state.team.office - 1].seats : 0;
}

export function officeBonus(state: GameState): number {
  return state.team.office > 0 ? OFFICE_LEVELS[state.team.office - 1].bonus : 1;
}

export function moraleFactor(morale: number): number {
  return 0.7 + (0.5 * clamp(morale, 0, 100)) / 100;
}

export function isWorking(e: Employee, day: number): boolean {
  return e.trainingUntil === null || day >= e.trainingUntil;
}

/** Points per day of one employee (GDD §6.3). */
export function employeeOutput(state: GameState, e: Employee): number {
  if (!isWorking(e, state.day)) return 0;
  return (e.skill / 10) * moraleFactor(e.morale) * officeBonus(state) * traitById(e.trait).speed;
}

export interface TeamRates {
  design: number;
  tech: number;
  software: number;
  rp: number;
}

/** Development and research points per day, founder included. */
export function teamRates(state: GameState): TeamRates {
  const f = FOUNDER_POINTS_PER_DAY;
  const r: TeamRates = { design: f, tech: f, software: f, rp: state.phase >= 2 ? FOUNDER_RP_PER_DAY : 0 };
  for (const e of state.team.staff) {
    const out = ROLE_OUTPUT[e.role];
    if (out) r[out] += employeeOutput(state, e);
  }
  if (state.team.studio > 0) r.design *= 1 + STUDIO_LEVELS[state.team.studio - 1].bonus;
  if (state.team.lab > 0) r.rp *= 1 + LAB_LEVELS[state.team.lab - 1].bonus;
  return r;
}

/** Development points a design needs at the company's current stage. */
export function devRequired(state: GameState, design: PhoneDesign): { design: number; tech: number; software: number } {
  const p = devPoints(design);
  const k = state.phase >= 2 ? OFFICE_DEV_SCALE : 1;
  return { design: p.design * k, tech: p.tech * k, software: p.software * k };
}

export function devDaysFor(state: GameState, design: PhoneDesign, rates = teamRates(state)): number {
  const req = devRequired(state, design);
  return Math.ceil(Math.max(req.design / rates.design, req.tech / rates.tech, req.software / rates.software));
}

/** Skill the market expects from a phone team in `year` (complexity reference, GDD §5.8). */
export function expectedSkill(year: number): number {
  return Math.min(95, 30 + 2.5 * (year - 2007));
}

/** Weighted average skill of everyone who builds phones (founder included). */
export function teamSkill(state: GameState): number {
  let sum = FOUNDER_SKILL * 2;
  let w = 2;
  for (const e of state.team.staff) {
    if (!ROLE_OUTPUT[e.role] || ROLE_OUTPUT[e.role] === 'rp') continue;
    const weight = (e.skill / 10) * traitById(e.trait).quality;
    sum += e.skill * weight;
    w += weight;
  }
  return sum / w;
}

/** Development quality q (GDD §5.8): a team below the era's standard ships rougher phones. */
export function teamQuality(state: GameState): number {
  if (state.phase < 2) return 1;
  return clamp(1 + 0.3 * (teamSkill(state) / expectedSkill(yearOf(state.day)) - 1), 0.9, 1.08);
}

/** Review bonus from the design studio. */
export function studioPolish(state: GameState): number {
  return state.team.studio > 0 ? STUDIO_LEVELS[state.team.studio - 1].polish : 0;
}

/** Hype multiplier from the marketing team (+5 % per average marketer, max +60 %). */
export function marketingBoost(state: GameState): number {
  let b = 0;
  for (const e of state.team.staff) if (e.role === 'marketer' && isWorking(e, state.day)) b += 0.05 * (e.skill / 30) * moraleFactor(e.morale);
  return 1 + Math.min(0.6, b);
}

/** Weekly rent for office, lab and studio. */
export function buildingRent(state: GameState): number {
  const inf = inflation(Math.floor(yearOf(state.day)));
  let rent = state.team.office > 0 ? OFFICE_LEVELS[state.team.office - 1].rent : 0;
  if (state.team.lab > 0) rent += LAB_LEVELS[state.team.lab - 1].price * BUILDING_RENT_RATE;
  if (state.team.studio > 0) rent += STUDIO_LEVELS[state.team.studio - 1].price * BUILDING_RENT_RATE;
  return rent * inf;
}

export function rolesAvailable(state: GameState): Role[] {
  return ROLES.filter((r) => state.team.office >= ROLE_MIN_OFFICE[r]);
}

function makePerson(state: GameState, rng: Rng, role: Role): Employee {
  const year = yearOf(state.day);
  const lo = 10 + Math.min(45, state.company.brand / 4 + (year - 2007) * 2.5);
  const skill = clamp(Math.round(lo + rng.next() * 30), 1, 100);
  return {
    id: state.team.nextId++,
    first: rng.pick(FIRST_NAMES),
    last: rng.pick(LAST_NAMES),
    role,
    skill,
    morale: 70,
    trait: rng.pick(TRAITS).id,
    hiredDay: state.day,
    trainingUntil: null,
    look: rng.int(0, 9999),
  };
}

/** New applicant pool: a mix of roles, skill rising with the year and the brand. */
export function refreshApplicants(state: GameState): void {
  if (state.team.office < 1) return;
  const rng = createRng(state.rng);
  const roles = rolesAvailable(state);
  const start = rng.int(0, roles.length - 1);
  state.team.applicants = [];
  for (let i = 0; i < APPLICANT_COUNT; i++) {
    // Mostly round-robin so every pool offers different roles, with some randomness.
    const role = rng.next() < 0.75 ? roles[(start + i) % roles.length] : rng.pick(roles);
    state.team.applicants.push(makePerson(state, rng, role));
  }
  state.team.poolDay = state.day;
  state.rng = rng.state;
}

export type TeamAction =
  | { type: 'hire'; id: number }
  | { type: 'fire'; id: number }
  | { type: 'train'; id: number }
  | { type: 'upgradeOffice' }
  | { type: 'buildLab' }
  | { type: 'buildStudio' }
  | { type: 'payBonus' };

export function officeUpgradeCost(state: GameState): number | null {
  const next = OFFICE_LEVELS[state.team.office];
  if (!next || state.team.office < 1) return null;
  return next.price * inflation(Math.floor(yearOf(state.day)));
}

export function labCost(state: GameState): number | null {
  const next = LAB_LEVELS[state.team.lab];
  return next ? next.price * inflation(Math.floor(yearOf(state.day))) : null;
}

export function studioCost(state: GameState): number | null {
  const next = STUDIO_LEVELS[state.team.studio];
  return next ? next.price * inflation(Math.floor(yearOf(state.day))) : null;
}

export function bonusCost(state: GameState): number {
  return payroll(state);
}

export function bonusReady(state: GameState): boolean {
  return state.team.staff.length > 0 && state.day - state.team.lastBonusDay >= BONUS_COOLDOWN_DAYS;
}

function pay(state: GameState, amount: number): boolean {
  if (state.company.cash < amount) return false;
  state.company.cash -= amount;
  return true;
}

export function applyTeamAction(state: GameState, action: TeamAction): SimEvent[] {
  const year = yearOf(state.day);
  const team = state.team;
  if (team.office < 1) return [{ type: 'rejected', reason: 'notReady' }];
  switch (action.type) {
    case 'hire': {
      const idx = team.applicants.findIndex((a) => a.id === action.id);
      if (idx < 0) return [{ type: 'rejected', reason: 'notReady' }];
      if (team.staff.length >= seats(state)) return [{ type: 'rejected', reason: 'noSeats' }];
      const person = team.applicants[idx];
      if (!pay(state, hireFee(person, year))) return [{ type: 'rejected', reason: 'noCash' }];
      team.applicants.splice(idx, 1);
      person.hiredDay = state.day;
      team.staff.push(person);
      state.stats.hires += 1;
      return [{ type: 'hired', id: person.id, role: person.role }];
    }
    case 'fire': {
      const idx = team.staff.findIndex((e) => e.id === action.id);
      if (idx < 0) return [];
      const [gone] = team.staff.splice(idx, 1);
      // Severance: one week's salary. Colleagues are not thrilled.
      state.company.cash -= salary(gone, year);
      for (const e of team.staff) e.morale = clamp(e.morale - 4, 0, 100);
      return [{ type: 'fired', id: gone.id }];
    }
    case 'train': {
      const e = team.staff.find((x) => x.id === action.id);
      if (!e || !isWorking(e, state.day) || e.skill >= 100) return [{ type: 'rejected', reason: 'busy' }];
      if (!pay(state, trainingCost(e, year))) return [{ type: 'rejected', reason: 'noCash' }];
      e.trainingUntil = state.day + TRAINING_DAYS;
      e.morale = clamp(e.morale + 5, 0, 100);
      state.stats.trainings += 1;
      return [{ type: 'trainingStarted', id: e.id }];
    }
    case 'upgradeOffice': {
      const cost = officeUpgradeCost(state);
      if (cost === null) return [{ type: 'rejected', reason: 'notReady' }];
      if (!pay(state, cost)) return [{ type: 'rejected', reason: 'noCash' }];
      team.office += 1;
      refreshApplicants(state);
      return [{ type: 'officeUpgraded', level: team.office }];
    }
    case 'buildLab': {
      const cost = labCost(state);
      if (cost === null || team.office < 2) return [{ type: 'rejected', reason: 'notReady' }];
      if (!pay(state, cost)) return [{ type: 'rejected', reason: 'noCash' }];
      team.lab += 1;
      return [{ type: 'labBuilt', level: team.lab }];
    }
    case 'buildStudio': {
      const cost = studioCost(state);
      if (cost === null || team.office < 2) return [{ type: 'rejected', reason: 'notReady' }];
      if (!pay(state, cost)) return [{ type: 'rejected', reason: 'noCash' }];
      team.studio += 1;
      return [{ type: 'studioBuilt', level: team.studio }];
    }
    case 'payBonus': {
      if (!bonusReady(state)) return [{ type: 'rejected', reason: 'busy' }];
      if (!pay(state, bonusCost(state))) return [{ type: 'rejected', reason: 'noCash' }];
      team.boost = Math.min(30, team.boost + BONUS_MORALE);
      team.lastBonusDay = state.day;
      for (const e of team.staff) e.morale = clamp(e.morale + 10, 0, 100);
      return [{ type: 'bonusPaid' }];
    }
  }
}

/** Daily team upkeep: finished trainings and a fresh applicant pool each week. */
export function tickTeamDay(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const team = state.team;
  if (team.office < 1) return events;
  const mentor = Math.min(0.5, team.staff.reduce((a, e) => a + traitById(e.trait).mentor, 0));
  for (const e of team.staff) {
    if (e.trainingUntil !== null && state.day >= e.trainingUntil) {
      const self = traitById(e.trait).mentor;
      const gain = 8 * (1 - e.skill / 120) * (1 + mentor - self);
      e.skill = clamp(Math.round(e.skill + gain), 1, 100);
      e.trainingUntil = null;
      events.push({ type: 'trainingDone', id: e.id, skill: e.skill });
    }
  }
  if (state.day - team.poolDay >= APPLICANT_REFRESH_DAYS) refreshApplicants(state);
  return events;
}

/** Morale target: office comfort, cheerful colleagues, bonuses and the last launch's reception. */
export function moraleTarget(state: GameState): number {
  const team = state.team;
  const comfort = team.office > 0 ? OFFICE_LEVELS[team.office - 1].comfort : 0;
  const cheer = Math.min(10, team.staff.reduce((a, e) => a + traitById(e.trait).morale, 0));
  const last = state.products[state.products.length - 1];
  const success = last ? 10 * clamp((last.review.score - 6.5) / 1.5, -1, 1) : 0;
  const crowd = team.staff.length > seats(state) ? -10 : 0;
  const debt = state.company.debt > 0 && state.company.cash < payroll(state) * 2 ? -8 : 0;
  return clamp(58 + comfort + cheer + team.boost + success + crowd + debt, 0, 100);
}

/** Weekly: morale drifts to its target; very unhappy people may leave. */
export function tickTeamWeek(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const team = state.team;
  if (!team.staff.length) {
    team.boost *= 0.7;
    return events;
  }
  const target = moraleTarget(state);
  const rng = createRng(state.rng);
  for (const e of [...team.staff]) {
    e.morale = clamp(e.morale + (target - e.morale) * 0.3, 0, 100);
    if (e.morale < QUIT_MORALE && rng.next() < 0.25) {
      team.staff.splice(team.staff.indexOf(e), 1);
      events.push({ type: 'staffQuit', id: e.id, name: `${e.first} ${e.last}` });
    }
  }
  state.rng = rng.state;
  team.boost *= 0.7;
  return events;
}
