# TODO (Next Session)

## Priority 1 - Follower Routing Correctness

- [ ] Validate snake routing in all movement entry paths:
  - `preMoveToken` movement payload
  - keyboard/non-payload position update path
- [ ] Reproduce and isolate cases where followers mirror instead of trailing.
- [ ] Verify duplicate-routing guard (`options._tokenwarpSnakeRoute`) does not skip required follow updates.
- [ ] Confirm followers preserve their own width/height/shape in all route branches.

Acceptance:
- Followers always trail the leader route (or hold), never mirror-translate unexpectedly.

## Priority 2 - UX Consistency

- [ ] Confirm leader dropdown shows only confirmed leaders.
- [ ] Confirm follower-only fields hide correctly when role is not follower.
- [ ] Confirm role/follow selection persists and reloads correctly after dialog reopen.

Acceptance:
- UI state is stable across reopen and writes expected flag structure.

## Priority 3 - Regression Pass

- [ ] Re-test movement animation overrides after snake routing changes.
- [ ] Re-test out-of-bounds behavior interactions.
- [ ] Re-test wall-block/no-animation behavior interactions.
- [ ] Re-test trigger hook macros still fire correctly.

Acceptance:
- No regressions in movement options, hooks, or animation controls.

## Priority 4 - Cleanup Before Release

- [ ] Remove or reduce follow debug logs if no longer needed.
- [ ] Update changelog with final behavior and known constraints.
- [ ] Add short README note for troubleshooting follow logs (debug mode).

Acceptance:
- Code and docs match released behavior, with minimal debug noise.

