import Settings from './settings.js';
import Constants from './constants.js';

const settings = new Settings();
const name = Constants.MODULE_NAME;
const WALLBLOCK_NO_ANIMATION_ONCE = new WeakMap();
const LEGACY_HOOK_ARG_WARNINGS = new Set();
const HP_ROLL_DATA_SUPPORT_CHECKS = [];
let HP_ROLL_DATA_SUPPORTED_ACTORS = new WeakSet();
const triggers = [
	'All hooks',
	'Pre token creation',
	'Post token creation',
	'Pre token deletion',
	'Post token deletion',
	'Pre token update',
	'Post token update',
	'Movement start',
	'Movement stop',
	'Pre Actor update',
	'Post Actor update',
	'Pre Actor HP zero',
	'Post Actor HP zero',
];
const kebabTriggers = triggers.map((t) => t.toLowerCase().replace(/\s+/g, '-'));
const ALL_HOOKS_TAG = kebabTriggers[0];
const DEFAULT_TRIGGER_PRESET_ID = 'all-events';
const TRIGGER_PRESETS = Object.freeze([
	Object.freeze({
		id: 'summon',
		label: 'TOKENWARP.PresetSpawn',
		targets: Object.freeze([kebabTriggers[1], kebabTriggers[2]]),
	}),
	Object.freeze({
		id: 'despawn',
		label: 'TOKENWARP.PresetDespawn',
		targets: Object.freeze([kebabTriggers[3], kebabTriggers[4]]),
	}),
	Object.freeze({
		id: 'movement',
		label: 'TOKENWARP.PresetMovement',
		targets: Object.freeze([kebabTriggers[7], kebabTriggers[8]]),
	}),
	Object.freeze({
		id: 'hp-zero',
		label: 'TOKENWARP.PresetHpZero',
		targets: Object.freeze([kebabTriggers[11], kebabTriggers[12]]),
	}),
	Object.freeze({
		id: 'all-events',
		label: 'TOKENWARP.PresetAllEvents',
		targets: Object.freeze(kebabTriggers.slice(1)),
	}),
]);

/*  Functions */
export function _preUpdateToken(tdoc, changes, options, userId) {
	if (WALLBLOCK_NO_ANIMATION_ONCE.get(tdoc) === true) {
		// Clear only the one-shot no-animation carry-over from a prior walls-blocked segment.
		if (options?.animate === false) delete options.animate;
		if (options?.action === 'displace') delete options.action;
		if (options?.tokenwarped === true) delete options.tokenwarped;
	}
	WALLBLOCK_NO_ANIMATION_ONCE.delete(tdoc);

	const isMovementPayload = !!(changes?.destination && changes?.origin);
	const destination = isMovementPayload
		? { x: changes.destination.x, y: changes.destination.y }
		: { x: changes.x, y: changes.y };
	const origin = isMovementPayload
		? { x: changes.origin.x, y: changes.origin.y }
		: { x: tdoc.x, y: tdoc.y };
	const hasDestination =
		destination.x !== undefined || destination.y !== undefined;
	const {
		excludedScene,
		movementSpeed,
		movementSwitch,
		outOfBounds,
		debug,
		migration,
		teleportKey,
	} = settings;

	// Always stamp animation speed from actor override or world default.
	if (hasDestination) getMovementSpeed(changes, options, settings, tdoc);

	if (
		(destination.x === undefined && destination.y === undefined) ||
		(destination.x == origin.x && destination.y == origin.y) ||
		options.animate == false ||
		options.action === 'displace' ||
		options.tokenwarped == true
	)
		return true;
	const isGM = game.users.get(userId)?.isGM ?? game.user?.isGM;
	const token = tdoc.object;
	const ev = event;
	const hasKey = isKeyPressed(ev, teleportKey);
	const shouldInstantTeleport = !!isGM && hasKey;

	const isMoveOutOfBounds =
		outOfBounds && positionOutOfBounds({ destination, origin, tdoc });
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
	const currentSegmentWaypoints = getCurrentSegmentWaypoints({
		changes,
		fallbackDestination: destination,
	});
	if (excludedScene) return true;

	if (
		(destination.x !== origin.x || destination.y !== origin.y) &&
		options.animate !== false &&
		options.action !== 'displace' &&
		!options.tokenwarped
	) {
		if (shouldInstantTeleport) {
			options.animate = false;
			options.action = 'displace';
			options.tokenwarped = true;
		} else if (
			movementSwitch === 'noanimations' ||
			(isGM && movementSwitch === 'wallsblock')
		) {
			if (movementSwitch === 'noanimations') {
				options.animate = false;
				options.action = 'displace';
				options.tokenwarped = true;
			} else if (isGM && movementSwitch === 'wallsblock') {
				const coreUnconstrainedMovement = !!game.settings.get(
					'core',
					'unconstrainedMovement',
				);

				// Walls Block only applies when core unconstrained movement is ON.
				if (coreUnconstrainedMovement) {
					const crossesWall = pathCrossesWall({
						token,
						origin,
						waypoints: currentSegmentWaypoints,
					});
					if (crossesWall) {
						options.animate = false;
						WALLBLOCK_NO_ANIMATION_ONCE.set(tdoc, true);
					}
				}
			}
		}
		if (!shouldInstantTeleport && isMoveOutOfBounds === 'outwards') {
			const { x, y } = clampDestinationToSceneRect({ tdoc, destination });
			const keepNoAnimation =
				options.animate === false || options.action === 'displace';
			if (isMovementPayload) {
				const remainingWaypoints = getRemainingPlannedWaypoints({
					options,
					id: tdoc.id,
					destination: changes?.destination,
				});
				const firstWaypoint = foundry.utils.duplicate(
					remainingWaypoints[0] ?? changes?.destination ?? {},
				);
				firstWaypoint.x = x;
				firstWaypoint.y = y;
				firstWaypoint.forced = true;
				firstWaypoint.explicit = true;
				firstWaypoint.checkpoint = true;

				const movementData = foundry.utils.duplicate(
					options?.movement?.[tdoc.id] ?? {},
				);
				movementData.waypoints = [
					firstWaypoint,
					...remainingWaypoints.slice(1),
				];

				const updateOptions = {
					movement: { [tdoc.id]: movementData },
				};
				if (keepNoAnimation) {
					updateOptions.animate = false;
					updateOptions.action = 'displace';
				}
				getMovementSpeed(changes, updateOptions, settings, tdoc, options);
				tdoc.update({}, updateOptions);
				return false;
			}

			if (options.movement?.[tdoc.id]) {
				foundry.utils.mergeObject(
					options.movement[tdoc.id],
					setLastWayPoint({ options, x, y, id: tdoc.id }),
				);
			}
			if (options._movement?.[tdoc.id]?.destination) {
				const newDestination = foundry.utils.duplicate(
					options._movement[tdoc.id].destination,
				);
				newDestination.x = x;
				newDestination.y = y;
				options._movement[tdoc.id].destination = newDestination;
			}
			foundry.utils.mergeObject(changes, { x, y }, { inPlace: true });
			options.tokenwarped = true;
			if (keepNoAnimation) {
				options.animate = false;
				options.action = 'displace';
			}
		}
		if (shouldInstantTeleport || isMoveOutOfBounds === 'both') {
			options.animate = false;
			options.action = 'displace';
			options.tokenwarped = true;
		}
		getMovementSpeed(changes, options, settings, tdoc);
		return true;
	}
}

