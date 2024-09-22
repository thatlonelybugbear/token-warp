import Settings from './settings.js';
import Constants from './constants.js';

const settings = new Settings();
const name = Constants.MODULE_NAME;

/*  Functions */
export function _preUpdateToken(tdoc, changes, options, userId) {
  if (
    (!changes.x && !changes.y) ||
    (changes.x == tdoc.x && changes.y == tdoc.y) ||
    options.animate == false ||
    options.teleport == true ||
    options.tokenwarped == true
  )
    return;
  const isGM = game.users.get(userId).isGM;
  const token = tdoc.object;
  const ev = event;
  const keyTW = settings.teleportKey;
  const keyER = getElevationRulerKey();
  const hasKey =
    isKeyPressed(ev, keyTW) || elevationRulerPathfindingKeybind(ev, keyER);
  const {
    excludedScene,
    movementSpeed,
    movementSwitch,
    outOfBounds,
    debug,
    migration,
  } = settings;
  if (debug)
    console.warn(`${name} settings: ||`, {
      excludedScene,
      movementSpeed,
      movementSwitch,
      outOfBounds,
      debug,
      migration,
    });
  const destination = { x: changes.x, y: changes.y }; //topLeft
  const origin = { x: tdoc.x, y: tdoc.y }; //topLeft
  const destinationCenter = token.getCenterPoint(destination);

  const originCenter = token.center;

  const ruler = canvas.controls.ruler;
  const { segments } = ruler || {};
  const finalSegment = segments.find((s) => s.last);
  const activeRulerModules = getActiveRulers();
  if (activeRulerModules == 'both') return true;
  const tokenCenterPointDiff = token.getCenterPoint({ x: 0, y: 0, z: 0 });
  const finalDestination =
    activeRulerModules == 'ER' && segments.length > 1
      ? {
          x: finalSegment.ray.B.x - tokenCenterPointDiff.x,
          y: finalSegment.ray.B.y - tokenCenterPointDiff.y,
          z: finalSegment.ray.B.z,
        }
      : activeRulerModules == 'DR' && segments.length
      ? token.getSnappedPosition({
          x: finalSegment.ray.B.x - tokenCenterPointDiff.x,
          y: finalSegment.ray.B.y - tokenCenterPointDiff.y,
          z: finalSegment.ray.B.z,
        })
      : destination;
  if (excludedScene || (hasKey && isGM)) {
    if (!hasKey) return getMovementSpeed(options, settings);
    else {
      tdoc.update(finalDestination, {
        animate: false,
        teleport: true,
        tokenwarped: true,
      });
      return false;
    }
  }

  if (
    (changes.x !== tdoc.x || changes.y !== tdoc.y) &&
    options.animate !== false &&
    !options.teleport &&
    !options.tokenwarped
  ) {
    if (
      settings.movementSwitch == 'noanimations' ||
      (game.users.get(userId).isGM &&
        settings.movementSwitch == 'wallsblock' &&
        token.checkCollision(destinationCenter, { origin: originCenter }))
    ) {
      options.animate = false;
      options.teleport = true;
      options.tokenwarped = true;
    }
    if (
      settings.outOfBounds &&
      ((isGM && !hasKey) || !isGM) &&
      positionOutOfBounds({ destination, origin, tdoc }) == true
    ) {
      options.tokenwarped = true;
      foundry.utils.mergeObject(
        changes,
        clampDestinationToSceneRect({ tdoc, destination })
      );
    }
    if (
      (isGM && hasKey) ||
      positionOutOfBounds({ destination, origin, tdoc }) == 'both'
    ) {
      options.animate = false;
      options.teleport = true;
      options.tokenwarped = true;
    }
    return getMovementSpeed(options, settings);
  }
}

function isElevationRulerActive() {
  return game.modules.get('elevationruler')?.active;
}

function isDragRulerActive() {
  return game.modules.get('drag-ruler')?.active;
}

//DR always calls animate false when the key is pressed and hooks before Token Warp, so for now no need to check it.
function getDragRulerKey() {
  return isDragRulerActive()
    ? game.keybindings.get('drag-ruler', 'moveWithoutAnimation')?.[0]?.key
    : null;
}

function getElevationRulerKey() {
  return isElevationRulerActive()
    ? game.keybindings.get('elevationruler', 'togglePathfinding')[0]?.key //expect error if the key bind is null
    : null;
}

function isKeyPressed(ev, key) {
  return key ? ev?.view?.game.keyboard.downKeys.has(key) : false; //return false if no proper key is found.
}

function elevationRulerPathFindingState() {
  return isElevationRulerActive()
    ? game.settings.get('elevationruler', 'pathfinding_enable') &&
        game.settings.get('elevationruler', 'pathfinding-control')
    : false;
}

function elevationRulerPathfindingKeybind(ev, keyER) {
  if (!keyER) return false;
  const pathfindingToggled = elevationRulerPathFindingState();
  const keyPress = isKeyPressed(ev, keyER);
  return pathfindingToggled && keyPress; //!(pathfindingToggled ^ keyPress);
}

function positionOutOfBounds({ destination, origin, tdoc }) {
  //positions top left
  const rect = canvas.scene.dimensions.sceneRect;
  const { top, bottom, left, right } = tdoc.object.shape;
  const destinationOOB =
    rect.x > destination.x ||
    rect.y > destination.y ||
    rect.x + rect.width < destination.x + right ||
    rect.y + rect.height < destination.y + bottom;
  const originOOB =
    rect.x > origin.x ||
    rect.y > origin.y ||
    rect.x + rect.width < origin.x + right ||
    rect.y + rect.height < origin.y + bottom;
  return destinationOOB && originOOB
    ? 'both'
    : destinationOOB && !originOOB
    ? true
    : false;
}

function clampDestinationToSceneRect({ destination, tdoc }) {
  const rect = canvas.scene.dimensions.sceneRect;
  const { top, bottom, left, right } = tdoc.object.shape;
  return {
    x: Math.clamp(destination.x, rect.x, rect.x + rect.width - right),
    y: Math.clamp(destination.y, rect.y, rect.y + rect.height - bottom),
  };
}

function getMovementSpeed(options, settings) {
  if (settings.movementSpeed)
    foundry.utils.setProperty(
      options,
      'animation.movementSpeed',
      settings.movementSpeed
    );
}

export function getActiveRulers() {
  const ER = game.modules.get('elevationruler')?.active;
  const DR = game.modules.get('drag-ruler')?.active;
  if (ER && DR) {
    ui.notifications.error(game.i18n.localize("TOKENWARP.WarnMultipleRulersActive"));
    return 'both';
  }
  return ER ? 'ER' : DR ? 'DR' : false;
}
