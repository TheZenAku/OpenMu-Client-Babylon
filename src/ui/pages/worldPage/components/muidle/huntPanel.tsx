import { observer } from 'mobx-react-lite';
import { Store } from '../../../../../store';
import { MUIdle, huntMapMode } from '../../../../../muidle/state';
import { mt, type MUIdleTextKey } from '../../../../../muidle/text';
import { toggleMuHelperWindow } from '../../../../../muHelper/state';
import { uiClick } from '../../../../../libs/sfx';

/**
 * The HUNT side of the bottom bar (the owner's reference): CAÇAR with the map mode it hunts on, MANUAL,
 * then the hunting map and MU Helper buttons and what the hunt is doing now. A press only switches
 * when it means a change - CAÇAR while hunting does not stop the hunt. The floating HUNT button stays
 * the touch screen's (MUIdleHud).
 */
export const HuntPanel = observer(({ left, width, height }: { left: number; width: number; height: number }) => {
  if (Store.isOffline) return null;

  const hunting = MUIdle.hunting;
  const settings = MUIdle.settings;
  const mode = settings ? huntMapMode(settings) : 'auto';
  const modeLabel =
    mode === 'auto' ? 'AUTO' : mode === 'manual' ? 'MANUAL' : (MUIdle.maps.find(m => m.number === mode)?.name ?? '');
  const kind = MUIdle.activity?.kind ?? 'idle';

  return (
    <div className="hud-panel hunt-panel" style={{ left, top: 0, width, height }}>
      <button
        type="button"
        className={`hunt-mode hunt-main${hunting ? ' is-on' : ''}`}
        title={mt('huntHint')}
        aria-pressed={hunting}
        onClick={uiClick(() => !hunting && MUIdle.toggleHunt())}
      >
        <span className="hunt-glyph" aria-hidden>
          ⚔
        </span>
        <span className="hunt-label">
          {mt('hunt')} ({modeLabel})
        </span>
      </button>
      <button
        type="button"
        className={`hunt-mode hunt-manual${hunting ? '' : ' is-on'}`}
        title={mt('manualHint')}
        aria-pressed={!hunting}
        onClick={uiClick(() => hunting && MUIdle.toggleHunt())}
      >
        <span className="hunt-glyph" aria-hidden>
          ✋
        </span>
        <span className="hunt-label">{mt('manual')}</span>
      </button>
      <div className="hunt-row">
        <button type="button" className="hunt-icon" title={mt('hud.huntMapTip')} onClick={uiClick(() => MUIdle.openSettings())}>
          ⚑
        </button>
        <button type="button" className="hunt-icon" title={mt('helperSettings')} onClick={uiClick(() => toggleMuHelperWindow(true))}>
          ⚙
        </button>
        <span className={`hunt-pill is-${kind}`} aria-live="polite">
          {kind === 'hunting' && (
            <span className="hunt-glyph" aria-hidden>
              ⚔
            </span>
          )}
          {mt(`pill.${kind}` as MUIdleTextKey)}
        </span>
      </div>
    </div>
  );
});