export function _preMoveToken(tokenDocument, move, options) {
	const movementUserId = getMovementUserId(move, options);
	const ev = event;
	if (isKeyPressed(ev, settings.disableRotationKey, 'disableRotationKey')) {
		move.autoRotate = false;
	}
	return _preUpdateToken(tokenDocument, move, options, movementUserId);
}

function getCurrentSegmentWaypoints({ changes, fallbackDestination }) {
	const passedWaypoints = changes?.passed?.waypoints;
	if (Array.isArray(passedWaypoints) && passedWaypoints.length) {
		return passedWaypoints;
	}

	if (changes?.destination) return [changes.destination];
	if (
		fallbackDestination &&
		(fallbackDestination.x !== undefined || fallbackDestination.y !== undefined)
	) {
		return [fallbackDestination];
	}

	return [];
}

function hasDefaultHpRollData(actorDocument) {
	if (typeof actorDocument?.getRollData !== 'function') return false;

	let rollData;
	try {
		rollData = actorDocument.getRollData();
	} catch {
		return false;
	}

	return !!(
		rollData &&
		typeof rollData === 'object' &&
		foundry.utils.hasProperty(rollData, 'attributes.hp.value') &&
		foundry.utils.hasProperty(rollData, 'attributes.hp.max')
	);
}

function hasCustomHpRollDataSupport(actorDocument) {
	for (const check of HP_ROLL_DATA_SUPPORT_CHECKS) {
		try {
			if (check(actorDocument) === true) return true;
		} catch (error) {
			console.warn(
				`${name}: custom HP support check failed and was ignored.`,
				error,
			);
		}
	}
	return false;
}

export function registerHpRollDataSupportCheck(
	check,
	{ prepend = false } = {},
) {
	if (typeof check !== 'function') return false;
	if (!HP_ROLL_DATA_SUPPORT_CHECKS.includes(check)) {
		if (prepend) HP_ROLL_DATA_SUPPORT_CHECKS.unshift(check);
		else HP_ROLL_DATA_SUPPORT_CHECKS.push(check);
	}
	HP_ROLL_DATA_SUPPORTED_ACTORS = new WeakSet();
	return true;
}

export function supportsHpRollData(actorDocument) {
	return actorHasHpRollData(actorDocument);
}

function actorHasHpRollData(actorDocument) {
	if (!actorDocument) return false;
	if (game?.system?.id === 'dnd5e') return true;
	if (HP_ROLL_DATA_SUPPORTED_ACTORS.has(actorDocument)) return true;
	const supportsHpRollData =
		hasDefaultHpRollData(actorDocument) ||
		hasCustomHpRollDataSupport(actorDocument);
	if (supportsHpRollData) HP_ROLL_DATA_SUPPORTED_ACTORS.add(actorDocument);
	return supportsHpRollData;
}

function getRemainingPlannedWaypoints({ options, id, destination }) {
	const planned = foundry.utils.duplicate(options?.movement?.[id]?.waypoints);
	if (!Array.isArray(planned) || !planned.length) return [];

	if (!destination) return planned;
	const index = planned.findIndex((waypoint) =>
		waypointMatchesDestination(waypoint, destination),
	);
	if (index === -1) return planned;
	return planned.slice(index);
}

function pathCrossesWall({ token, origin, waypoints }) {
	if (
		!token ||
		!origin ||
		!Array.isArray(waypoints) ||
		waypoints.length === 0
	) {
		return false;
	}

	let previous = origin;
	for (const waypoint of waypoints) {
		const waypointCenter = token.getCenterPoint(waypoint);
		const previousCenter = token.getCenterPoint(previous);
		if (token.checkCollision(waypointCenter, { origin: previousCenter })) {
			return true;
		}
		previous = waypoint;
	}

	return false;
}
function setLastWayPoint({ options, x, y, id }) {
	const tokenMovementArray = foundry.utils.duplicate(
		options.movement?.[id]?.waypoints || [],
	);

	if (tokenMovementArray.length > 0) {
		const lastWaypoint = tokenMovementArray[tokenMovementArray.length - 1];
		lastWaypoint.x = x;
		lastWaypoint.y = y;
		lastWaypoint.forced = true;
	}
	return { waypoints: tokenMovementArray };
}

function isKeyPressed(ev, key, action = 'teleportKey') {
	const { MODIFIER_CODES: CODES, MODIFIER_KEYS } =
		foundry.helpers?.interaction?.KeyboardManager ?? KeyboardManager;

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
			if (
				game.keyboard.downKeys.has(b.key) &&
				b.modifiers.every((m) => activeModifiers[m])
			)
				return true;
			if (b.modifiers.length) return false;
			return activeModifiers[b.key];
		});
	}
	return key ? areKeysPressed(ev, action) : false; //return false if no proper key is found.
}

function positionOutOfBounds({ destination, origin, tdoc }) {
	//positions top left
	const rect = canvas.scene.dimensions.sceneRect;
	const { h: bottom, w: right } = tdoc.object;
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
			? 'outwards'
			: !destinationOOB && originOOB
				? 'inwards'
				: false;
}

function clampDestinationToSceneRect({ destination, tdoc }) {
	const rect = canvas.scene.dimensions.sceneRect;
	const { h: bottom, w: right } = tdoc.object;
	return {
		x: Math.clamp(destination.x, rect.x, rect.x + rect.width - right),
		y: Math.clamp(destination.y, rect.y, rect.y + rect.height - bottom),
	};
}

