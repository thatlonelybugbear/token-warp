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
