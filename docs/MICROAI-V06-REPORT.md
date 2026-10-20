# MicroAI v0.6 — lightweight model improvement

**Status:** research prototype, 20 October 2026. Trained CPU/browser inference with no provider API bills. The deterministic Moduvela application engine remains the functional core.

## What changed

A second supervised model was trained using **training-only synthetic augmentation**, with clause-level examples, word and character features, adjacent-word pairs and per-category thresholds selected using the validation split. The training generator produces 5,404 augmented/generated training examples (derived from a limited original set of phrase templates, **not 5,404 independent business descriptions**).

The resulting signed 8-bit model has **16,384 bytes of weights** (versus 8,192 bytes in v1). Source assets and metadata increase download size beyond the raw weights. The generated model is committed, and the CI pipeline verifies that it can be reproduced from source.

### Results: entity classification micro-F1

| Evaluation set | Trained v1 | Trained v2 | Existing deterministic rules |
| --- | ---: | ---: | ---: |
| Validation: 120 synthetic cases | 0.553 | **0.627** | 0.694 |
| Held-out test: 120 synthetic cases | 0.710 | **0.749** | 0.786 |
| Hand-authored challenge: 24 cases | 0.760 | **0.854** | 0.831 |

**Caveat:** All these cases are synthetic or project-authored; no independent real-business generalisation has been established. The small challenge collection is particularly easy to overinterpret. Scores are descriptive test results and not calibrated probabilities.

The model v2 improves over trained v1 across these three sets, but is still worse than the deterministic baseline on the larger held-out synthetic test. It is **not** promoted to authoritative generation.

## Product behaviour

The Blueprint Designer displays v2 as an independent second opinion. If v2 suggests an additional built-in record section that the deterministic interpreter omitted, the user may explicitly **Add to draft**. The user can then rename/edit the fields and separately review and approve the application. Inference cannot directly write records, activate workflows, change permissions or execute model-generated conditions.

When the description explicitly excludes a section, MicroAI does not offer that model-only suggestion for inclusion. The programmatic model has no cloud dependencies, no runtime training and no GPU requirement.

## Reproduction

From the repository root:

```powershell
git pull origin main
node experiments/microai/research/train_v2.mjs --check
node experiments/microai/benchmark_v2.mjs
node --test experiments/microai/*.test.mjs
python -m unittest discover -s tests -v
python -m moduvela.server
```

Open [http://127.0.0.1:8765/microai/](http://127.0.0.1:8765/microai/). Restart the Python server after pulling updates to load the new allowlisted JavaScript modules.

## Research limitations and next gate

- **Dataset quality:** 5,404 training examples do not mean 5,404 independent labelled observations. Most are recombinations of short synthetic source phrases. Higher-quality held-out business-owner annotations are required.
- **Safety:** Approval threshold suggestions are not enforceable authorisation; real roles, access control and guarded workflow transitions remain unavailable.
- **Coverage:** Models only classify eight existing record categories. They cannot invent arbitrary domain models, reliably derive relationships, or understand complex negation and conditions.
- **Privacy:** The prototype has no login or production-grade data security. Test fictional descriptions only.
- **Measured device requirements:** The raw weight count is 16 KiB. Full bundle transfer, cold-load latency and RAM on low-end laptops have not been independently benchmarked.
- **Model design:** It remains a small supervised text classifier, not a compact general-purpose LLM. Human-reviewed deterministic workflows are a prerequisite for real use.

A future model should be promoted above deterministic rules only after blind evaluation on genuinely independent, permissioned examples demonstrates **higher precision with acceptable false-positive behaviour**, plus latency/memory measurements on ordinary laptops.
