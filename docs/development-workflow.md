# ClassKru development and release workflow

This workflow supports small, independent changes across multiple devices without blocking unrelated work.

## Work on one task at a time per branch

1. Before starting, run `git status --short`. Keep unfinished work on its existing task branch; do not move, reset, or discard it to start another task.
2. On a device with a clean checkout, fetch the latest `main` and create a task branch from it, for example `fix/score-export-format` or `feat/demo-entry`.
3. If the checkout has unfinished work, use a separate Git worktree or another clean clone for the new task. A worktree is a separate checkout, not a file lock.
4. Make the smallest change that completes the task. Multiple tasks may edit the same file. Git merges independent lines normally; if the same lines changed, resolve only that conflict and keep both intended changes.
5. Stage only the task's intended files or hunks (`git add -p` when a file contains unrelated edits). Review both `git diff --cached` and `git status` before committing.

Do not force-push shared branches, commit unrelated work to a task branch, or use destructive reset/checkout commands to clean a workspace. If the network is unavailable, continue local work if useful, but do not describe the branch as current with `main` or claim a release is ready.

## Review and release

1. Open one pull request per independently reviewable task. State its scope, affected files, checks, and any dependency on another task.
2. Let CI run and review the Vercel Preview for that pull request. A task can be reviewed while unrelated pull requests remain open; do not bundle them just to make progress.
3. Merge only the reviewed pull request into `main`. Production deploys should come from the Vercel integration for `main`, not from a developer's dirty working directory.
4. After merge, verify the production deployment is ready and smoke-test the changed behavior. If automatic deployment from `main` is not configured, stop and configure/verify that integration before calling the task deployed.

Each production deployment contains the full `main` snapshot, including previously merged work. It must not contain unmerged task branches or uncommitted local changes. Independent tasks remain isolated until each pull request is merged.

## Before calling a task complete

- Confirm the branch is based on the latest available `main` and contains only the task's intended changes.
- Run the focused tests and the relevant CI checks.
- Confirm the pull request Preview, then verify the production deployment after merge.
- Report what was merged and deployed separately; a local change, a pushed branch, a Preview, and a production release are different states.
