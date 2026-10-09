import { mt, type MUIdleTextKey } from './text';
import type { HuntMapOption } from './state';

/** 1,234 / 12.3K / 4.56M / 7.89B. */
export function compact(value: number): string {
  const n = Math.floor(value);
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString('en-US');
}

/** The build presets of a class line (value null = the class default), or none. */
export function buildPresets(charClass: number): { value: string | null; label: MUIdleTextKey }[] {
  if (charClass >= 8 && charClass <= 11) return [{ value: null, label: 'build.elfDefault' }, { value: 'support', label: 'build.support' }];
  if (charClass >= 12 && charClass <= 15) return [{ value: null, label: 'build.strength' }, { value: 'energy', label: 'build.energy' }];
  if (charClass >= 16 && charClass <= 19) return [{ value: null, label: 'build.strength' }, { value: 'raven', label: 'build.raven' }];
  return [];
}

/** Why a map is out of reach for HUNT, as the server judged it. */
export function mapReasonText(option: Pick<HuntMapOption, 'reason' | 'minLevel' | 'fare'>): string {
  if (!option.reason) return '';
  return mt(`mapReason.${option.reason}` as MUIdleTextKey, { level: option.minLevel, zen: compact(option.fare) });
}
