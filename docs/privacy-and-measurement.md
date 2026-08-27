# Privacy and measurement boundaries

## 1. Scope

This document covers audited app/proxy code and the offline demo, not deployment certification. It does not certify hosting, provider retention, authentication, compliance, privacy, or production security.

## 2. Data-boundary table

| Stage | Data | Storage | Network boundary | Verified status |
| --- | --- | --- | --- | --- |
| Capture/import | Originals; project/subject/item, result, confidence, role | Application Support files; SwiftData state | None | Verified |
| Share staging | Temporary attachments and manifest | App Group staging | Local process boundary | Removed after SwiftData import or recovery; staged imports may remain |
| Local preprocessing | Apple Vision OCR; up to four JPEGs, 2,048-pixel edge, quality 0.85, 16 MiB total | In-memory; not separately persisted | None until submit | Verified |
| Proxy request | Project/subject/item, result/confidence, language, roles, selected memory, OCR text/quality, base64 derivatives | Transient request body | App to HTTPS proxy | Encoding verified; deployment unverified |
| OpenAI Responses API | Prompt, context, memory, role hints, policy-selected OCR, derivatives | `store: false` | Proxy to OpenAI | Construction verified; this alone does not define retention/infrastructure behavior |
| Post-response validation | Outcome, nullable point, memory evaluations, guidance, confidence, versions | Memory until valid | Through proxy | Shape, bounds, classifications, memory, and versions checked |
| Local persistence | Outcome/guidance, provisional or confirmed feedback, comparison/review state, originals | SwiftData and Application Support | None | Verified path |
| Proxy logging | Timestamp/request ID, counts, model/versions, outcome, latency, usage, estimate, operational categories | Deployment logger | Hosting logs unverified | Code omits titles, OCR strings, images, and feedback; tests do not cover external logs |
| Public offline demo | Synthetic JSON/SVG and mock outputs | Repository and memory | Guarded `fetch`; zero attempts | No key, live provider, or live metrics |

Diagnostics record counts, not learner text. An opt-in Xcode inspection can print OCR text; it is excluded from Production Release and should not use learner material.

## 3. Measurement-availability table

| Metric | Existing source | What it measures | Public offline value | Limitation |
| --- | --- | --- | --- | --- |
| Model ID | Runtime config; static persistence label | Configured versus recorded model | `gpt-5.6-terra` configured, not measured | These can drift; capture provider-returned ID later |
| Prompt version | Constant and validated metadata | Prompt revision | `linxol-feedback-v2.3` configured | Not quality |
| Schema version | Constant and validated metadata | Wire revision | `linxol-feedback-schema-v2` configured | Not quality |
| Input tokens | `usage.input_tokens` | Provider-counted input | **Not measured in the public offline demo.** | Live response only |
| Cached input | `usage.input_tokens_details.cached_tokens` | Cached input portion | **Not measured in the public offline demo.** | Estimator lacks separate rate |
| Output tokens | `usage.output_tokens` | Provider-counted output | **Not measured in the public offline demo.** | Live response only |
| Reasoning tokens | `usage.output_tokens_details.reasoning_tokens` | Output breakdown | **Not measured in the public offline demo.** | Logged separately; not added again |
| Total tokens | `usage.total_tokens` | Provider total | **Not measured in the public offline demo.** | Mock values are not measurements |
| App latency | First client send through receipt and validation, including retry | Client round trip and validation | **Not measured in the public offline demo.** | Excludes encoding/initial authorization |
| Proxy latency | Decode through security/quota/provider/validation/finalization, before send | Server handling | **Not measured in the public offline demo.** | Excludes client network/validation; do not combine timers |
| Estimated cost | `(input × configured input rate + output × configured output rate) / 1M` | Configured calculation | **Not measured in the public offline demo.** | Not billed cost or fully category-aware |
| Measurement time | Future run record | Live sample time | **Not measured in the public offline demo.** | Docs access is not measurement |
| Pricing-source date | Official source access | Consulted publication date | 2026-08-27 UTC | Not a case result |

Official sources were accessed 2026-08-27 UTC. The [Responses reference](https://developers.openai.com/api/reference/resources/responses/methods/create/) defines the response usage object. The audited code reads provider-reported input, cached-input, output, reasoning, and total-token fields. The [pricing page](https://developers.openai.com/api/docs/pricing) separately lists uncached input, cached input, cache writes, and output; the [model page](https://developers.openai.com/api/docs/models/gpt-5.6-terra) identifies `gpt-5.6-terra`. Standard short-context rates per million tokens were $2.00 input, $0.20 cached input, $2.50 cache write, and $12.00 output. Inputs above 272K tokens use different long-context rates. These are published rates, not measured cost; recheck them on the measurement date. The current estimator applies only configured input and output rates, so it is not a complete category-aware billing calculation.

## Optional live measurement plan — not executed

After approval, run exactly three identical, production-aligned requests with the same synthetic case—never learner data. Rasterize its evidence if SVG is unsupported. Record separately; do not average outliers or call this a benchmark. Keep credentials outside the repository and do not commit unnecessary raw responses.

| Run | UTC timestamp | Actual model ID | Prompt version | Schema version | Input tokens | Output tokens | Wall-clock latency | Estimated cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |  |

Wall-clock latency spans immediately before send through validated receipt, matching the app timer rather than the proxy timer. Add token-detail columns only when returned and needed for pricing.

Use actual provider usage and that day’s official price. Apply each category, record the formula, and label `estimated cost`, not billed cost. Use `not calculated` without exact-model pricing.

> **Approval gate:** No live request may be made until the user explicitly approves the three calls.
