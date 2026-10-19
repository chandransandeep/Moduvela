# Moduvela MicroAI — product quality and limitations

**Stage:** v0.3 experimental. Dependency-free browser text classifier + offline domain planner.
This is **not** a miniature LLM and should not be marketed as general-purpose generative AI.

## What is usable now

- Recognition of common business record sections from plain English.
- Separate clause analysis to handle multiple requests in one paragraph.
- Detection of a few explicit exclusions, such as "we do not need invoices."
- Human-readable evidence snippets for suggested entities.
- Reviewable, non-executable relationship suggestions.
- Basic monetary threshold extraction for approval wishes (e.g., "over £500").
- Explicit questions when thresholds, roles or lifecycle details are missing.
- Browser UI to select record sections, download a blueprint and submit a draft to the local Moduvela server.
- No AI account, model download, API, GPU or external network needed for inference.

The Python runtime verifies the imported draft and **does not approve it automatically**. Its entity fields are still text only. All workflow rules and relationships shown by MicroAI are suggestions, not functioning business logic.

## How to run

From the repository root:

```powershell
git pull origin main
python -m unittest discover -s tests -v
python -m moduvela.server
```

Open **http://127.0.0.1:8765/microai/**.

In the designer: describe a fictional business, analyse, select sections, examine assumptions, click **Save draft in Moduvela**, then inspect the unapproved draft. Approval in the server is a *separate* user step.

Standalone static review is still available via `python -m http.server 8000 --bind 127.0.0.1` at `/experiments/microai/`, but saving directly to the Moduvela server is intentionally disabled for that separate origin. JSON export still works there.

Run all browser-interpreter tests with Node 20+:

```powershell
node --test experiments/microai/*.test.mjs
node experiments/microai/evaluate.mjs
```

## Current model, realistically

The small classifier uses hand-authored **synthetic** examples, weighted term matching and business-term patterns. These are not learned general semantics. It can misread negation, implied relationships, multilingual requests, unusual terminology and complex workflow conditions. Reported nearest-example similarity is **not calibrated confidence**.

The evaluation script contains 20 hand-authored synthetic examples and reports recall/precision relative to their labels. Those examples are not independent business data or an unbiased research benchmark. Do not claim measured general accuracy from them.

## Next meaningful model milestone

1. Define a stable ontology for data objects, events, tasks, conditions, roles and relationships.
2. Create a consented labelled dataset of independent descriptions across varied industries; strictly separate training, validation and held-out test businesses.
3. Benchmark a lightweight character/word n-gram classifier against the current hybrid. Use a small quantised ONNX/WASM model only if the gains justify size and CPU cost.
4. Add slot extraction (amount, currency, deadline, approver role, trigger, target record), negation/ambiguity tests and human corrections.
5. Measure precision, recall, false-approval suggestions, download size and first-run time on ordinary 4 GB / 8 GB laptops.
6. Introduce a guided correction workflow that updates a draft rather than silently applying assumptions.
7. Refuse unsupported or high-risk requests and ask clear questions before saving.

**Success criterion:** someone can define a useful small-business application after a short guided review, even if MicroAI is fully disabled. Inference size is less important than the accuracy and safety of the resulting blueprint.

## v0.4: correct the generated blueprint before saving

The Blueprint Designer now permits renaming suggested sections, editing fields, excluding sections, changing the application name and adding new sections. Validation runs on the device before JSON export or import; the Python server independently validates imports. Corrections do **not** train a model or leave the browser automatically. The output remains a draft with **no executable workflow rules**.
