# Blocker: partial run interrupted during judge retry

This archive is not a valid full-suite result.

- Provider base URL: `https://sub2.congmingai.com`
- Model: `gpt-5.5`
- Review model: `gpt-5.5`
- Fingerprint at run start: `c418a391fb5c7d3c02136c07f97abde14dc81a22`
- Observed state before interruption: generation requests were succeeding with provider `200` responses and clean, non-dirty fingerprints.
- Failure mode: the run stopped making progress in the judge phase while provider retries were enabled.
- Operator action: interrupted manually to avoid an unbounded wait and preserve a clear blocker trail.

This run is preserved only as an audit trail for the judge-stage retry/hang behavior. It must not be used as evidence for or against the four-layer memory engine.
