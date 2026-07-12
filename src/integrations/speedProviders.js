import Constants from '../constants.js';

const name = Constants.MODULE_NAME;

const MOVEMENT_MODE_PATHS = new Map();
const MOVEMENT_MODE_PROVIDERS = new Map();

function normalizeMovementModePathEntry(entry) {
	if (!entry || typeof entry !== 'object') return null;
	const key = String(entry.key ?? '')
		.trim()
		.toLowerCase();
	const valuePath = String(entry.valuePath ?? entry.path ?? '').trim();
	if (!key || !valuePath) return null;
	const label = typeof entry.label === 'string' ? entry.label : undefined;
	return { key, label, valuePath };
}

function normalizeMovementModeEntry(entry) {
	if (!entry || typeof entry !== 'object') return null;
	const key = String(entry.key ?? '')
		.trim()
		.toLowerCase();
	const value = Number(entry.value);
	if (!key || !Number.isFinite(value) || value <= 0) return null;
	const label = typeof entry.label === 'string' ? entry.label : undefined;
	return { key, label, value };
}

function normalizeMovementModePathEntries(entries) {
	if (Array.isArray(entries)) return entries;
	if (!entries || typeof entries !== 'object') return [];
	return Object.entries(entries).map(([key, entry]) => ({
		key,
		...entry,
	}));
}

export function registerMovementModePath(
	systemId,
	entry,
	{ prepend = false } = {},
) {
	const id = String(systemId ?? '').trim();
	if (!id) return false;
	const modePath = normalizeMovementModePathEntry(entry);
	if (!modePath) return false;
	const modePaths = MOVEMENT_MODE_PATHS.get(id) ?? [];
	const index = modePaths.findIndex((path) => path.key === modePath.key);
	if (index >= 0) modePaths.splice(index, 1);
	if (prepend) modePaths.unshift(modePath);
	else modePaths.push(modePath);
	MOVEMENT_MODE_PATHS.set(id, modePaths);
	return true;
}

export function registerMovementModePaths(systemId, entries, options = {}) {
	let registered = false;
	for (const entry of normalizeMovementModePathEntries(entries)) {
		registered =
			registerMovementModePath(systemId, entry, options) || registered;
	}
	return registered;
}

export function registerMovementModeProvider(
	systemId,
	provider,
	{ prepend = false } = {},
) {
	const id = String(systemId ?? '').trim();
	if (!id) return false;
	if (typeof provider !== 'function') return false;
	const providers = MOVEMENT_MODE_PROVIDERS.get(id) ?? [];
	if (!providers.includes(provider)) {
		if (prepend) providers.unshift(provider);
		else providers.push(provider);
		MOVEMENT_MODE_PROVIDERS.set(id, providers);
	}
	return true;
}

export function getMovementModes(actor) {
	const modes = new Map();
	const systemId = game?.system?.id;
	const modePaths = [...(MOVEMENT_MODE_PATHS.get(systemId) ?? [])];
	Hooks.callAll('tokenwarp.getMovementModePaths', actor, modePaths);
	for (const entry of modePaths) {
		const modePath = normalizeMovementModePathEntry(entry);
		if (!modePath || modes.has(modePath.key)) continue;
		const value = Number(foundry.utils.getProperty(actor, modePath.valuePath));
		const mode = normalizeMovementModeEntry({ ...modePath, value });
		if (mode) modes.set(mode.key, mode);
	}

	const providers = MOVEMENT_MODE_PROVIDERS.get(systemId) ?? [];
	for (const provider of providers) {
		let entries;
		try {
			entries = provider(actor);
		} catch (error) {
			console.warn(
				`${name}: movement mode provider failed and was ignored.`,
				error,
			);
			continue;
		}
		if (!Array.isArray(entries)) continue;
		for (const entry of entries) {
			const mode = normalizeMovementModeEntry(entry);
			if (mode && !modes.has(mode.key)) modes.set(mode.key, mode);
		}
	}
	return Array.from(modes.values());
}
