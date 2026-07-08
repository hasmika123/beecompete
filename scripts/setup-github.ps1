<#
  BeeCompete - GitHub bootstrap (runbook section 1), PowerShell version.
  Run AFTER `gh auth login`. Safe to re-run; existing items are skipped.
  Usage:  .\scripts\setup-github.ps1 -Owner hasmika123
#>
param(
  [Parameter(Mandatory = $true)][string]$Owner
)

$ErrorActionPreference = 'Continue'
$repo = 'beecompete'
$slug = "$Owner/$repo"

Write-Host "==> 1. Create private repo from this directory and push" -ForegroundColor Cyan
gh repo create $slug --private --source=. --remote=origin --push
if ($LASTEXITCODE -ne 0) { Write-Host "   (repo may already exist - continuing)" }

Write-Host "==> 2. Labels" -ForegroundColor Cyan
function Set-Label($name, $color, $desc) {
  gh label create $name --color $color --description $desc --repo $slug
  if ($LASTEXITCODE -ne 0) {
    gh label edit $name --color $color --description $desc --repo $slug | Out-Null
  }
}
Set-Label 'facet:marketplace' 'F5C330' 'Facet 1 - discovery/marketplace'
Set-Label 'facet:participant' '5B4B9E' 'Facet 2 - Participant+'
Set-Label 'facet:host'        '2E7D4F' 'Facet 3 - Host tools'
Set-Label 'type:feat'  '1D76DB' 'Feature'
Set-Label 'type:fix'   'D73A4A' 'Bug fix'
Set-Label 'type:chore' 'CFD3D7' 'Chore / infra'
Set-Label 'type:docs'  '0075CA' 'Documentation'
Set-Label 'phase:1' '0E8A16' 'Phase 1'
Set-Label 'phase:2' '0E8A16' 'Phase 2'
Set-Label 'phase:3' '0E8A16' 'Phase 3'
Set-Label 'phase:4' '0E8A16' 'Phase 4'
Set-Label 'compliance' 'B60205' 'Touches COPPA/privacy/legal - hard gate'
Set-Label 'a11y'       '5319E7' 'Accessibility (WCAG 2.1 AA)'
Set-Label 'foundation-hook' 'FBCA04' 'Schema must reserve room now'

Write-Host "==> 3. Milestones (F, R1, R2)" -ForegroundColor Cyan
function New-Milestone($title, $desc) {
  gh api "repos/$slug/milestones" -f "title=$title" -f "description=$desc" | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host "   + $title" } else { Write-Host "   ($title may already exist)" }
}
New-Milestone 'F - Foundation'                 'Skeletons, CI/CD, observability (phase-1-plan.md Milestone F)'
New-Milestone 'R1 - Browse-only marketplace'   'Public browse-only launch; light compliance (phase-1-plan.md R1)'
New-Milestone 'R2 - Accounts + tracker'        'COPPA consent, tracker, the core beta (phase-1-plan.md R2)'

Write-Host "==> 4. Branch protection on main (require PR + CI check, no force-push/delete)" -ForegroundColor Cyan
$protection = @{
  required_status_checks        = @{ strict = $true; contexts = @('ci') }
  enforce_admins                = $false
  required_pull_request_reviews = @{ required_approving_review_count = 0 }
  restrictions                  = $null
  allow_force_pushes            = $false
  allow_deletions               = $false
} | ConvertTo-Json -Depth 6
$protection | gh api -X PUT "repos/$slug/branches/main/protection" -H "Accept: application/vnd.github+json" --input -
if ($LASTEXITCODE -eq 0) {
  Write-Host "   protection set"
} else {
  Write-Host "   (protection needs 'main' pushed first; re-run this step after the first push)"
}

Write-Host ""
Write-Host "Done. Next:" -ForegroundColor Green
Write-Host "  - Create the Project board (Backlog->Ready->In progress->In review->Done) at github.com/$Owner (Projects)."
Write-Host "  - Seed issues: one per phase-1-plan.md task (F1..F8, R1-*, S1..S5, R2-*), titled with its ID."
