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

function logFollowerDebug(message, context = undefined) {
	if (!settings.debug) return;
	if (context === undefined) console.debug('[tokenwarp][follow]', message);
	else console.debug('[tokenwarp][follow]', message, context);
}

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

	// Keyboard and some movement workflows provide position updates here
	// without a full movement operation payload.
	if (!isMovementPayload && hasDestination) {
		const syntheticMove = buildSyntheticMoveFromPositionUpdate(
			tdoc,
			changes,
			options,
		);
		if (syntheticMove) {
			logFollowerDebug('Synthetic move detected in _preUpdateToken', {
				tokenId: tdoc?.id,
				origin: syntheticMove.origin,
				destination: syntheticMove.destination,
			});
			routeFollowersFromSyntheticMove(tdoc, syntheticMove, options);
		}
	}

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
	routeFollowersBehindLeader(tokenDocument, move, options);
	const ev = event;
	if (isKeyPressed(ev, settings.disableRotationKey, 'disableRotationKey')) {
		move.autoRotate = false;
	}
	return _preUpdateToken(tokenDocument, move, options, movementUserId);
}

function getLeaderFlagState(tokenDocument) {
	const rawFlag = tokenDocument?.getFlag?.(Constants.MODULE_ID, 'leader');
	const state = { isLeader: false, follows: null };
	if (rawFlag === true) {
		state.isLeader = true;
		return state;
	}
	if (typeof rawFlag === 'string') {
		const follows = rawFlag.trim();
		if (follows.length) state.follows = follows;
		return state;
	}
	if (!rawFlag || typeof rawFlag !== 'object') return state;

	const followFromObject = [rawFlag.follow, rawFlag.leaderId, rawFlag.tokenId].find(
		(value) => typeof value === 'string' && value.trim().length > 0,
	);
	if (followFromObject) state.follows = followFromObject.trim();
	if (coerceBoolean(rawFlag.isLeader, false)) state.isLeader = true;
	if (coerceBoolean(rawFlag.leader, false) && !state.follows) state.isLeader = true;
	return state;
}

function getMovementLeaderDialogState(tokenDocument) {
	const state = getLeaderFlagState(tokenDocument);
	if (state.isLeader) return { role: 'leader', followTokenId: '' };
	if (state.follows) return { role: 'follower', followTokenId: String(state.follows) };
	return { role: 'none', followTokenId: '' };
}

function getTokenDocumentLeaderCandidateIds(tokenDocument) {
	const ids = new Set();
	if (tokenDocument?.id) ids.add(String(tokenDocument.id));
	return ids;
}

function getMovementLeaderTargetOptions(tokenDocument) {
	const currentId = tokenDocument?.id;
	const options = Array.from(canvas?.tokens?.placeables ?? [])
		.map((placeable) => placeable?.document)
		.filter((document) => document?.id && document.id !== currentId)
		.filter((document) => getLeaderFlagState(document).isLeader)
		.map((document) => ({
			id: String(document.id),
			name: String(document.name ?? document.id),
		}));
	options.sort((a, b) => a.name.localeCompare(b.name));
	return options;
}

async function persistMovementLeaderFlag(tokenDocument, movementLeader = {}) {
	if (!tokenDocument?.setFlag || !tokenDocument?.unsetFlag) return;
	const role = String(movementLeader.role ?? 'none').toLowerCase();
	const followTokenId = String(movementLeader.followTokenId ?? '').trim();
	if (role === 'leader') {
		await tokenDocument.setFlag(Constants.MODULE_ID, 'leader', true);
		return;
	}
	if (role === 'follower' && followTokenId) {
		await tokenDocument.setFlag(Constants.MODULE_ID, 'leader', {
			follow: followTokenId,
		});
		return;
	}
	await tokenDocument.unsetFlag(Constants.MODULE_ID, 'leader');
}

function getTokenDocumentPosition(tokenDocument) {
	const x = Number(tokenDocument?.x ?? tokenDocument?._source?.x);
	const y = Number(tokenDocument?.y ?? tokenDocument?._source?.y);
	return {
		x: Number.isFinite(x) ? x : 0,
		y: Number.isFinite(y) ? y : 0,
	};
}

