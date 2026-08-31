---
name: file-pr
description: Use when creating, drafting, or updating a GitHub pull request, including its title, description, readiness, and review context.
---

# File PR

Before filing, check whether this branch already has a PR. Review the diff against `origin/main`; the title follows repository conventions and states the user-visible reason for the change. Use the same conventional commit prefix as commit messages (see `.github/instructions/commit-format.instructions.md`): `fix:` for bug fixes, `feat:` for new features, `chore:` for maintenance work. Open a real PR, not a draft, so review bots run.

## Description format

Leave room for people first. Then make AI authorship unambiguous:

```markdown
<!-- Human input (optional): add context, review notes, or release details here. -->

---
Everything below this line was written by AI. Agent: <agent>. Model: <model>.

## Problem

<one or two plain-language sentences>

## Solution

<brief outcome-focused explanation>

## Verification

<focused checks actually run>
```

Keep the human-input area empty unless the user supplied text. Never place AI-written content above the divider, and never bury the attribution line below the Summary or Test plan — it comes immediately after the divider, first.

## Writing style

**REQUIRED SUB-SKILL:** Use `unslop` when it is installed.

Write terse, concrete, human-readable prose. Lead with the problem, then the outcome. Avoid filler, generic claims, implementation inventories, decorative headings, and restating every changed file.

Bad: "Refactored several components, updated configuration, and improved the system."

Good: "New worktrees ignored the configured default. They now apply it consistently."

## Final checks

- The description has the empty human-input area, divider, and AI attribution naming the agent and model.
- Everything below the divider is AI-written; human text stays above it.
- Verification states only evidence actually collected.
- The title and description explain why the change matters.
