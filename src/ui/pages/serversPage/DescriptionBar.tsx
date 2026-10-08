import { DESC_HEIGHT, DESC_WIDTH, DESC_X, DESC_Y } from './layout';

type DescriptionBarProps = {
  text?: string;
};

/**
 * The server's description under the list, where the original drew its `server_ex01-03` bar - as a
 * Vael panel (gilt hairline, ink fill) of the same size and place.
 */
export const DescriptionBar = ({ text }: DescriptionBarProps) => (
  <div
    className="vael-server-desc"
    style={{
      position: 'absolute',
      left: DESC_X,
      top: DESC_Y,
      width: DESC_WIDTH,
      height: DESC_HEIGHT,
    }}
  >
    {!!text && <div className="vael-server-desc-text">{text}</div>}
  </div>
);
