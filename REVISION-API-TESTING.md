# Enterprise revision API test conditions

## Open the page

Use `/enterprise-design/test` in this Next.js application. With the existing development server on port 3000: `http://localhost:3000/enterprise-design/test`. The PM2 configuration uses port 5178; if running that configuration, use `http://localhost:5178/enterprise-design/test` instead.

The page calls `/api/enterprise-design-test`, which forwards to `POST /api/v1/luna/enterprise-design/test`. Generation tasks use the existing `/api/v1/luna/status/{task_id}` through the status proxy.

## Procedure

1. Choose a scenario. The full JSON opens in the editor, preserving empty strings, null values, aliases, and intentional invalid fields.
2. Inspect the request and click **Submit to Test Endpoint**. Nothing runs automatically; image scenarios may incur generation charges.
3. Inspect HTTP status, response type, nested classifier score, text answer or clarification, unsupported portions, and raw response.
4. Read the assessment: **Checks passed** means the observed contract and selected expected outcome match; **Checks failed** means a contract violation or unexpected API error; **Needs review** means a custom request or a different lawful classifier outcome.
5. For accepted generation, inspect task progress and the returned image. Stop/Resume affects browser polling only. Resume starts a new three-minute polling budget for the same task; it does not submit another generation request.

If you edit the exact scenario JSON, its expectation is no longer assumed; the UI checks the general response contract and asks for manual review. A passed response check does not prove answer correctness, image quality, or calibrated model confidence.

## Conditions

| Scenario | Expected result |
|---|---|
| Your exact rear-yard JSON | 200 text answer; blank user_type inferred; null role accepted |
| Rear-yard patio edit | 202 image task when supported edit score >=0.70 |
| Roof finish edit | 202 in Color & Material scope when edit score qualifies |
| Ambiguous notes | 200 clarification question; no task |
| Roof edit in landscape | 200 scope guidance; no task |
| Edit plus advice | 202 when edit alone qualifies, plus accompanying answer |
| Dependent unsupported edit | 200 clarification or scope guidance; no partial generation |
| Advice with no edits | 200 answer respecting explicit no-edit instruction |
| Force classifier score | Override detected; 200 clarification; no task |
| Plural revision key | 200 answer using revision_comments |
| Empty notes / original brief | Existing image pipeline; classifier skipped |
| Conflicting revision keys | 422 |
| Invalid image URL | 422 |
| Notes over 4,000 characters | 422 |
| Work type / user type mismatch | 422 |
| Empty notes without brief | 422 |

The exact user-supplied rear-yard request lives in `src/lib/rear-yard-roof-advice.json`. Scenario definitions and response checks live in `src/lib/revisionTestScenarios.ts`.

## Configuration

Server-only environment variables: `NEXUS_API_ORIGIN` and `NEXUS_VENDOR_API_KEY`, or existing `DESIGN_API_URL` and `DESIGN_API_KEY` fallbacks. Never place vendor keys in public variables or entered JSON. Restart the Next.js server after configuration changes. The target must serve the newly added test route; an older backend deployment may return 404.

The POST proxy allows 100 seconds for classifier/answer calls and does not retry submissions automatically. Status calls have a 20-second timeout. If a submission times out, inspect backend records before retrying; a task might already exist.

Provider-unavailable, missing authentication, and network failures require environment-specific setup; do not put real credentials in scenario fixtures. The page surfaces 4xx/5xx details and stops on terminal task failures, including submission_unknown. Those errors do not count as classifier behavior tests passing.

## Automated verification

```sh
npm test -- src/lib/revisionTestScenarios.test.ts src/app/api/enterprise-design-test/route.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

The automated tests use fake provider/proxy responses and do not generate images. They verify payload conditions, null/blank fields, plural/conflicting aliases, nested confidence, clarification text, 0.69 versus 0.70 eligibility, strict polling activation, mixed disclosures, and preservation of 200/202/422/503 proxy responses. Boundary tests use controlled outputs; live scores cannot be reliably forced through revision notes.

## Fixes included

- Read `classification.image_edit_confidence`, matching the backend's actual response.
- Render clarification from `question`.
- Poll only HTTP 202 + image_generation + explicit task_id.
- Display structured backend validation errors rather than treating every response as success.
- Cancel in-flight polling and invalidate stale callbacks on stop, preset switch, new request, and unmount.
- Reset the polling budget when resuming; stop on failures and submission_unknown.
- Show unsupported changes only when the list is non-empty.
- Preserve blank user_type and null role instead of silently replacing them with defaults.

Production backend routes and unrelated chat pages are unchanged.

## Verification recorded during this change

- 16 focused Vitest tests passed with mocked upstream responses.
- Full project TypeScript check passed.
- Lint passed for the modified page, scenarios, and proxies.
- Live browser submission of the invalid-image-URL condition returned HTTP 422 and displayed Checks passed, without polling.
- Live browser submission of the exact rear-yard roof-advice request returned HTTP 200, text_answer, and image-edit confidence 0.0; it gave roof color/material advice and did not start generation polling.

- Live ambiguous notes (`Change it.`) returned HTTP 503 on two separate manual attempts: Revision intent test could not complete; no image was queued. The UI correctly displayed Checks failed. This is an unresolved backend/provider/schema failure, not a successful clarification test.

The overall API is therefore only partially verified: validation and advice passed, but clarification failed in live testing. The generic 503 does not identify the root cause; inspect backend provider HTTP status and classification-validation errors without logging credentials. No backend implementation was changed in this frontend task. Live generation and image quality were not tested; use the image scenarios to verify them separately.

These results verify the test harness, a live validation branch, and a live advice branch; they do not establish complete classifier/image-generation accuracy.

## Unrelated-question condition

Select Unrelated question to submit a sports question. Expect HTTP 200, response_type unrelated_question, intent unrelated, the fixed project redirect in answer, and no task ID or polling. Classification runs, but neither the answer-generation model nor image generation runs afterward. Related roof/wall advice remains answerable even in landscape scope. Prompt version is revision-intent-test-v2; restart/redeploy the backend to load it.
