import Settings from './settings.js';
import Constants from './constants.js';

const settings = new Settings();
const name = Constants.MODULE_NAME;

/*  Functions */
export function _preUpdateToken(tdoc, changes, options, userId) {
	if ((!changes.x && !changes.y) || (changes.x == tdoc.x && changes.y == tdoc.y) || options.animate == false || options.teleport == true || options.tokenwarped == true) return;
	const isGM = game.users.get(userId).isGM;
	const token = tdoc.object;
	const ev = event;
	const { excludedScene, movementSpeed, movementSwitch, outOfBounds, debug, migration, teleportKey } = settings;
	const keyER = getElevationRulerKey();
	const hasKey = isKeyPressed(ev, teleportKey) || elevationRulerPathfindingKeybind(ev, keyER);
	const destination = { x: changes.x, y: changes.y }; //topLeft
	const origin = { x: tdoc.x, y: tdoc.y }; //topLeft
	const isMoveOutOfBounds = settings.outOfBounds && positionOutOfBounds({ destination, origin, tdoc });
	const destinationCenter = token.getCenterPoint(destination);

	const originCenter = token.center;
	if (debug)
		console.warn(`${name} settings: ||`, {
			excludedScene,
			movementSpeed,
			movementSwitch,
			outOfBounds,
			debug,
			migration,
		});
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

	if ((changes.x !== tdoc.x || changes.y !== tdoc.y) && options.animate !== false && !options.teleport && !options.tokenwarped) {
		if (settings.movementSwitch == 'noanimations' || (game.users.get(userId).isGM && movementSwitch == 'wallsblock' && token.checkCollision(destinationCenter, { origin: originCenter }))) {
			options.animate = false;
			options.teleport = true;
			options.tokenwarped = true;
		}
		if (((isGM && !hasKey) || !isGM) && isMoveOutOfBounds === 'outwards') {
			options.tokenwarped = true;
			foundry.utils.mergeObject(changes, clampDestinationToSceneRect({ tdoc, destination }));
		}
		if ((isGM && hasKey) || isMoveOutOfBounds === 'both') {
			options.animate = false;
			options.teleport = true;
			options.tokenwarped = true;
		}
		return getMovementSpeed(options, settings);
	}
}

export function _preUpdateTokenV13(tdoc, changes, options, userId) {
	if ((!changes.x && !changes.y) || (changes.x == tdoc.x && changes.y == tdoc.y) || options.animate == false || options.teleport == true || options.tokenwarped == true) return true;
	const isGM = game.users.get(userId).isGM;
	const token = tdoc.object;
	const ev = event;
	const { excludedScene, movementSpeed, movementSwitch, outOfBounds, debug, migration, teleportKey } = settings;
	const keyER = getElevationRulerKey();
	const hasKey = isKeyPressed(ev, teleportKey) || elevationRulerPathfindingKeybind(ev, keyER);

	const destination = { x: changes.x, y: changes.y }; //topLeft
	const origin = { x: tdoc.x, y: tdoc.y }; //topLeft
	const isMoveOutOfBounds = outOfBounds && positionOutOfBounds({ destination, origin, tdoc });
	const destinationCenter = token.getCenterPoint(destination);

	const originCenter = token.center;
	if (debug)
		console.warn(`${name} settings: ||`, {
			excludedScene,
			movementSpeed,
			movementSwitch,
			outOfBounds,
			debug,
			migration,
			origin,
			isMoveOutOfBounds,
			destination,
			hasKey,
		});
	const activeRulerModules = getActiveRulers();
	if (activeRulerModules) return true; //v13 rulers compatibility unknown, so disable anything TW related if they are enabled.
	const finalDestination = getFinalDestination({ options, id: tdoc.id });
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

	if ((changes.x !== tdoc.x || changes.y !== tdoc.y) && options.animate !== false && !options.teleport && !options.tokenwarped) {
		if (movementSwitch === 'noanimations' || (isGM && movementSwitch === 'wallsblock' && token.checkCollision(destinationCenter, { origin: originCenter }))) {
			options.animate = false;
			options.teleport = true;
			options.tokenwarped = true;
		}
		if (((isGM && !hasKey) || !isGM) && isMoveOutOfBounds === 'outwards') {
			options.tokenwarped = true;
			options.animate = false;
			options.teleport = true;
			const { x, y } = clampDestinationToSceneRect({ tdoc, destination });
			foundry.utils.mergeObject(options.movement[tdoc.id], setLastWayPoint({ options, x, y, id: tdoc.id }));
			const newDestination = foundry.utils.duplicate(options._movement[tdoc.id].destination);
			newDestination.x = x;
			newDestination.y = y;
			options._movement[tdoc.id].destination = newDestination;
			foundry.utils.mergeObject(changes, { x, y }, { inPlace: true });
			options.tokenwarped = true;
		}
		if ((isGM && hasKey) || isMoveOutOfBounds === 'both') {
			options.animate = false;
			options.teleport = true;
			options.tokenwarped = true;
		}
		return getMovementSpeed(options, settings);
	}
}