const DND5E_MOVEMENT_EXCLUDED_KEYS = new Set([
	'units',
	'hover',
	'ignoredDifficultTerrain',
	'speed',
	'max',
	'slowed',
	'bonus',
	'special',
]);

const MOVEMENT_ACTION_SPEED_ALIASES = Object.freeze({
	walk: ['walk'],
	fly: ['fly'],
	climb: ['climb'],
	swim: ['swim'],
	crawl: ['crawl', 'walk'],
	burrow: ['burrow'],
	jump: ['jump', 'walk'],
	dash: ['dash', 'walk'],
	run: ['run', 'walk'],
	burrowing: ['burrow'],
	flying: ['fly'],
	climbing: ['climb'],
	swimming: ['swim'],
	crawling: ['crawl', 'walk'],
	jumping: ['jump', 'walk'],
});

function clampAnimationSpeed(value, fallback = 6, min = 1, max = 30) {
	const numeric = Number(value);
	const base = Number.isFinite(numeric) ? numeric : Number(fallback);
	const safe = Number.isFinite(base) ? base : 6;
	return Math.max(min, Math.min(max, Math.round(safe)));
}

function coerceBoolean(value, fallback = false) {
	if (typeof value === 'boolean') return value;
	if (value === undefined || value === null) return fallback;
	if (typeof value === 'number') return value !== 0;
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
		if (['false', '0', 'no', 'n', 'off', ''].includes(normalized)) {
			return false;
		}
	}
	return !!value;
}

function normalizeMovementAction(action) {
	if (typeof action !== 'string') return null;
	const normalized = action.trim().toLowerCase();
	return normalized.length ? normalized : null;
}

function waypointMatchesDestination(waypoint, destination) {
	if (!waypoint || !destination) return false;
	if (Number(waypoint.x) !== Number(destination.x)) return false;
	if (Number(waypoint.y) !== Number(destination.y)) return false;
	if (
		destination.elevation !== undefined &&
		waypoint.elevation !== undefined &&
		Number(waypoint.elevation) !== Number(destination.elevation)
	) {
		return false;
	}
	return true;
}

function getMovementActionFromOptions(movement, options, tdoc) {
	const id = tdoc?.id;
	const destination = movement?.destination;
	const planned = options?.movement?.[id]?.waypoints;

	if (Array.isArray(planned) && planned.length) {
		if (destination) {
			const matched = planned.find((waypoint) => {
				if (!waypointMatchesDestination(waypoint, destination)) return false;
				return normalizeMovementAction(waypoint?.action) !== null;
			});
			if (matched) return normalizeMovementAction(matched.action);
		}
	}

	const passedAction = movement?.passed?.waypoints
		?.slice()
		.reverse()
		.find(
			(waypoint) => normalizeMovementAction(waypoint?.action) !== null,
		)?.action;
	if (passedAction) return normalizeMovementAction(passedAction);

	const pendingAction = movement?.pending?.waypoints?.find(
		(waypoint) => normalizeMovementAction(waypoint?.action) !== null,
	)?.action;
	if (pendingAction) return normalizeMovementAction(pendingAction);

	if (Array.isArray(planned) && planned.length) {
		const firstPlannedAction = planned.find(
			(waypoint) => normalizeMovementAction(waypoint?.action) !== null,
		)?.action;
		if (firstPlannedAction) return normalizeMovementAction(firstPlannedAction);
	}

	return null;
}

function getDnd5eMovementModes(actor) {
	const movement = actor?.system?.attributes?.movement ?? {};
	return Object.entries(movement)
		.filter(([key, value]) => {
			if (DND5E_MOVEMENT_EXCLUDED_KEYS.has(key)) return false;
			const numeric = Number(value);
			return Number.isFinite(numeric) && numeric > 0;
		})
		.map(([key, value]) => ({ key, value: Number(value) }));
}

function getMovementSpeed(movement, options, settings, tdoc, lookupOptions) {
	const actor = tdoc?.actor;
	const movementAnimation =
		actor?.getFlag('tokenwarp', 'movementAnimation') ?? {};
	const multipleTokensControlled =
		(canvas?.tokens?.controlled?.length ?? 0) > 1;
	const movementAction = getMovementActionFromOptions(
		movement,
		lookupOptions ?? options,
		tdoc,
	);

	const pickSpeedOverride = () => {
		// Multi-token workflows should use one global speed across all tokens.
		if (multipleTokensControlled) return null;
		if (!coerceBoolean(movementAnimation?.override, false)) return null;

		// Support both legacy single-speed and per-mode speed flag shapes.
		if (Number.isFinite(Number(movementAnimation.speed))) {
			const speed = Number(movementAnimation.speed);
			return speed > 0 ? speed : null;
		}

		const perMode =
			movementAnimation.speeds ??
			(typeof movementAnimation.speed === 'object'
				? movementAnimation.speed
				: {});
		const speedEntries = Object.entries(perMode)
			.map(([mode, value]) => [String(mode).toLowerCase(), Number(value)])
			.filter(([, value]) => Number.isFinite(value) && value > 0);
		if (!speedEntries.length) return null;

		const speedByMode = new Map(speedEntries);
		if (movementAction) {
			const aliases = MOVEMENT_ACTION_SPEED_ALIASES[movementAction] ?? [
				movementAction,
			];
			for (const key of aliases) {
				const speed = speedByMode.get(key);
				if (Number.isFinite(speed) && speed > 0) return speed;
			}
		}

		// dnd5e has multiple movement modes, so pick the override for the fastest
		// mode available on the actor. This keeps faster movement types faster.
		if (game?.system?.id === 'dnd5e' && actor) {
			const rankedModes = getDnd5eMovementModes(actor)
				.filter((entry) => speedByMode.has(entry.key))
				.sort((a, b) => {
					if (b.value !== a.value) return b.value - a.value;
					return speedByMode.get(b.key) - speedByMode.get(a.key);
				});
			if (rankedModes.length) return speedByMode.get(rankedModes[0].key);
		}

		if (speedByMode.has('walk')) return speedByMode.get('walk');
		return Math.max(...speedEntries.map(([, value]) => value));
	};

	const speed = pickSpeedOverride() ?? Number(settings.movementSpeed);
	if (Number.isFinite(speed) && speed > 0) {
		foundry.utils.setProperty(options, 'animation.movementSpeed', speed);
	}
}

