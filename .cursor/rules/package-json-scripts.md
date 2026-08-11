---
description: package.json scripts naming — colons only for parallel/sequential groups
globs: **/package.json
alwaysApply: false
---

# package.json script names

Use `:` only for **step scripts** that belong to a group run via `bun run --parallel` or `bun run --sequential` with a glob (`<group>:*`).

## Standalone scripts (no `:`)

One-off commands run directly — use kebab-case, no colon:

- `type-check`, `lint-check`, `format-check`, `check-pre-push`

## Verify scripts

| Script | Role |
| --- | --- |
| `check` | finish-work — `--parallel type-check lint format test-run [knip-warn]` |
| `check-ci` | Read-only CI — `--parallel type-check lint-check format-check test-run` |
| `check-pre-push` | husky — parallel leaves |
