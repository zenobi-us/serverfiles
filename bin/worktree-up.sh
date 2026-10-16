#!/usr/bin/env bash
set -euo pipefail

ticket=${1:?usage: bin/worktree-up.sh <ticket>}
[[ "$ticket" =~ ^gh-[0-9]+$ ]] || {
	echo "invalid ticket: $ticket" >&2
	exit 1
}
repo=$(git rev-parse --show-toplevel)
root="$repo/../.worktrees/serverfiles"
worktree="$root/$ticket"
branch="factory/$ticket"
mkdir -p "$root"
git fetch origin main
if [[ -e "$worktree" ]]; then
	[[ "$(git -C "$worktree" symbolic-ref --short HEAD)" == "$branch" ]] || {
		echo "worktree has the wrong branch: $worktree" >&2
		exit 1
	}
	exit 0
fi
if git show-ref --verify --quiet "refs/heads/$branch"; then
	git worktree add "$worktree" "$branch"
else
	git worktree add -b "$branch" "$worktree" origin/main
fi