function extractDialogChoiceParts(formObject) {
	const raw = foundry.utils.duplicate(formObject ?? {});
	const expanded = foundry.utils.expandObject(raw);

	let movementAnimation =
		expanded?.movementAnimation &&
		typeof expanded.movementAnimation === 'object'
			? foundry.utils.duplicate(expanded.movementAnimation)
			: {};

	if (!Object.keys(movementAnimation).length) {
		const dottedMovement = {};
		for (const [key, value] of Object.entries(raw)) {
			if (!key.startsWith('movementAnimation.')) continue;
			foundry.utils.setProperty(dottedMovement, key, value);
		}
		const dottedExpanded = foundry.utils.expandObject(dottedMovement);
		movementAnimation =
			dottedExpanded?.movementAnimation &&
			typeof dottedExpanded.movementAnimation === 'object'
				? foundry.utils.duplicate(dottedExpanded.movementAnimation)
				: {};
	}

	const triggers = foundry.utils.duplicate(expanded);
	delete triggers.movementAnimation;
	for (const key of Object.keys(triggers)) {
		if (key.startsWith('movementAnimation.')) delete triggers[key];
	}

	return { triggers, movementAnimation };
}

function getTriggerPreset(id) {
	if (typeof id !== 'string') return null;
	return TRIGGER_PRESETS.find((preset) => preset.id === id) ?? null;
}

function applyTriggerPresetVisibility({ presetId, triggerRows }) {
	const preset =
		getTriggerPreset(presetId) ?? getTriggerPreset(DEFAULT_TRIGGER_PRESET_ID);
	if (!preset || !(triggerRows instanceof Map)) return false;

	const visibleKeys = new Set([ALL_HOOKS_TAG, ...preset.targets]);
	for (const [key, row] of triggerRows.entries()) {
		if (!(row instanceof HTMLElement)) continue;
		row.style.display = visibleKeys.has(key) ? '' : 'none';
	}
	return true;
}

function applyAllHooksValueToPreset({ presetId, triggerInputs, value }) {
	const preset =
		getTriggerPreset(presetId) ?? getTriggerPreset(DEFAULT_TRIGGER_PRESET_ID);
	if (!preset || !(triggerInputs instanceof Map)) return false;

	const sourceValue = String(value ?? '').trim();
	if (!sourceValue) return false;

	for (const key of preset.targets) {
		const input = triggerInputs.get(key);
		if (!(input instanceof HTMLInputElement)) continue;
		input.value = sourceValue;
	}
	return true;
}

function resetTriggerPresetValues({ presetId, triggerInputs }) {
	const preset =
		getTriggerPreset(presetId) ?? getTriggerPreset(DEFAULT_TRIGGER_PRESET_ID);
	if (!preset || !(triggerInputs instanceof Map)) return false;

	const keysToReset = [ALL_HOOKS_TAG, ...preset.targets];
	for (const key of keysToReset) {
		const input = triggerInputs.get(key);
		if (!(input instanceof HTMLInputElement)) continue;
		input.value = '';
	}
	return true;
}