function getTokenDocumentMovementWaypoint(tokenDocument, action) {
	if (!tokenDocument) return null;
	const x = Number(tokenDocument?._source?.x ?? tokenDocument?.x);
	const y = Number(tokenDocument?._source?.y ?? tokenDocument?.y);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return {
		x,
		y,
		elevation: Number(
			tokenDocument?._source?.elevation ?? tokenDocument?.elevation ?? 0,
		),
		width: Number(tokenDocument?._source?.width ?? tokenDocument?.width ?? 1),
		height: Number(tokenDocument?._source?.height ?? tokenDocument?.height ?? 1),
		shape: tokenDocument?._source?.shape ?? tokenDocument?.shape,
		action: normalizeMovementAction(action ?? tokenDocument?.movementAction) ?? 'walk',
		snapped: true,
		explicit: true,
		checkpoint: true,
	};
}

function getTokenGridFootprint(tokenDocument) {
	const width = Number(tokenDocument?.width ?? tokenDocument?._source?.width);
	const height = Number(tokenDocument?.height ?? tokenDocument?._source?.height);
	const footprint = Math.max(
		1,
		Math.ceil(Number.isFinite(width) ? width : 1),
		Math.ceil(Number.isFinite(height) ? height : 1),
	);
	return footprint;
}

function toMovementWaypoint(waypoint) {
	if (!waypoint || typeof waypoint !== 'object') return null;
	const x = Number(waypoint.x);
	const y = Number(waypoint.y);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

	const cleanWaypoint = { x, y };
	for (const key of [
		'elevation',
		'width',
		'height',
		'shape',
		'action',
		'snapped',
		'explicit',
		'checkpoint',
	]) {
		if (waypoint[key] !== undefined) cleanWaypoint[key] = waypoint[key];
	}
	return cleanWaypoint;
}

function movementWaypointsEqual(a, b) {
	if (!a || !b) return false;
	if (Number(a.x) !== Number(b.x)) return false;
	if (Number(a.y) !== Number(b.y)) return false;
	if (a.elevation === undefined || b.elevation === undefined) return true;
	return Number(a.elevation) === Number(b.elevation);
}

function getLeaderPathWaypoints(tokenDocument, move, options) {
	const moveWaypoints = [];
	if (Array.isArray(move?.passed?.waypoints)) moveWaypoints.push(...move.passed.waypoints);
	if (Array.isArray(move?.pending?.waypoints))
		moveWaypoints.push(...move.pending.waypoints);

	let sourceWaypoints = moveWaypoints.length
		? moveWaypoints
		: options?.movement?.[tokenDocument?.id]?.waypoints ?? [];
	if (
		!moveWaypoints.length &&
		Array.isArray(sourceWaypoints) &&
		sourceWaypoints.length &&
		typeof tokenDocument?.getCompleteMovementPath === 'function'
	) {
		const origin = {
			x: tokenDocument._source?.x ?? tokenDocument.x,
			y: tokenDocument._source?.y ?? tokenDocument.y,
			elevation: tokenDocument._source?.elevation ?? tokenDocument.elevation,
			width: tokenDocument._source?.width ?? tokenDocument.width,
			height: tokenDocument._source?.height ?? tokenDocument.height,
			shape: tokenDocument._source?.shape ?? tokenDocument.shape,
		};
		try {
			const completePath = tokenDocument.getCompleteMovementPath([
				origin,
				...sourceWaypoints,
			]);
			if (Array.isArray(completePath) && completePath.length > 1) {
				completePath.shift();
				sourceWaypoints = completePath;
			}
		} catch {}
	}
	const path = [];
	for (const rawWaypoint of sourceWaypoints) {
		const waypoint = toMovementWaypoint(rawWaypoint);
		if (!waypoint) continue;
		if (
			path.length &&
			movementWaypointsEqual(path[path.length - 1], waypoint)
		) {
			continue;
		}
		path.push(waypoint);
	}
	return path;
}

