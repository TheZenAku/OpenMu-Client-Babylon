import './style.less';
import { useUiStageScale } from '../uiStage';

/**
 * The mark over the login window, in the Vael theme (the owner's reference): a spaced label and the
 * name in the display serif with the blood-and-gilt gradient, where `LoginScene::Render` drew the MU
 * logo art (Scenes/LoginScene.cpp:410-421) - same place (centred, y 25 of the 640×480 stage), same
 * fade in (`g_fMULogoAlpha`, about 0.8 s).
 *
 * Shared: the start menu and the login window both crown themselves with it.
 */

const LOGO_TOP = 25;

/** The name's size on the 640×480 stage. */
const WORD_SIZE = 64;

export const MuLogo = ({ top = LOGO_TOP }: { top?: number }) => {
  const stageScale = useUiStageScale();

  return (
    <div className="mu-logo" style={{ top: top * stageScale }} role="img" aria-label="MUIdle">
      <span className="mu-logo-kicker">MU Online · Season 6</span>
      <span className="mu-logo-word" style={{ fontSize: WORD_SIZE * stageScale }}>
        MUIdle
      </span>
      <span className="mu-logo-rule" aria-hidden />
    </div>
  );
};
