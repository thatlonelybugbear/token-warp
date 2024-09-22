import Constants from './constants.js';

export default class Settings {
  // KEYS FOR WORLD CONFIG SETTINGS
  static TOKEN_ANIMATION_SWITCH = 'defaultTokenAnimationSwitch';
  static WALLS_CANCEL_TOKEN_ANIMATION_GM = 'wallsCancelTokenAnimationGM';
  static DEFAULT_TOKEN_ANIMATION_SWITCH_OLD = 'defaultTokenAnimationSwitchOLD';
  static EXCLUDED_SCENES = 'excludedScenes';
  static DEFAULT_TOKEN_ANIMATION_SPEED = 'defaultTokenAnimationSpeed';
  static DEFAULT_OUT_OF_BOUNDS_BEHAVIOUR = 'outOfBoundsCheck';
  static TELEPORT_KEYBIND = 'teleportKey';
  static MIGRATIONS = 'migration';
  static DEBUG = 'debug';

  registerSettings() {
    this._registerWorldSettings();
    this._registerKeybindings();
  }

  _registerWorldSettings() {
    game.settings.register(Constants.MODULE_ID, Settings.EXCLUDED_SCENES, {
      name: 'TOKENWARP.ExcludedScenesName',
      hint: 'TOKENWARP.ExcludedScenesHint',
      scope: 'world',
      config: true,
      type: String,
    });

    game.settings.register(
      Constants.MODULE_ID,
      Settings.TOKEN_ANIMATION_SWITCH,
      {
        name: 'TOKENWARP.TokenAnimationSwitchName',
        hint: 'TOKENWARP.TokenAnimationSwitchHint',
        scope: 'world',
        config: true,
        default: 'default',
        type: String,
        choices: {
          default: 'TOKENWARP.defaultTA',
          noanimations: 'TOKENWARP.noTA',
          wallsblock: 'TOKENWARP.wallsBlockTA',
        },
      }
    );

    game.settings.register(
      Constants.MODULE_ID,
      Settings.DEFAULT_TOKEN_ANIMATION_SWITCH_OLD,
      {
        name: 'TOKENWARP.DefaultTokenAnimationSwitchName',
        hint: 'TOKENWARP.DefaultTokenAnimationSwitchHint',
        scope: 'world',
        config: false,
        default: false,
        type: Boolean,
      }
    );

    game.settings.register(
      Constants.MODULE_ID,
      Settings.WALLS_CANCEL_TOKEN_ANIMATION_GM,
      {
        name: 'TOKENWARP.WallsCancelTokenAnimationName',
        hint: 'TOKENWARP.WallsCancelTokenAnimationHint',
        scope: 'world',
        config: false,
        default: false,
        type: Boolean,
      }
    );

	  game.settings.register(
		  Constants.MODULE_ID,
		  Settings.DEFAULT_TOKEN_ANIMATION_SPEED,
		  {
			  name: 'TOKENWARP.DefaultTokenAnimationSpeedName',
			  hint: 'TOKENWARP.DefaultTokenAnimationSpeedHint',
			  scope: 'world',
			  config: true,
			  default: 6,
			  type: Number,
			  range: {
				  max: 20,
				  min: 1,
				  step: 1,
			  },
		  }
	  );

    game.settings.register(
      Constants.MODULE_ID,
      Settings.DEFAULT_OUT_OF_BOUNDS_BEHAVIOUR,
      {
        name: 'TOKENWARP.DefaultOutOfBoundsBehaviourName',
        hint: 'TOKENWARP.DefaultOutOfBoundsBehaviourHint',
        scope: 'world',
        config: true,
        default: false,
        type: Boolean,
      }
    );

    game.settings.register(Constants.MODULE_ID, Settings.MIGRATIONS, {
      name: 'TOKENWARP.Migration',
      scope: 'world',
      config: false,
      type: String,
    });

    game.settings.register(Constants.MODULE_ID, Settings.DEBUG, {
      name: 'TOKENWARP.Debug',
      scope: 'world',
      config: false,
      type: Boolean,
    });
  }

  _registerKeybindings() {
    game.keybindings.register(Constants.MODULE_ID, Settings.TELEPORT_KEYBIND, {
      name: 'TOKENWARP.TeleportKeybindName',
      editable: [{ key: 'KeyQ' }],
      restricted: true,
    });
  }

  get teleportKey() {
    return game.keybindings.get(
      Constants.MODULE_ID,
      Settings.TELEPORT_KEYBIND
    )[0]?.key;
  }

  get movementSwitchOLD() {
    return game.settings.get(
      Constants.MODULE_ID,
      Settings.DEFAULT_TOKEN_ANIMATION_SWITCH_OLD
    );
  }

  get movementSwitch() {
    return game.settings.get(
      Constants.MODULE_ID,
      Settings.TOKEN_ANIMATION_SWITCH
    );
  }

  get excludedScene() {
    const sceneString = game.settings.get(
      Constants.MODULE_ID,
      Settings.EXCLUDED_SCENES
    );
    if (!sceneString?.trim().length) return false;
    const sceneArray = sceneString
      .trim()
      .split(';')
      .filter((s) => !!s.trim())
      .map((s) => s.trim());
    for (const scene of sceneArray) {
      if (scene.startsWith('Scene.')) continue;
      else
        sceneArray[sceneArray.indexOf(scene)] = scene.replace(
          scene,
          `Scene.${scene}`
        );
    }
    if (game.canvas?.scene && sceneArray.includes(game.canvas.scene.uuid))
      return true;
    else return false;
  }

  get wallBlock() {
    return game.settings.get(
      Constants.MODULE_ID,
      Settings.WALLS_CANCEL_TOKEN_ANIMATION_GM
    );
  }

  get movementSpeed() {
    return game.settings.get(
      Constants.MODULE_ID,
      Settings.DEFAULT_TOKEN_ANIMATION_SPEED
    );
  }

  get outOfBounds() {
    return game.settings.get(
      Constants.MODULE_ID,
      Settings.DEFAULT_OUT_OF_BOUNDS_BEHAVIOUR
    );
  }

  get migration() {
    return game.settings.get(Constants.MODULE_ID, Settings.MIGRATIONS);
  }

  get debug() {
    return game.settings.get(Constants.MODULE_ID, Settings.DEBUG);
  }
}
