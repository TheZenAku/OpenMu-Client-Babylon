/**
 * The option window's frame in the Vael theme (the owner's reference): one gilt-lined ink panel at
 * any size, where the original drew its stone, rails, title bar and foot (`op1_stone`, `op1_back2-4`,
 * `op2_back1`).
 */
export const OptionsFrame = ({ width, height }: { width: number; height: number }) => (
  <div className="vael-options-frame" style={{ width, height }} aria-hidden />
);
