import { MuButton } from '../../components/muButton';
import {
  GAUGE_HEIGHT,
  GAUGE_OFFSET_X,
  GAUGE_OFFSET_Y,
  GAUGE_WIDTH,
  SERVER_BTN_HEIGHT,
  SERVER_BTN_WIDTH,
  SPRITE,
  TEXT_COLOR,
} from './layout';

interface ServerItemProps {
  name: string;
  load: number;
  top: number;
  onClick?: () => void;
}

export const ServerItem = ({ name, load, top, onClick }: ServerItemProps) => {
  const filled = Math.max(0, Math.min(100, load));

  const full = filled >= 100;

  return (
    <MuButton
      file={SPRITE.serverButton}
      width={SERVER_BTN_WIDTH}
      height={SERVER_BTN_HEIGHT}
      frames={{ up: 0, active: 1, down: 2 }}
      color={TEXT_COLOR.brightGray}
      activeColor={TEXT_COLOR.white}
      disabled={full}
      onClick={onClick}
      style={{ position: 'absolute', left: 0, top }}
      labelStyle={{
        alignItems: 'flex-start',
        paddingTop: 3,
        fontSize: 11,
        textShadow: '1px 1px 0 rgba(0, 0, 0, 0.85)',
      }}
      label={name}
    >
      {/* The load gauge ('server_b2_loding' in the original), as a Vael bar. */}
      <div
        className="vael-server-gauge"
        style={{
          position: 'absolute',
          left: GAUGE_OFFSET_X,
          top: GAUGE_OFFSET_Y,
          width: GAUGE_WIDTH,
          height: GAUGE_HEIGHT,
        }}
      >
        <div className="vael-server-gauge-fill" style={{ width: `${filled}%` }} />
      </div>
    </MuButton>
  );
};
