'use strict';

import Settings from './src/settings.js';
import { _preUpdateToken, _wallsBlockMovement } from './src/tokenwarp.js';

Hooks.once('init', () => {
  new Settings().registerSettings();
})

Hooks.on('preUpdateToken', _preUpdateToken);
