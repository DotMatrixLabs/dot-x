# Dot X — agent guide

This file applies to all coding agents (ChatGPT Codex, Claude, others).

## Commit messages

Follow `.github/instructions/commit-format.instructions.md`: use a conventional
prefix (`feat:` for features, `fix:` for bug fixes, `chore:` for maintenance),
write a single lowercase imperative one-liner, no body.

## Filing pull requests

Follow `.claude/skills/file-pr/SKILL.md` for every pull request you create, draft,
or update. In short:

- Check whether the branch already has a PR before opening a new one.
- Title uses the same conventional prefix as commits and states the user-visible
  reason for the change.
- Open a real PR, not a draft, so review bots run.
- Description format:

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

- Keep the human-input area empty unless the user supplied text. Never put
  AI-written content above the divider. The attribution line comes first, right
  after the divider.
- Write terse, concrete prose. Lead with the problem, then the outcome. No filler,
  no file-by-file inventories, no decorative headings.
- Verification states only checks actually run.
