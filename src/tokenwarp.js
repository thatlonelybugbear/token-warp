import Settings from './settings.js';

const settings = new Settings();

/*  Functions */
export function _preUpdateToken(tdoc, changes, options, userId) {
	if ((changes.x || changes.y) && options.animate !== false) {
		if (settings.movementSpeed)
			foundry.utils.setProperty(
				options,
				'animation.movementSpeed',
				settings.movementSpeed
			);
		if (
			options.rulerSegment || //force Elevation ruler compatibility. If that parameter exists, let ER handle it.
			settings.excludedScene
		)
			return true;
		if (
			settings.movementSwitch ||
			(game.users.get(userId).isGM && _wallsBlockMovement(tdoc, changes))
		)
			options.animate = false;
	}
	return true;
}

export function _wallsBlockMovement(tdoc, changes) {
	if (!settings.wallBlock) return false;
	const sourceCenter = tdoc.object.center;
	const targetPos = { x: (changes.x ??= tdoc.x), y: (changes.y ??= tdoc.y) };
	const offset = { x: sourceCenter.x - tdoc.x, y: sourceCenter.y - tdoc.y };
	const targetCenter = { x: targetPos.x + offset.x, y: targetPos.y + offset.y };
	const ray = new Ray(sourceCenter, targetCenter);
	if (
		CONFIG.Canvas.polygonBackends.move.testCollision(ray.A, ray.B, {
			mode: 'any',
			type: 'move',
		})
	)
		return true;
}
