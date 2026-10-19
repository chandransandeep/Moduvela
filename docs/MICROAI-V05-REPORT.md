# MicroAI v0.5 research checkpoint — 19 October 2026

**This is an engineering research build, not a production model.** Local operation requires no hosted inference, external API keys, GPU, or cloud model downloads. All named scenarios are fictional and no employer or client data is used.

## What was built

- **Dataset:** 480 programmatically constructed training examples, 120 validation, 120 synthetic held-out, plus 24 separately hand-written test descriptions and 36 project-authored, annotated design cases across 18 sectors. Not a corpus of externally independently labelled real businesses.
- **Trained model:** supervised multi-label hashed word/character-gram logistic classifier trained with pure JavaScript, saved in a quantised **8,192-byte weight array**. The generated JavaScript module is larger due to encoding/metadata. A tiny browser inference module runs entirely on CPU with no runtime training or inference API.
- **Human review:** both model predictions and deterministic suggestions are shown separately. The trained output is **advisory only**; suggestions do not automatically become deployed entities or workflow logic.
- **Runtime data contracts:** manually configured record-to-record links that reject dangling references, and an explicit draft/activate deterministic state-machine flow with transition history.
- **Workflow UI:** users of the local demonstration can configure allowed states and links, activate them and move fictional records through allowed transitions. No roles or automated manager approval.
- **Quality:** Python integration tests, Node classifier tests, training reproduction check, synthetic evaluation scripts and CI.

## Measured results (published CI output)

| Scenario set | Tiny trained model F1 | Original deterministic interpreter F1 |
| --- | ---: | ---: |
| Synthetic validation, 120 examples | 0.553 | 0.694 |
| Synthetic held-out test, 120 examples | 0.710 | 0.786 |
| Project-authored challenge, 24 examples | 0.760 | 0.831 |

The separate 36-card design annotation test yields **0.902 entity F1** and 0.923 rule-kind recall for the deterministic planner. That collection is hand-authored by the project and not a representative independent test set; those scores must **not** be used as marketing accuracy.

**Decision: do not promote the trained model to authoritative application generation.** Even the higher deterministic scores cannot establish generalisation to real businesses. The current safe default is to show both and ask for human corrections.

## Size and expected resource usage

- Quantised weight array: 8 KiB.
- Inference uses hashed lexical features and a few matrix operations.
- No inference server, no large local LLM and no GPU required.
- Full browser bundle size, cold-start timings, peak RAM and performance on 4 GB devices **have not been benchmarked**; do not claim zero CPU/memory cost.

## Important gaps

- Language understanding beyond known patterns, multilingual requests and negations.
- Independently annotated real-world requirements; training quality currently limited by templated synthetic examples.
- Typed fields, safe migrations, relationship cardinality and richer data model.
- Authenticated users, protected actions, server-side roles and **real manager approvals**.
- Workflow guards, reminders, time-based triggers and certificates.
- Secure hosting/tenant isolation, backup/restore and deployment hardening.

## Offline test and demo

Run from repository root on Windows in VS Code:

```powershell
git pull origin main
python -m unittest discover -s tests -v
node --test experiments/microai/*.test.mjs
node --test experiments/microai/training/*.test.mjs
node experiments/microai/training/train.mjs --check
node experiments/microai/benchmark.mjs
node experiments/microai/training/design_evaluate.mjs
python -m moduvela.server
```

Open [http://127.0.0.1:8765/microai/](http://127.0.0.1:8765/microai/). Review the draft and the trained-model second opinion. Save only synthetic draft data.

For a real state-machine and record-link demonstration, create a fictional approved application with Customers and Jobs sections. Include `customer` and `status` fields in Jobs before approval, then use the **Configure workflow stages** and **Configure record links** links on the Jobs section. Reference a displayed Customer record ID in a Job. All workflow actions still lack user authentication and are for local testing only.

## Next research gate

Before investing in larger models:
1. Obtain permissioned, de-identified and genuinely independently annotated requirements.
2. Introduce scenario, industry and author-separated blind evaluation, with negation and high-risk conditions.
3. Train and compare small char-ngram fastText-like classifiers against the existing deterministic baseline.
4. Measure inference latency, bundle size and memory on basic office devices.
5. Promote trained output only if precision, recall and safety are materially better on locked held-out cases.
