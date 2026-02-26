import Settings from './settings.js';
import Constants from './constants.js';
import * as tokenwarp from './tokenwarp.js';

const settings = new Settings();

Hooks.once('init', () => {
	settings.registerSettings();
});

Hooks.once('ready', async () => {
	const migrationID = '11.3.1';
	const migration = game.settings.get(Constants.MODULE_ID, Settings.MIGRATIONS);
	if (migration !== migrationID) {
		console.warn(`${Constants.MODULE_NAME}: Migration to ${migrationID}`);
		const migrateTo = settings.movementSwitchOLD
			? 'noanimations'
			: settings.wallBlock
				? 'wallsblock'
				: 'default';
		await game.settings.set(
			Constants.MODULE_ID,
			Settings.TOKEN_ANIMATION_SWITCH,
			migrateTo,
		);
		await game.settings.set(
			Constants.MODULE_ID,
			Settings.DEFAULT_TOKEN_ANIMATION_SWITCH_OLD,
			false,
		);
		await game.settings.set(
			Constants.MODULE_ID,
			Settings.WALLS_CANCEL_TOKEN_ANIMATION_GM,
			false,
		);
		await game.settings.set(
			Constants.MODULE_ID,
			Settings.MIGRATIONS,
			migrationID,
		);
		console.warn(
			`${Constants.MODULE_NAME}: migration to ${migrationID} complete`,
		);
	}

	const api = Object.freeze({
		supportsHpRollData: tokenwarp.supportsHpRollData,
		registerHpRollDataSupportCheck: tokenwarp.registerHpRollDataSupportCheck,
	});
	const module = game.modules.get(Constants.MODULE_ID);
	if (module) module.api = api;
	Hooks.callAll('tokenwarp.ready', api);

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

Hooks.once('tokenwarp.ready', (api) => {
	api.registerHpRollDataSupportCheck((actor) => {
		const hp = actor?.getRollData?.()?.resources?.health;
		if (!hp || typeof hp !== 'object') return false;
		return 'value' in hp && 'max' in hp;
	});
});
