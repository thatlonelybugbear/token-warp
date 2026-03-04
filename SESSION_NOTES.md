# Token Warp Session Notes (Handoff)

Last updated: 2026-03-04
Branch: `main`

## Current Status

- In progress feature: Leader/follower "snake follow" routing for selected tokens.
- The linked-token `isLinked + actor.getActiveTokens()` compatibility path was reverted.
- Debug tracing for follow-routing is enabled behind module `debug` setting.
- Files currently modified are ready for commit.

## What Was Implemented

1. Leader/follower routing core
- Added leader/follower flag parsing from `flags.tokenwarp.leader`.
- Added route derivation from leader movement waypoints.
- Added follower spacing using token grid footprint.
- Added follower-specific waypoint dimension enforcement to avoid width/height/shape drift.

2. Movement hook wiring
- `preMoveToken` now attempts to route followers from leader movement.
- Non-movement payload updates (keyboard/position updates) build a synthetic move and route followers.

3. UI wiring
- Added movement leader controls in Token Warp actor dialog:
  - Role: none/leader/follower
  - Follow token selector
- Follow selector currently lists only confirmed leaders.

4. Stability and diagnostics
- Added hold-waypoint fallback so followers do not fall back to mirrored translation when no segment is available.
- Added debug logs tagged as `[tokenwarp][follow]` for:
  - synthetic move detection
  - leader resolution
  - route early exits
  - per-follower waypoint assignment
  - route completion summary

## Important Revert Applied

- Reverted linked token compatibility path:
  - Removed helper resolution via `actor.getActiveTokens()`.
  - Leader candidate IDs are back to plain token document ID matching.
  - Dialog token document resolution no longer swaps to active linked token.

## Known Behavior / Risks

- Snake follow behavior still needs deeper validation for edge cases where followers may mirror or not route as expected in mixed workflows.
- Multi-token movement speed remains global fallback behavior (per previous decision).
- Debug logging is intentionally verbose when module debug is enabled.

## How To Continue Quickly

1. Enable module debug in Foundry and reproduce follower movement cases.
2. Capture `[tokenwarp][follow]` logs for failing route sequences.
3. Confirm if remaining failure is:
   - leader resolution,
   - empty leader path,
   - routing duplicate guard,
   - or waypoint assignment ordering.
4. Patch only the failing branch and retest with:
   - drag movement
   - keyboard movement
   - mixed selected tokens
   - out-of-bounds and wall-block modes

## Files Touched This Cycle

- `src/tokenwarp.js`
- `lang/en.json`
- `README.md`
- `Changelog.md`

