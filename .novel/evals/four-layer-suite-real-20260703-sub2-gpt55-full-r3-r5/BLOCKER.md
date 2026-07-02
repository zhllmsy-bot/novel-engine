# Blocker: interrupted after main worktree became dirty

This archive is not a valid full-suite result.

- Intended provider base URL: `https://sub2.congmingai.com`
- Model: `gpt-5.5`
- Review model: `gpt-5.5`
- Intended fingerprint at run start: `908adb3039fbe38ceca18e7486478117dea24ac6`
- Failure mode: the main worktree changed during execution, including `src/memory/*` files, so later case fingerprints could no longer satisfy the clean-run requirement.
- Operator action: interrupted manually to avoid producing a mixed clean/dirty suite.

This run is preserved only as an audit trail for the dirty-worktree interruption. It must not be used as evidence for or against the four-layer memory engine. Use `four-layer-suite-real-20260703-cleanwt-gpt55-full-r3` for the isolated clean worktree result.
