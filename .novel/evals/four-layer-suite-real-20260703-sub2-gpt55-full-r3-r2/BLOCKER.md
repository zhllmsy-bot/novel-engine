# Blocker: invalid API key source

This archive is not a valid clean generation result.

- Provider base URL: `https://sub2.congmingai.com`
- Model: `gpt-5.5`
- Review model: `gpt-5.5`
- Failure mode: provider returned `401 INVALID_API_KEY` for all generation calls.
- Likely cause: the eval launcher picked the ambient `OPENAI_API_KEY` environment variable, not the project-specific OpenAI-compatible key intended for this provider.
- Result: `pairedRuns=0`, all arm generations failed, and judge results are empty.

This run is preserved only as an audit trail for the credential-source failure. It must not be used as evidence for or against the four-layer memory engine.
