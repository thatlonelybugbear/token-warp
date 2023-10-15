'use strict';

import Constants from './src/constants.js';
import Settings from './src/settings.js';
import { _preUpdateToken, _wallsBlockMovement } from './src/tokenwarp.js';

const settings = new Settings();

Hooks.once('init', () => {
  settings.registerSettings();
})

Hooks.on('preUpdateToken', _preUpdateToken);
