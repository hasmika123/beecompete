# RFC — Phase 1: Auth, Parental Consent & Guardian/RBAC

**Status:** Draft for approval · **Last updated:** 2026-07-18 · Depends on: `domain-model.md`, `architecture.md`, `compliance.md`

The hardest, most compliance-sensitive subsystem in Phase 1 — the gate for the **R2 accounts launch**.
This RFC designs identity, the COPPA parental-consent flow, guardianship, and RBAC.

> ⚠️ Compliance-critical. **Counsel must review** the consent method and privacy disclosures before R2.

## Decisions locked (clarify gate)
1. **Under-13 = parent-managed** (parent creates/consents; 13+ self-register). Supports all of K-12.
2. **Consent method = "email-plus" now**, upgrade to a stronger method later (triggers below).
3. **Account creation = both student- and parent-initiated.**

Reminder: **R1 (browse-only) needs none of this.** All of the below is for **R2** (accounts + tracker).

---

## 1. Actors & roles at R2

Active now: **Student (13–17)**, **Student (under-13, parent-managed)**, **Parent/Guardian**, **Admin**.
Modeled but inactive (slot in later): `HOST_OWNER`, `HOST_STAFF`, `JUDGE`, `EDUCATOR`, `COACH`.

## 2. Age gating

- **Neutral age screen** at signup — ask **date of birth** (never "are you 13+?", which invites lying). COPPA-compliant neutral gate.
- Bands: **under-13** → parent-managed consent flow · **13–17** → minor, self-register (minor protections apply) · **18+** → adult.
- DOB is stored anyway (drives eligibility filtering). No precise geolocation collected.
- If we later gain **actual knowledge** a user is under-13 (e.g., they tell us), we remediate to the under-13 path.

## 3. Account state machine

| State | Meaning | Can use app? |
|---|---|---|
| `PENDING_EMAIL` | 13+/adult, awaiting email verification | No |
| `PENDING_CONSENT` | under-13, awaiting verifiable parental consent | **No — inaccessible** |
| `ACTIVE` | verified/consented | Yes |
| `SUSPENDED` | locked (safety/abuse/consent revoked) | No |
| `DELETED` | soft-deleted, then purged | No |

Under-13 accounts are **inaccessible until a parent consents** (`PENDING_CONSENT` → `ACTIVE`).

## 4. Registration flows

**A — 13+ student self-registration**
Age screen (DOB→13–17/18+) → email + password (or Google) → email verification (`PENDING_EMAIL`→`ACTIVE`) → progressive profile (grade, interests, region). Minor protections apply for 13–17 (no ad-targeting/selling). Optionally invite a parent for oversight (not required by COPPA for 13+).

**B — Under-13, student-initiated**
Age screen→under-13 → student gives minimal info **+ parent's email** (collecting child+parent contact solely to obtain consent is permitted) → account `PENDING_CONSENT` (inaccessible) → system emails parent → parent completes **email-plus consent** (§5) → `ACTIVE`, `GuardianLink` created. If no consent within the grace window → **purge** the provisional child data.

**C — Parent-initiated**
Parent registers (adult, verifies email, `ACTIVE`) → adds child(ren) from dashboard → for under-13, parent gives consent inline (they are the parent, present) → child `ACTIVE`, `GuardianLink` created. Parent gets oversight (PA1/PA2/PA4).

**D — Linking**
Student who self-started (B) links to an existing parent, or a parent claims an existing child account — the *existing* side must confirm (prevents hijacking a child account).

## 5. Verifiable parental consent — "email-plus"

Permitted because at R2 a child's data is **internal-use only** (not disclosed to third parties).

1. Parent receives an email stating **what** we collect, **why**, their **rights**, and a **consent action**.
2. Parent completes the consent action (unique, single-use, expiring link → affirmation form).
3. **The "plus":** a **confirmatory second step** — a follow-up confirmation email (and/or short delay) with an easy **revoke** path — to reduce the chance a child self-consents.
4. Record a **`ConsentRecord`** (parent email/identity, timestamp, method, scope, disclosures version, IP, confirmation).
5. Ongoing **parental controls**: review the child's data, refuse further collection, revoke, delete.

**Upgrade triggers → stronger method required later** (card/ID/signed form):
- Child data is **disclosed to a third party** (host registration, Phase 3; public profile/team-finder).
- A **payment card** is added (Phase 2) — the card transaction can itself serve as stronger verification.

> 🔒 **Reminder — do not forget this.** These triggers are pinned as `🔒 Consent-upgrade` markers on the
> features that fire them, so they surface when those features are built: **P3** (Participant+ payment),
> **H4** & **H7** (host/child registration), **M18** (team-finder). When any of those is picked up, the
> email-plus method **must** be upgraded to a stronger verifiable-consent method first.

## 6. Guardianship model

`GuardianLink { id, guardian_user_id, child_user_id, relationship, status(pending|active|revoked), consent_record_id, created_at }`
- One guardian → many children; one child → (R2) one primary consenting guardian (multi-guardian later).
- **Anti-hijack:** parent-initiated (C) is inherently verified; student-initiated (B) requires the parent to act on the emailed consent (proves control of the parent inbox); linking an existing child (D) needs the existing side's confirmation.

## 7. Authentication mechanics

