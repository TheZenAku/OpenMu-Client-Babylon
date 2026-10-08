import type { CSSProperties } from 'react';

/** The original digit sheet's glyph box at a scale (`newui_number1.OZT`), kept for the positions. */
function glyphSize(scale: number) {
  return { width: 12 * (scale - 0.3), height: 16 * (scale - 0.3) };
}

type MuNumberProps = {
  value: number;
  x: number;
  y: number;
  scale?: number;
  /** Pad with leading zeroes to this many digits (a clock's seconds). */
  minDigits?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * A number centred on `x`, as the original's digit sprites were - drawn as text in the Vael theme's
 * label face (gilt, tabular figures) instead of the bitmap sheet.
 */
export const MuNumber = ({
  value,
  x,
  y,
  scale = 1,
  minDigits = 1,
  className,
  style,
}: MuNumberProps) => {
  if (scale < 0.3) return null;

  const { height } = glyphSize(scale);
  const digits = String(Math.trunc(value)).padStart(minDigits, '0');

  return (
    <div
      className={`vael-number${className ? ` ${className}` : ''}`}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        height,
        lineHeight: `${height}px`,
        fontSize: Math.max(6, height * 0.72),
        transform: 'translateX(-50%)',
        fontFamily: 'var(--v-font-label)',
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--v-gilt-bright)',
        textShadow: '0 1px 2px oklch(0% 0 0 / 0.9)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {digits}
    </div>
  );
};
