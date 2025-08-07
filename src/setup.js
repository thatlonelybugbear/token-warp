import Settings from './settings.js';
import Constants from './constants.js';
import * as tokenwarp from './tokenwarp.js';

const settings = new Settings();

Hooks.once('init', () => {
	settings.registerSettings();
});

Hooks.once('ready', async () => {
	tokenwarp.getActiveRulers();
	const migrationID = '11.3.1';
	const migration = game.settings.get(Constants.MODULE_ID, Settings.MIGRATIONS);
	if (migration !== migrationID) {
		console.warn(`${Constants.MODULE_NAME}: Migration to ${migrationID}`);
		const migrateTo = settings.movementSwitchOLD ? 'noanimations' : settings.wallBlock ? 'wallsblock' : 'default';
		await game.settings.set(Constants.MODULE_ID, Settings.TOKEN_ANIMATION_SWITCH, migrateTo);
		await game.settings.set(Constants.MODULE_ID, Settings.DEFAULT_TOKEN_ANIMATION_SWITCH_OLD, false);
		await game.settings.set(Constants.MODULE_ID, Settings.WALLS_CANCEL_TOKEN_ANIMATION_GM, false);
		await game.settings.set(Constants.MODULE_ID, Settings.MIGRATIONS, migrationID);
		console.warn(`${Constants.MODULE_NAME}: migration to ${migrationID} complete`);
	}
	Hooks.on('preUpdateToken', tokenwarp._preUpdateToken);
});