async function _renderDialog() {
	const token = this.token; //Token#Document
	const actor = token?.actor || this.actor;
	if (!actor) return;

	const isDnd5e = game?.system?.id === 'dnd5e';
	const hasHpZeroSupport = actorHasHpRollData(actor);
	const twTriggers = actor.getFlag('tokenwarp', 'tokenTriggers') || {};
	const savedAnimation = actor.getFlag('tokenwarp', 'movementAnimation') || {};
	const savedOverride = coerceBoolean(savedAnimation.override, false);
	const worldDefaultSpeed = game.settings.get(
		Constants.MODULE_ID,
		Settings.DEFAULT_TOKEN_ANIMATION_SPEED,
	);
	const baseSettingSpeed = clampAnimationSpeed(worldDefaultSpeed, 6);

	const titleCase = (value) =>
		value?.length ? `${value[0].toUpperCase()}${value.slice(1)}` : value;

	let triggersContent = '';
	for (let index = 0; index < triggers.length; index++) {
		const trigger = triggers[index];
		const kebabTrigger = kebabTriggers[index];
		if (
			!hasHpZeroSupport &&
			(kebabTrigger === kebabTriggers[11] || kebabTrigger === kebabTriggers[12])
		) {
			continue;
		}
		const savedValue = twTriggers[kebabTrigger] || '';
		triggersContent += new foundry.data.fields.StringField({
			label: trigger,
		}).toFormGroup(
			{},
			{
				value: savedValue,
				placeholder: 'macro uuid',
				name: kebabTrigger,
				dataset: { trigger: kebabTrigger },
			},
		).outerHTML;
		if (trigger === 'All hooks') triggersContent += '<hr>';
	}
	const availableTriggerPresets = TRIGGER_PRESETS.filter(
		(preset) => hasHpZeroSupport || preset.id !== 'hp-zero',
	);
	const triggerPresetButtons = availableTriggerPresets
		.map(
			(preset) => `
      <button type="button" class="tw-trigger-preset" data-tw-trigger-preset="${preset.id}" style="flex: 1 1 auto; min-width: max-content; white-space: nowrap;">
        ${game.i18n.localize(preset.label)}
      </button>`,
		)
		.join('');
	const triggerPresetsContent = `
      <div class="tw-trigger-presets" style="margin-bottom: 0.75rem;">
        <div class="tw-trigger-preset-buttons" style="display: flex; flex-wrap: nowrap; gap: 0.35rem; overflow-x: auto; padding-bottom: 0.1rem;">
          ${triggerPresetButtons}
        </div>
      </div>
    `;

	let movementModeEntries = [];
	let slidersHTML = '';
	let animationResetSpeed = clampAnimationSpeed(worldDefaultSpeed, 6);
	const animationResetSpeedsByMode = {};
	if (isDnd5e) {
		const savedSpeeds =
			savedAnimation.speeds ??
			(typeof savedAnimation.speed === 'object' ? savedAnimation.speed : {});

		movementModeEntries = getDnd5eMovementModes(actor).sort((a, b) => {
			if (b.value !== a.value) return b.value - a.value;
			return a.key.localeCompare(b.key);
		});

		const walkSpeed = movementModeEntries.find(
			(entry) => entry.key === 'walk',
		)?.value;
		const baseline =
			walkSpeed ??
			(movementModeEntries.length ? movementModeEntries[0].value : 0);

		if (!movementModeEntries.length) {
			slidersHTML =
				'<p class="notes">No non-zero movement types found on this actor.</p>';
		} else {
			for (const { key, value } of movementModeEntries) {
				const ratio = baseline > 0 ? value / baseline : 1;
				const initialScaled = clampAnimationSpeed(
					baseSettingSpeed * ratio,
					baseSettingSpeed,
				);
				animationResetSpeedsByMode[key] = initialScaled;
				const savedValue = clampAnimationSpeed(
					savedSpeeds?.[key],
					initialScaled,
				);
				const speedField = new foundry.data.fields.NumberField({
					label: `${titleCase(key)} (${value})`,
					min: 1,
					max: 30,
					step: 1,
				});
				const speedFieldGroup = speedField.toFormGroup(
					{},
					{
						name: `movementAnimation.speeds.${key}`,
						value: savedValue,
						hint: '1 = slowest, 30 = fastest',
					},
				);
				speedFieldGroup.dataset.twMovementMode = key;
				speedFieldGroup.dataset.twResetSpeed = String(initialScaled);
				slidersHTML += speedFieldGroup.outerHTML;
			}
		}
	} else {
		const fallbackSpeed = Number.isFinite(Number(savedAnimation.speed))
			? Number(savedAnimation.speed)
			: baseSettingSpeed;
		animationResetSpeed = clampAnimationSpeed(
			game.settings.get(
				Constants.MODULE_ID,
				Settings.DEFAULT_TOKEN_ANIMATION_SPEED,
			),
			baseSettingSpeed,
		);
		const speedField = new foundry.data.fields.NumberField({
			label: 'Speed',
			min: 1,
			max: 30,
			step: 1,
		});

		const speedFieldGroup = speedField.toFormGroup(
			{},
			{
				name: 'movementAnimation.speed',
				value: clampAnimationSpeed(fallbackSpeed, baseSettingSpeed),
				hint: '1 = slowest, 30 = fastest',
			},
		);
		speedFieldGroup.dataset.twMovementMode = 'default';
		speedFieldGroup.dataset.twResetSpeed = String(animationResetSpeed);
		slidersHTML = speedFieldGroup.outerHTML;
	}

	const animationContent = `
        <div class="form-group tw-override-inline" style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; flex-wrap:nowrap;">
            <label style="margin:0; width:auto; max-width:none; flex:1 1 auto; white-space:nowrap; overflow-wrap:normal; word-break:keep-all;">Override&nbsp;animation&nbsp;speeds</label>
            <input type="checkbox" name="movementAnimation.override" ${savedOverride ? 'checked' : ''} style="flex:0 0 auto; margin:0 0 0 auto; width:16px; height:16px; display:block;"/>
        </div>
        <div class="tw-anim-sliders" data-tw-anim-sliders>
            ${slidersHTML}
        </div>
    `;

	const content = `
        <div class="tw-tabs" data-group="tokenwarp">
            <nav class="tabs" data-group="tokenwarp" aria-label="Token Warp tabs">
            <a class="item active" data-tab="triggers" data-group="tokenwarp">Triggers</a>
            <a class="item" data-tab="animation" data-group="tokenwarp">Movement animation speed</a>
            </nav>
            <section class="content">
            <div class="tab active" data-tab="triggers" data-group="tokenwarp">
                ${triggerPresetsContent}
                ${triggersContent}
            </div>
            <div class="tab" data-tab="animation" data-group="tokenwarp">
                ${animationContent}
            </div>
            </section>
        </div>
    `;

	let activePresetId = DEFAULT_TRIGGER_PRESET_ID;
	let triggerInputs = new Map();
	const RESET_RESULT = '__tokenwarp_reset__';
	let runResetForActiveTab = () => false;

	const buttons = [];
	buttons.ok = {
		action: 'ok',
		label: 'Confirm',
		icon: 'fa-solid fa-check',
		default: true,
		callback: (event, button) =>
			new foundry.applications.ux.FormDataExtended(button.form).object,
	};
	buttons.reset = {
		action: 'reset',
		label: 'TOKENWARP.Reset',
		icon: 'fa-solid fa-xmark',
		callback: (event) => {
			event?.preventDefault?.();
			runResetForActiveTab();
			return RESET_RESULT;
		},
	};
	buttons.push(buttons.ok);
	buttons.push(buttons.reset);

	const choices = await new Promise((resolve) => {
		let submitted = false;
		const dialog = new foundry.applications.api.DialogV2({
			content,
			window: { title: `${name} Triggers` },
			position: { width: 460 },
			form: { closeOnSubmit: false },
			buttons,
			submit: async (result, submittedDialog) => {
				if (result === RESET_RESULT || result === 'reset') return;
				submitted = true;
				resolve(result);
				await submittedDialog.close({ submitted: true });
			},
		});

		dialog.addEventListener(
			'render',
			() => {
				const tabs = new foundry.applications.ux.Tabs({
					group: 'tokenwarp',
					navSelector: '.tw-tabs > nav.tabs',
					contentSelector: '.tw-tabs > section.content',
					initial: 'triggers',
				});
				tabs.bind(dialog.element);

				triggerInputs = new Map();
				const triggerRows = new Map();
				dialog.element
					.querySelectorAll("input[type='text'][data-trigger]")
					.forEach((el) => {
						el.addEventListener('drop', (ev) =>
							_onDrop(ev, {
								trigger: el.dataset.trigger,
								applyAllHooks: (uuid) =>
									applyAllHooksValueToPreset({
										presetId: activePresetId,
										triggerInputs,
										value: uuid,
									}),
							}),
						);
						triggerInputs.set(el.dataset.trigger, el);
						const row = el.closest('.form-group');
						if (row) triggerRows.set(el.dataset.trigger, row);
					});
				const allHooksInput = triggerInputs.get(ALL_HOOKS_TAG);
				const applyAllHooksToActivePreset = () => {
					applyAllHooksValueToPreset({
						presetId: activePresetId,
						triggerInputs,
						value: allHooksInput?.value,
					});
				};
				if (allHooksInput) {
					allHooksInput.addEventListener('change', () =>
						applyAllHooksToActivePreset(),
					);
				}
				const presetButtons = Array.from(
					dialog.element.querySelectorAll('button[data-tw-trigger-preset]'),
				);
				const setPresetButtonState = () => {
					for (const button of presetButtons) {
						const isActive = button.dataset.twTriggerPreset === activePresetId;
						button.classList.toggle('active', isActive);
						button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
					}
				};
				const setActivePreset = (presetId) => {
					if (!getTriggerPreset(presetId)) return;
					activePresetId = presetId;
					applyTriggerPresetVisibility({ presetId, triggerRows });
					setPresetButtonState();
				};
				presetButtons.forEach((button) => {
					button.addEventListener('click', (ev) => {
						ev.preventDefault();
						setActivePreset(button.dataset.twTriggerPreset);
					});
				});
				setActivePreset(DEFAULT_TRIGGER_PRESET_ID);

				const overrideInput = dialog.element.querySelector(
					"input[name='movementAnimation.override']",
				);
				const slidersWrap = dialog.element.querySelector(
					'[data-tw-anim-sliders]',
				);
				const applyOverrideUI = () => {
					const enabled = !!overrideInput?.checked;
					if (!slidersWrap) return;
					slidersWrap.style.display = enabled ? '' : 'none';
					slidersWrap
						.querySelectorAll('input, select, textarea, button')
						.forEach((el) => {
							el.disabled = !enabled;
						});
				};

				if (overrideInput) {
					overrideInput.addEventListener('change', applyOverrideUI);
				}
				applyOverrideUI();

				const applyInputValue = (input, value) => {
					if (!(input instanceof HTMLInputElement)) return false;
					input.value = String(value);
					input.dispatchEvent(new Event('input', { bubbles: true }));
					input.dispatchEvent(new Event('change', { bubbles: true }));
					const rangeValue = input
						.closest('.form-group')
						?.querySelector('.range-value');
					if (rangeValue) rangeValue.textContent = String(value);
					return true;
				};

				const setNamedInputValue = (name, value) => {
					const nodes = Array.from(
						dialog.element.querySelectorAll('input[name]'),
					);
					const namedNodes = nodes.filter((node) => node.name === name);
					let changed = false;
					for (const node of namedNodes) {
						changed = applyInputValue(node, value) || changed;
					}
					return changed;
				};

				const resetTriggerScope = () =>
					resetTriggerPresetValues({
						presetId: activePresetId,
						triggerInputs,
					});

				const resetAnimationScope = () => {
					if (isDnd5e) {
						let changed = false;
						const sliderRows = slidersWrap
							? Array.from(
									slidersWrap.querySelectorAll('[data-tw-movement-mode]'),
								)
							: [];
						if (sliderRows.length) {
							for (const row of sliderRows) {
								if (!(row instanceof HTMLElement)) continue;
								const key = String(row.dataset.twMovementMode ?? '');
								if (!key) continue;
								const speed = clampAnimationSpeed(
									row.dataset.twResetSpeed,
									animationResetSpeedsByMode[key] ?? baseSettingSpeed,
								);
								let changedForMode =
									setNamedInputValue(`movementAnimation.speeds.${key}`, speed) ||
									setNamedInputValue(`movementAnimation.speed.${key}`, speed);
								if (!changedForMode) {
									const inputs = Array.from(
										row.querySelectorAll(
											"input[type='range'], input[type='number']",
										),
									);
									for (const input of inputs) {
										changedForMode =
											applyInputValue(input, speed) || changedForMode;
									}
								}
								changed = changedForMode || changed;
							}
							return changed;
						}

						for (const [key, speed] of Object.entries(
							animationResetSpeedsByMode,
						)) {
							changed =
								setNamedInputValue(`movementAnimation.speeds.${key}`, speed) ||
								setNamedInputValue(`movementAnimation.speed.${key}`, speed) ||
								changed;
						}
						return changed;
					}
					let changed = setNamedInputValue(
						'movementAnimation.speed',
						animationResetSpeed,
					);
					if (!(slidersWrap instanceof HTMLElement)) return changed;
					const fallbackInputs = Array.from(
						slidersWrap.querySelectorAll(
							"input[type='range'], input[type='number']",
						),
					);
					for (const input of fallbackInputs) {
						changed = applyInputValue(input, animationResetSpeed) || changed;
					}
					return changed;
				};

				const getActiveTabId = () => {
					const navAnimation = dialog.element.querySelector(
						".tw-tabs > nav.tabs [data-tab='animation']",
					);
					const contentAnimation = dialog.element.querySelector(
						".tw-tabs > section.content > [data-tab='animation']",
					);
					if (navAnimation?.classList?.contains('active')) {
						return 'animation';
					}
					if (contentAnimation?.classList?.contains('active')) {
						return 'animation';
					}
					if (
						contentAnimation instanceof HTMLElement &&
						getComputedStyle(contentAnimation).display !== 'none'
					) {
						return 'animation';
					}
					return 'triggers';
				};

				runResetForActiveTab = () => {
					const activeTabId = getActiveTabId();
					return activeTabId === 'animation'
						? resetAnimationScope()
						: resetTriggerScope();
				};
			},
			{ once: true },
		);

		dialog.addEventListener(
			'close',
			() => {
				if (!submitted) resolve(null);
			},
			{ once: true },
		);

		dialog.render({ force: true });
	});
	if (!choices) return;

	const {
		triggers: triggerChoices,
		movementAnimation: movementAnimationChoices,
	} = extractDialogChoiceParts(choices);

	await actor.setFlag('tokenwarp', 'tokenTriggers', triggerChoices ?? {});

	const movementAnimation = movementAnimationChoices ?? {};
	const override = coerceBoolean(movementAnimation.override, false);
	if (isDnd5e) {
		const speedsIn = movementAnimation.speeds ?? {};
		const savedSpeeds =
			savedAnimation.speeds ??
			(typeof savedAnimation.speed === 'object' ? savedAnimation.speed : {});
		const speedsOut = {};
		for (const { key } of movementModeEntries) {
			speedsOut[key] = clampAnimationSpeed(
				speedsIn[key],
				clampAnimationSpeed(savedSpeeds?.[key], baseSettingSpeed),
			);
		}
		await actor.setFlag('tokenwarp', 'movementAnimation', {
			override,
			speeds: speedsOut,
		});
	} else {
		const fallback = clampAnimationSpeed(
			savedAnimation.speed,
			baseSettingSpeed,
		);
		await actor.setFlag('tokenwarp', 'movementAnimation', {
			override,
			speed: clampAnimationSpeed(movementAnimation.speed, fallback),
		});
	}

	return choices;
}

