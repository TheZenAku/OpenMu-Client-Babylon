import { useEffect } from 'react';
import { reaction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { SessionStats } from '../../../../../common/sessionStats';
import { MUIdle } from '../../../../../muidle/state';
import { mt } from '../../../../../muidle/text';
import { formatNumber } from '../playerFrame';

function etaText(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
  return `${Math.round(hours / 24)}d`;
}

const Row = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={`stats-row${accent ? ' is-accent' : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

/**
 * The rates side of the bottom bar (the owner's reference): experience, kills and zen per minute now (the
 * last two minutes of the run of kills, nothing while idle), and when the next level comes at that rate.
 * Counted by SessionStats from the packets the client already handles; it ticks while on screen.
 */
export const StatsPanel = observer(({ left, width, height }: { left: number; width: number; height: number }) => {
  useEffect(() => {
    SessionStats.watch();
    const timer = window.setInterval(() => SessionStats.tick(), 1000);
    const stopped = reaction(
      () => MUIdle.hunting,
      hunting => !hunting && SessionStats.pause()
    );
    return () => {
      window.clearInterval(timer);
      stopped();
    };
  }, []);

  const eta = SessionStats.msToLevelNow;

  return (
    <div className="hud-panel stats-panel" style={{ left, top: 0, width, height }}>
      <Row label={mt('hud.xpNow')} value={formatNumber(SessionStats.experiencePerMinuteNow)} />
      <Row label={mt('hud.killsNow')} value={formatNumber(SessionStats.killsPerMinuteNow)} />
      <Row label={mt('hud.zenRate')} value={formatNumber(SessionStats.zenPerMinute)} />
      <Row label={mt('hud.nextLevel')} value={eta === null ? '—' : etaText(eta)} accent />
    </div>
  );
});
