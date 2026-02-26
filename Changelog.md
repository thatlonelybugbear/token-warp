## v13.351.1
* Updated for Foundry v13.351
* Expanded Token Warp trigger coverage beyond create/delete:
  * `preUpdateToken` / `updateToken`
  * `preUpdateActor` / `updateActor`
  * movement start/stop via `moveToken`
  * actor HP-zero checks during actor updates
* Added explicit Token Warp hooks for user/module integration:
  * `tokenwarp.movementStart`
  * `tokenwarp.movementStop`
  * `tokenwarp.preActorHpZero` (fires during `preUpdateActor` when `changes.system.attributes.hp.value <= 0`)
  * `tokenwarp.actorHpZero` (fires during `updateActor` when `changes.system.attributes.hp.value <= 0`)
* Added new Trigger dialog fields:
  * `Pre token update`
  * `Post token update`
  * `Movement start`
  * `Movement stop`
  * `Pre Actor update`
  * `Post Actor update`
  * `Pre Actor HP zero`
  * `Post Actor HP zero`
* Added a tabbed Actor-sheet Token Warp dialog:
  * `Triggers` tab
  * `Movement animation speed` tab
* Added per-actor movement animation overrides:
  * `Override animation speeds` toggle is saved and reloaded from actor flags
  * Per-actor speed overrides take precedence over world default movement speed
  * On dnd5e, per-mode sliders are built from non-zero `actor.system.attributes.movement` values
  * On dnd5e, per-mode defaults are prefilled from movement ratios against the world movement speed baseline
* Movement override wiring and behavior updates:
  * Hooked `preMoveToken` to Token Warp movement handling
  * Teleport-key override now runs inline on the active movement update (no `_preUpdateMovement` force-allow wrapper)
  * Always applies `options.animation.movementSpeed` from actor override or world default when movement data is present
* Movement mode behavior clarifications:
  * `Walls block` only applies when Foundry Core `unconstrainedMovement` is enabled for the GM
  * If Core `unconstrainedMovement` is disabled, `Walls block` has no additional effect
  * `Disallow out of bounds movement` clamps to the nearest legal destination while preserving segment continuation
  * Out-of-bounds clamping does not force no-animation unless `No movement animations` is selected
* Hook payload normalization and compatibility:
  * Macro payloads use `token`/`actor` plus `data`, `options`, and user fields
  * Kept `context` alias for `options` with compatibility warning
* Updated localization/README to document new movement behavior notes and trigger hook usage.

## v13.348.2
* Added an `All hooks` field, which will add the same macro to all fields. If you clear that field, all the macros from the other fields will be cleared as well.

## v13.348.1
* Dropped v12 support. For v12 use [13.347.2 json](<https://github.com/thatlonelybugbear/token-warp/releases/download/v13.347.2/module.json>)
* First pass into adding triggers for macros pre/post token creation and pre/post token deletion.
  * In the Actor sheet context menu, there is a new button for `Token Warp Triggers`. Drag and drop macros in the dialog fields to link them as needed.

## v13.347.2
* Clear deprecation warning about `options.teleport`, replaced by `options.action === 'displace'`

## v13.347.1
- Fix for `options.movement` being undefined when updating a token document's position in a macro.
- Compatibility bump for Foundry v13.347

## v13.339.1
- Initial release for dual v12 and v13 compatibility

## v12.0.2 <hl>
- Fix typo in module's manifest

## v12.0.1 <hl>
- Respect isGM only teleport key
- Forgotten translation key, for the teleport keybind

## v12.0.0 <hl>
- Full compatibility with v12
- Drag Ruler and Elevation Ruler compatibility updates
- Out of bounds fixes
- Teleport keys fixes
- Settings migrations
  
## v11.2.2 <hl>
- More compatibility updates for Elevation Ruler.
- Added a default Token Warp KeyQ to teleport tokens when pressed. 
- Now TW respects the boundaries of the padding when moving by arrows or by dragging the tokens, except for the case that KeyQ is pressed, or Elevation Ruler's toggle pathfinding button.

## v11.2.1 <hl>
- Clean up code.
- Add Elevation Ruler compatibility, by overriding any settings if ER is doing anything in that segment of movement (will revisit).

## v11.1.1 <hl>
- Add translation file.
- Bump compatibility to Foundry v11.315 and dnd5e 3.0.4

## v11.0.1.1 <hl>
- Hotfix for excluded scenes being `undefined`
- Changed the manifest url to make it easier to release hotfixes

## v11.0.1 <hl>
- Player clients should respect movement animation speed too...

## v11.0.0 <hl>
- Initial release of Token Warp!
  - Settings for movement animation default on/off,
  - Specific scenes excluded from no movement animation,
  - Moving over walls removes movement animation automatically,
  - Set default movement animation speed.