function getFollowerDocuments(leaderTokenDocument, move) {
	const controlledTokens = Array.from(canvas?.tokens?.controlled ?? []);
	if (controlledTokens.length <= 1) return [];

	const leaderOrigin = move?.origin
		? {
				x: Number(move.origin.x),
				y: Number(move.origin.y),
			}
		: getTokenDocumentPosition(leaderTokenDocument);

	const followers = [];
	const leaderCandidateIds = getTokenDocumentLeaderCandidateIds(leaderTokenDocument);
	for (const token of controlledTokens) {
		const followerDocument = token?.document;
		if (!followerDocument || followerDocument.id === leaderTokenDocument?.id) {
			continue;
		}

		const relation = getLeaderFlagState(followerDocument);
		if (relation.isLeader) continue;
		if (relation.follows && !leaderCandidateIds.has(String(relation.follows))) {
			continue;
		}
		followers.push({
			document: followerDocument,
			explicit: relation.follows
				? leaderCandidateIds.has(String(relation.follows))
				: false,
		});
	}

	followers.sort((a, b) => {
		if (a.explicit !== b.explicit) return a.explicit ? -1 : 1;
		const aPos = getTokenDocumentPosition(a.document);
		const bPos = getTokenDocumentPosition(b.document);
		const distA = Math.hypot(aPos.x - leaderOrigin.x, aPos.y - leaderOrigin.y);
		const distB = Math.hypot(bPos.x - leaderOrigin.x, bPos.y - leaderOrigin.y);
		if (distA !== distB) return distA - distB;
		return String(a.document.id).localeCompare(String(b.document.id));
	});

	return followers.map((entry) => entry.document);
}

function getActiveLeaderTokenDocument(tokenDocument, options) {
	const tokenState = getLeaderFlagState(tokenDocument);
	if (tokenState.isLeader) return tokenDocument;

	const controlledTokens = Array.from(canvas?.tokens?.controlled ?? []);
	const leaderDocuments = controlledTokens
		.map((token) => token?.document)
		.filter((document) => document && getLeaderFlagState(document).isLeader);
	if (!leaderDocuments.length) return null;
	if (leaderDocuments.length === 1) return leaderDocuments[0];

	const leaderWithMovement = leaderDocuments.filter(
		(document) => options?.movement?.[document.id],
	);
	if (leaderWithMovement.length) return leaderWithMovement[0];
	return leaderDocuments[0];
}

function buildFollowerWaypoints(leaderPath, trailingOffset) {
	if (!Array.isArray(leaderPath) || !leaderPath.length) return [];
	const maxLength = Math.max(0, leaderPath.length - trailingOffset);
	if (maxLength === 0) return [];

	const waypoints = foundry.utils.duplicate(leaderPath.slice(0, maxLength));
	const lastWaypoint = waypoints.at(-1);
	if (lastWaypoint) {
		lastWaypoint.explicit = true;
		lastWaypoint.checkpoint = true;
	}
	return waypoints;
}

function applyFollowerDimensionsToWaypoints(waypoints, followerDocument) {
	if (!Array.isArray(waypoints) || !waypoints.length) return waypoints;
	const width = Number(
		followerDocument?._source?.width ?? followerDocument?.width,
	);
	const height = Number(
		followerDocument?._source?.height ?? followerDocument?.height,
	);
	const shape = followerDocument?._source?.shape ?? followerDocument?.shape;
	for (const waypoint of waypoints) {
		if (!waypoint || typeof waypoint !== 'object') continue;
		if (Number.isFinite(width) && width > 0) waypoint.width = width;
		if (Number.isFinite(height) && height > 0) waypoint.height = height;
		if (shape !== undefined) waypoint.shape = shape;
	}
	return waypoints;
}

function buildSyntheticMoveFromPositionUpdate(tokenDocument, changes, options) {
	if (!tokenDocument || !changes || typeof changes !== 'object') return null;
	if (changes.destination || changes.origin) return null;
	const x = Number(changes.x);
	const y = Number(changes.y);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

	const origin = {
		x: Number(tokenDocument._source?.x ?? tokenDocument.x),
		y: Number(tokenDocument._source?.y ?? tokenDocument.y),
		elevation: Number(
			tokenDocument._source?.elevation ?? tokenDocument.elevation ?? 0,
		),
		width: Number(tokenDocument._source?.width ?? tokenDocument.width ?? 1),
		height: Number(tokenDocument._source?.height ?? tokenDocument.height ?? 1),
		shape: tokenDocument._source?.shape ?? tokenDocument.shape,
	};
	if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return null;
	if (origin.x === x && origin.y === y) return null;

	const destination = {
		x,
		y,
		elevation: origin.elevation,
		width: origin.width,
		height: origin.height,
		shape: origin.shape,
		action: tokenDocument.movementAction,
		snapped: true,
		explicit: true,
		checkpoint: true,
	};

	return {
		id: options?._movementArguments?.movementId ?? foundry.utils.randomID(),
		origin,
		destination: {
			x: destination.x,
			y: destination.y,
			elevation: destination.elevation,
			width: destination.width,
			height: destination.height,
			shape: destination.shape,
		},
		passed: {
			waypoints: [destination],
		},
		pending: {
			waypoints: [],
		},
	};
}

