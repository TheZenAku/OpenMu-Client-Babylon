import './style.less';
import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../../../store';
import { MUIdle, type HuntActivity, type OfflineSummary } from '../../../../../muidle/state';
import { mt, type MUIdleTextKey } from '../../../../../muidle/text';
import { compact, mapReasonText } from '../../../../../muidle/settingsLabels';
import { openOptionsPage } from '../../../../components/optionsWindow';
import { EventsWindow } from './events';
import { ProgressionWindow } from './progression';
import { Performance } from '../../../../../muidle/performance';
import { isMobileDevice } from '../../../../../common/mobile';
import { bottomBarScreenHeight } from '../../../../components/muWindow';

/**
 * MUIdle's HUD: the idle settings, the offline summary and what the hunt is doing. On a desktop the
 * HUNT switch and the status sit in the bottom bar (HuntPanel) and the hero's frame (PlayerFrame), and
 * this line keeps only its warnings, over the bar; a touch screen keeps the floating HUNT button
 * (sized for a thumb) and the whole line. Plain
 * HTML over the canvas on purpose - big, legible and touchable on a phone,
 * which the original's pixel windows are not.
 */

function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function activityText(activity: HuntActivity): string {
  return mt(`activity.${activity.kind}` as MUIdleTextKey, {
    map: activity.map ?? '',
    have: compact(activity.pause?.have ?? 0),
    need: compact(activity.pause?.need ?? 0),
  });
}

/** What the hunt is doing now, and why it is not on the chosen map when it is not. */
const COMPACT = isMobileDevice();

const ActivityLine = observer(() => {
  const activity = MUIdle.activity;
  if (!activity) return null;
  const pinned = MUIdle.settings?.preferredMap ?? null;
  const option = pinned === null ? undefined : MUIdle.maps.find(m => m.number === pinned);
  const warned = !!(activity.pinnedReason && option) || !!activity.notes?.length;
  // The desktop's bottom bar says what the hunt does (its status pill); the warnings stay here.
  if (!COMPACT && !warned) return null;
  return (
    <div
      className={`muidle-activity${COMPACT ? '' : ' is-notes'}`}
      style={COMPACT ? undefined : { bottom: bottomBarScreenHeight() + 22 }}
      aria-live="polite"
    >
      {COMPACT && <span>{activityText(activity)}</span>}
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

/** The touch screen's HUNT switch; a desktop has HuntPanel in the bottom bar. */
const HuntButton = observer(() => {
  if (!COMPACT || !Store.playerData.name || Store.isOffline) return null;
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
        onClick={() => openOptionsPage('hunt')}
      >
        ⚙
      </button>
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
    <ActivityLine />
    <HuntButton />
    <EventsWindow />
    <ProgressionWindow />
    <SummaryModal />
  </>
));