function getFinalDestination({ options, id }) {
	const tokenMovementArray = options.movement[id].waypoints;
	return tokenMovementArray[tokenMovementArray.length - 1];
}
function setLastWayPoint({ options, x, y, id }) {
	const tokenMovementArray = foundry.utils.duplicate(options.movement[id].waypoints);

	if (tokenMovementArray.length > 0) {
		const lastWaypoint = tokenMovementArray[tokenMovementArray.length - 1];
		lastWaypoint.x = x;
		lastWaypoint.y = y;
		lastWaypoint.forced = true;
	}
	return { waypoints: tokenMovementArray };
}

function isElevationRulerActive() {
	return game.modules.get('elevationruler')?.active;
}

function isDragRulerActive() {
	return game.modules.get('drag-ruler')?.active;
}

//DR always calls animate false when the key is pressed and hooks before Token Warp, so for now no need to check it.
function getDragRulerKey() {
	return isDragRulerActive() ? game.keybindings.get('drag-ruler', 'moveWithoutAnimation')?.[0]?.key : null;
}

function getElevationRulerKey() {
	return isElevationRulerActive()
		? game.keybindings.get('elevationruler', 'togglePathfinding')[0]?.key //expect error if the key bind is null
		: null;
}

function isKeyPressed(ev, key) {
	const { MODIFIER_CODES: CODES, MODIFIER_KEYS } = foundry.helpers?.interaction?.KeyboardManager ?? KeyboardManager;

	/**
	 * Track which KeyboardEvent#code presses associate with each modifier.
	 * Added support for treating Meta separate from Control.
	 * @enum {string[]}
	 */
	const MODIFIER_CODES = {
		Alt: CODES.Alt,
		Control: CODES.Control.filter((k) => k.startsWith('Control')),
		Meta: CODES.Control.filter((k) => !k.startsWith('Control')),
		Shift: CODES.Shift,
	};

	function areKeysPressed(event, action) {
		if (!event) return false;
		const activeModifiers = {};
		const addModifiers = (key, pressed) => {
			activeModifiers[key] = pressed;
			MODIFIER_CODES[key].forEach((n) => (activeModifiers[n] = pressed));
		};
		addModifiers(MODIFIER_KEYS.ALT, event.altKey);
		addModifiers(MODIFIER_KEYS.CONTROL, event.ctrlKey);
		addModifiers('Meta', event.metaKey);
		addModifiers(MODIFIER_KEYS.SHIFT, event.shiftKey);
		return game.keybindings.get('tokenwarp', action).some((b) => {
			if (game.keyboard.downKeys.has(b.key) && b.modifiers.every((m) => activeModifiers[m])) return true;
			if (b.modifiers.length) return false;
			return activeModifiers[b.key];
		});
	}
	return key ? areKeysPressed(ev, 'teleportKey') : false; //return false if no proper key is found.
}

function elevationRulerPathFindingState() {
	return isElevationRulerActive() ? game.settings.get('elevationruler', 'pathfinding_enable') && game.settings.get('elevationruler', 'pathfinding-control') : false;
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
	const { h: bottom, w: right } = tdoc.object;
	const destinationOOB = rect.x > destination.x || rect.y > destination.y || rect.x + rect.width < destination.x + right || rect.y + rect.height < destination.y + bottom;
	const originOOB = rect.x > origin.x || rect.y > origin.y || rect.x + rect.width < origin.x + right || rect.y + rect.height < origin.y + bottom;
	return destinationOOB && originOOB ? 'both' : destinationOOB && !originOOB ? 'outwards' : !destinationOOB && originOOB ? 'inwards' : false;
}

function clampDestinationToSceneRect({ destination, tdoc }) {
	const rect = canvas.scene.dimensions.sceneRect;
	const { h: bottom, w: right } = tdoc.object;
	return {
		x: Math.clamp(destination.x, rect.x, rect.x + rect.width - right),
		y: Math.clamp(destination.y, rect.y, rect.y + rect.height - bottom),
	};
}

function getMovementSpeed(options, settings) {
	if (settings.movementSpeed) foundry.utils.setProperty(options, 'animation.movementSpeed', settings.movementSpeed);
}

export function getActiveRulers() {
	const ER = game.modules.get('elevationruler')?.active;
	const DR = game.modules.get('drag-ruler')?.active;
	if (ER && DR) {
		ui.notifications.error(game.i18n.localize('TOKENWARP.WarnMultipleRulersActive'));
		return 'both';
	}
	return ER ? 'ER' : DR ? 'DR' : false;
}