function _onDrop(ev, context = {}) {
	ev.preventDefault();
	const data = foundry.applications.ux.TextEditor.getDragEventData(ev);
	const target = ev.target;
	const uuid = data.uuid ?? '';
	target.value = uuid;

	const trigger = context.trigger ?? target.dataset.trigger;
	if (trigger === ALL_HOOKS_TAG) {
		if (typeof context.applyAllHooks === 'function') {
			context.applyAllHooks(uuid);
			return;
		}

		const container = target.closest('form');
		container
			?.querySelectorAll("input[type='text'][data-trigger]")
			.forEach((el) => {
				if (el.dataset.trigger === ALL_HOOKS_TAG) return;
				el.value = uuid;
			});
	}
}

function warnCompatibility(message, options = {}) {
	const logger =
		foundry?.utils?.logCompatibilityWarning ??
		globalThis.logCompatibilityWarning;
	if (typeof logger === 'function') {
		logger(message, options);
		return;
	}
	if (options.once) {
		if (LEGACY_HOOK_ARG_WARNINGS.has(message)) return;
		LEGACY_HOOK_ARG_WARNINGS.add(message);
	}
	console.warn(message);
}

function defineLegacyHookArgAlias(
	payload,
	{
		hookName,
		legacyKey,
		canonicalKey,
		since = '13.0',
		until = '14',
		details = '',
	},
) {
	if (!payload || Object.hasOwn(payload, legacyKey)) return;
	const warningKey = `${hookName}.${legacyKey}`;
	Object.defineProperty(payload, legacyKey, {
		enumerable: true,
		configurable: true,
		get() {
			if (!LEGACY_HOOK_ARG_WARNINGS.has(warningKey)) {
				LEGACY_HOOK_ARG_WARNINGS.add(warningKey);
				warnCompatibility(
					`${name}: "${hookName}" macro arg "${legacyKey}" is deprecated, use "${canonicalKey}" instead.`,
					{ since, until, details, once: true },
				);
			}
			return payload[canonicalKey];
		},
		set(value) {
			if (!LEGACY_HOOK_ARG_WARNINGS.has(warningKey)) {
				LEGACY_HOOK_ARG_WARNINGS.add(warningKey);
				warnCompatibility(
					`${name}: "${hookName}" macro arg "${legacyKey}" is deprecated, use "${canonicalKey}" instead.`,
					{ since, until, details, once: true },
				);
			}
			payload[canonicalKey] = value;
		},
	});
}

