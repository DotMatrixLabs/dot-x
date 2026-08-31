# Dot X — agent guide

## Commit messages

Follow `.github/instructions/commit-format.instructions.md`: conventional prefix
(`feat:` / `fix:` / `chore:`), one lowercase imperative line, no body.

## Pull requests

Use the `file-pr` skill (`.claude/skills/file-pr/SKILL.md`) for every PR you
create, draft, or update — title conventions, the human-input/divider/AI-attribution
description format, and the final checks.

## Writing

The `unslop` skill (`.agents/skills/unslop/SKILL.md`) applies to all prose you
write — PR descriptions, docs, comments. Skills are managed with `npx skills`;
`skills-lock.json` pins their versions.
