// Reacts to simulation events with sound, toasts, coins and 3D effects.

import { sfx } from '../audio/sfx';
import { colorById } from '../data/design';
import { GOALS } from '../data/goals';
import type { SimEvent } from '../sim/events';
import { money } from './format';
import { game, hubView, launchData, sayBark, toast } from './game';
import { lang, t, tList } from './i18n';
import { researchNameById, rivalName } from './labels';

let lastCoin = 0;
const deferred: (() => void)[] = [];

/** Toasts are held back while the launch sequence is on screen. */
function later(fn: () => void) {
  if (launchData.value) deferred.push(fn);
  else fn();
}

export function flushDeferred() {
  const list = deferred.splice(0);
  list.forEach((fn, i) => setTimeout(fn, 300 + i * 600));
}

export function cashTarget(): DOMRect | null {
  return document.querySelector('.cash')?.getBoundingClientRect() ?? null;
}

export function flyCoins(from: { x: number; y: number }, count: number) {
  const layer = document.getElementById('fx-layer');
  const target = cashTarget();
  if (!layer || !target) return;
  const tx = target.left + 28;
  const ty = target.top + target.height / 2;
  for (let i = 0; i < count; i++) {
    const coin = document.createElement('div');
    coin.className = 'coin';
    layer.appendChild(coin);
    const sx = from.x + (Math.random() - 0.5) * 40;
    const sy = from.y + (Math.random() - 0.5) * 30;
    const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 120;
    const my = Math.min(sy, ty) - 60 - Math.random() * 60;
    const anim = coin.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${mx}px, ${my}px) scale(1.1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${tx}px, ${ty}px) scale(0.6)`, opacity: 0.9 },
      ],
      { duration: 700 + Math.random() * 250, delay: i * 70, easing: 'cubic-bezier(.4,.1,.6,1)', fill: 'both' },
    );
    anim.onfinish = () => {
      coin.remove();
      const chip = document.querySelector('.cash');
      chip?.classList.remove('flash');
      void (chip as HTMLElement | null)?.offsetWidth;
      chip?.classList.add('flash');
    };
  }
}

function floatMoney(amount: number) {
  const layer = document.getElementById('fx-layer');
  const target = cashTarget();
  if (!layer || !target) return;
  const el = document.createElement('div');
  el.className = 'float-money';
  el.textContent = `+${money(amount, lang.value)}`;
  el.style.left = `${target.left + target.width / 2}px`;
  el.style.top = `${target.bottom + 2}px`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

export function installJuice() {
  const { store, engine, platform } = game();
  store.onEvents((events: SimEvent[]) => {
    for (const e of events) {
      switch (e.type) {
        case 'sales': {
          const now = performance.now();
          if (launchData.value || now - lastCoin < 650) break;
          lastCoin = now;
          const p = engine.project('phone');
          if (p.visible) flyCoins(p, Math.min(4, 1 + Math.floor(e.units / 4)));
          floatMoney(e.profit);
          sfx.coin(0.9 + Math.random() * 0.2);
          if (Math.random() < 0.06) sayBark(tList('barks.sold'));
          break;
        }
        case 'goalCompleted': {
          later(() => {
            const g = GOALS.find((x) => x.id === e.goalId);
            if (!g) return;
            toast(`${t('goals.done')} ${t(`goals.${g.id}`)}`, 'trophy', true);
            sfx.unlock2();
          });
          break;
        }
        case 'colorUnlocked':
          later(() => toast(t('launch.unlockColor', { color: t(`color.${e.colorId}`) }), 'paint'));
          void colorById(e.colorId);
          break;
        case 'devStarted':
          sfx.whoosh();
          break;
        case 'devDone':
          if (store.getState().stats.launches > 0) {
            toast(t('toast.devDone'), 'spark', true);
            sfx.unlock2();
            engine.confettiAt('bench');
          }
          break;
        case 'officeReady':
          later(() => {
            toast(t('toast.officeReady'), 'building', true);
            sfx.fanfare();
            platform.happytime();
          });
          break;
        case 'productRetired': {
          const p = store.getState().products.find((x) => x.id === e.productId);
          if (p) toast(t('toast.retired', { name: p.design.name }), 'box');
          break;
        }
        case 'officeRented':
          toast(t('office.rented'), 'building', true);
          engine.confettiAt('bench');
          platform.happytime();
          break;
        case 'researchDone':
          later(() => {
            toast(t('toast.researchDone', { name: researchNameById(e.id) }), 'spark', true);
            sfx.unlock2();
          });
          break;
        case 'orderArrived': {
          const p = store.getState().products.find((x) => x.id === e.productId);
          if (p) toast(t('toast.orderArrived', { n: e.units, name: p.design.name }), 'box');
          break;
        }
        case 'soldOut': {
          const p = store.getState().products.find((x) => x.id === e.productId);
          if (p && p.orders.length === 0) toast(t('toast.soldOut', { name: p.design.name }), 'warn');
          break;
        }
        case 'factoryBuilt':
          toast(t('toast.factoryBuilt'), 'building', true);
          // Show it off right away.
          hubView.value = 'factory';
          engine.goToView('factory', 1.4);
          sfx.fanfare();
          platform.happytime();
          break;
        case 'factoryGrown':
          toast(t('toast.factoryGrown'), 'building', true);
          break;
        case 'lineAdded':
          toast(t('toast.lineAdded'), 'box');
          break;
        case 'lineUpgraded':
          toast(t('toast.lineUpgraded', { level: e.level }), 'box');
          break;
        case 'warehouseUpgraded':
          toast(t('toast.warehouseUpgraded'), 'box');
          break;
        case 'phase4Ready':
          later(() => {
            toast(t('toast.phase4'), 'trophy', true);
            sfx.fanfare();
            platform.happytime();
          });
          break;
        case 'rivalLaunch':
          if (Math.random() < 0.5) sfx.click();
          break;
        case 'rivalPriceCut':
          toast(t('toast.priceCut', { rival: rivalName(e.rival), segment: t(`segment.${e.segment}`) }), 'warn');
          break;
        case 'eventStarted':
          if (e.id !== 'chipShortage' && e.id !== 'recall') later(() => toast(t(`event.${e.id}.toast`, { rival: e.target ? rivalName(e.target) : '', region: e.target ? t(`region.${e.target}`) : '' }), e.id === 'recession' || e.id === 'tariff' ? 'warn' : 'spark', true));
          else sfx.unlock2();
          break;
        case 'eventEnded':
          toast(t(`event.${e.id}.end`), 'spark');
          break;
        case 'regionEntered':
          toast(t('toast.regionEntered', { region: t(`region.${e.region}`) }), 'building', true);
          platform.happytime();
          break;
        case 'storeOpened': {
          toast(t('toast.storeOpened', { region: t(`region.${e.region}`) }), 'building', true);
          // The very first store: go and have a look.
          const total = Object.values(store.getState().regions.stores).reduce((a, b) => a + b, 0);
          if (total === 1) {
            hubView.value = 'store';
            engine.goToView('store', 1.4);
          }
          break;
        }
        case 'contractOffered':
          toast(t('toast.contractOffered'), 'box');
          break;
        case 'contractDone':
          floatMoney(e.payout);
          toast(t('toast.contractDone', { amount: money(e.payout, lang.value) }), 'trophy', true);
          break;
        case 'contractFailed':
          toast(t('toast.contractFailed'), 'warn');
          break;
        case 'repaid':
          toast(t('toast.repaid', { amount: money(e.amount, lang.value) }), 'spark');
          break;
        case 'loan':
          toast(t('toast.loan', { amount: money(e.amount, lang.value) }), 'warn');
          break;
        case 'phase3Ready':
          later(() => {
            toast(t('toast.phase3'), 'trophy', true);
            sfx.fanfare();
            platform.happytime();
          });
          break;
        case 'hired': {
          const p = store.getState().team.staff.find((x) => x.id === e.id);
          if (p) toast(t('toast.hired', { name: p.first, role: t(`team.role.${p.role}`) }), 'spark');
          break;
        }
        case 'trainingDone': {
          const p = store.getState().team.staff.find((x) => x.id === e.id);
          if (p) toast(t('toast.trained', { name: p.first, skill: e.skill }), 'trophy');
          sfx.unlock2();
          break;
        }
        case 'staffQuit':
          toast(t('toast.quit', { name: e.name }), 'warn');
          break;
        case 'officeUpgraded':
          toast(t('toast.officeUpgraded', { level: e.level }), 'building', true);
          platform.happytime();
          break;
        case 'labBuilt':
          toast(t('toast.labBuilt', { level: e.level }), 'building', true);
          break;
        case 'studioBuilt':
          toast(t('toast.studioBuilt', { level: e.level }), 'building', true);
          break;
        case 'bonusPaid':
          toast(t('toast.bonus'), 'spark');
          break;
        case 'dailyDone':
          later(() => toast(t('toast.dailyDone'), 'trophy', true));
          break;
        case 'calendarClaimed':
          floatMoney(e.cash);
          if (e.cosmetic) later(() => toast(t('toast.aurora'), 'paint', true));
          break;
        case 'dailyClaimed':
          if (e.reward.cash) floatMoney(e.reward.cash);
          break;
        default:
          break;
      }
    }
  });
}
