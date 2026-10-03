import { observer } from 'mobx-react-lite';
import { Store } from '../../../../../store';
import { isKey } from '../../../../../common/keyBindings';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { EVENT_TEXT } from '../../../../../events/recipes';
import { eventSchedule, type EventScheduleKey, type EventScheduleRow } from '../../../../../events/schedule';
import { MUIdle, DEFAULT_IDLE_SETTINGS } from '../../../../../muidle/state';
import { mt, type MUIdleTextKey } from '../../../../../muidle/text';

/**
 * MUIdle's Events window: when each event opens, and whether HUNT enters it
 * for the character. The entry itself is the server's (ticket, level, fee,
 * the event's own rules); this window only says what it will do, and why not.
 */

const NAME: Readonly<Record<EventScheduleKey, () => string>> = {
  bloodCastle: () => EVENT_TEXT.bloodCastle,
  devilSquare: () => EVENT_TEXT.devilSquare,
  chaosCastle: () => EVENT_TEXT.chaosCastle,
};

function opensIn(row: EventScheduleRow): string {
  if (row.open) return mt('eventOpen');
  if (row.seconds === null) return row.far ? mt('eventFar') : '-';
  const h = Math.floor(row.seconds / 3600);
  const m = Math.floor((row.seconds % 3600) / 60);
  const s = row.seconds % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s).padStart(2, '0')}`;
}

export const EventsWindow = observer(() => {
  useEventBus('keyPressed', key => {
    if (!Store.world?.playerEntity) return;
    if (isKey('events', key)) MUIdle.openEvents();
  });
  if (!MUIdle.eventsOpen) return null;

  const settings = MUIdle.settings ?? DEFAULT_IDLE_SETTINGS;
  return (
    <div className="muidle-backdrop" onPointerDown={e => e.stopPropagation()}>
      <div className="muidle-panel muidle-events" role="dialog" aria-label={mt('events')}>
        <h2>{mt('events')}</h2>
        <label className="muidle-toggle">
          <input
            type="checkbox"
            checked={settings.eventsFirst}
            onChange={e => MUIdle.setEventsFirst(e.target.checked)}
          />
          <span>{mt('eventsFirst')}</span>
        </label>
        <p className="muidle-note">{mt('eventsHint')}</p>
        <div className="muidle-event-list">
          {eventSchedule().map(row => {
            const info = MUIdle.events.find(e => e.key === row.key);
            const enrolled = !settings.eventOptOut.includes(row.key);
            const status = !info
              ? ''
              : info.ready
                ? mt('eventReady')
                : mt(`eventReason.${info.reason ?? 'level'}` as MUIdleTextKey, { item: info.item ?? '' });
            return (
              <div key={row.key} className={`muidle-event-row${info?.ready ? ' is-ready' : ''}`}>
                <div className="muidle-event-name">
                  <strong>{NAME[row.key]()}</strong>
                  <span>{opensIn(row)}</span>
                </div>
                <span className="muidle-event-status">{status}</span>
                <label className="muidle-event-join">
                  <input
                    type="checkbox"
                    checked={enrolled}
                    disabled={!settings.eventsFirst}
                    onChange={e => MUIdle.setEventEnrolled(row.key, e.target.checked)}
                  />
                  <span>{mt('eventEnrolled')}</span>
                </label>
              </div>
            );
          })}
        </div>
        {MUIdle.contracts.length > 0 && (
          <>
            <h3>{mt('dailyContracts')}</h3>
            <div className="muidle-event-list">
              {MUIdle.contracts.map(c => (
                <div key={c.kind} className={`muidle-event-row${c.rewarded ? ' is-ready' : ''}`}>
                  <div className="muidle-event-name">
                    <strong>
                      {mt(`contract.${c.kind}` as MUIdleTextKey, { target: c.target, map: c.mapName ?? '' })}
                    </strong>
                    <span>+{c.rewardZen.toLocaleString()} zen</span>
                  </div>
                  <span className="muidle-event-status">
                    {c.rewarded ? mt('contractDone') : `${c.progress} / ${c.target}`}
                  </span>
                  <span />
                </div>
              ))}
            </div>
          </>
        )}
        {MUIdle.bosses.length > 0 && (
          <>
            <h3>{mt('worldBosses')}</h3>
            <label className="muidle-toggle">
              <input
                type="checkbox"
                checked={settings.bossesFirst}
                onChange={e => MUIdle.setBossesFirst(e.target.checked)}
              />
              <span>{mt('bossesFirst')}</span>
            </label>
            <div className="muidle-event-list">
              {MUIdle.bosses.map(boss => (
                <div key={boss.name} className={`muidle-event-row${boss.alive ? ' is-ready' : ''}`}>
                  <div className="muidle-event-name">
                    <strong>{boss.name}</strong>
                    <span>{mt('bossReward', { zen: boss.rewardZen.toLocaleString(), level: boss.minimumLevel })}</span>
                  </div>
                  <span className="muidle-event-status">
                    {boss.alive
                      ? mt('bossAlive', { map: boss.map, x: boss.x ?? '?', y: boss.y ?? '?' })
                      : boss.nextSpawnUtc
                        ? mt('bossNext', {
                            time: new Date(boss.nextSpawnUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          }) + ` · ${boss.map}`
                        : boss.map}
                  </span>
                  <span />
                </div>
              ))}
            </div>
          </>
        )}
        <div className="muidle-actions">
          <button type="button" className="muidle-primary" onClick={() => MUIdle.openEvents(false)}>
            {mt('close')}
          </button>
        </div>
      </div>
    </div>
  );
});
