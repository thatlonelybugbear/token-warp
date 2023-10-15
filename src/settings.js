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
        name: 'Disable token movement by default.',
        hint: 'When checked, the tokens appear to their destinations instantly (no token movement animations).',
        scope: 'world',
        config: true,
        default: false,
        type: Boolean,
      }
    );

    game.settings.register(Constants.MODULE_ID, Settings.EXCLUDED_SCENES, {
      name: 'Excluded scenes. Overrides disable movement for specific Scenes.',
      hint: 'Scene UUIDs (or IDs) separated by semicolons (;). Movement animations will always be displayed on these scenes. Right click on a scene on the navigation bar, configure scene and click on the small icon to the right of the name in the title bar. Right click for Scene.UUID, left click for Scene.ID.',
      scope: 'world',
      config: true,
      type: String,
    });

    game.settings.register(
      Constants.MODULE_ID,
      Settings.WALLS_CANCEL_TOKEN_ANIMATION_GM,
      {
        name: 'Walls cancel token movement animation',
        hint: 'When checked, draggin tokens over scene walls will automatically force the token movement to be instant. This setting helps GMs to not reveal map areas not meant to be seen by their players (will not have any effect if the token movement animation is OFF).',
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
        name: 'Token movement animation speed.',
        hint: 'Set the tokens animation speed. Default is 6. v10 Foundry had a default speed of 12.',
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
    if (!sceneString.trim().length) return false;
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