function routeFollowersFromSyntheticMove(tokenDocument, syntheticMove, options) {
	if (!tokenDocument || !syntheticMove || typeof options !== 'object') return false;

	const leaderTokenDocument = getActiveLeaderTokenDocument(
		tokenDocument,
		options,
	);
	if (!leaderTokenDocument) {
		logFollowerDebug('No active leader found for synthetic move', {
			tokenId: tokenDocument?.id,
		});
		return false;
	}
	if (leaderTokenDocument.id === tokenDocument.id) {
		logFollowerDebug('Synthetic move is on leader token, routing directly', {
			leaderId: leaderTokenDocument.id,
		});
		return routeFollowersBehindLeader(tokenDocument, syntheticMove, options);
	}

	const deltaX =
		Number(syntheticMove.destination?.x) - Number(syntheticMove.origin?.x);
	const deltaY =
		Number(syntheticMove.destination?.y) - Number(syntheticMove.origin?.y);
	if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
		logFollowerDebug('Invalid synthetic delta for follower move', {
			tokenId: tokenDocument?.id,
			deltaX,
			deltaY,
		});
		return false;
	}

	const leaderPosition = getTokenDocumentPosition(leaderTokenDocument);
	const leaderSyntheticMove = buildSyntheticMoveFromPositionUpdate(
		leaderTokenDocument,
		{
			x: leaderPosition.x + deltaX,
			y: leaderPosition.y + deltaY,
		},
		options,
	);
	if (!leaderSyntheticMove) {
		logFollowerDebug('Unable to build synthetic move for resolved leader', {
			tokenId: tokenDocument?.id,
			leaderId: leaderTokenDocument.id,
			deltaX,
			deltaY,
		});
		return false;
	}
	const routed = routeFollowersBehindLeader(
		leaderTokenDocument,
		leaderSyntheticMove,
		options,
	);
	logFollowerDebug('Synthetic follower route via leader resolved', {
		tokenId: tokenDocument?.id,
		leaderId: leaderTokenDocument.id,
		deltaX,
		deltaY,
		routed,
	});
	return routed;
}

