import Settings from './settings.js';

const settings = new Settings();

/*  Functions */
export function _preUpdateToken(tdoc, changes, options, userId) {
	if ((changes.x || changes.y) && options.animate !== false) {
		const ev = event;
		const keyTW =
			/*game.keybindings.get('tokenwarp', 'teleport')?.[0].key || */ 'KeyQ';
		const keyER = game.modules.get('elevationruler')?.active
			? game.keybindings.get('elevationruler', 'togglePathfinding')[0].key
			: keyTW;
		const hasKey =
			ev?.view?.game.keyboard.downKeys.has(keyER) ||
			ev?.view?.game.keyboard.downKeys.has(keyTW);
		const ruler = canvas.controls.ruler;
		const { segments } = ruler;
		const { size, distance } = canvas.scene.grid || {};
		const finalSegment = segments?.at(-1);
		const destination = finalSegment
			? { x: finalSegment.ray.B.x, y: finalSegment.ray.B.y }
			: { x: changes.x ?? tdoc.x, y: changes.y ?? tdoc.y };
		const isRulerMoving = ruler._state === Ruler.STATES.MOVING;
		if (
			isRulerMoving &&
			(hasKey ||
				(!settings.excludedScene &&
					(settings.movementSwitch ||
						(game.users.get(userId).isGM &&
							settings.wallBlock &&
							_wallsBlockMovement(tdoc, segments)) ||
						canvas.scene.dimensions.sceneRect.x > destination.x ||
						canvas.scene.dimensions.sceneRect.x +
							canvas.scene.dimensions.sceneRect.width -
							canvas.grid.size * tdoc.width <
							destination.x ||
						canvas.scene.dimensions.sceneRect.y > destination.y ||
						canvas.scene.dimensions.sceneRect.y +
							canvas.scene.dimensions.sceneRect.height -
							canvas.grid.size * tdoc.height <
							destination.y)))
		) {
			let elevation;
			let update = {};
			if (segments?.length) {
				update = getAdjustedDestination(tdoc, segments, hasKey);
				elevation = segments.at(-1).waypointElevationIncrement
					? tdoc.elevation +
					  Math.round(
							(segments.at(-1).waypointElevationIncrement * distance) / size
					  )
					: tdoc.elevation;
				update.elevation = elevation;
			} else {
				update = getAdjustedDestination(tdoc, segments ?? destination, hasKey);
			}
			tdoc.update(update, { animate: false, animation: {} });
			return false;
		}
		if (settings.movementSpeed)
			foundry.utils.setProperty(
				options,
				'animation.movementSpeed',
				settings.movementSpeed
			);
		if (
			canvas.scene.dimensions.sceneRect.x > destination.x ||
			canvas.scene.dimensions.sceneRect.x +
				canvas.scene.dimensions.sceneRect.width -
				canvas.grid.size * tdoc.width <
				destination.x ||
			canvas.scene.dimensions.sceneRect.y > destination.y ||
			canvas.scene.dimensions.sceneRect.y +
				canvas.scene.dimensions.sceneRect.height -
				canvas.grid.size * tdoc.height <
				destination.y
		) {
			changes.x = Math.clamped(
				destination.x,
				canvas.scene.dimensions.sceneRect.x,
				canvas.scene.dimensions.sceneRect.x +
					canvas.scene.dimensions.sceneRect.width -
					canvas.grid.size * tdoc.width
			);
			changes.y = Math.clamped(
				destination.y,
				canvas.scene.dimensions.sceneRect.y,
				canvas.scene.dimensions.sceneRect.y +
					canvas.scene.dimensions.sceneRect.height -
					canvas.grid.size * tdoc.height
			);
		}
		return true;
	}
}

function _wallsBlockMovement(tdoc, segments) {
	if (!segments?.length) return false;
	for (const segment of segments) {
		if (tdoc.object.checkCollision(segment.ray.B, { origin: segment.ray.A })) {
			return true;
		}
	}
	return false;
}

function getAdjustedDestination(tdoc, segments, hasKey) {
	const origin = segments.length ? segments[0].ray.A : { x: tdoc.x, y: tdoc.y };
	const destination = segments.length ? segments.at(-1).ray.B : segments;
	const s2 =
		canvas.scene.grid.type === CONST.GRID_TYPES.GRIDLESS
			? 1
			: canvas.dimensions.size / 2;
	const dx = Math.round((tdoc.x - origin.x) / s2) * s2;
	const dy = Math.round((tdoc.y - origin.y) / s2) * s2;
	const r = new Ray(origin, destination);
	const adjustedDestination = canvas.grid.grid._getRulerDestination(
		r,
		{ x: dx, y: dy },
		tdoc.object
	);
	if (hasKey) return adjustedDestination;
	else
		return {
			x: Math.clamped(
				adjustedDestination.x,
				canvas.scene.dimensions.sceneRect.x,
				canvas.scene.dimensions.sceneRect.x +
					canvas.scene.dimensions.sceneRect.width -
					canvas.grid.size * tdoc.width
			),
			y: Math.clamped(
				adjustedDestination.y,
				canvas.scene.dimensions.sceneRect.y,
				canvas.scene.dimensions.sceneRect.y +
					canvas.scene.dimensions.sceneRect.height -
					canvas.grid.size * tdoc.height
			),
		};
}
