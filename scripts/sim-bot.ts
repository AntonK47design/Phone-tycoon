// Headless balancing bot: npm run sim:bot -- --minutes 120 --seed 42 --profile average
import { runBot, type BotProfile } from '../src/sim/bot';

const args = process.argv.slice(2);
const arg = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const minutes = Number(arg('minutes', '120'));
const seed = Number(arg('seed', '42'));
const profiles = arg('profile', 'average,optimizer,weak').split(',') as BotProfile[];
const every = Number(arg('every', '5'));

const fmt = (n: number) =>
  Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${Math.round(n)}`;

for (const profile of profiles) {
  const res = runBot({ minutes, seed, profile, sampleEveryMin: every });
  console.log(`\n## Bot "${profile}" – seed ${seed}, ${minutes} min`);
  const m = (x: number | null) => (x === null ? 'never' : `${x.toFixed(1)} min`);
  console.log(`first launch: ${res.firstLaunchSec}s · office gate: ${m(res.officeReadyMin)} · office rented: ${m(res.officeRentedMin)} · phase-3 gate: ${m(res.phase3Min)} · factory: ${m(res.factoryMin)} · phase-4 gate: ${m(res.phase4Min)}`);
  console.log('\n| min | date | phase | cash | valuation | launches | Ø review (last 5) | units/wk | brand | fans | research | share % | staff | payroll/wk | office | line lvls | built |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of res.samples) {
    console.log(`| ${s.minute} | ${s.date} | ${s.phase} | ${fmt(s.cash)} | ${fmt(s.valuation)} | ${s.launches} | ${s.avgReview} | ${s.unitsPerWeek} | ${s.brand} | ${s.fans} | ${s.research} | ${s.share} | ${s.staff} | ${fmt(s.payroll)} | ${s.office} | ${s.lines} | ${fmt(s.produced)} |`);
  }
  const max = Math.max(...res.samples.map((s) => s.cash), 1);
  console.log('\nCash over time:');
  for (const s of res.samples) {
    const bar = '█'.repeat(Math.max(0, Math.round((s.cash / max) * 50)));
    console.log(`${String(s.minute).padStart(6)} min ${bar} ${fmt(s.cash)}`);
  }
}