function getMacroUserFields(userOrUserId) {
	if (typeof userOrUserId === 'string') {
		return { userId: userOrUserId, user: userOrUserId };
	}

	if (userOrUserId === undefined || userOrUserId === null) return {};

	const fields = { user: userOrUserId };
	if (typeof userOrUserId?.id === 'string') fields.userId = userOrUserId.id;
	return fields;
}

function createTokenLifecycleMacroPayload({
	hookName,
	tokenDocument,
	data,
	options,
	userId,
	tag,
}) {
	const payload = {
		token: tokenDocument,
		actor: tokenDocument?.actor,
		options,
		tag,
		...getMacroUserFields(userId),
	};
	if (data !== undefined) payload.data = data;

	defineLegacyHookArgAlias(payload, {
		hookName,
		legacyKey: 'context',
		canonicalKey: 'options',
		details: 'The options object is now exposed as "options".',
	});

	return payload;
}

export async function _executePreCreation(
	tokenDocument,
	data,
	options,
	userId,
) {
	const tag = kebabTriggers[1];
	const hasTrigger = tokenDocument.actor.getFlag(
		'tokenwarp',
		`tokenTriggers.${tag}`,
	);
	if (hasTrigger) {
		const macro = await fromUuid(hasTrigger);
		return macro.execute(
			createTokenLifecycleMacroPayload({
				hookName: 'preCreateToken',
				tokenDocument,
				data,
				options,
				userId,
				tag,
			}),
		);
	}
}
export async function _executePostCreation(tokenDocument, options, userId) {
	if (game.user.id !== userId) return;
	const tag = kebabTriggers[2];
	const hasTrigger = tokenDocument.actor.getFlag(
		'tokenwarp',
		`tokenTriggers.${tag}`,
	);
	if (hasTrigger) {
		const macro = await fromUuid(hasTrigger);
		return macro.execute(
			createTokenLifecycleMacroPayload({
				hookName: 'createToken',
				tokenDocument,
				options,
				userId,
				tag,
			}),
		);
	}
}

export async function _executePreDeletion(tokenDocument, options, userId) {
	const tag = kebabTriggers[3];
	const hasTrigger = tokenDocument.actor.getFlag(
		'tokenwarp',
		`tokenTriggers.${tag}`,
	);
	if (hasTrigger) {
		const macro = await fromUuid(hasTrigger);
		return macro.execute(
			createTokenLifecycleMacroPayload({
				hookName: 'preDeleteToken',
				tokenDocument,
				options,
				userId,
				tag,
			}),
		);
	}
}

export async function _executePostDeletion(tokenDocument, options, userId) {
	if (game.user.id !== userId) return;
	const tag = kebabTriggers[4];
	const hasTrigger = tokenDocument.actor.getFlag(
		'tokenwarp',
		`tokenTriggers.${tag}`,
	);
	if (hasTrigger) {
		const macro = await fromUuid(hasTrigger);
		return macro.execute(
			createTokenLifecycleMacroPayload({
				hookName: 'deleteToken',
				tokenDocument,
				options,
				userId,
				tag,
			}),
		);
	}
}

export async function _executePreUpdateToken(
	tokenDocument,
	data,
	options,
	userId,
) {
	const tag = kebabTriggers[5];
	const hasTrigger = tokenDocument.actor.getFlag(
		'tokenwarp',
		`tokenTriggers.${tag}`,
	);
	if (hasTrigger) {
		const macro = await fromUuid(hasTrigger);
		return macro.execute({
			token: tokenDocument,
			actor: tokenDocument.actor,
			data,
			changes: data,
			options,
			context: options,
			tag,
			...getMacroUserFields(userId),
		});
	}
}

