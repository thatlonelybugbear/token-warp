import Constants from '../constants.js';

const name = Constants.MODULE_NAME;

const HP_PROVIDERS = new Map();
let HP_ROLL_DATA_SUPPORTED_ACTORS = new WeakSet();
const COMPATIBILITY_WARNINGS = new Set();

function warnCompatibility(message, options = {}) {
	const logger = foundry?.utils?.logCompatibilityWarning;
	if (typeof logger === 'function') {
		logger(message, options);
		return;
	}
	if (options.once) {
		if (COMPATIBILITY_WARNINGS.has(message)) return;
		COMPATIBILITY_WARNINGS.add(message);
	}
	console.warn(message);
}

function normalizeHpConfig(config) {
	if (!config || typeof config !== 'object') return null;
	const valuePath = String(config.valuePath ?? '').trim();
	const updatePath = String(config.updatePath ?? valuePath).trim();
	const supported = config.supported === true;
	if (!valuePath && !supported) return null;
	if (!updatePath) return null;
	return { valuePath, updatePath, supported };
}

function getDefaultRollDataHpConfig(actorDocument, { warn = false } = {}) {
	if (typeof actorDocument?.getRollData !== 'function') return null;

	let rollData;
	try {
		rollData = actorDocument.getRollData();
	} catch {
		return null;
	}

	if (
		!rollData ||
		typeof rollData !== 'object' ||
		!foundry.utils.hasProperty(rollData, 'attributes.hp.value') ||
		!foundry.utils.hasProperty(rollData, 'attributes.hp.max')
	) {
		return null;
	}

	if (warn) {
		warnCompatibility(
			`${name}: generic actor.getRollData().attributes.hp HP support is deprecated. Register a system-specific hit point provider instead.`,
			{ since: 14, until: 15, once: true },
		);
	}
	return {
		updatePath: 'system.attributes.hp.value',
		supported: true,
	};
}

function getHpConfig(actorDocument) {
	const providers = HP_PROVIDERS.get(game?.system?.id) ?? [];
	for (const provider of providers) {
		try {
			const config = normalizeHpConfig(provider(actorDocument));
			if (config) return config;
		} catch (error) {
			console.warn(`${name}: HP provider failed and was ignored.`, error);
		}
	}
	return getDefaultRollDataHpConfig(actorDocument, { warn: true });
}

export function registerHitPointProvider(
	systemId,
	provider,
	{ prepend = false } = {},
) {
	const id = String(systemId ?? '').trim();
	if (!id) return false;
	if (typeof provider !== 'function') return false;
	const providers = HP_PROVIDERS.get(id) ?? [];
	if (!providers.includes(provider)) {
		if (prepend) providers.unshift(provider);
		else providers.push(provider);
		HP_PROVIDERS.set(id, providers);
	}
	HP_ROLL_DATA_SUPPORTED_ACTORS = new WeakSet();
	return true;
}

export function registerHpRollDataSupportCheck(check, options = {}) {
	if (typeof check !== 'function') return false;
	warnCompatibility(
		`${name}: registerHpRollDataSupportCheck is deprecated. Use registerHitPointProvider instead.`,
		{ since: 14, until: 15, once: true },
	);
	return registerHitPointProvider(
		game?.system?.id,
		(actorDocument) => {
			if (check(actorDocument) !== true) return null;
			return {
				updatePath: 'system.attributes.hp.value',
				supported: true,
			};
		},
		options,
	);
}

export function supportsHpRollData(actorDocument) {
	if (!actorDocument) return false;
	if (HP_ROLL_DATA_SUPPORTED_ACTORS.has(actorDocument)) return true;
	const config = getHpConfig(actorDocument);
	const supportsHpRollData =
		!!config &&
		(config.supported ||
			foundry.utils.hasProperty(actorDocument, config.valuePath));
	if (supportsHpRollData) HP_ROLL_DATA_SUPPORTED_ACTORS.add(actorDocument);
	return supportsHpRollData;
}

export function isHpZeroUpdate(actorDocument, changes) {
	if (!actorDocument) return false;
	const config = getHpConfig(actorDocument);
	if (!config) return false;
	if (!foundry.utils.hasProperty(changes ?? {}, config.updatePath))
		return false;
	const hpValue = Number(foundry.utils.getProperty(changes, config.updatePath));
	return Number.isFinite(hpValue) && hpValue <= 0;
}
