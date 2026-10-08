import './style.less';
import { useState, type CSSProperties } from 'react';
import { MuSpriteFrame } from '../muSprite';
import { uiClick } from '../../../libs/sfx';

export type MuButtonFrames = {
  up: number;
  active?: number;
  down?: number;
  check?: number;
};

type MuButtonProps = {
  file: string;
  width: number;
  height: number;
  frames: MuButtonFrames;
  label?: string;
  /** The main action of its place, in blood (Vael theme). */
  primary?: boolean;
  color?: string;
  activeColor?: string;
  checked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  labelStyle?: CSSProperties;
  children?: React.ReactNode;
};

/**
 * The Vael theme's face for the original's button sprites. A button with a label, or one of the
 * common sprites below, is drawn in CSS (the reference's gilt-lined tiles, the blood one for the
 * main action); any other sprite keeps its picture inside a themed tile.
 */
const THEMED: Record<string, { glyph?: string; primary?: boolean }> = {
  'newui_exit_00.OZT': { glyph: '✕' },
  'newui_button_ok.OZT': { glyph: '✓', primary: true },
  'message_ok_b_all.OZT': { glyph: '✓', primary: true },
  'newui_button_cancel.OZT': { glyph: '✕' },
  'loding_cancel_b_all.OZT': { glyph: '✕' },
  'newui_repair_00.OZT': { glyph: '⚒' },
  'newui_chainfo_btn_level.OZT': { glyph: '+' },
  'Quest_bt_L.OZT': { glyph: '‹' },
  'Quest_bt_R.OZT': { glyph: '›' },
  'newui_btn_empty.OZT': {},
  'newui_btn_empty_small.OZT': {},
  'newui_btn_empty_big.OZT': {},
  'newui_guild_tab04.OZT': {},
  // The five buttons of the main bar (their tooltips name them).
  'partCharge1/newui_menu_Bt05.OZJ': { glyph: '⚖' },
  'partCharge1/newui_menu_Bt01.OZJ': { glyph: '♜' },
  'partCharge1/newui_menu_Bt02.OZJ': { glyph: '▤' },
  'partCharge1/newui_menu_Bt03.OZJ': { glyph: '✉' },
  'partCharge1/newui_menu_Bt04.OZJ': { glyph: '⚙' },
};

export const MuButton = ({
  file,
  width,
  height,
  frames,
  label,
  primary = false,
  color,
  activeColor,
  checked = false,
  disabled = false,
  onClick,
  style,
  labelStyle,
  children,
}: MuButtonProps) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const themed = THEMED[file];

  if (themed || label) {
    const classes = [
      'vael-btn',
      themed?.glyph && !label ? 'vael-btn-glyph' : '',
      themed?.primary || primary ? 'vael-btn-primary' : '',
      checked ? 'vael-btn-checked' : '',
      disabled ? 'vael-btn-disabled' : '',
    ].filter(Boolean).join(' ');
    return (
      <div
        role="button"
        aria-disabled={disabled}
        // A button is never a drag handle (see the sprite branch below).
        data-no-drag="true"
        className={classes}
        style={{ position: 'relative', width, height, ...style }}
        onClick={disabled ? undefined : uiClick(onClick)}
      >
        <span className="vael-btn-label" style={{ ...(color ? { color } : {}), ...labelStyle }}>
          {label ?? themed?.glyph}
        </span>
        {children}
      </div>
    );
  }

  let frame = frames.up;

  if (checked && frames.check !== undefined) frame = frames.check;
  if (!disabled && hovered && frames.active !== undefined) frame = frames.active;
  if (!disabled && pressed && frames.down !== undefined) frame = frames.down;

  return (
    <MuSpriteFrame
      file={file}
      y={frame * height}
      width={width}
      height={height}
      // A button is never a drag handle. Without this the window's own
      // pointerdown starts a drag and captures the pointer, and the click
      // lands on the window root instead of here - the button looks alive and
      // does nothing. Every caller used to wrap itself in a `data-no-drag`
      // div to avoid that; the ones that forgot were simply broken.
      noDrag
      className={`vael-sprite-btn${checked ? ' vael-btn-checked' : ''}`}
      style={{
        position: 'relative',
        pointerEvents: 'auto',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
      onClick={disabled ? undefined : uiClick(onClick)}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: pressed && !disabled ? 2 : 0,
          color: hovered && !disabled ? (activeColor ?? 'var(--v-gilt-bright)') : (color ?? 'var(--v-gilt)'),
          ...labelStyle,
        }}
      >
        {children}
      </div>
    </MuSpriteFrame>
  );
};
