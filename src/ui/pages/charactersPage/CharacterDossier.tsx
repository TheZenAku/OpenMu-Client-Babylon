import { observer } from 'mobx-react-lite';
import { Store } from '../../../store';
import { classFromAppearance } from '../../../common/deserializeAppearance';
import { getClassName } from '../../../common/characterStats';
import { mt } from '../../../muidle/text';
import { uiClick } from '../../../libs/sfx';

/** The original's five character slots per account. */
const SLOTS = 5;

/**
 * The Vael "dossiê" of the character select (the owner's reference): a roster column on the left -
 * the account's characters as tiles, the chosen one in blood - and the chosen character's record
 * at the top: house line, its name large in the gilt-and-blood serif, class and level under it.
 * Choosing a tile is the same as clicking the model in the scene (focus request to the server).
 */
export const CharacterDossier = observer(() => {
  const characters = Store.charactersList;
  const selected = characters.find(c => c.Name === Store.focusedChar);

  const choose = (name: string) => {
    if (name === Store.focusedChar) return;
    Store.focusedChar = name;
    Store.focusCharacterRequest(name);
  };

  return (
    <>
      <nav className="vael-roster" aria-label={mt('charsel.roster')}>
        <div className="vael-roster-mark">
          <span className="vael-roster-letter">M</span>
          <span className="vael-roster-word">IDLE</span>
        </div>
        <div className="vael-roster-title">{mt('charsel.roster')}</div>
        {characters.map(character => (
          <button
            key={character.Name}
            type="button"
            className={`vael-roster-tile${character.Name === Store.focusedChar ? ' is-active' : ''}`}
            onClick={uiClick(() => choose(character.Name))}
          >
            <span className="vael-roster-name">{character.Name}</span>
            <span className="vael-roster-meta">
              {getClassName(classFromAppearance(character.Appearance))} · {character.Level}
            </span>
          </button>
        ))}
        {Array.from({ length: Math.max(0, SLOTS - characters.length) }, (_, i) => (
          <div key={`free-${i}`} className="vael-roster-tile is-free">
            <span className="vael-roster-meta">{mt('charsel.free')}</span>
          </div>
        ))}
      </nav>

      {selected && (
        <header className="vael-dossier">
          <div className="vael-dossier-house">{mt('charsel.house')}</div>
          <h1 className="vael-dossier-name">{selected.Name}</h1>
          <p className="vael-dossier-line">
            {mt('charsel.line', {
              class: getClassName(classFromAppearance(selected.Appearance)),
              level: selected.Level,
            })}
          </p>
        </header>
      )}
    </>
  );
});
