#!/usr/bin/env bash
set -euo pipefail

ticket=${1:?usage: bin/worktree-down.sh <ticket>}
[[ "$ticket" =~ ^gh-[0-9]+$ ]] || { echo "invalid ticket: $ticket" >&2; exit 1; }
repo=$(git rev-parse --show-toplevel)
worktree="$repo/../.worktrees/serverfiles/$ticket"
[[ -d "$worktree" ]] || exit 0
git worktree remove "$worktree"
git worktree prune
