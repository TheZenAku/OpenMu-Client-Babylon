import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Store } from '../../../../../store';
import { isKey } from '../../../../../common/keyBindings';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { MUIdle } from '../../../../../muidle/state';
import { mt, type MUIdleTextKey } from '../../../../../muidle/text';

/**
 * MUIdle's Server Progression window: the season, the reset cap of the week
 * and when it rises, the character's resets, what the next reset needs, and
 * the reset itself. The server's reset feature checks everything and does
 * the reset; the button only asks for it (after a confirmation).
 */

function day(utc: string | null): string {
  return utc ? new Date(utc).toLocaleDateString([], { day: '2-digit', month: '2-digit' }) : '-';
}

export const ProgressionWindow = observer(() => {
  const [confirming, setConfirming] = useState(false);
  useEventBus('keyPressed', key => {
    if (!Store.world?.playerEntity) return;
    if (isKey('progression', key)) MUIdle.openProgression();
  });
  if (!MUIdle.progressionOpen) return null;

  const p = MUIdle.progression;
  const close = () => {
    setConfirming(false);
    MUIdle.openProgression(false);
  };
  const reason = p?.reason
    ? mt(`resetReason.${p.reason}` as MUIdleTextKey, {
        level: p.requiredLevel ?? '-',
        zen: (p.requiredZen ?? 0).toLocaleString(),
        date: day(p.nextRaiseUtc),
      })
    : null;

  return (
    <div className="muidle-backdrop" onPointerDown={e => e.stopPropagation()}>
      <div className="muidle-panel muidle-progression" role="dialog" aria-label={mt('progression')}>
        <h2>{mt('progression')}</h2>
        {p && (
          <>
            <p className="muidle-note">{mt('seasonWeek', { season: p.season, week: p.week })}</p>
            <div className="muidle-summary-row">
              <span>{mt('resetCap')}</span>
              <strong>
                {p.resetCap ?? mt('resetCapNone')}
                {p.nextRaiseUtc && p.resetsPerWeek > 0 ? ` (${mt('capRises', { per: p.resetsPerWeek, date: day(p.nextRaiseUtc) })})` : ''}
              </strong>
            </div>
            <div className="muidle-summary-row">
              <span>{mt('yourResets')}</span>
              <strong>
                {p.resets}
                {p.resetCap ? ` / ${p.resetCap}` : ''}
              </strong>
            </div>
            {p.requiredLevel !== null && (
              <div className="muidle-summary-row">
                <span>{mt('resetNeeds')}</span>
                <strong>
                  {mt('resetNeedsValue', { level: p.requiredLevel, zen: (p.requiredZen ?? 0).toLocaleString() })}
                </strong>
              </div>
            )}
            {p.levelAfterReset !== null && <p className="muidle-note">{mt('resetAfter', { level: p.levelAfterReset })}</p>}
            {reason && <p className="muidle-note muidle-warn">{reason}</p>}
          </>
        )}
        <div className="muidle-actions">
          {confirming ? (
            <>
              <button type="button" onClick={() => setConfirming(false)}>
                {mt('resetCancel')}
              </button>
              <button type="button" className="muidle-primary" onClick={() => MUIdle.requestReset()}>
                {mt('resetConfirm')}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={close}>
                {mt('close')}
              </button>
              <button
                type="button"
                className="muidle-primary"
                disabled={!p?.canReset}
                onClick={() => setConfirming(true)}
              >
                {mt('resetButton')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
