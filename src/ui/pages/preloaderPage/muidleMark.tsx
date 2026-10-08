/**
 * The page's mark in the Vael theme (the owner's reference): the name set in the display serif with
 * the blood-and-gilt gradient, a spaced label over it, a gilt rule under it. It keeps the `ws-logo`
 * box, so the page's layout and its draw-in once the load is done stay as they were.
 */
export const MuidleMark = () => (
  <div className="ws-logo vael-mark" role="img" aria-label="MUIdle">
    <span className="vael-mark-kicker">MU Online · Season 6</span>
    <span className="vael-mark-word">MUIdle</span>
    <span className="vael-mark-rule" aria-hidden />
  </div>
);
