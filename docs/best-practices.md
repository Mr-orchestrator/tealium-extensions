# Tealium Best Practices (enforced by this repo)

## Order of operations
Extensions run **Pre Loader → Before Load Rules → After Load Rules → DOM Ready → After Tags**,
in `order` within each scope. Never consume a variable produced by a later scope (rule `ORDER-001`).
Build the data layer and identity in *Before Load Rules*; do vendor tag mappings in *After Load Rules*.

## Consent first
The **Consent Manager** runs first (Pre Loader) and produces `consent_analytics` / `consent_marketing`.
Every Analytics/Marketing tag-feeding extension must **gate** on a consent flag (rule `CONSENT-001`),
and nothing that feeds a tag may run before the consent decision (`CONSENT-002`). This keeps the
implementation GDPR/CCPA-safe by construction.

## Protected variables
`tealium_event`, `customer_id`, `customer_email`, `visitor_id` are protected — they feed GA4, Adobe
and downstream identity stitching. Renaming/removing them fails CI (`PROT-001`) and needs architect
approval. Add new variables instead of repurposing protected ones.

## Self-describing extensions
Every extension declares its facts in the manifest header (`creates`/`uses`/`scope`/`risk`). This
makes impact analysis deterministic and keeps documentation generated, not hand-maintained.

## Versioning & rollback
Publish to Tealium with **Save As** (not Overwrite) so each version is preserved. To roll back, revert
the merge commit (restores the repo state) and re-publish the prior Tealium version.

## Risk awareness
Changes to consent or identity are **critical**; load-order changes and removals are **high**. The
Impact Agent promotes risk by blast radius (how many extensions/tags depend on the change) and flags
when architect sign-off is required.
