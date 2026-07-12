export const systemId = 'dnd5e';

export function getHitPointData(actor) {
	if (!actor?.system?.attributes?.hp) return null;
	return {
		valuePath: 'system.attributes.hp.value',
		updatePath: 'system.attributes.hp.value',
	};
}
