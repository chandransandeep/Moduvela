# MicroAI: tiny browser-based requirements interpreter

This is an independent, experimental local NLP component for Moduvela. It does **not** require a large language model, a GPU or any AI provider. It runs as static JavaScript, with no external JS packages, model downloads or API calls.

## Try it

From the repository root:

```bash
python -m http.server 8000 --bind 127.0.0.1
```

Visit **http://127.0.0.1:8000/experiments/microai/**, or run `node --test experiments/microai/engine.test.mjs` (Node 20+). Once downloaded, the classifier operates wholly inside the browser. The simple local test server serves only these static files; it is **not** the Moduvela application server.

## How it works

1. Normalise and tokenise the description.
2. Use a small, fixed supervised set of *synthetic* labelled business phrases.
3. Perform weighted bag-of-words nearest-example classification, not generative inference.
4. Select entity categories (customers, jobs, stock, bookings, invoices, staff and inspections).
5. Suggest version-1 Moduvela blueprint entities, with all fields represented as text.
6. Put reminders and approvals in an unsupported-feature list, since the runtime does not yet implement them.
7. Request human review. If the input is out of distribution, ask for clarification.

The classifier is trainable by changing its labelled examples; currently they are shipped as static development examples. It is *not* trained from private user prompts and not benchmarked for real-world accuracy.

## Important limitations

- This is a weak lexical prototype, not a general-purpose English understanding system.
- Similar words can cause false positives, and compound descriptions can miss requirements.
- Similarity scores are **not calibrated confidence probabilities**.
- No arbitrary relation, workflow, field-type or permission generation.
- Do not silently approve or deploy suggested blueprints.
- The demonstration does not integrate directly with the Python application server.
- JavaScript source and examples are loaded through the local static server; inference stays in the browser. A hosted site would still incur normal bandwidth/hosting costs to deliver those assets.

## Path to a genuinely learned lightweight model

After collecting an opt-in, synthetic or consented labelled dataset, benchmark:
- Supervised bag-of-words / fastText-like classification and slot/entity extraction.
- Character n-gram models to handle spelling variation.
- Small quantised ONNX text classifiers running on WebAssembly.
- Schema-constrained suggestion with deterministic questions when uncertain.

Evaluate held-out businesses, adversarial descriptions, ambiguity, languages, memory and inference latency on low-powered devices. Do not claim minimal download size or accuracy until the production bundle is measured.

**Product rule:** the app always works if MicroAI is disabled, removed or completely wrong.
