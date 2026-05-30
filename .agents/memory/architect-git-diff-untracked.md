---
name: architect includeGitDiff with untracked files
description: When to avoid passing includeGitDiff to the code_review architect in this repo.
---

# architect(includeGitDiff) fails on untracked files

Calling the code_review `architect({ ..., includeGitDiff: true })` errors with
`UNKNOWN_NOT_GIT` when the working tree contains untracked files (e.g. newly
added asset GLBs under a package's `public/`). The diff collection step chokes
instead of degrading gracefully.

**Why:** brand-new files that have never been `git add`ed are not part of a diff;
the helper treats that state as a hard error rather than skipping them.

**How to apply:** when reviewing work that added new (untracked) files, call
`architect` WITHOUT `includeGitDiff` and instead pass the concrete paths in
`relevantFiles`. Only use `includeGitDiff: true` when all changes are to
already-tracked files.
