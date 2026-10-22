---
applyTo: "**"
description: "Git commit message formatting preferences. Use when writing or suggesting git commit messages."
---

# Commit Message Format

- Use conventional commit prefixes: `feat:` for new features, `fix:` for bug fixes, `chore:` for maintenance work with no user-facing behavior change (tooling, deps, config, docs, skills)
- Write a single concise one-liner — no body, no bullet points
- Use imperative mood, lowercase, no trailing period

**Examples:**
```
feat: add support for deno
fix: resolve null pointer in auth middleware
feat: expose camera metadata endpoint
fix: correct off-by-one in pagination logic
chore: bump vite to 7.3
```
