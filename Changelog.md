## v13.348.1
* Dropped v12 support. For v12 use [13.347.2 json](<https://github.com/thatlonelybugbear/token-warp/releases/download/v13.347.2/module.json>)
* First pass into adding triggers for macros on token creation and token deletion.
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
