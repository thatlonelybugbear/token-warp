import {
	registerMovementModePaths,
	registerMovementModeProvider,
} from './speedProviders.js';
import { registerHitPointProvider } from './hitPointProviders.js';

async function moduleExists(path) {
	const response = await fetch(new URL(path, import.meta.url), {
		method: 'HEAD',
	});
	return response.ok;
}

async function importIfExists(path) {
	if (!(await moduleExists(path))) return null;
	return import(path);
}

export async function registerBuiltinIntegrations() {
	const systemId = String(game?.system?.id ?? '').trim();
	if (!/^[a-z0-9_-]+$/i.test(systemId)) return;

	const [speeds, hitPoints] = await Promise.all([
		importIfExists(`./speeds/${systemId}.js`),
		importIfExists(`./hit-points/${systemId}.js`),
	]);

	if (typeof speeds?.getMovementModes === 'function') {
		registerMovementModeProvider(systemId, speeds.getMovementModes);
	}
	if (speeds?.movementModePaths) {
		registerMovementModePaths(systemId, speeds.movementModePaths);
	}

	if (typeof hitPoints?.getHitPointData === 'function') {
		registerHitPointProvider(systemId, hitPoints.getHitPointData);
	}
}