export async function _executePostUpdateToken(
	tokenDocument,
	data,
	options,
	userId,
) {
	if (game.user.id !== userId) return;
	const tag = kebabTriggers[6];
	const hasTrigger = tokenDocument.actor.getFlag(
		'tokenwarp',
		`tokenTriggers.${tag}`,
	);
	if (hasTrigger) {
		const macro = await fromUuid(hasTrigger);
		return macro.execute({
			token: tokenDocument,
			actor: tokenDocument.actor,
			data,
			changes: data,
			options,
			context: options,
			tag,
			...getMacroUserFields(userId),
		});
	}
}
export async function _registerMovementHooks(
	tokenDocument,
	move,
	options,
	userId,
) {
	const movementUserId = getMovementUserId(move, options, userId);

	if (movementUserId && game.user.id !== movementUserId) return;

	const tagStart = kebabTriggers[7];
	const tagStop = kebabTriggers[8];
	Hooks.callAll(
		`tokenwarp.movementStart`,
		tokenDocument,
		move,
		options,
		movementUserId,
		tagStart,
	);

	const movementAnimationPromise =
		tokenDocument?.object?.movementAnimationPromise ??
		tokenDocument?.movementAnimationPromise;
	try {
		if (movementAnimationPromise?.then) await movementAnimationPromise;
	} finally {
		Hooks.callAll(
			`tokenwarp.movementStop`,
			tokenDocument,
			move,
			options,
			movementUserId,
			tagStop,
		);
	}
}

function getMovementUserId(movement, context, user) {
	return (
		(typeof user === 'string' && user) ||
		(typeof context?.userId === 'string' && context.userId) ||
		(typeof context?.user === 'string' && context.user) ||
		(typeof movement?.passed?.waypoints?.[0]?.userId === 'string' &&
			movement.passed.waypoints[0].userId) ||
		(typeof movement?.history?.unrecorded?.waypoints?.[0]?.userId ===
			'string' &&
			movement.history.unrecorded.waypoints[0].userId) ||
		null
	);
}

export async function _executeTokenMovementStart(
	tokenDocument,
	move,
	options,
	userId,
) {
	const tag = kebabTriggers[7];
	const hasTrigger = tokenDocument.actor.getFlag(
		'tokenwarp',
		`tokenTriggers.${tag}`,
	);
	if (hasTrigger) {
		const macro = await fromUuid(hasTrigger);
		return macro.execute({
			token: tokenDocument,
			actor: tokenDocument.actor,
			move,
			changes: move,
			options,
			context: options,
			tag,
			...getMacroUserFields(userId),
		});
	}
}

export async function _executeTokenMovementStop(
	tokenDocument,
	move,
	options,
	userId,
) {
	const tag = kebabTriggers[8];
	const hasTrigger = tokenDocument.actor.getFlag(
		'tokenwarp',
		`tokenTriggers.${tag}`,
	);
	if (hasTrigger) {
		const macro = await fromUuid(hasTrigger);
		return macro.execute({
			token: tokenDocument,
			actor: tokenDocument.actor,
			move,
			changes: move,
			options,
			context: options,
			tag,
			...getMacroUserFields(userId),
		});
	}
}

function isHpZeroUpdate(actorDocument, changes) {
	if (!actorHasHpRollData(actorDocument)) return false;
	if (!foundry.utils.hasProperty(changes ?? {}, 'system.attributes.hp.value')) {
		return false;
	}
	const hpValue = Number(changes?.system?.attributes?.hp?.value);
	return Number.isFinite(hpValue) && hpValue <= 0;
}

export async function _executePreUpdateActor(
	actorDocument,
	data,
	options,
	userId,
) {
	const tag = kebabTriggers[9];
	const hasTrigger = actorDocument.getFlag('tokenwarp', `tokenTriggers.${tag}`);
	let result;
	if (hasTrigger) {
		const macro = await fromUuid(hasTrigger);
		result = await macro.execute({
			actor: actorDocument,
			data,
			changes: data,
			options,
			context: options,
			tag,
			...getMacroUserFields(userId),
		});
	}
	if (isHpZeroUpdate(actorDocument, data)) {
		Hooks.callAll(
			`tokenwarp.preActorHpZero`,
			actorDocument,
			data,
			options,
			userId,
			kebabTriggers[11],
		);
	}
	return result;
}

export async function _executePostUpdateActor(
	actorDocument,
	data,
	options,
	userId,
) {
	if (game.user.id !== userId) return;
	const tag = kebabTriggers[10];
	const hasTrigger = actorDocument.getFlag('tokenwarp', `tokenTriggers.${tag}`);
	if (hasTrigger) {
		const macro = await fromUuid(hasTrigger);
		await macro.execute({
			actor: actorDocument,
			data,
			changes: data,
			options,
			context: options,
			tag,
			...getMacroUserFields(userId),
		});
	}
	if (isHpZeroUpdate(actorDocument, data)) {
		Hooks.callAll(
			`tokenwarp.actorHpZero`,
			actorDocument,
			data,
			options,
			userId,
			kebabTriggers[12],
		);
	}
}

export async function _executePreActorHpZero(
	actorDocument,
	data,
	options,
	userId,
	tag,
) {
	if (!actorHasHpRollData(actorDocument)) return;
	const hookTag = tag ?? kebabTriggers[11];
	const hasTrigger = actorDocument.getFlag(
		'tokenwarp',
		`tokenTriggers.${hookTag}`,
	);
	if (hasTrigger) {
		const macro = await fromUuid(hasTrigger);
		return macro.execute({
			actor: actorDocument,
			data,
			changes: data,
			options,
			context: options,
			tag: hookTag,
			...getMacroUserFields(userId),
		});
	}
}

export async function _executePostActorHpZero(
	actorDocument,
	data,
	options,
	userId,
	tag,
) {
	if (!actorHasHpRollData(actorDocument)) return;
	if (game.user.id !== userId) return;
	const hookTag = tag ?? kebabTriggers[12];
	const hasTrigger = actorDocument.getFlag(
		'tokenwarp',
		`tokenTriggers.${hookTag}`,
	);
	if (hasTrigger) {
		const macro = await fromUuid(hasTrigger);
		return macro.execute({
			actor: actorDocument,
			data,
			changes: data,
			options,
			context: options,
			tag: hookTag,
			...getMacroUserFields(userId),
		});
	}
}

export function _addActorSheetHeaderButton(app, controls) {
	controls.push({
		label: `${name} ${game.i18n.localize('TOKENWARP.Triggers')}`,
		icon: 'fas fa-shuffle',
		onClick: _renderDialog.bind({ actor: app.document, token: app.token }),
	});
}
