# MicroAI v0.8 — zero-download cross-industry business discovery

**Stage:** Experimental. Designed to run on an ordinary browser/CPU without calling a paid AI provider or requiring any additional model download. This is an extension of the rule-based product planner, not new neural training.

## Reproduced failure

The v0.7 default interpreter returned **no suggested records** for:

> A micro-logistics and subscription platform connecting urban vertical micro-farms with downtown coffee shops and residential households for same-day harvest delivery.

The first trained classifier understands only eight record categories and cannot derive a fresh business ontology from this description. The previous browser UI also showed the *previous* app name, "Drone Repair Workshop", when parsing a new business failed.

## Implemented correction

- The existing classifier is now joined by an **always-available, zero-download, domain-concept composer** using a reviewed local data-section catalogue. It runs in plain JavaScript with no external dependency.
- Added schema types for `Farms`, `HarvestBatches`, `Orders`, `DeliveryRoutes`, and `FarmProducts`, alongside the earlier 24 domain categories.
- The composer identifies explicit records separately from **inferred records**. Inferred entities are suggestions and must be confirmed or deselected by a user.
- Candidate relationships and time-bound delivery wishes are never activated automatically.
- The browser now clears stale application names and prior optional model results when analysing a different description.
- If no safe category is detected, the user can select **Start a blank blueprint** and create their own record sections without running any model.
- Server-side validation and unapproved-draft import remain unchanged. No workflow, recurring billing, logistics optimisation, transport routing, same-day SLA or access-control features are implemented by these suggestions.

## Expected fictional micro-farm design

The reviewable entities include:

| Record section | Interpretation | Evidence |
| --- | --- | --- |
| Farms | Participating micro-farms | Explicit |
| Customers | Coffee shops and households | Explicit, normalised as buyers |
| HarvestBatches | Produce harvest batches | Explicit reference to harvest, plus farming context |
| Subscriptions | Recurring platform subscriptions | Explicit |
| Deliveries | Last-mile delivery records | Explicit |
| Orders | Orders fulfilled through deliveries | **Inferred; confirm** |
| FarmProducts | Crops and products offered by farms | **Inferred; confirm** |

The suggested schema may change as rules and user feedback improve. It is not an independently validated enterprise domain model. In particular, customer types (business vs household), harvest ownership, multi-farm orders and delivery cutoff rules need clarification.

Inert relationship hypotheses include `Farms → HarvestBatches`, `Customers → Subscriptions`, `Customers → Orders` and `Orders → Deliveries`. This is **not** physical database relational modelling or a routed delivery application.

The phrase **same-day** is recognised as a *requested feature that is not yet executable*. Users are asked to clarify the cut-off, delivery coverage, delivery windows and exception handling. Real fulfilment logic has not been generated.

## How to test

In the existing local VS Code checkout, with a clean working tree:

```powershell
git pull origin main
node --test experiments/microai/catalog_planner.test.mjs
node --test experiments/microai/planner.test.mjs
node --test experiments/microai/*.test.mjs
python -m unittest discover -s tests -v
python -m moduvela.server
```

Open `http://127.0.0.1:8765/microai/` and use `Ctrl+Shift+R` to clear the old cached frontend assets. Paste the sample above and click **Analyse requirements locally**.

The expected draft title is **Urban Farm Delivery Platform**, not Drone Repair Workshop. Review and deselect anything irrelevant before saving as an *unapproved* draft.

## Quality limitations

These changes improve a reproducible failure, but remain handcrafted ontology and language rules. There is no robust general-purpose language understanding, independently validated accuracy, generated working subscription billing, optimisation or permission system. Explicit negation and context detection only cover a limited set of wordings. Real business data must not be entered into the unauthenticated prototype.

The optional 23 MB semantic model and larger WebGPU models remain research tiers and are **not required** to complete this scenario.
