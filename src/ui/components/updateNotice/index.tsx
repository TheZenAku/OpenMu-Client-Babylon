import './style.less';
import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { BuildCheck } from '../../../common/buildCheck';
import { mt } from '../../../muidle/text';

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * The update window (D34): a newer client is on the server, the server restarts in a moment, the
 * server is restarting, or it is back. Every case ends in one button - Reload.
 */
export const UpdateNotice = observer(() => {
  useEffect(() => BuildCheck.start(), []);
  const view = BuildCheck.view;
  if (!view) return null;

  const reload = (
    <button type="button" className="primary" onClick={() => location.reload()}>
      {mt('update.reload')}
    </button>
  );

  let title: string;
  let lines: string[];
  let actions: React.ReactNode;
  switch (view) {
    case 'restart':
      title = mt('update.restartTitle');
      lines = [mt('update.restartIn', { time: clock(BuildCheck.secondsLeft) }), mt('update.restartHunt')];
      actions = (
        <button type="button" onClick={() => BuildCheck.acknowledgeRestart()}>
          {mt('update.ok')}
        </button>
      );
      break;
    case 'updating':
      title = mt('update.restartTitle');
      lines = [mt('update.updating'), mt('update.restartHunt')];
      actions = <span className="update-spinner" aria-hidden="true" />;
      break;
    case 'back':
      title = mt('update.title');
      lines = [mt('update.back')];
      actions = reload;
      break;
    default:
      title = mt('update.title');
      lines = [mt('update.ready'), mt('update.huntSafe')];
      actions = (
        <>
          <button type="button" onClick={() => BuildCheck.snooze()}>
            {mt('update.later')}
          </button>
          {reload}
        </>
      );
  }

  // The server is down or just back: nothing else on the page works, so the window holds the screen.
  const blocking = view === 'updating' || view === 'back';
  return (
    <div className={`update-notice-layer${blocking ? ' blocking' : ''}`}>
      <div className="update-notice" role="alertdialog" aria-labelledby="update-notice-title">
        <div className="update-notice-title" id="update-notice-title">
          {title}
        </div>
        {lines.map(line => (
          <p key={line}>{line}</p>
        ))}
        <div className="update-notice-actions">{actions}</div>
      </div>
    </div>
  );
});
