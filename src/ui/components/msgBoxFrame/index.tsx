import type { CSSProperties, ReactNode } from 'react';

/**
 * The original's three-slice message box (`CNewUIMessageBoxMng::LoadImages`,
 * NewUIMessageBox.cpp:444): a 230-wide frame over a stretched fill, whose
 * middle slice repeats once per line. Every window built on the message box
 * art is this frame with a different number of middle slices - the two-field
 * economy prompt takes 8, the Kanturu gateway dialog takes 10
 * (`RenderFrame`, NewUIKanturuEvent.cpp).
 *
 * In the Vael theme (the owner's reference) the slices are one gilt-lined panel of the same size
 * (`.vael-msgbox`, ui/theme/vael-surfaces.less); the slice heights still size the box.
 *
 * Driven by: whoever renders it. Read by: nobody - it holds no state.
 */

export const MSGBOX_WIDTH = 230;
export const MSGBOX_TOP_HEIGHT = 67;
export const MSGBOX_MIDDLE_HEIGHT = 15;
export const MSGBOX_BOTTOM_HEIGHT = 50;

/** The box's height for `lines` middle slices. */
export function msgBoxHeight(lines: number): number {
  return MSGBOX_TOP_HEIGHT + MSGBOX_MIDDLE_HEIGHT * lines + MSGBOX_BOTTOM_HEIGHT;
}

type MsgBoxFrameProps = {
  /** Middle slices; the box grows by `MSGBOX_MIDDLE_HEIGHT` each. */
  lines: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export const MsgBoxFrame = ({ lines, className, style, children }: MsgBoxFrameProps) => {
  const height = msgBoxHeight(lines);

  return (
    <div className={className} style={{ width: MSGBOX_WIDTH, height, ...style }}>
      <div className="vael-msgbox" aria-hidden />
      {children}
    </div>
  );
};
