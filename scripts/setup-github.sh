#!/usr/bin/env bash
# BeeCompete — GitHub bootstrap (runbook §1).
# Run AFTER `gh auth login`. Idempotent-ish: safe to re-run; existing items just error and are skipped.
# Usage:  bash scripts/setup-github.sh <github-user-or-org>
set -uo pipefail

OWNER="${1:?Usage: bash scripts/setup-github.sh <github-user-or-org>}"
REPO="beecompete"
SLUG="$OWNER/$REPO"

echo "==> 1. Create private repo from this directory and push"
# Creates the repo, adds it as 'origin', pushes the current branch.
gh repo create "$SLUG" --private --source=. --remote=origin --push || \
  echo "   (repo may already exist — continuing)"

echo "==> 2. Labels"
label() { gh label create "$1" --color "$2" --description "$3" --repo "$SLUG" 2>/dev/null \
          || gh label edit "$1" --color "$2" --description "$3" --repo "$SLUG" 2>/dev/null; }
# facets
label "facet:marketplace" "F5C330" "Facet 1 — discovery/marketplace"
label "facet:participant"  "5B4B9E" "Facet 2 — Participant+"
label "facet:host"         "2E7D4F" "Facet 3 — Host tools"
# types
label "type:feat"  "1D76DB" "Feature"
label "type:fix"   "D73A4A" "Bug fix"
label "type:chore" "CFD3D7" "Chore / infra"
label "type:docs"  "0075CA" "Documentation"
# phases
label "phase:1" "0E8A16" "Phase 1"
label "phase:2" "0E8A16" "Phase 2"
label "phase:3" "0E8A16" "Phase 3"
label "phase:4" "0E8A16" "Phase 4"
# cross-cutting
label "compliance" "B60205" "Touches COPPA/privacy/legal — hard gate"
label "a11y"       "5319E7" "Accessibility (WCAG 2.1 AA)"
label "foundation-hook" "FBCA04" "Schema must reserve room now"

echo "==> 3. Milestones (F, R1, R2)"
milestone() { gh api "repos/$SLUG/milestones" -f title="$1" -f description="$2" >/dev/null 2>&1 \
              && echo "   + $1" || echo "   ($1 may already exist)"; }
milestone "F — Foundation"            "Skeletons, CI/CD, observability (phase-1-plan.md Milestone F)"
milestone "R1 — Browse-only marketplace" "Public browse-only launch; light compliance (phase-1-plan.md R1)"
milestone "R2 — Accounts + tracker"   "COPPA consent, tracker, the core beta (phase-1-plan.md R2)"

echo "==> 4. Branch protection on main (require PR + status checks, no direct push/force-push)"
gh api -X PUT "repos/$SLUG/branches/main/protection" \
  -H "Accept: application/vnd.github+json" \
  -F "required_status_checks[strict]=true" \
  -F "required_status_checks[contexts][]=ci" \
  -F "enforce_admins=false" \
  -F "required_pull_request_reviews[required_approving_review_count]=0" \
  -F "restrictions=" \
  -F "allow_force_pushes=false" \
  -F "allow_deletions=false" >/dev/null 2>&1 \
  && echo "   protection set" \
  || echo "   (protection needs 'main' pushed first; re-run this step after the first push)"

echo ""
echo "Done. Next:"
echo "  - Create the Project board (Backlog→Ready→In progress→In review→Done) at github.com/$OWNER (Projects)."
echo "  - Seed issues: see phase-1-plan.md; one issue per task (F1..F8, R1-*, S1..S5, R2-*), titled with its ID."
