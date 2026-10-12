// Team & buildings (GDD §10). Content and constants; rules live in sim/team.ts.

export type Role = 'designer' | 'engineer' | 'programmer' | 'researcher' | 'marketer' | 'producer';

export const ROLES: Role[] = ['designer', 'engineer', 'programmer', 'researcher', 'marketer', 'producer'];

/** Which development points a role produces (null = none). */
export const ROLE_OUTPUT: Record<Role, 'design' | 'tech' | 'software' | 'rp' | null> = {
  designer: 'design',
  engineer: 'tech',
  programmer: 'software',
  researcher: 'rp',
  marketer: null,
  producer: null,
};

/** Office level from which a role can be hired. */
export const ROLE_MIN_OFFICE: Record<Role, number> = {
  designer: 1,
  engineer: 1,
  programmer: 1,
  researcher: 1,
  marketer: 2,
  producer: 1,
};

/** Roles that need a game phase (production leads need the own factory). */
export const ROLE_MIN_PHASE: Partial<Record<Role, number>> = { producer: 3 };

export type TraitId = 'fast' | 'perfectionist' | 'nightOwl' | 'cheerful' | 'frugal' | 'mentor';

export interface TraitDef {
  id: TraitId;
  /** Output multiplier. */
  speed: number;
  /** Multiplier on this person's weight in the quality average. */
  quality: number;
  /** Salary multiplier. */
  salary: number;
  /** Team morale target bonus. */
  morale: number;
  /** Extra training gain multiplier for everyone else. */
  mentor: number;
}

export const TRAITS: TraitDef[] = [
  { id: 'fast', speed: 1.15, quality: 0.9, salary: 1, morale: 0, mentor: 0 },
  { id: 'perfectionist', speed: 0.9, quality: 1.25, salary: 1, morale: 0, mentor: 0 },
  { id: 'nightOwl', speed: 1.05, quality: 1, salary: 1, morale: 0, mentor: 0 },
  { id: 'cheerful', speed: 1, quality: 1, salary: 1, morale: 4, mentor: 0 },
  { id: 'frugal', speed: 1, quality: 1, salary: 0.9, morale: 0, mentor: 0 },
  { id: 'mentor', speed: 0.95, quality: 1, salary: 1.05, morale: 0, mentor: 0.25 },
];

export function traitById(id: TraitId): TraitDef {
  return TRAITS.find((t) => t.id === id) ?? TRAITS[2];
}

/** Startup office stages (GDD §10.3): seats, output bonus, upgrade price and weekly rent (2007 $). */
export const OFFICE_LEVELS = [
  { level: 1, seats: 4, bonus: 1.0, price: 25_000, rent: 3_000, comfort: 0 },
  { level: 2, seats: 8, bonus: 1.1, price: 120_000, rent: 7_000, comfort: 5 },
  { level: 3, seats: 14, bonus: 1.25, price: 600_000, rent: 18_000, comfort: 10 },
  { level: 4, seats: 24, bonus: 1.4, price: 3_000_000, rent: 45_000, comfort: 15 },
];

/** Research lab: research output +25 % per level. Running cost 1 % of the price per week. */
export const LAB_LEVELS = [
  { level: 1, price: 150_000, bonus: 0.25 },
  { level: 2, price: 500_000, bonus: 0.5 },
  { level: 3, price: 2_000_000, bonus: 0.75 },
];

/** Design studio: design points + review polish. Running cost 1 % of the price per week. */
export const STUDIO_LEVELS = [
  { level: 1, price: 250_000, bonus: 0.2, polish: 0.1 },
  { level: 2, price: 800_000, bonus: 0.35, polish: 0.2 },
  { level: 3, price: 3_000_000, bonus: 0.5, polish: 0.3 },
];

export const BUILDING_RENT_RATE = 0.01;

/** Salary per week = (base + perSkill · skill) · inflation (GDD §10.2). */
export const SALARY_BASE = 300;
export const SALARY_PER_SKILL = 25;
export const HIRE_FEE_WEEKS = 2;
export const TRAINING_WEEKS_COST = 4;
export const TRAINING_DAYS = 14;
export const APPLICANT_COUNT = 4;
export const APPLICANT_REFRESH_DAYS = 7;
/** Founder: generalist at the bench. */
export const FOUNDER_SKILL = 30;
/** Office-era phones need this many times the garage development points. */
export const OFFICE_DEV_SCALE = 3;
/** Team bonus: one week of salaries, then a cooldown. */
export const BONUS_COOLDOWN_DAYS = 28;
export const BONUS_MORALE = 20;
/** Morale below this makes people look for another job. */
export const QUIT_MORALE = 25;

/** Fictional first and last names (mixed origins, no celebrities). */
export const FIRST_NAMES = [
  'Mira', 'Jonas', 'Aylin', 'Theo', 'Priya', 'Lukas', 'Noor', 'Emil', 'Sofia', 'Kenji', 'Lea', 'Mateo',
  'Ines', 'Tariq', 'Hanna', 'Oskar', 'Yara', 'Felix', 'Amara', 'Nils', 'Rosa', 'Dario', 'Wen', 'Kofi',
  'Ida', 'Malik', 'Jule', 'Bruno', 'Lin', 'Esra', 'Pavel', 'Zoe',
];

export const LAST_NAMES = [
  'Brenner', 'Okafor', 'Lindqvist', 'Moreau', 'Tanaka', 'Kowalski', 'Haddad', 'Ferreira', 'Novak', 'Achterberg',
  'Castillo', 'Weiss', 'Nakamura', 'Duarte', 'Kaya', 'Sorensen', 'Petrov', 'Mbeki', 'Varga', 'Quint',
  'Hollis', 'Rautio', 'Sato', 'Bianchi',
];

/** Shirt colours for the 3D figures, per role. */
export const ROLE_COLORS: Record<Role, string> = {
  designer: '#ff7aa8',
  engineer: '#4f7cff',
  programmer: '#3cc48a',
  researcher: '#b18cff',
  marketer: '#ffb020',
  producer: '#ff6a2a',
};
