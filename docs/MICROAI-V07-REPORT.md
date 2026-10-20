# MicroAI v0.7 — adaptive on-device intelligence

**Stage:** experimental; updated 20 October 2026. Moduvela's regular application engine still requires no AI, external account, GPU or cloud. Business-owner review and server-side schema validation remain mandatory.

## What was implemented

We now provide **three entirely optional capability levels**, separate from the deterministic application runtime:

| Level | Model and mode | Indicative model weights | First-run connectivity | GPU |
| --- | --- | --- | --- | --- |
| Base | Our own supervised quantised MicroAI v2 | 16 KiB | None | No |
| Enhanced semantic — CPU | Xenova/all-MiniLM-L6-v2, q8 through Transformers.js | ~23 MB | First download | No |
| Enhanced semantic — GPU | Same model, fp16 through Transformers.js | ~45 MB | First download | WebGPU |
| Deep generative — small | Qwen2.5-0.5B-Instruct, q4f16 | ~483 MB | First download | WebGPU |
| Deep generative — larger | Qwen2.5-1.5B-Instruct, q4f16 | ~1.22 GB | First download | WebGPU |

All sizes refer to **model weights**, not the total package, GPU memory, disk cache or actual RAM. Browser limits vary. Even a GPU detected by WebGPU may be unable to run either large model.

**No paid AI inference API is called.** The two enhanced modes use local browser inference with pretrained third-party models. The JavaScript runtime and model files are fetched from external providers *only after an explicit user action*. Subsequent offline use depends on cache availability and runtime support. External providers can observe model-download requests and related network metadata; the intended application flow does not submit users' business descriptions to a hosted inference endpoint. External third-party JavaScript must be pinned, reviewed and preferably self-hosted before production.

## What this can do

- The baseline 16 KiB classifier is available immediately and continues to work without external downloads.
- Optional CPU/WebGPU **semantic matching** maps user descriptions to 24 reviewed data-section types, not only the original eight keyword categories. Semantic similarity is not a calibrated probability and has **not been accuracy-benchmarked against real business requests**.
- On sufficiently capable WebGPU devices, a pretrained local generative model can propose **business-specific** record names and fields. The user can explicitly add those sections to an unapproved draft. No suggestions are inserted silently.
- Generated relationships and workflow stage names can be displayed as **inert design ideas**. The actual workflow and relationship engines are configured and activated separately through deterministic controls.
- Before loading large models, the UI checks whether WebGPU is exposed and reports approximate browser-visible CPU and RAM information, without misrepresenting this as a VRAM or compatibility test.

## Safety and operational boundaries

- The generative model output is **untrusted**. Only validated, bounded JSON object names and simple field identifiers are retained; all arbitrary code, permissions, accounts, guards and executable workflow content are discarded.
- The parser limits sections and fields, rejects duplicate identifiers and reserved names, and refuses invalid JSON.
- Relationship references and proposed state lists must refer to generated entities and comply with strict identifier rules. They are **never executable configuration**.
- Only a direct user action can move a generated section into a draft. Importing and approval remain separate stages.
- Unsupported manager approvals, role-based authorisation, secure multi-user operations and production-ready data handling remain unimplemented.
- The project currently has **no proper identity/access controls**. Do not enter confidential customer data or use this for a real business.

## Important testing distinction

The published GitHub CI runs verify:
- Local deterministic Python tests and HTTP routes.
- Unit tests for semantic similarity, schema filtering and two injected/mocked local inference pipelines.
- No generated workflow can execute code or grant privileges through the model parser.
- The previously documented v2 classifier training and reproducible synthetic benchmark.

**CI does not download or execute the optional MiniLM or Qwen model weights on an actual end-user CPU/GPU.** Real browser compatibility, ONNX runtime downloads, download completion, browser caching and actual model behaviour are **not yet verified**. They must be tested locally using different browsers and hardware before claiming these as reliable production features.

## Run and test locally

From the VS Code terminal in your existing clone:

```powershell
git status
git pull origin main
node --test experiments/microai/*.test.mjs
python -m unittest discover -s tests -v
python -m moduvela.server
```

Open `http://127.0.0.1:8765/microai/`, then refresh with `Ctrl+Shift+R`.

The core designer opens without any large model download. For the first optional semantic test, choose **CPU / WebAssembly** and explicitly click **Download & run enhanced model locally**. It will download model assets from external sources once, then run local inference. For high-memory WebGPU devices, the larger generative options are **experiments only** and require a separate click and confirmation.

If any optional tier fails to load or produces invalid JSON, **do not treat this as a core failure**. The deterministic designer and small trained v2 model still work. The optional model cannot auto-activate business rules.

## Next measured engineering gates

1. Run complete opt-in downloads and generated responses on real hardware (4/8/16 GB laptops plus a suitable GPU desktop).
2. Record compressed transfer size, first-load time, local inference latency, peak memory, failure rate and GPU fallback. Do not infer VRAM from navigator.deviceMemory.
3. Create an independently permissioned, multi-sector benchmark and compare zero-shot semantic and generative suggestions against the deterministic baseline; track false positives and omitted critical requirements.
4. Self-host/pin and integrity-check the browser runtime and model artefacts before production. Avoid depending on a third-party CDN for security-sensitive business data.
5. Consider small-domain adapter fine-tuning and local model caching only after real independent evaluation justifies it.
6. Harden authentication, tenant isolation, record encryption, backup and workflow permissions before onboarding real businesses.

**Product principle:** more capable local intelligence when a user explicitly chooses it, never a compulsory AI download and never operator-subsidised inference calls.