- **Credentials:** email + password, hashed with **Argon2id** (or bcrypt) via Spring Security. Password policy + optional breach check (HIBP k-anon).
- **Email verification:** signed, expiring, single-use token; required before `ACTIVE` (13+/adult).
- **Password reset:** signed, single-use, expiring token; on reset, **revoke all sessions**.
- **Google OAuth login:** allowed, but **still run the neutral age gate** for new users (Google doesn't reliably tell us age). New Google user under-13 → route to parent-consent flow (B/C).
- **Sessions, not JWT (decision 2026-07-07 — replaces the earlier JWT + refresh-rotation design; see ADR 9):** server-side sessions via **Spring Session JDBC (Postgres)**. The session ID lives in an **httpOnly · Secure · SameSite cookie** and is **rotated on login** (fixation protection). No access tokens, no refresh rotation, no reuse detection, no revocation list — revocation is a row delete and takes effect on the **next request**. Sessions survive restarts (Postgres-backed, covered by backups).
- **Session control:** list active sessions (device/UA/IP) + revoke individually; auto-revoke **all** sessions on password reset, consent revocation, suspension. *(Revocation matters for a minors' platform — with server-side sessions it is immediate, with no token-expiry lag.)*

## 8. RBAC

- `Role` (active R2: `STUDENT`, `PARENT`, `ADMIN`) · `Permission` (action + resource) · `Membership` (user↔org↔role, for later org roles).
- **Scoping at R2:** users access **their own** data; a **parent accesses a linked child's** data **only if** an `active` `GuardianLink` exists; **admin** accesses admin tools.
- **Enforcement:** Spring Security method-level + **resource-ownership checks** on every API call (the real gate); Next.js middleware guards routes for UX only. Never trust the client.
- Built on the general RBAC model so host/judge/educator roles slot in later without rework.

## 9. Data model additions (updates `domain-model.md`)

New/confirmed entities for this subsystem:
- **`ConsentRecord`** *(new)* — `id, child_user_id, guardian_user_id, method, scope, disclosures_version, granted_at, confirmed_at?, revoked_at?, ip` — the COPPA audit record.
- **`AuthCredential`** — `user_id, provider(local|google), password_hash?, google_sub?`
- **`Session`** — Spring Session JDBC schema (Postgres) + `user_agent, ip` metadata columns for the session-list UI. *(No `RefreshToken` / token-family entity — superseded by server-side sessions, 2026-07-07.)*
- **`AuthToken`** — `id, user_id, type(email_verify|password_reset|consent), token_hash, expires_at, used_at?`
- Confirmed from domain model: `User(status, email_verified_at, primary_persona)`, `ParticipantProfile(date_of_birth, grad_year → derived grade, region, interests)`, `GuardianLink`, `Role/Permission/Membership`.

## 10. Data minimization & parental rights (COPPA)

- **Collect only:** email, credential, display name, DOB, grade (stored as `grad_year`), region, interests (interests optional/progressive). No precise geolocation; no behavioral ad profiling; privacy-first analytics only.
- **Parental rights** (from parent dashboard, any time): **review** the child's data, **refuse further collection**, **revoke consent**, **delete** the child's data/account. Revoke → suspend/delete.
- **Retention:** purge unconsented provisional child data after the grace window; honor deletion promptly.

## 11. Security considerations

- **Rate limiting** (Redis + Cloudflare) on login / signup / reset / consent endpoints.
- **Account-enumeration protection** — uniform responses on signup & reset.
- **Brute-force** — progressive backoff / lockout.
- **CSRF** — SameSite cookies + CSRF tokens on state-changing requests through the BFF.
- **Session security** — session ID rotated on login (anti-fixation); httpOnly cookie (no JS access); server-side revocation is immediate; sessions expire on inactivity + absolute lifetime.
- **Consent-link security** — single-use, expiring, unguessable; the "plus" step blocks child self-consent.

## 12. Edge cases

| Case | Handling |
|---|---|
| Parent never responds | Purge provisional child data after grace window (COPPA). |
| Child turns 13 | Optionally transition to self-managed with notice; parent oversight stays optional. |
| Wrong/typo parent email | Resend / correct-email flow; nothing activates without real parent action. |
| One parent, many kids | Fine — one guardian, many `GuardianLink`s. |
| Student lies about age (says 18) | Neutral gate = reasonable effort; remediate on actual knowledge. Don't design to encourage. |
| Duplicate email (local + Google) | Unique email; offer to link providers. |
| Child-account takeover attempt | Linking an existing child requires the existing side's confirmation. |

## 13. R2 scope vs. deferred

**Ships at R2:** neutral age gate · 13+ self-register · under-13 parent-managed (flows B & C) · email-plus consent · guardian links · email/password + Google · email verification · password reset · server-side sessions with list/revoke · RBAC (student/parent/admin) · parental review/delete · data minimization.

**Deferred (with triggers):** stronger consent method (on third-party disclosure — Phase 3 — or card on file — Phase 2) · host/educator/judge roles (modeled, not activated) · school SSO (Phase 4) · multi-guardian.

## 14. Open items for counsel (before R2)
- Confirm **email-plus** is acceptable for our internal-use-only data at R2, and the exact "plus" step.
- **Retention window** for unconsented provisional child data.
- Privacy-disclosure **wording + versioning** (tie to `ConsentRecord.disclosures_version`).
- Any extra **state-law** treatment for 13–17 minors (some laws cover under-16/18).

## 15. Registry mapping
Implements: **X1** (multi-type accounts), **X2** (parent↔child linking), **X3** (age gate + consent), **X4** (auth + Google), **X5** (RBAC), **X6/X7** (org/membership, reserved), **PA1/PA2** (parent dashboard basics, multi-child), **PA5** (parent approval — foundation). New entity **`ConsentRecord`** to add to the domain model.
