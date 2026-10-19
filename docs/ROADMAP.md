# Moduvela roadmap — local capabilities first

**Product rule:** A customer should be able to build, customise, operate, report on, export and back up their business application with no AI installed and no internet.

This table is a **roadmap**, not a statement of implemented features. The current local prototype is not suitable for real business records.

| Priority | Capability | Customer outcome | Verification gate |
| --- | --- | --- | --- |
| P0 | Blueprint designer | Define business entities and fields visually | Custom application without AI |
| P0 | Typed data model | Text, number, date, money, enum, relationships, validation | Schema and invalid-input tests |
| P0 | CRUD + data explorer | Edit records, search, filter, sort and bulk manage | Full lifecycle integration tests |
| P0 | Data portability | CSV/JSON import/export, local backups and restore | Round-trip and restore drills |
| P0 | Workflow engine | Define states, business rules, assignments and approvals | Deterministic transition tests |
| P0 for real usage | Security baseline | Users, session auth, business isolation, RBAC and audit | Threat model and negative auth tests |
| P1 | Application UI | Responsive tables, forms, menus, dashboards and charts | Accessible task scenarios |
| P1 | Scheduling | Reminders, overdue jobs, periodic checks | Local scheduler tests |
| P1 | Distribution | Local installer, self-hosting, upgrades and migrations | Documented install/upgrade/rollback |
| P2 | Integration SDK | Email, calendar, payment, accounting integrations by explicit opt-in | Permission and failure handling tests |
| P2 | Offline collaboration | Synchronise multiple devices and reconcile conflicts | Sync/conflict/recovery tests |
| P3 | Optional AI assistant | Turn a conversation into a draft blueprint, explain settings | Full functionality when AI is absent |

## Current completed foundation
- Python standard-library loopback web server and SQLite data store.
- Deterministic initial templates for garage, audit, salon and general services.
- Owner review and approval before storing records.
- Generic forms from blueprint schema.
- **First non-AI customisation slice:** add a custom section and extend fields before approval.
- **New offline data slice:** create a manual application from scratch, search/edit/delete records, CSV/JSON export (not yet import or backup/restore).

## Next implementation slices
**0.2a:** improve custom designer with edit/rename/delete on drafts and documented JSON export.
**0.2b:** manual application setup, full record CRUD, search and CSV/JSON export — initial development slice implemented. Next: typed fields, stricter validation, pagination and import/restore.
**0.2c:** CSV preview/import and backup/restore.
**0.3:** deterministic state machine and approvals (separate from AI).
**0.4:** properly authenticated and isolated multi-user foundation.

## Scope discipline
Generic industry support comes from reusable primitives, not a huge list of superficial templates. Test against one complete fictional workshop/service-business workflow before claiming broad coverage. AI is not required for the workflow to run.

## Zero-subsidy optional AI policy

Free users do not receive operator-funded LLM calls. A demo stays no-AI. Optional future AI requires customer-funded BYOK, prepaid credits or local inference and server-side rate, token and budget enforcement. See [ADR-0002](ADR-0002-AI-COST-POLICY.md). This policy does not eliminate ordinary hosting and support costs.

## Research and implementation checkpoint

- Supervised compact classifier implemented as **advisory** browser inference: the synthetic held-out evaluation currently underperforms deterministic rules; improve dataset quality before enabling automatic suggestions.
- Synthetic labelled corpus (720 cases) + 24 independent project-authored challenges and 36 manually written design cards; NOT external independent annotation.
- Stateful deterministic workflows (draft/activate/transition) and explicit record links (draft/activate/reference validation) now implemented locally.
- **Not implemented:** role-based approvals, typed numeric/currency fields, cross-device sync, database migrations, secure multi-user permissions, real certificate issuance. No real business data.
