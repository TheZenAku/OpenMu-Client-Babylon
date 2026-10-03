import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { t, type TextKey } from '../../../../../i18n';
import { Economy, MIX_MENU } from '../../../../../economy';
import { Store } from '../../../../../store';
import { MUIdle } from '../../../../../muidle/state';
import { mixOddsView, traySignature } from '../../../../../muidle/mixOdds';
import { uiClick } from '../../../../../libs/sfx';

/** The crafting refusals by their server name, in the texts the mix button already uses. */
const REFUSAL: Record<string, TextKey> = {
  NotEnoughMoney: 'chaos.notEnoughZen',
  TooManyItems: 'chaos.tooManyItems',
  CharacterLevelTooLow: 'chaos.levelTooLow',
  LackingMixItems: 'chaos.lackingItems',
  IncorrectMixItems: 'chaos.incorrectItems',
  InvalidItemLevel: 'chaos.invalidItemLevel',
  CharacterClassTooLow: 'chaos.classTooLow',
  IncorrectBloodCastleItems: 'chaos.bloodCastleItems',
  NotEnoughMoneyForBloodCastle: 'chaos.bloodCastleZen',
};

const LISTED = MIX_MENU.map(entry => entry.type as number);

const group = (value: number) => Math.max(0, Math.floor(value)).toLocaleString('en-US');

/**
 * The odds of the picked combination for the items in the tray - success rate and Zen, or why the
 * goblin refuses them and which recipe they fit - as the server works them out (`MUIdleMixPreview`)
 * whenever the tray or the pick changes.
 */
export const MixOdds = observer(() => {
  const picked = Economy.mixType as number;
  const tray = traySignature(Economy.mixItems);
  const asking =
    Economy.mixOpen &&
    Economy.mixKind === 'chaosMachine' &&
    !Economy.mixPending &&
    !Economy.mixResult &&
    !Store.isOffline &&
    Economy.mixItems.some(Boolean);

  useEffect(() => {
    if (!asking) return;
    // A burst of moves (a stack dragged in piece by piece) asks once.
    const timer = setTimeout(() => MUIdle.requestMixPreview(picked), 200);
    return () => clearTimeout(timer);
  }, [asking, picked, tray]);

  if (!asking) return null;
  const view = mixOddsView(MUIdle.mixPreview, picked, LISTED);
  if (!view) return null;

  if (view.kind === 'odds') {
    const short = view.cost > Store.playerData.money;
    return (
      <div className={`chaos-odds${short ? ' short' : ''}`}>
        {t('chaos.odds', { rate: view.rate, zen: group(view.cost) })}
      </div>
    );
  }

  if (view.kind === 'fits') {
    const entry = MIX_MENU.find(e => (e.type as number) === view.mixType)!;
    return (
      <div
        className="chaos-odds fits"
        data-no-drag="true"
        onClick={uiClick(() => Economy.setMixType(entry.type))}
      >
        {t('chaos.fits', { recipe: t(entry.labelKey) })}
      </div>
    );
  }

  return <div className="chaos-odds refused">{t(REFUSAL[view.result] ?? 'chaos.incorrectItems')}</div>;
});