function routeFollowersBehindLeader(tokenDocument, move, options) {
	if (!tokenDocument || !move || typeof options !== 'object') return false;

	const leaderTokenDocument = getActiveLeaderTokenDocument(
		tokenDocument,
		options,
	);
	if (!leaderTokenDocument) {
		logFollowerDebug('No active leader found in routeFollowersBehindLeader', {
			tokenId: tokenDocument?.id,
		});
		return false;
	}

	const routingState = options._tokenwarpSnakeRoute;
	if (routingState?.leaderId === leaderTokenDocument.id) {
		logFollowerDebug('Skipping duplicate snake routing for leader in same options', {
			leaderId: leaderTokenDocument.id,
			movementId: move?.id,
		});
		return false;
	}

	const followers = getFollowerDocuments(leaderTokenDocument, move);
	if (!followers.length) {
		logFollowerDebug('No follower tokens eligible for leader move', {
			leaderId: leaderTokenDocument.id,
		});
		return false;
	}

	const leaderPath = getLeaderPathWaypoints(
		leaderTokenDocument,
		leaderTokenDocument.id === tokenDocument.id ? move : null,
		options,
	);
	if (!leaderPath.length) {
		logFollowerDebug('No leader path waypoints available for snake routing', {
			leaderId: leaderTokenDocument.id,
		});
		return false;
	}
	logFollowerDebug('Routing followers behind leader', {
		leaderId: leaderTokenDocument.id,
		followerCount: followers.length,
		leaderPathLength: leaderPath.length,
	});

	options.movement ??= {};
	const leaderMovementData = foundry.utils.duplicate(
		options.movement?.[leaderTokenDocument.id] ?? {},
	);
	const leadAction = leaderPath[0]?.action;
	const leaderOriginWaypoint =
		toMovementWaypoint({
			...(move.origin ?? {}),
			action: leadAction,
			snapped: true,
			explicit: true,
			checkpoint: true,
		}) ?? getTokenDocumentMovementWaypoint(leaderTokenDocument, leadAction);
	const stepSnake = leaderPath.length <= 1 && !!leaderOriginWaypoint;
	let trailingWaypoint = leaderOriginWaypoint
		? foundry.utils.duplicate(leaderOriginWaypoint)
		: null;

	let trailingOffset = 0;
	let previousFootprint = getTokenGridFootprint(leaderTokenDocument);
	const leaderCandidateIds = getTokenDocumentLeaderCandidateIds(leaderTokenDocument);
	for (const followerDocument of followers) {
		if (leaderCandidateIds.has(String(followerDocument.id))) continue;
		const followerFootprint = getTokenGridFootprint(followerDocument);
		trailingOffset += Math.max(previousFootprint, followerFootprint);

		const followerMovementData = foundry.utils.duplicate(
			options.movement?.[followerDocument.id] ?? leaderMovementData,
		);
		if (stepSnake && trailingWaypoint) {
			const followerWaypoints = [foundry.utils.duplicate(trailingWaypoint)];
			applyFollowerDimensionsToWaypoints(followerWaypoints, followerDocument);
			followerMovementData.waypoints = followerWaypoints;
			trailingWaypoint = getTokenDocumentMovementWaypoint(
				followerDocument,
				leadAction,
			);
		} else {
			let followerWaypoints = buildFollowerWaypoints(
				leaderPath,
				trailingOffset,
			);
			// Prevent fallback to Foundry's translated mirror movement
			// when a follower has no segment to advance this step.
			if (!followerWaypoints.length) {
				const holdWaypoint = getTokenDocumentMovementWaypoint(
					followerDocument,
					leadAction,
				);
				if (holdWaypoint) followerWaypoints = [holdWaypoint];
			}
			applyFollowerDimensionsToWaypoints(followerWaypoints, followerDocument);
			followerMovementData.waypoints = followerWaypoints;
		}
		logFollowerDebug('Follower waypoints assigned', {
			leaderId: leaderTokenDocument.id,
			followerId: followerDocument.id,
			waypointCount: Array.isArray(followerMovementData.waypoints)
				? followerMovementData.waypoints.length
				: 0,
			stepSnake,
		});
		if (!followerMovementData.method && leaderMovementData.method) {
			followerMovementData.method = leaderMovementData.method;
		}
		if (
			followerMovementData.constrainOptions === undefined &&
			leaderMovementData.constrainOptions !== undefined
		) {
			followerMovementData.constrainOptions = foundry.utils.duplicate(
				leaderMovementData.constrainOptions,
			);
		}
		options.movement[followerDocument.id] = followerMovementData;
		previousFootprint = followerFootprint;
	}

	options._tokenwarpSnakeRoute = {
		leaderId: leaderTokenDocument.id,
		movementId: move.id,
	};
	logFollowerDebug('Follower routing complete', {
		leaderId: leaderTokenDocument.id,
		movementId: move?.id,
		followerCount: followers.length,
	});
	return true;
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

	let movementLeader =
		expanded?.movementLeader && typeof expanded.movementLeader === 'object'
			? foundry.utils.duplicate(expanded.movementLeader)
			: {};

	if (!Object.keys(movementLeader).length) {
		const dottedLeader = {};
		for (const [key, value] of Object.entries(raw)) {
			if (!key.startsWith('movementLeader.')) continue;
			foundry.utils.setProperty(dottedLeader, key, value);
		}
		const dottedExpanded = foundry.utils.expandObject(dottedLeader);
		movementLeader =
			dottedExpanded?.movementLeader &&
			typeof dottedExpanded.movementLeader === 'object'
				? foundry.utils.duplicate(dottedExpanded.movementLeader)
				: {};
	}

	const triggers = foundry.utils.duplicate(expanded);
	delete triggers.movementAnimation;
	delete triggers.movementLeader;
	for (const key of Object.keys(triggers)) {
		if (key.startsWith('movementAnimation.')) delete triggers[key];
		if (key.startsWith('movementLeader.')) delete triggers[key];
	}

	return { triggers, movementAnimation, movementLeader };
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
	const tokenRef = this.token; // Token placeable or TokenDocument
	const rawTokenDocument = tokenRef?.document ?? tokenRef ?? null;
	const actor = rawTokenDocument?.actor || tokenRef?.actor || this.actor;
	if (!actor) return;
	const tokenDocument = rawTokenDocument ?? null;

	const isDnd5e = game?.system?.id === 'dnd5e';
	const hasHpZeroSupport = actorHasHpRollData(actor);
	const twTriggers = actor.getFlag('tokenwarp', 'tokenTriggers') || {};
	const savedAnimation = actor.getFlag('tokenwarp', 'movementAnimation') || {};
	const savedLeaderState = getMovementLeaderDialogState(tokenDocument);
	const leaderTargetOptions = getMovementLeaderTargetOptions(tokenDocument);
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

	const movementLeaderContent = (() => {
		if (!tokenDocument?.id) {
			return `<p class="notes">${game.i18n.localize('TOKENWARP.LeaderNoTokenHint')}</p>`;
		}
		const selectedRole = savedLeaderState.role;
		const selectedFollowTokenId = savedLeaderState.followTokenId;
		const roleOptions = [
			{ value: 'none', label: game.i18n.localize('TOKENWARP.LeaderRoleNone') },
			{
				value: 'leader',
				label: game.i18n.localize('TOKENWARP.LeaderRoleLeader'),
			},
			{
				value: 'follower',
				label: game.i18n.localize('TOKENWARP.LeaderRoleFollower'),
			},
		]
			.map(
				(option) =>
					`<option value="${option.value}" ${option.value === selectedRole ? 'selected' : ''}>${option.label}</option>`,
			)
			.join('');

		let followOptions = `<option value="">${game.i18n.localize('TOKENWARP.LeaderFollowNone')}</option>`;
		for (const option of leaderTargetOptions) {
			followOptions += `<option value="${option.id}" ${option.id === selectedFollowTokenId ? 'selected' : ''}>${foundry.utils.escapeHTML(option.name)} (${option.id})</option>`;
		}
		if (
			selectedRole === 'follower' &&
			selectedFollowTokenId &&
			!leaderTargetOptions.some((option) => option.id === selectedFollowTokenId)
		) {
			followOptions += `<option value="${selectedFollowTokenId}" selected>${selectedFollowTokenId}</option>`;
		}

		return `
      <hr>
      <h3 style="margin: 0 0 0.5rem;">${game.i18n.localize('TOKENWARP.LeaderSectionLabel')}</h3>
      <div class="form-group">
        <label>${game.i18n.localize('TOKENWARP.LeaderRoleLabel')}</label>
        <div class="form-fields">
          <select name="movementLeader.role" data-tw-leader-role>${roleOptions}</select>
        </div>
        <p class="hint">${game.i18n.localize('TOKENWARP.LeaderRoleHint')}</p>
      </div>
      <div class="form-group" data-tw-follow-row>
        <label>${game.i18n.localize('TOKENWARP.LeaderFollowLabel')}</label>
        <div class="form-fields">
          <select name="movementLeader.followTokenId">${followOptions}</select>
        </div>
        <p class="hint">${game.i18n.localize('TOKENWARP.LeaderFollowHint')}</p>
      </div>
    `;
	})();

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
                ${movementLeaderContent}
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

				const leaderRoleInput = dialog.element.querySelector(
					"select[name='movementLeader.role']",
				);
				const followerRow = dialog.element.querySelector('[data-tw-follow-row]');
				const applyLeaderRoleUI = () => {
					if (!(followerRow instanceof HTMLElement)) return;
					const isFollower = leaderRoleInput?.value === 'follower';
					followerRow.style.display = isFollower ? '' : 'none';
					followerRow
						.querySelectorAll('input, select, textarea, button')
						.forEach((el) => {
							el.disabled = !isFollower;
						});
				};
				if (leaderRoleInput) {
					leaderRoleInput.addEventListener('change', applyLeaderRoleUI);
				}
				applyLeaderRoleUI();

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
		movementLeader: movementLeaderChoices,
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

	await persistMovementLeaderFlag(tokenDocument, movementLeaderChoices);

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
