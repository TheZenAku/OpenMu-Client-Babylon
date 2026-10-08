import './style.less';

/**
 * The frame around a pregame panel (the world picker, the GM panel) in the Vael theme - the owner's
 * reference: a gilt hairline, a fainter one inset, gilt brackets on the corners. It stands where the
 * original's Option window band and rails (`op1_back2/3/4`) were drawn.
 */
export const MuFrame = () => (
  <div className="mu-frame" aria-hidden>
    {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
      <span key={corner} className={`mu-frame-corner mu-frame-${corner}`} />
    ))}
  </div>
);
