import './style.less';
import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../../../store';
import {
  MUIdle,
  DEFAULT_IDLE_SETTINGS,
  huntMapMode,
  withHuntMapMode,
  type HuntActivity,
  type HuntMapOption,
  type IdleSettings,
  type OfflineSummary,
} from '../../../../../muidle/state';
import { mt, type MUIdleTextKey } from '../../../../../muidle/text';
import { toggleMuHelperWindow } from '../../../../../muHelper/state';
import { combatPower } from '../../../../../muidle/combatPower';
import { itemDisplayName } from '../../../../../common/itemTooltip';
import { EventsWindow } from './events';
import { ProgressionWindow } from './progression';
import { Performance, type PerformanceMode } from '../../../../../muidle/performance';

/**
 * MUIdle's HUD: the HUNT/MANUAL switch (always on screen, sized for a thumb),
 * a compact status strip, the idle settings and the offline summary. Plain
 * HTML over the canvas on purpose - big, legible and touchable on a phone,
 * which the original's pixel windows are not.
 */

function compact(value: number): string {
  const n = Math.floor(value);
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString('en-US');
}

function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** The build presets of a class line (value null = the class default), or none. */
function buildPresets(charClass: number): { value: string | null; label: MUIdleTextKey }[] {
  if (charClass >= 8 && charClass <= 11) return [{ value: null, label: 'build.elfDefault' }, { value: 'support', label: 'build.support' }];
  if (charClass >= 12 && charClass <= 15) return [{ value: null, label: 'build.strength' }, { value: 'energy', label: 'build.energy' }];
  if (charClass >= 16 && charClass <= 19) return [{ value: null, label: 'build.strength' }, { value: 'raven', label: 'build.raven' }];
  return [];
}

function mapReasonText(option: Pick<HuntMapOption, 'reason' | 'minLevel' | 'fare'>): string {
  if (!option.reason) return '';
  return mt(`mapReason.${option.reason}` as MUIdleTextKey, { level: option.minLevel, zen: compact(option.fare) });
}

function activityText(activity: HuntActivity): string {
  return mt(`activity.${activity.kind}` as MUIdleTextKey, {
    map: activity.map ?? '',
    have: compact(activity.pause?.have ?? 0),
    need: compact(activity.pause?.need ?? 0),
  });
}

/** What the hunt is doing now, and why it is not on the chosen map when it is not. */
const ActivityLine = observer(() => {
  const activity = MUIdle.activity;
  if (!activity) return null;
  const pinned = MUIdle.settings?.preferredMap ?? null;
  const option = pinned === null ? undefined : MUIdle.maps.find(m => m.number === pinned);
  return (
    <div className="muidle-activity" aria-live="polite">
      <span>{activityText(activity)}</span>
      {activity.pinnedReason && option && (
        <span className="muidle-activity-warn">
          {mt('pinnedUnavailable', { reason: mapReasonText({ ...option, reason: activity.pinnedReason }) })}
        </span>
      )}
      {activity.notes?.map(note => (
        <span key={note.reason} className="muidle-activity-warn">
          {mt(`note.${note.reason}` as MUIdleTextKey, { have: compact(note.have), need: compact(note.need) })}
        </span>
      ))}
    </div>
  );
});

const PerformanceSampler = () => {
  usePerformanceSampler();
  return null;
};

const StatusStrip = observer(() => {
  // The HUD only exists on the world page; `playerData` is observable (the
  // world/entity handles are not, so they cannot gate a render).
  const p = Store.playerData;
  if (!p.name) return null;
  return (
    <div className="muidle-strip" aria-label="character status">
      <span className="muidle-strip-name">{p.name}</span>
      <span>Lv {p.level}</span>
      <span>Zen {compact(p.money)}</span>
      <span>{mt('cp')} {compact(combatPower())}</span>
    </div>
  );
});

const HuntButton = observer(() => {
  if (!Store.playerData.name || Store.isOffline) return null;
  const hunting = MUIdle.hunting;
  return (
    <div className="muidle-hunt">
      <button
        type="button"
        className={`muidle-hunt-button ${hunting ? 'is-hunting' : 'is-manual'}`}
        title={hunting ? mt('huntHint') : mt('manualHint')}
        aria-pressed={hunting}
        onClick={() => MUIdle.toggleHunt()}
      >
        <span className="muidle-hunt-dot" />
        {hunting ? mt('hunt') : mt('manual')}
      </button>
      <button
        type="button"
        className="muidle-gear"
        aria-label={mt('idleSettings')}
        title={mt('idleSettings')}
        onClick={() => MUIdle.openSettings()}
      >
        ⚙
      </button>
    </div>
  );
});

