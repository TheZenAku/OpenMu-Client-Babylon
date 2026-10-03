import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Store } from '../../../../../store';
import { isKey } from '../../../../../common/keyBindings';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { MUIdle } from '../../../../../muidle/state';
import { mt, type MUIdleTextKey } from '../../../../../muidle/text';
import { combatPowerParts, weakestSlot } from '../../../../../muidle/combatPower';
import { itemDisplayName } from '../../../../../common/itemTooltip';

type RankingEntry = { rank: number; name: string; classNumber: number; level: number; resets: number; masterLevel: number };
const LINES = ['all', 'wizard', 'knight', 'elf', 'gladiator', 'lord', 'summoner', 'fighter'] as const;

/** The public ranking board (server: /api/ranking, top 100, a minute old at most). */
const Ranking = observer(() => {
  const [line, setLine] = useState<(typeof LINES)[number]>('all');
  const [entries, setEntries] = useState<RankingEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    fetch(`/api/ranking${line === 'all' ? '' : `?line=${line}`}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { entries: RankingEntry[] }) => live && setEntries(data.entries))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [line]);
  const me = Store.playerData.name;
  const mine = entries?.find(e => e.name === me);
  return (
    <>
      <h3>{mt('ranking')}</h3>
      <label className="muidle-select">
        <select value={line} onChange={e => setLine(e.target.value as (typeof LINES)[number])}>
          {LINES.map(l => (
            <option key={l} value={l}>
              {mt(`line.${l}` as MUIdleTextKey)}
            </option>
          ))}
        </select>
      </label>
      {failed && <p className="muidle-note muidle-warn">{mt('rankingUnavailable')}</p>}
      {mine && <p className="muidle-note">{mt('rankingYou', { rank: mine.rank })}</p>}
      <div className="muidle-cp-slots">
        {(entries ?? []).slice(0, 20).map(e => (
          <div key={e.name} className={`muidle-summary-row${e.name === me ? ' muidle-me' : ''}`}>
            <span>
              #{e.rank} {e.name}
            </span>
            <strong>{mt('rankingRow', { resets: e.resets, level: e.level })}</strong>
          </div>
        ))}
      </div>
    </>
  );
});

const SLOT_NAMES = ['L-hand', 'R-hand', 'helm', 'armor', 'pants', 'gloves', 'boots', 'wings', 'pet', 'pendant', 'ring', 'ring'];

/** Where the Combat Power comes from, and where the next is cheapest (an indicator, see COMBAT_POWER.md). */
const CombatPowerBreakdown = observer(() => {
  const parts = combatPowerParts();
  const hint = weakestSlot(parts);
  const weak = hint && !hint.empty ? parts.slots[hint.slot] : null;
  return (
    <>
      <h3>{mt('cpBreakdown', { total: parts.total.toLocaleString() })}</h3>
      <p className="muidle-note">{mt('cpBase', { level: parts.level, stats: parts.stats, vitals: parts.vitals })}</p>
      <div className="muidle-cp-slots">
        {parts.slots.map(s => (
          <div key={s.slot} className="muidle-summary-row">
            <span>{SLOT_NAMES[s.slot]}</span>
            <strong>{s.item ? `${itemDisplayName(s.item)} · ${s.power}` : mt('cpEmpty')}</strong>
          </div>
        ))}
      </div>
      {hint && (
        <p className="muidle-note">
          {hint.empty
            ? mt('cpHintEmpty', { slot: SLOT_NAMES[hint.slot] })
            : mt('cpHintWeak', { item: weak?.item ? itemDisplayName(weak.item) : '-', power: weak?.power ?? 0 })}
        </p>
      )}
    </>
  );
});

/** The class quest line: what the next quest needs and how far it is (accept and hand in at the giver). */
const ClassQuest = observer(() => {
  const q = MUIdle.quest;
  if (!q) return null;
  if (q.finished) {
    return (
      <>
        <h3>{mt('classQuest')}</h3>
        <p className="muidle-note">{mt('questLineDone')}</p>
      </>
    );
  }
  const status = q.done
    ? mt('questReady')
    : q.active
      ? mt('questActive')
      : q.canAccept
        ? mt('questAccept')
        : mt('questNext', { level: q.minLevel ?? '-' });
  return (
    <>
      <h3>{mt('classQuest')}</h3>
      <div className="muidle-summary-row">
        <span>{q.name}</span>
        <strong className={q.done ? 'muidle-me' : undefined}>{status}</strong>
      </div>
      {q.giver && (
        <p className="muidle-note">
          {mt('questGiver', { name: q.giver.name, map: q.giver.map ?? '-', x: q.giver.x, y: q.giver.y })}
        </p>
      )}
      {(q.items ?? []).map(i => (
        <div key={i.name} className="muidle-summary-row">
          <span>
            {i.name}
            {i.monster
              ? ` · ${mt('questDropBoss', { monster: i.monster })}`
              : i.minMonsterLevel !== null
                ? ` · ${mt('questDrop', { min: i.minMonsterLevel, max: i.maxMonsterLevel ?? i.minMonsterLevel })}`
                : ''}
          </span>
          <strong>
            {i.have}/{i.need}
          </strong>
        </div>
      ))}
      {!q.active && (q.startZen ?? 0) > 0 && (
        <p className="muidle-note">{mt('questFee', { zen: (q.startZen ?? 0).toLocaleString() })}</p>
      )}
      <label className="muidle-toggle">
        <input type="checkbox" checked={MUIdle.settings?.questsAuto ?? false} onChange={e => MUIdle.setQuestsAuto(e.target.checked)} />
        {mt('questsAuto')}
      </label>
      {q.automation && q.automation !== 'off' && (
        <p className={`muidle-note${q.automation === 'zen' || q.automation === 'manual' ? ' muidle-warn' : ''}`}>
          {mt(`questAuto.${q.automation}` as MUIdleTextKey, { zen: (q.startZen ?? 0).toLocaleString(), level: q.minLevel ?? '-', giver: q.giver?.name ?? '-' })}
        </p>
      )}
      {(q.items ?? []).some(i => i.minMonsterLevel !== null) && (
        <label className="muidle-toggle">
          <input
            type="checkbox"
            checked={MUIdle.settings?.questItemsFirst ?? true}
            onChange={e => MUIdle.setQuestItemsFirst(e.target.checked)}
          />
          {mt('questItemsFirst')}
        </label>
      )}
      {(q.kills ?? []).map(k => (
        <div key={k.monster} className="muidle-summary-row">
          <span>{k.monster}</span>
          <strong>
            {k.have}/{k.need}
          </strong>
        </div>
      ))}
    </>
  );
});

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
            <div className="muidle-summary-row">
              <span>{mt('xpBonus')}</span>
              <strong>
                {p.bonus && p.bonus.total > 0
                  ? mt('xpBonusParts', {
                      total: Math.round(p.bonus.total * 100),
                      catchUp: Math.round(p.bonus.catchUp * 100),
                      newcomer: Math.round(p.bonus.newcomer * 100),
                    })
                  : mt('xpBonusNone')}
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
        <ClassQuest />
        <CombatPowerBreakdown />
        <Ranking />
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
