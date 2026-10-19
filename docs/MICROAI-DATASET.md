# MicroAI Business Requirements Dataset & Annotation Protocol

## State of evidence (October 2026)

Our repository contains:
- **480 synthetic training scenarios**, 120 synthetic validation scenarios, 120 synthetic test scenarios, separated by sectors and phrase variants; labels assigned by deterministic construction.
- **24 project-authored held-out classification challenges**, not drawn from the training generator.
- **36 project-authored design annotation cards** across 18 sectors, with record entities, some explicit record links, rule intents and exclusions.

**These are not externally independently labelled production requirements.** Template-derived splits can overestimate generalisation. They are an engineering bootstrap only. Do not represent this as measured real-customer accuracy or claim that 720 independently annotated examples exist.

## Required annotation schema

A complete business design annotation may describe:
- **Entity:** durable record objects and fields (Customer, Job, Invoice etc.)
- **Relationship:** `source entity -> target entity` explicitly requested, not assumed from coexistence
- **Workflow:** states, transitions, events and task ownership, each with evidence spans
- **Rule:** decision/approval/reminder/assignment including actor, subject, trigger, threshold and currency
- **Exclusion:** explicit negative requirement (e.g. "We do not issue invoices")
- **Uncertain:** unresolved references/ambiguous terminology requiring a follow-up question
- **Evidence:** short segment of the submitted requirement supporting a given label
- **Unsupported:** feature not yet supported by Moduvela's runtime

Each item must have provenance, contributor consent for reuse, source type, language, sector and scenario group. Every label should include an evidence span and reviewer's uncertainty decision.

## Privacy and provenance

Accept only clearly fictional content or explicitly permissioned descriptions that have been cleared for publication and training by their owner. Never copy real customer data, employee details, confidential business arrangements, government programmes, credentials, private documents, or workplace materials. If in doubt, do not submit. Avoid scraping forums or private communities for training without validating rights, privacy and permissions.

Use a second human reviewer for a calibration subset. Record disagreements, not a fabricated single "ground truth". Manage a private consent/retraction procedure before introducing real submissions to a public repository.

## Dataset splits and leakage

- Group all variants of one business/problem into the same split.
- Reserve **industries and authors** not present in training for held-out testing.
- Avoid near-identical requirement templates across splits. Current synthetic dataset still shares phrasing patterns and must not count as independent evaluation.
- Never tune thresholds on the locked held-out test.
- Evaluate entity/field precision, recall, exact match, false automation suggestions, relationship precision, negation and guard conditions separately.
- Publish example counts, slice sizes, bootstrap confidence intervals where justified, and edge-case failures.
- Maintain **negative-case fixtures** and unsupported high-risk requirements.

## Local reproducible commands

```powershell
node experiments/microai/training/train.mjs --check
node experiments/microai/benchmark.mjs
node experiments/microai/training/design_evaluate.mjs
node --test experiments/microai/*.test.mjs
node --test experiments/microai/training/*.test.mjs
```

All scripts work offline using Node.js 22+ and the standard library.

## Product usage

The trained classifier is an **advisory second opinion**, not an automatic blueprint generator. The deterministic rule interpreter and the owner's corrections remain authoritative for the proposed *draft*, but even those cannot enable unsupported workflows or permissions without validated runtime controls.
