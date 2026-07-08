<#
  BeeCompete - seed GitHub issues for Milestone F + Release R1 (~32 issues).
  Run AFTER setup-github.ps1 (needs the repo, milestones, and labels to exist).
  RUN ONCE: gh issue create has no dedupe, so re-running makes duplicates.
  Usage:  .\scripts\seed-issues.ps1 -Owner hasmika123
  R2 issues are intentionally NOT seeded yet (after the validation gate; vision-prd section 7).
#>
param([string]$Owner = 'hasmika123')

$repo = "$Owner/beecompete"
$F  = 'F - Foundation'
$R1 = 'R1 - Browse-only marketplace'

$issues = @(
  # --- Milestone F ---
  @{ id='F1'; t='Monorepo skeleton + root CLAUDE.md'; m=$F; l=@('phase:1','type:chore'); b='Monorepo skeleton: apps/web, apps/api, packages/ui, packages/config, infra, .github. Root CLAUDE.md already added. Registry: X-platform. Full acceptance criteria at pickup (dev-process 3a).' }
  @{ id='F2'; t='Spring Boot skeleton'; m=$F; l=@('phase:1','type:chore'); b='Java 21, Gradle, modular packages (accounts, catalog, discovery, journey, platform), Actuator, Bean Validation.' }
  @{ id='F3'; t='Next.js skeleton'; m=$F; l=@('phase:1','type:chore'); b='App Router, TS, Tailwind v4, packages/ui via transpilePackages; app shell + light/dark theming + placeholder logo.' }
  @{ id='F4'; t='Postgres + Liquibase baseline + local compose'; m=$F; l=@('phase:1','type:chore'); b='Postgres + Liquibase additive baseline; local docker-compose (postgres + redis).' }
  @{ id='F5'; t='CI (ci.yml)'; m=$F; l=@('phase:1','type:chore'); b='web + API tests, lint, dependency/secret/SAST scans, path filters, caching. NOTE: enabling this unblocks branch protection (setup-runbook section 1).' }
  @{ id='F6'; t='Deploy pipeline (deploy.yml) + Caddy'; m=$F; l=@('phase:1','type:chore'); b='Build images -> GHCR -> SSH to VPS -> pull/restart; Liquibase step; health checks; staging auto-deploy on merge. Caddy reverse proxy.' }
  @{ id='F7'; t='packages/ui baseline (design system)'; m=$F; l=@('phase:1','type:chore'); b='Design tokens (gold #F5C330 / ink #030201, Inter self-hosted) + primitives (button, input, dropdown, card, badge, icon set). Encodes design-brief.md. Flat buttons, ~12px radius, no glow.' }
  @{ id='F8'; t='Observability wiring'; m=$F; l=@('phase:1','type:chore'); b='Sentry (web + api), structured JSON logs, uptime monitor.' }

  # --- R1 data & catalog ---
  @{ id='R1-1'; t='Core schema migration'; m=$R1; l=@('phase:1','type:feat','foundation-hook'); b='Category, CategoryTemplate, Region, Competition, Edition, EditionRegion, KeyDate, Resource, CorrectionProposal + provenance/verification/archived_at. Per locked modeling decisions (domain-model.md section 7: grade encoding, Division on Competition, Edition-level regions, soft-delete D7).' }
  @{ id='R1-2'; t='Category taxonomy + templates seeded'; m=$R1; l=@('phase:1','type:feat'); b='~10 K-12 categories with JSON-Schema validation of attributes (X9).' }
  @{ id='R1-3'; t='Admin curation tooling v0'; m=$R1; l=@('phase:1','type:feat'); b='Minimal internal admin: CRUD for catalog entities, import-review queue (S3 pipeline output), verification/provenance controls. Behind Cloudflare Access at R1; migrates to RBAC at R2-7. Registry X16, DQ13.' }
  @{ id='R1-3b'; t='Corrections intake + review (DQ6)'; m=$R1; l=@('phase:1','type:feat'); b='Public suggest-a-correction form -> CorrectionProposal rows; admin review queue (approve applies diff + audit). DQ15 suggest-a-competition lands here too.' }

  # --- R1 backend ---
  @{ id='R1-4'; t='Catalog API'; m=$R1; l=@('phase:1','type:feat','facet:marketplace'); b='list/detail competitions + editions; verification_state/provenance exposed (M5, M6, DQ1).' }
  @{ id='R1-5'; t='Search & filter API'; m=$R1; l=@('phase:1','type:feat','facet:marketplace'); b='Postgres FTS + pg_trgm; filters (category, grade, region, cost, format, individual/team, deadline), sort (M2, M3, M4, X10).' }

  # --- R1 frontend ---
  @{ id='R1-6'; t='Marketplace: browse + search + filters + sort'; m=$R1; l=@('phase:1','type:feat','facet:marketplace','a11y'); b='Competitions listing page per page-blueprints.md page 2 (4->3 col filter panel, chips, continuous scroll + pagination links). M1-M4.' }
  @{ id='R1-7'; t='Competition detail page'; m=$R1; l=@('phase:1','type:feat','facet:marketplace','a11y'); b='Per page-blueprints.md page 3: header + cover/register, tabbed Key Facts, resources row, related; sidebar (follow, timeline, trust+attribution, claim, correction). M5, M6.' }
  @{ id='R1-8'; t='Resources + affiliate links + disclosure'; m=$R1; l=@('phase:1','type:feat','facet:marketplace','compliance'); b='Resources section + affiliate links + affiliate disclosure (M11, DQ10). COMPLIANCE: FTC disclosure ships with affiliate links.' }
  @{ id='R1-9'; t='Trust/verification badges + maintainer attribution'; m=$R1; l=@('phase:1','type:feat','facet:marketplace'); b='Curated/Verified badges + "Listing maintained by BeeCompete Curation Team" line (DQ13). Verified = subtle green.' }
  @{ id='R1-10'; t='SEO'; m=$R1; l=@('phase:1','type:feat','facet:marketplace'); b='SSG/ISR, metadata/OpenGraph, schema.org Event + BreadcrumbList structured data, clean URLs, per-competition/category landing pages, sitemap (M15).' }
  @{ id='R1-11'; t='Share a competition'; m=$R1; l=@('phase:1','type:feat','facet:marketplace'); b='Share control on detail page (M21).' }

  # --- R1 launch surface ---
  @{ id='R1-12'; t='Legal pages'; m=$R1; l=@('phase:1','type:docs','compliance'); b='Privacy, Terms, Cookie Policy, affiliate disclosure. COMPLIANCE gate - live before public R1.' }
  @{ id='R1-13'; t='Beta tag + disclaimer'; m=$R1; l=@('phase:1','type:feat'); b='Beta tag in nav + disclaimer (beta; data may be incomplete; not official affiliation).' }
  @{ id='R1-14'; t='Privacy-first analytics'; m=$R1; l=@('phase:1','type:chore','compliance'); b='Cloudflare Web Analytics + PostHog (cookieless). NOT standard GA (child-directed). X20.' }
  @{ id='R1-15'; t='Waitlist / email capture'; m=$R1; l=@('phase:1','type:feat','facet:marketplace'); b='Waitlist/newsletter capture via Brevo (M26 precursor / R0).' }
  @{ id='R1-15b'; t='Listing-page captures (no accounts)'; m=$R1; l=@('phase:1','type:feat','facet:marketplace'); b='Per-competition follow-by-email (M29), suggest-a-competition (DQ15), "Are you the organizer?" host CTA -> host waitlist (H46). Queue/Brevo-backed, no accounts.' }
  @{ id='R1-16'; t='In-app bug/feedback report'; m=$R1; l=@('phase:1','type:feat'); b='In-app bug/feedback report routed to issues + Sentry context (DQ7 precursor).' }
  @{ id='R1-17'; t='R1 release gate'; m=$R1; l=@('phase:1','type:chore','compliance','a11y'); b='GATE: a11y (WCAG AA) on public pages, WAF/rate-limit on, backups restore-tested, legal pages live, legal foundation done (entity + insurance + trademark, runbook 1b), content gate met (>=200 listings, all categories, verified dates, top-50 full) -> tag R1, deploy to prod.' }

  # --- R1 data seeding (parallel workstream) ---
  @{ id='S1'; t='Seeding strategy spike'; m=$R1; l=@('phase:1','type:chore'); b='Timeboxed ~1 day: confirm sources, master-index columns, extraction-pipeline design; pick keyword-research tool for demand ranking.' }
  @{ id='S2'; t='Master index (300+ long-list)'; m=$R1; l=@('phase:1','type:chore'); b='Compile from aggregator lists, state DoE/GT lists, CTSO/national-org calendars, club pages, prior-year fair sites. Rank by search volume, category coverage, deadline proximity.' }
  @{ id='S3'; t='AI-assisted extraction pipeline v0'; m=$R1; l=@('phase:1','type:feat'); b='Fetch each competition official page -> LLM extracts Spine fields to JSON validated against Category Template schema -> curation queue (R1-3) with provenance=import + confidence. Public web data only, no PII.' }
  @{ id='S4'; t='Curation sprints'; m=$R1; l=@('phase:1','type:chore'); b='Human review/approve every imported record before publish. Write our own descriptions (facts not copyrightable; prose is). Target ~20-30 approved/day once pipeline works.' }
  @{ id='S5'; t='Freshness loop'; m=$R1; l=@('phase:1','type:chore'); b='Weekly stale-date report + re-verification pass keyed to each Edition annual cycle (precursor to DQ2/DQ3).' }
)

Write-Host ("Seeding {0} issues into {1} ..." -f $issues.Count, $repo) -ForegroundColor Cyan
$ok = 0
foreach ($i in $issues) {
  $a = @('issue','create','--repo',$repo,'--title',("{0} - {1}" -f $i.id, $i.t),'--body',$i.b,'--milestone',$i.m)
  foreach ($lab in $i.l) { $a += @('--label', $lab) }
  gh @a | Out-Null
  if ($LASTEXITCODE -eq 0) { $ok++; Write-Host ("   + {0}" -f $i.id) } else { Write-Host ("   ! FAILED {0}" -f $i.id) -ForegroundColor Red }
}
Write-Host ("Done: {0}/{1} created." -f $ok, $issues.Count) -ForegroundColor Green
Write-Host "Next: open the Project board and add these issues (or set the board to auto-add from the repo)."
