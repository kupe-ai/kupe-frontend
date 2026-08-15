#!/usr/bin/env bash
# Reverse-sync: kupe-ai/kupe-frontend → iNavLabsResearch/kupe-frontend
#
# Typical fork sync is original → fork. This does the opposite:
# take whatever is on kupe-ai and push it to the original iNavLabsResearch repo.
#
# Usage (from repo root):
#   ./scripts/sync-to-inavlabs.sh              # sync main
#   ./scripts/sync-to-inavlabs.sh main         # same
#   ./scripts/sync-to-inavlabs.sh --force      # overwrite upstream/main if histories diverged
#   ./scripts/sync-to-inavlabs.sh feature-x    # sync a different branch

set -euo pipefail

ORIGIN_URL="https://github.com/kupe-ai/kupe-frontend.git"
UPSTREAM_URL="https://github.com/iNavLabsResearch/kupe-frontend.git"
BRANCH="main"
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-f) FORCE=1; shift ;;
    *) BRANCH="$1"; shift ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "error: not a git repo" >&2
  exit 1
fi

ensure_remote() {
  local name="$1" url="$2"
  if git remote get-url "$name" >/dev/null 2>&1; then
    git remote set-url "$name" "$url"
  else
    git remote add "$name" "$url"
  fi
}

ensure_remote origin "$ORIGIN_URL"
ensure_remote upstream "$UPSTREAM_URL"

echo "Fetching origin (${ORIGIN_URL})..."
git fetch origin

echo "Fetching upstream (${UPSTREAM_URL})..."
git fetch upstream

if ! git rev-parse --verify "origin/${BRANCH}" >/dev/null 2>&1; then
  echo "error: origin/${BRANCH} does not exist" >&2
  exit 1
fi

echo
echo "Will push origin/${BRANCH} → upstream/${BRANCH}"
echo "  from: ${ORIGIN_URL}"
echo "  to:   ${UPSTREAM_URL}"
echo

if git rev-parse --verify "upstream/${BRANCH}" >/dev/null 2>&1; then
  AHEAD="$(git rev-list --count "upstream/${BRANCH}..origin/${BRANCH}" 2>/dev/null || echo 0)"
  BEHIND="$(git rev-list --count "origin/${BRANCH}..upstream/${BRANCH}" 2>/dev/null || echo 0)"
  echo "origin/${BRANCH} is ${AHEAD} commit(s) ahead of upstream/${BRANCH}, ${BEHIND} behind."
  if [[ "${AHEAD}" != "0" ]]; then
    echo "Commits to push:"
    git log --oneline "upstream/${BRANCH}..origin/${BRANCH}"
  fi
  echo
else
  echo "upstream/${BRANCH} does not exist yet — it will be created."
  echo
fi

PUSH_ARGS=(upstream "refs/remotes/origin/${BRANCH}:refs/heads/${BRANCH}")
if [[ "$FORCE" -eq 1 ]]; then
  echo "Force-pushing with --force-with-lease..."
  git push --force-with-lease "${PUSH_ARGS[@]}"
else
  git push "${PUSH_ARGS[@]}"
fi

echo
echo "Done. iNavLabsResearch/${BRANCH} now matches kupe-ai/${BRANCH}."