const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => (
  <label className="muidle-toggle">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

/** First backpack slot: 0..11 are the equipped items, which are never sold anyway. */
const FIRST_BACKPACK_SLOT = 12;

/** The backpack with a lock per item: a locked item is never sold automatically. */
const LockedItems = observer(() => {
  const items = Store.playerData.items
    .map((item, slot) => ({ item, slot }))
    .filter(({ item, slot }) => item && slot >= FIRST_BACKPACK_SLOT);
  if (!items.length) return null;
  return (
    <div className="muidle-locks">
      <h3>{mt('lockedItems')}</h3>
      <ul>
        {items.map(({ item, slot }) => {
          const locked = MUIdle.isSlotLocked(slot);
          return (
            <li key={slot} className={locked ? 'is-locked' : ''}>
              <span>{itemDisplayName(item!)}</span>
              <button
                type="button"
                aria-pressed={locked}
                title={locked ? mt('unlock') : mt('lock')}
                onClick={() => MUIdle.lockItem(slot, !locked)}
              >
                {locked ? '🔒' : '🔓'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

const SettingsPanel = observer(() => {
  const [draft, setDraft] = useState<IdleSettings | null>(null);
  if (!MUIdle.settingsOpen) return null;
  const current = draft ?? MUIdle.settings ?? DEFAULT_IDLE_SETTINGS;
  const set = (patch: Partial<IdleSettings>) => setDraft({ ...current, ...patch });
  const close = () => {
    setDraft(null);
    MUIdle.openSettings(false);
  };

  return (
    <div className="muidle-backdrop" onPointerDown={e => e.stopPropagation()}>
      <div className="muidle-panel" role="dialog" aria-label={mt('idleSettings')}>
        <h2>{mt('idleSettings')}</h2>
        <div className="muidle-row">
          <button
            type="button"
            className={`muidle-hunt-button wide ${MUIdle.hunting ? 'is-hunting' : 'is-manual'}`}
            onClick={() => MUIdle.toggleHunt()}
          >
            <span className="muidle-hunt-dot" />
            {MUIdle.hunting ? mt('hunt') : mt('manual')}
          </button>
        </div>
        <button
          type="button"
          className="muidle-link"
          onClick={() => {
            close();
            toggleMuHelperWindow(true);
          }}
        >
          {mt('helperSettings')}
        </button>
        <button
          type="button"
          className="muidle-link"
          onClick={() => {
            close();
            MUIdle.openProgression(true);
          }}
        >
          {mt('progression')} (B)
        </button>
        <label className="muidle-select">
          <span>{mt('performance')}</span>
          <select value={Performance.mode} onChange={e => Performance.setMode(e.target.value as PerformanceMode)}>
            {(['full', 'reduced', 'minimum', 'auto'] as const).map(mode => (
              <option key={mode} value={mode}>
                {mt(`perf.${mode}` as MUIdleTextKey)}
              </option>
            ))}
          </select>
        </label>
        {Performance.mode === 'auto' && (
          <p className="muidle-note">{mt('perfAutoNow', { level: mt(`perf.${Performance.autoLevel}` as MUIdleTextKey) })}</p>
        )}
        <Toggle label={mt('autoTravel')} checked={current.autoTravel} onChange={v => set({ autoTravel: v })} />
        <label className="muidle-select">
          <span>{mt('huntMap')}</span>
          <select
            value={String(huntMapMode(current))}
            onChange={e => {
              const value = e.target.value;
              set(withHuntMapMode(current, value === 'auto' || value === 'manual' ? value : Number(value)));
            }}
          >
            <option value="auto">{mt('huntMap.auto')}</option>
            <option value="manual">{mt('huntMap.manual')}</option>
            {MUIdle.maps.map(m => (
              <option key={m.number} value={m.number} disabled={!m.available}>
                {m.available ? m.name : `${m.name} - ${mapReasonText(m)}`}
              </option>
            ))}
          </select>
        </label>
        <Toggle
          label={mt('keepHuntingAfterDeath')}
          checked={current.keepHuntingAfterDeath}
          onChange={v => set({ keepHuntingAfterDeath: v })}
        />
        <Toggle label={mt('autoSell')} checked={current.autoSell} onChange={v => set({ autoSell: v })} />
        <Toggle label={mt('autoRepair')} checked={current.autoRepair} onChange={v => set({ autoRepair: v })} />
        <Toggle
          label={mt('autoBuyPotions')}
          checked={current.autoBuyPotions}
          onChange={v => set({ autoBuyPotions: v })}
        />
        <Toggle label={mt('autoBuild')} checked={current.autoBuild} onChange={v => set({ autoBuild: v })} />
        {current.autoBuild && buildPresets(Store.playerData.charClass).length > 0 && (
          <label className="muidle-select">
            <span>{mt('buildPreset')}</span>
            <select value={current.buildPreset ?? ''} onChange={e => set({ buildPreset: e.target.value || null })}>
              {buildPresets(Store.playerData.charClass).map(p => (
                <option key={p.value ?? 'default'} value={p.value ?? ''}>
                  {mt(p.label)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="muidle-range">
          <span>{mt('sellMaxItemLevel', { level: current.sellMaxItemLevel })}</span>
          <input
            type="range"
            min={0}
            max={9}
            value={current.sellMaxItemLevel}
            onChange={e => set({ sellMaxItemLevel: Number(e.target.value) })}
          />
        </label>
        <p className="muidle-note">{mt('alwaysKept')}</p>
        <LockedItems />
        <div className="muidle-actions">
          <button
            type="button"
            className="muidle-primary"
            onClick={() => {
              MUIdle.saveSettings(current);
              close();
            }}
          >
            {mt('save')}
          </button>
          <button type="button" onClick={close}>
            {mt('close')}
          </button>
        </div>
      </div>
    </div>
  );
});

const SummaryRow = ({ label, value }: { label: MUIdleTextKey; value: string }) => (
  <div className="muidle-summary-row">
    <span>{mt(label)}</span>
    <strong>{value}</strong>
  </div>
);

const SummaryModal = observer(() => {
  const s: OfflineSummary | null = MUIdle.summary;
  if (!s) return null;
  const started = Date.parse(s.startedUtc);
  const ended = s.endedUtc ? Date.parse(s.endedUtc) : Date.now();
  const reasonKey = `reason.${s.endReason ?? 'returned'}` as MUIdleTextKey;
  return (
    <div className="muidle-backdrop" onPointerDown={e => e.stopPropagation()}>
      <div className="muidle-panel muidle-summary" role="dialog" aria-label={mt('offlineProgress')}>
        <h2>{mt('offlineProgress')}</h2>
        <SummaryRow label="offlineTime" value={duration(ended - started)} />
        <SummaryRow label="monsters" value={compact(s.monstersKilled)} />
        <SummaryRow label="experience" value={compact(s.experience)} />
        <SummaryRow label="levels" value={`${s.endLevel - s.startLevel} (${s.startLevel} → ${s.endLevel})`} />
        {s.masterExperience > 0 && <SummaryRow label="masterExperience" value={compact(s.masterExperience)} />}
        <SummaryRow label="zenEarned" value={compact(s.zenEarned)} />
        <SummaryRow label="zenSpent" value={compact(s.zenSpent)} />
        <SummaryRow label="itemsCollected" value={compact(s.itemsCollected)} />
        <SummaryRow label="itemsSold" value={compact(s.itemsSold)} />
        <SummaryRow label="repairs" value={compact(s.repairs)} />
        <SummaryRow label="potions" value={compact(s.potionsUsed)} />
        {s.deaths > 0 && <SummaryRow label="deaths" value={compact(s.deaths)} />}
        <SummaryRow label="maps" value={s.mapsVisited.join(', ') || '-'} />
        {s.mapRates && s.mapRates.length > 0 && (
          <div className="muidle-summary-maps">
            <h3>{mt('perMap')}</h3>
            {s.mapRates
              .filter(r => r.minutes >= 1)
              .sort((a, b) => b.minutes - a.minutes)
              .map(r => (
                <div key={r.map} className="muidle-summary-row">
                  <span>
                    {r.map} · {duration(r.minutes * 60_000)}
                  </span>
                  <strong>
                    {compact(r.experience)} XP ({mt('perMinute', { value: compact(r.experience / r.minutes) })}) ·{' '}
                    {compact(r.zen)} zen{r.deaths > 0 ? ` · ${r.deaths} ${mt('deaths').toLowerCase()}` : ''}
                  </strong>
                </div>
              ))}
          </div>
        )}
        <SummaryRow label="endReason" value={mt(reasonKey)} />
        <div className="muidle-actions">
          <button type="button" className="muidle-primary" onClick={() => MUIdle.dismissSummary()}>
            {mt('ok')}
          </button>
        </div>
      </div>
    </div>
  );
});

/** Feeds the automatic performance mode one frame-rate sample a second. */
function usePerformanceSampler(): void {
  useEffect(() => {
    const timer = setInterval(() => {
      const engine = Store.world?.scene.getEngine();
      if (engine) Performance.sample(engine.getFps());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
}

export const MUIdleHud = observer(() => (
  <>
    <PerformanceSampler />
    <StatusStrip />
    <ActivityLine />
    <HuntButton />
    <SettingsPanel />
    <EventsWindow />
    <ProgressionWindow />
    <SummaryModal />
  </>
));
