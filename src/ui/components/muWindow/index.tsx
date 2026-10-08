import './style.less';
import { useCallback, type CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import { MuResizeGrip, useWindowChrome } from './useWindowChrome';
import { MuWindows, type WindowCloser } from './windowState';

export const WINDOW_WIDTH = 190;
export const WINDOW_HEIGHT = 429;

// The main bar's height (the original's was 51 in 640x480 units; the Vael
// bar, with HUNT and the rates beside the skills, is taller); the bar is scaled
// by the player, so every window that rides on it (the original's
// `480 - 51 - h`) follows the bar's on-screen height, not the constant.
export const BOTTOM_BAR_HEIGHT = 112;
/** The bar stands this far off the screen's bottom edge (bottomBar/style.less), plus a breath. */
const BOTTOM_BAR_GAP = 10;
export const BOTTOM_BAR_ID = 'bottom-bar';
export const bottomBarScreenHeight = () =>
  BOTTOM_BAR_HEIGHT * MuWindows.scaleOf(BOTTOM_BAR_ID) + BOTTOM_BAR_GAP;

type MuItemWindowProps = {
  id: string;
  column?: number;
  className?: string;
  style?: CSSProperties;
  /** Read by screen readers; defaults to the id. */
  label?: string;
  /**
   * Escape while this is the top window. Without one, Escape falls back to
   * the `keyPressed` broadcast, which closes every window listening for it.
   */
  onClose?: WindowCloser;
  children?: React.ReactNode;
};

export const MuItemWindow = observer(
  ({ id, column = 0, className, style, label, onClose, children }: MuItemWindowProps) => {
    const chrome = useWindowChrome(id, {
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      onClose,
    });
    const stackRef = chrome.ref as (el: HTMLElement | null) => void;
    // Joins the stack and takes the focus, so the window is the keyboard's
    // target the moment it opens (and Escape scopes to it).
    const ref = useCallback(
      (el: HTMLDivElement | null) => {
        stackRef(el);
        if (el) el.focus({ preventScroll: true });
      },
      [stackRef]
    );

    return (
      <div
        ref={ref}
        role="dialog"
        aria-label={label ?? id.replace(/-/g, ' ')}
        tabIndex={-1}
        className={`mu-item-window vael-window${className ? ` ${className}` : ''}`}
        onPointerDown={chrome.onPointerDown}
        style={{
          right: column * WINDOW_WIDTH * chrome.scale,
          bottom: bottomBarScreenHeight(),
          ...chrome.style,
          ...style,
        }}
      >
        {/* The Vael theme draws the frame in CSS (style.less): the original's sprite pieces are gone. */}
        {children}
        <MuResizeGrip id={id} width={WINDOW_WIDTH} />
      </div>
    );
  }
);

export const TABLE_CORNER = 14;

type MuTableFrameProps = {
  left: number;
  top: number;
  width: number;
  height: number;
  className?: string;
};

export const MuTableFrame = ({
  left,
  top,
  width,
  height,
  className,
}: MuTableFrameProps) => {
  // The Vael theme: a sunken well with a gilt hairline (style.less), not the original's corner sprites.
  return (
    <div
      className={`mu-table-frame vael-table${className ? ` ${className}` : ''}`}
      style={{ left, top, width, height }}
    />
  );
};

export const MuTableRule = ({
  left,
  top,
  width,
}: {
  left: number;
  top: number;
  width: number;
}) => (
  <div
    className="vael-rule"
    style={{ position: 'absolute', left, top: top + TABLE_CORNER / 2, width }}
  />
);
