import { makeAutoObservable, runInAction } from 'mobx';
import { defaultGameOption, setGameOption, type GameOptions } from '../common/gameOptions';
import { LocalStorage } from '../libs/localStorage';

/**
 * Performance presets: three levels over the options that cost frames, and an
 * automatic mode that moves between them by the measured frame rate, with
 * hysteresis so it does not flicker. A preset only writes options through
 * `setGameOption`, so the Options window shows (and can fine-tune) the result.
 */

export type PerformancePreset = 'full' | 'reduced' | 'minimum';
export type PerformanceMode = PerformancePreset | 'auto';

const LEVELS: readonly PerformancePreset[] = ['full', 'reduced', 'minimum'];

type Managed = Pick<
  GameOptions,
  | 'shadows'
  | 'postProcessing'
  | 'fxaa'
  | 'msaa'
  | 'bloom'
  | 'glow'
  | 'sunShafts'
  | 'dynamicLights'
  | 'lightingQuality'
  | 'materialQuality'
  | 'renderScale'
  | 'effectLevel'
  | 'itemEffects'
  | 'ambientParticles'
  | 'clouds'
  | 'weatherEffects'
  | 'animatedWater'
  | 'grassDensity'
  | 'advancedEffects'
  | 'monsterEffects'
>;

const MANAGED: readonly (keyof Managed)[] = [
  'shadows',
  'postProcessing',
  'fxaa',
  'msaa',
  'bloom',
  'glow',
  'sunShafts',
  'dynamicLights',
  'lightingQuality',
  'materialQuality',
  'renderScale',
  'effectLevel',
  'itemEffects',
  'ambientParticles',
  'clouds',
  'weatherEffects',
  'animatedWater',
  'grassDensity',
  'advancedEffects',
  'monsterEffects',
];

/** The option values of a preset; `full` is what a fresh install ships with. */
export function presetValues(preset: PerformancePreset, defaults: (key: keyof Managed) => Managed[keyof Managed] = defaultGameOption): Managed {
  const full = Object.fromEntries(MANAGED.map(key => [key, defaults(key)])) as Managed;
  if (preset === 'full') return full;
  if (preset === 'reduced') {
    return {
      ...full,
      shadows: false,
      msaa: 0,
      sunShafts: 0,
      bloom: Math.min(full.bloom, 2),
      glow: Math.min(full.glow, 3),
      dynamicLights: false,
      lightingQuality: Math.min(full.lightingQuality, 1),
      materialQuality: Math.min(full.materialQuality, 1),
      // 0.8 of the window: the cheap half of the gain measured on integrated graphics.
      renderScale: Math.max(full.renderScale, 2),
      effectLevel: Math.min(full.effectLevel, 2),
      itemEffects: Math.min(full.itemEffects, 1),
      ambientParticles: false,
      animatedWater: false,
      grassDensity: Math.min(full.grassDensity, 2),
      advancedEffects: false,
    };
  }
  return {
    shadows: false,
    postProcessing: false,
    fxaa: false,
    msaa: 0,
    bloom: 0,
    glow: 0,
    sunShafts: 0,
    dynamicLights: false,
    lightingQuality: 0,
    materialQuality: 0,
    // 0.6 of the window: upstream measured 15 fps at 1 and 29 at 0.6 on a Radeon 610M.
    renderScale: 4,
    effectLevel: 0,
    itemEffects: 0,
    ambientParticles: false,
    clouds: false,
    weatherEffects: false,
    animatedWater: false,
    grassDensity: 0,
    advancedEffects: false,
    monsterEffects: false,
  };
}

/** Thresholds of the automatic mode. */
export const AUTO = {
  lowFps: 25,
  highFps: 50,
  downAfterMs: 5_000,
  upAfterMs: 20_000,
  cooldownMs: 20_000,
} as const;

/** Where the automatic mode stands: a level index (0 full .. 2 minimum) and its timers. */
export type AutoState = { level: number; lowSince: number | null; highSince: number | null; changedAt: number };

/**
 * One frame-rate sample through the automatic mode: down a level after a
 * while below `lowFps`, up a level after a longer while above `highFps`, never
 * two changes within `cooldownMs`. Between the two thresholds nothing moves.
 */
export function nextAutoState(state: AutoState, fps: number, now: number, auto = AUTO): AutoState {
  const cool = now - state.changedAt >= auto.cooldownMs;
  if (fps < auto.lowFps) {
    const lowSince = state.lowSince ?? now;
    if (cool && state.level < LEVELS.length - 1 && now - lowSince >= auto.downAfterMs) {
      return { level: state.level + 1, lowSince: null, highSince: null, changedAt: now };
    }
    return { ...state, lowSince, highSince: null };
  }
  if (fps > auto.highFps) {
    const highSince = state.highSince ?? now;
    if (cool && state.level > 0 && now - highSince >= auto.upAfterMs) {
      return { level: state.level - 1, lowSince: null, highSince: null, changedAt: now };
    }
    return { ...state, highSince, lowSince: null };
  }
  return { ...state, lowSince: null, highSince: null };
}

const STORAGE_KEY = 'muidle.performance';

class PerformanceStore {
  mode: PerformanceMode = 'full';
  /** The level the automatic mode chose. */
  autoLevel: PerformancePreset = 'full';
  private auto: AutoState = { level: 0, lowSince: null, highSince: null, changedAt: 0 };

  constructor() {
    makeAutoObservable<this, 'auto'>(this, { auto: false });
    const stored = LocalStorage.load(STORAGE_KEY);
    if (stored === 'full' || stored === 'reduced' || stored === 'minimum' || stored === 'auto') this.mode = stored;
  }

  setMode(mode: PerformanceMode): void {
    this.mode = mode;
    LocalStorage.save(STORAGE_KEY, mode);
    if (mode === 'auto') {
      this.auto = { level: 0, lowSince: null, highSince: null, changedAt: Date.now() };
      this.autoLevel = 'full';
      apply('full');
    } else {
      apply(mode);
    }
  }

  /** One frame-rate sample (called every second while in the world). */
  sample(fps: number, now = Date.now()): void {
    if (this.mode !== 'auto' || !(fps > 0)) return;
    const next = nextAutoState(this.auto, fps, now);
    const changed = next.level !== this.auto.level;
    this.auto = next;
    if (changed) {
      runInAction(() => (this.autoLevel = LEVELS[next.level]));
      apply(LEVELS[next.level]);
    }
  }
}

function apply(preset: PerformancePreset): void {
  const values = presetValues(preset);
  for (const key of MANAGED) setGameOption(key, values[key] as never);
}

export const Performance = new PerformanceStore();
