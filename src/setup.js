import Settings from './settings.js';
import Constants from './constants.js';
import { registerBuiltinIntegrations } from './integrations/integrations.js';
import * as tokenwarp from './tokenwarp.js';

const settings = new Settings();

Hooks.once('init', () => {
	settings.registerSettings();
});

Hooks.once('ready', async () => {
	await registerBuiltinIntegrations();
	const api = Object.freeze({
		supportsHpRollData: tokenwarp.supportsHpRollData,
		registerHitPointProvider: tokenwarp.registerHitPointProvider,
		registerHpRollDataSupportCheck: tokenwarp.registerHpRollDataSupportCheck,
		registerMovementModePath: tokenwarp.registerMovementModePath,
		registerMovementModePaths: tokenwarp.registerMovementModePaths,
		registerMovementModeProvider: tokenwarp.registerMovementModeProvider,
	});
	const module = game.modules.get(Constants.MODULE_ID);
	if (module) module.api = api;
	Hooks.callAll('tokenwarp.ready', api);
	tokenwarp.enableContinuousKeyboardMovement();

	Hooks.on('preMoveToken', tokenwarp._preMoveToken);
	Hooks.on('preCreateToken', tokenwarp._executePreCreation);
	Hooks.on('createToken', tokenwarp._executePostCreation);
	Hooks.on('preDeleteToken', tokenwarp._executePreDeletion);
	Hooks.on('deleteToken', tokenwarp._executePostDeletion);
	Hooks.on('preUpdateActor', tokenwarp._executePreUpdateActor);
	Hooks.on('updateActor', tokenwarp._executePostUpdateActor);
	Hooks.on('preUpdateToken', tokenwarp._executePreUpdateToken);
	Hooks.on('updateToken', tokenwarp._executePostUpdateToken);
	Hooks.on('moveToken', tokenwarp._registerMovementHooks);
	Hooks.on('tokenwarp.movementStart', tokenwarp._executeTokenMovementStart);
	Hooks.on('tokenwarp.movementStop', tokenwarp._executeTokenMovementStop);
	Hooks.on('tokenwarp.preActorHpZero', tokenwarp._executePreActorHpZero);
	Hooks.on('tokenwarp.actorHpZero', tokenwarp._executePostActorHpZero);
	Hooks.on(
		'getHeaderControlsActorSheetV2',
		tokenwarp._addActorSheetHeaderButton,
	);
});
