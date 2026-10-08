import './style.less';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../../../store';
import { i18n } from '../../../../../i18n';
import { mt } from '../../../../../muidle/text';
import { combatPower } from '../../../../../muidle/combatPower';
import { MUIdle, huntMapMode } from '../../../../../muidle/state';
import { getClassName } from '../../../../../common/characterStats';
import { uiClick } from '../../../../../libs/sfx';

/**
 * The hero's frame in the top left corner (the owner's reference, Vael theme): the class portrait,
 * name, level and combat power, the life / SD / mana / AG bars with their numbers, and three boxes -
 * zen, the points still to spend, the hunting map. It takes over what the bottom bar's orbs and the
 * MUIdle status strip showed.
 *
 * The portraits are the creation window's own close-ups of each base class model
 * (`public/ui/portraits`, captured once from the client).
 */

const PORTRAITS = ['dw', 'dk', 'elf', 'mg', 'dl', 'sum', 'rf'];

export function portraitOf(charClass: number): string {
  return `/ui/portraits/${PORTRAITS[Math.floor(charClass / 4)] ?? 'dk'}.webp`;
}

/** Number formatting in the client's language (pt: 3.437.200, 59,1 mil). */
export function numberLocale(): string {
  const code = i18n.current.code;
  return code === 'pt' ? 'pt-BR' : code;
}

export function formatNumber(value: number): string {
  return Math.floor(value).toLocaleString(numberLocale());
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat(numberLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(
    Math.floor(value)
  );
}

const Bar = ({
  kind,
  label,
  current,
  max,
}: {
  kind: 'hp' | 'sd' | 'mp' | 'ag';
  label?: string;
  current: number;
  max: number;
}) => {
  const fill = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  return (
    <div className={`pf-bar is-${kind}`} role="meter" aria-valuenow={current} aria-valuemin={0} aria-valuemax={max}>
      <div className="pf-bar-fill" style={{ width: `${fill * 100}%` }} />
      <span className="pf-bar-text">
        {label && <b>{label}</b>}
        {formatNumber(current)} / {formatNumber(max)}
      </span>
    </div>
  );
};

const toggleCharacterInfo = () => {
  Store.characterInfoEnabled = !Store.characterInfoEnabled;
};

export const PlayerFrame = observer(() => {
  const p = Store.playerData;
  if (!p.name) return null;

  const settings = MUIdle.settings;
  const mode = settings ? huntMapMode(settings) : 'auto';
  const modeLabel =
    mode === 'auto' ? 'AUTO' : mode === 'manual' ? 'MANUAL' : (MUIdle.maps.find(m => m.number === mode)?.name ?? '');
  const map = MUIdle.activity?.map ?? '';

  return (
    // Its own clicks are not clicks on the world behind it.
    <div className="player-frame" onPointerDown={e => e.stopPropagation()}>
      <button type="button" className="pf-portrait" title={mt('hud.portraitTip')} onClick={uiClick(toggleCharacterInfo)}>
        <img src={portraitOf(p.charClass)} alt={getClassName(p.charClass)} draggable={false} />
      </button>

      <div className="pf-main">
        <div className="pf-head">
          <span className="pf-name">{p.name}</span>
          <span className="pf-level">
            Lv. {p.level}
            {p.masterLevel > 0 && <em> +{p.masterLevel}</em>}
          </span>
          <span className="pf-cp">
            {mt('cp')} {formatCompact(combatPower())}
          </span>
        </div>
        <Bar kind="hp" current={p.currentHP} max={p.maxHP} />
        <Bar kind="sd" label="SD" current={p.currentSD} max={p.maxSD} />
        <Bar kind="mp" current={p.currentMP} max={p.maxMP} />
        <Bar kind="ag" label="AG" current={p.currentAG} max={p.maxAG} />
      </div>

      <div className="pf-boxes">
        <div className="pf-box" title="Zen">
          <span className="pf-coin" aria-hidden />
          <strong>{formatCompact(p.money)}</strong>
        </div>
        <button
          type="button"
          className={`pf-box${p.points > 0 ? ' is-lit' : ''}`}
          title={mt('hud.portraitTip')}
          onClick={uiClick(toggleCharacterInfo)}
        >
          <span className="pf-glyph" aria-hidden>
            ◆
          </span>
          <strong>{formatNumber(p.points)}</strong>
          <small>{mt('hud.points')}</small>
        </button>
        <button type="button" className="pf-box pf-map" title={mt('hud.huntMapTip')} onClick={uiClick(() => MUIdle.openSettings())}>
          <span className="pf-glyph" aria-hidden>
            ⚑
          </span>
          <span className="pf-map-lines">
            <strong>{modeLabel}</strong>
            {map && <small>{map}</small>}
          </span>
        </button>
      </div>
    </div>
  );
});
