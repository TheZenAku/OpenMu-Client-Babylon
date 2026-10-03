// Vitest setup: tests import app modules without main.tsx, so give them the
// same boot contract - the default version's core resolved first. UI is not
// loaded; nothing renders version UI under node.
import { DEFAULT_VERSION_ID } from '../../versions/registry';
import { i18n } from '../i18n';
import { loadGameVersion } from './index';

await loadGameVersion(DEFAULT_VERSION_ID);

// Node has a `navigator` that reports the machine's locale, so on a pt-BR
// machine every test started in Portuguese and the ones that read English
// names failed. Tests that want another language switch to it themselves.
i18n.setLanguage('en');
