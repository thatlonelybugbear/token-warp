import Constants from './constants.js';

export default class Settings {
  // KEYS FOR WORLD CONFIG SETTINGS
  static WALLS_CANCEL_TOKEN_ANIMATION_GM = 'wallsCancelTokenAnimationGM';
  static DEFAULT_TOKEN_ANIMATION_SWITCH = 'defaultTokenAnimationSwitch';
  static EXCLUDED_SCENES = 'excludedScenes';
  static DEFAULT_TOKEN_ANIMATION_SPEED = 'defaultTokenAnimationSpeed';

  registerSettings() {
    this._registerWorldSettings();
  }

  _registerWorldSettings() {
    const userRoles = {};
    userRoles[CONST.USER_ROLES.PLAYER] = 'Player';
    userRoles[CONST.USER_ROLES.TRUSTED] = 'Trusted Player';
    userRoles[CONST.USER_ROLES.ASSISTANT] = 'Assistant GM';
    userRoles[CONST.USER_ROLES.GAMEMASTER] = 'Game Master';
    userRoles[5] = 'None';

    game.settings.register(
      Constants.MODULE_ID,
      Settings.DEFAULT_TOKEN_ANIMATION_SWITCH,
      {
        name: 'TOKENWARP.DefaultTokenAnimationSwitchName',
        hint: 'TOKENWARP.DefaultTokenAnimationSwitchHint',
        scope: 'world',
        config: true,
        default: false,
        type: Boolean,
      }
    );

    game.settings.register(Constants.MODULE_ID, Settings.EXCLUDED_SCENES, {
      name: 'TOKENWARP.ExcludedScenesName',
      hint: 'TOKENWARP.ExcludedScenesHint',
      scope: 'world',
      config: true,
      type: String,
    });

    game.settings.register(
      Constants.MODULE_ID,
      Settings.WALLS_CANCEL_TOKEN_ANIMATION_GM,
      {
        name: 'TOKENWARP.WallsCancelTokenAnimationName',
        hint: 'TOKENWARP.WallsCancelTokenAnimationHint',
        scope: 'world',
        config: true,
        default: true,
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
  }

  get movementSwitch() {
    return game.settings.get(
      Constants.MODULE_ID,
      Settings.DEFAULT_TOKEN_ANIMATION_SWITCH
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
}
