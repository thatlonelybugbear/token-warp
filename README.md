# Token Warp

![Latest Version](https://img.shields.io/badge/dynamic/json.svg?url=https://raw.githubusercontent.com/thatlonelybugbear/token-warp/main/module.json&label=Token%20Warp%20Version&query=$.version&colorB=yellow&style=for-the-badge)
![Foundry Core Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https://raw.githubusercontent.com/thatlonelybugbear/token-warp/main/module.json&label=Foundry%20Version&query=$.compatibility.minimum&colorB=ff6400&style=for-the-badge)
![Foundry Core Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https://raw.githubusercontent.com/thatlonelybugbear/token-warp/main/module.json&label=Foundry%20Version&query=$.compatibility.verified&colorB=ff6400&style=for-the-badge)
![Total Download Count](https://img.shields.io/github/downloads/thatlonelybugbear/token-warp/total?color=2b82fc&label=TOTAL%20DOWNLOADS&style=for-the-badge)
![Latest Release Download Count](https://img.shields.io/github/downloads/thatlonelybugbear/token-warp/latest/total?color=2b82fc&label=LATEST%20DOWNLOADS&style=for-the-badge)
[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https://forge-vtt.com/api/bazaar/package/tokenwarp&colorB=68a74f&style=for-the-badge)](https://forge-vtt.com/bazaar#package=tokenwarp)

## Description

A **system agnostic** Foundry VTT module that helps prevent accidental map reveals by controlling token movement animation behavior.

It also provides settings for:

- default movement animation behavior,
- default token movement animation speed,
- optional scene exclusions for `No movement animations`.

For Foundry v13, Token Warp includes actor-configurable macro triggers for token lifecycle, token update, actor update, movement start/stop, and actor HP-zero events.

## Trigger Presets (v1)

In the Actor-sheet Token Warp dialog (`Triggers` tab), five quick preset buttons are available:

- `Spawn`
- `Despawn`
- `Movement`
- `HP Zero`
- `All Events`

Pressing a preset filters the visible trigger fields to that preset scope.
When you set `All hooks`, that UUID is copied only to the currently active preset scope.
`Reset` in the `Triggers` tab clears only the active preset scope (`All hooks` + that preset's mapped fields).
`All Events` is a full-scope preset and applies to all trigger fields.

## Trigger hooks

Token Warp exposes explicit hooks that users/modules can call and that can be mapped in the Token Warp Triggers dialog:

- `tokenwarp.movementStart(token, move, options, userId, tag)`
- `tokenwarp.movementStop(token, move, options, userId, tag)`
- `tokenwarp.preActorHpZero(actor, data, options, userId, tag)`
- `tokenwarp.actorHpZero(actor, data, options, userId, tag)`

HP-zero hooks fire only when an actor update includes an identifiable *zero hp source*, like `changes.system.attributes.hp.value <= 0` for D&D5e system:

- `tokenwarp.preActorHpZero` during `preUpdateActor`
- `tokenwarp.actorHpZero` during `updateActor`

HP-zero support is enabled by default for:

- `dnd5e`
- systems where `actor.getRollData().attributes.hp.value` and `.max` are available

## HP-Zero Compatibility API

At `ready`, Token Warp exposes:

- `game.modules.get("tokenwarp").api`
- `Hooks.callAll("tokenwarp.ready", api)`

API methods:

- `api.supportsHpRollData(actor)`
- `api.registerHpRollDataSupportCheck(check, { prepend })`

Example:

```js
Hooks.on('tokenwarp.ready', (api) => {
	api.registerHpRollDataSupportCheck((actor) => {
		const rollData = actor?.getRollData?.();
		return (
			foundry.utils.hasProperty(rollData, 'attributes.hp.value') &&
			foundry.utils.hasProperty(rollData, 'attributes.hp.max')
		);
	});
});
```

Crucible test case example:

```js
Hooks.once('tokenwarp.ready', (api) => {
	api.registerHpRollDataSupportCheck((actor) => {
		const hp = actor?.getRollData?.()?.resources?.health;
		if (!hp || typeof hp !== 'object') return false;
		return 'value' in hp && 'max' in hp;
	});
});
```

## Actor Movement Animation Overrides

In the Token Warp Actor-sheet dialog there is a `Movement animation speed` tab.

- `Override animation speeds` enables per-actor animation speed overrides.
- If override is enabled, the actor override takes precedence over the world `Token movement animation speed` setting when Token Warp applies `options.animation.movementSpeed`.
- On `dnd5e`, the tab auto-builds per-mode speed inputs from non-zero `actor.system.attributes.movement` values and pre-fills them from movement ratios (faster movement modes get faster initial animation speeds).
- If multiple tokens are controlled and moved together, Token Warp uses the global `Token movement animation speed` for all selected tokens, and skips per-actor overrides for that move.

## Movement Behavior Notes

- `Walls block` applies only when Foundry Core `Unconstrained movement` is enabled for the GM.
- If Core `Unconstrained movement` is disabled, `Walls block` has no extra effect.
- `Disallow out of bounds movement` clamps movement to the nearest valid destination; it does not force no-animation by itself.
- Keybinding `Disable Token Rotation Key` is per-user. While held, it temporarily suppresses movement auto-rotation.

<hr>
If you like what I do, consider supporting this lonely bugbear.

Every shiny gold coin helps keep the ideas flowing and the goblins at bay.

<a href="https://www.patreon.com/thatlonelybugbear"><img src="https://img.shields.io/badge/-Patreon-%23f96854?style=for-the-badge&logo=patreon"/></a>
<a href="https://ko-fi.com/thatlonelybugbear"><img src="https://img.shields.io/badge/Ko-fi-00ADEF?style=for-the-badge&logo=kofi&logoColor=white"/></a>
<br/>
<br/>
You can also join the Bugbear's Den to hang out, get help, or check what I might be working on.

<a href="https://discord.gg/KYb74fcsBt"><img src="https://img.shields.io/discord/1226846921474310194?style=for-the-badge&logo=discord&label=Discord&labelColor=%231c1e1f&color=%235865f2&link=https%3A%2F%2Fdiscord.gg%KYb74fcsBt"/></a>

<hr>

![tokenwarpTriggers](https://github.com/user-attachments/assets/2a995825-c106-4b24-b05e-a90b2b222227)

![tokenwarp_functionality](https://github.com/thatlonelybugbear/token-warp/assets/7237090/4937e939-9964-44ff-9c66-bcc27066711e)
