# Blocker: invalid provider base URL

This archive is not a valid clean generation result.

- Intended provider base URL: `https://sub2.congmingai.com`
- Actual provider base URL recorded by the suite: `https://zzshu.cc/v1`
- Failure mode: the Responses request was sent to `/v1/v1/responses`, producing provider 404 errors; later calls also hit provider 429.
- Result: `pairedRuns=0`, all arm generations failed, and judge results are empty.

This run is preserved only as an audit trail for the provider-configuration failure. It must not be used as evidence for or against the four-layer memory engine.
