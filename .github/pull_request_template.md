## Summary

-

## Type

- [ ] Editor/runtime
- [ ] Four-layer memory
- [ ] Skill or adapter manifest
- [ ] Publisher/upload flow
- [ ] Project format, docs, or examples

## Safety Checklist

- [ ] Durable author assets remain Markdown/YAML/JSON; cache data remains rebuildable.
- [ ] High-risk AI output remains reviewable before mutation.
- [ ] Memory changes preserve time-slicing and do not leak future/unknown-order context.
- [ ] New or changed manifests pass the relevant public schema/checker.
- [ ] Publishing/upload behavior has a dry-run or preview path.

## Verification

- [ ] `npm run verify`
- [ ] Additional checks, if any:
