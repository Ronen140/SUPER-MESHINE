# Engineering Work Plan: Visual Item Identification Prototype (Round 8)

**Date:** 2026-05-07 19:00
**Source task (CEO brief, verbatim):**
> Build a working prototype of the "Visual Item Identification" feature in 2-3 working sessions. This prototype is for **demo purposes** — we'll record a 90-second screencast and share it with network contacts to generate leads and validate willingness-to-pay. It is NOT production code.
>
> The feature (motivated by primary research): At a real Israeli manufacturer (Amtan Karmiel, ~100 emp, weapons mfg), the warehouse manages hundreds of items that **look visually identical but differ by raw material composition**. Workers cannot tell them apart at the shelf, and the existing ERP can't help.
>
> The MVP flow:
> 1. Worker opens `/identify` route on a phone.
> 2. Uploads a photo.
> 3. Page calls Anthropic API (Claude vision — `claude-opus-4-7` or `claude-sonnet-4-6`) with photo + system prompt that includes seeded inventory catalog.
> 4. Claude returns top 1-3 candidates with confidence + a disambiguating question if confidence is low.
> 5. Worker selects match (or answers question, then sees refined match).
> 6. UI displays full item record: raw material, batch, location, open orders.
>
> Stack: existing `apps/web/`. Use `@anthropic-ai/sdk`. Mock inventory in `apps/web/src/lib/mock-inventory.ts`. Demo photos in `apps/web/public/demo-items/`. `ANTHROPIC_API_KEY` env var. `NEXT_PUBLIC_PROTOTYPE_MODE=true`.
>
> Out of scope: auth, real DB, multi-tenant, audit log, tests beyond a smoke test, Sentry/PostHog, production deploy.

**Relevant ADRs:**
- [[003-stack-architecture]] — Next.js 15 App Router, `@anthropic-ai/sdk` for direct API calls (server-side), shadcn/ui, zod, Tailwind 4, `apps/web/` location
- [[002-multi-tenancy-strategy]] — **explicitly skipped** for prototype (CEO brief)
- [[006-audit-log-and-agent-action-gating]] — **explicitly skipped** for prototype (CEO brief)
- [[005-auth-and-rbac]] — **explicitly skipped** for prototype (CEO brief)

**CLAUDE.md Architecture Invariants — explicit waivers for this prototype (per CEO brief):**
1. ⛔ Multi-tenancy in every row — **WAIVED** (no DB, in-memory mock array only).
2. ⛔ Audit log on every mutation — **WAIVED** (no mutations, no DB).
3. ⛔ Agent-action transaction + human-approval gate — **WAIVED** (Claude is read-only here, no ERP mutations).
4. ⛔ Schema migrations with rollback — **WAIVED** (no schema).
The prototype lives behind `NEXT_PUBLIC_PROTOTYPE_MODE` so it can be gated out of production. Any path that promotes this feature to a real product MUST re-introduce these invariants under a new architect-led ADR.

**Codebase state check:**
- `apps/web/package.json` exists with Next.js 15, React 19, tRPC v11, Tailwind 4, zod 3.23 — no `@anthropic-ai/sdk` yet, must be added.
- `apps/web/src/app/page.tsx`, `layout.tsx` exist (bootstrap from Round 7a). No shadcn `/components/ui` directory yet — shadcn init still required.
- `apps/web/src/lib/` contains only `trpc/` — `mock-inventory.ts` will be new; no conflicts.
- `apps/web/src/app/api/trpc/[trpc]/route.ts` exists; new route handler at `apps/web/src/app/api/identify/route.ts` is parallel and independent.
- `.env.example` already includes `ANTHROPIC_API_KEY` (no edit needed there). `NEXT_PUBLIC_PROTOTYPE_MODE` must be appended.
- No `apps/web/public/demo-items/` directory yet.
- No conflicts with concurrent work — the prototype is a self-contained route + lib + public assets.

## Decomposition

### Subtask 1 — Mock inventory data + demo photo set

- **Assignee:** `backend-builder`
- **Spec:** Create a TypeScript module `apps/web/src/lib/mock-inventory.ts` exporting a typed array of 50–80 realistic Israeli-manufacturing items spanning at least 4 categories (CNC metal parts with steel/aluminum/titanium grade variants, machined fittings, simple electronic components, private-label cosmetic tubs). Several items MUST be visually near-identical but differ by raw material composition (the core demo conceit). Place 8–12 demo image files (public-domain or self-generated stock) under `apps/web/public/demo-items/` and reference them by path in the mock data. Also create the `InventoryItem` TypeScript type and a small helper `findItemBySku(sku)`.
- **Files (predicted):**
  - `apps/web/src/lib/mock-inventory.ts` (new) — exports `InventoryItem` type, `MOCK_INVENTORY` array, `findItemBySku`, `getCatalogForPrompt()` (a compact summary string for the Claude system prompt).
  - `apps/web/public/demo-items/*.jpg` (new, 8–12 files).
  - `apps/web/public/demo-items/README.md` (new, 1 paragraph — source attribution).
- **Acceptance criteria:**
  - `MOCK_INVENTORY.length >= 50 && MOCK_INVENTORY.length <= 100`.
  - At least one **visually-identical-cluster**: ≥ 3 items with the same `visualDescription` field but different `rawMaterial` values (this is what enables the disambiguation demo).
  - Every item has all required fields: `sku`, `name`, `visualDescription`, `rawMaterial`, `batchNumber`, `location`, `openOrders` (array of `{ orderNumber, quantity, dueDate }`), `imagePath` (resolves to a real file under `/demo-items/` or is `null`).
  - `getCatalogForPrompt()` returns a string ≤ 8 KB suitable to embed in a Claude system prompt (token-efficient one-line-per-item format).
  - `apps/web/public/demo-items/` contains 8–12 image files, total size ≤ 5 MB (so the repo doesn't bloat).
  - `pnpm --filter web typecheck` passes (no TS errors introduced).
- **Dependencies:** none.
- **Invariants applied:** N/A (waived per prototype scope).

### Subtask 2 — `/api/identify` route handler with Claude vision call

- **Assignee:** `backend-builder`
- **Spec:** Add `@anthropic-ai/sdk` to `apps/web/package.json`. Create a Next.js Route Handler at `apps/web/src/app/api/identify/route.ts` that accepts a `multipart/form-data` POST with fields `photo` (image file) and optional `disambiguationAnswer` (string). The handler base64-encodes the photo, builds a Claude vision request (model: `claude-sonnet-4-6` per the architectural call below), passes a system prompt that embeds `getCatalogForPrompt()`, and instructs Claude to respond with strict JSON of the form `{ candidates: [{ sku, confidence, reasoning }], disambiguatingQuestion: string | null }`. Parse the response, validate with zod, return as JSON. Add a `?demo=true` query param branch that returns a hardcoded successful response without calling Claude (cost-free demo mode). Add `NEXT_PUBLIC_PROTOTYPE_MODE=true` to `.env.example`.
- **Files (predicted):**
  - `apps/web/package.json` (edit — add `@anthropic-ai/sdk` to dependencies).
  - `apps/web/src/app/api/identify/route.ts` (new).
  - `apps/web/src/lib/identify/prompt.ts` (new — system prompt builder).
  - `apps/web/src/lib/identify/schema.ts` (new — zod schemas for request/response shape).
  - `apps/web/src/lib/identify/demo-response.ts` (new — hardcoded demo payload).
  - `.env.example` (edit — append `NEXT_PUBLIC_PROTOTYPE_MODE=true`).
  - `apps/web/.env.example` (edit if it exists, mirror the same line).
- **Acceptance criteria:**
  - `POST /api/identify` with a JPEG file < 5 MB and no `?demo=true` param returns HTTP 200 with body matching the zod response schema (when `ANTHROPIC_API_KEY` is set). Manually verified once with `curl` or via the frontend in Subtask 4.
  - `POST /api/identify?demo=true` returns HTTP 200 with the hardcoded demo payload **without calling the Anthropic API** (verified: works with `ANTHROPIC_API_KEY=` empty).
  - Request validation: missing `photo` → HTTP 400 with `{ error: "photo required" }`. File > 8 MB → HTTP 413. Non-image MIME → HTTP 415.
  - Response always includes 1–3 candidates (capped at 3 in code), each with `sku` matching a real entry in `MOCK_INVENTORY`, `confidence` between 0 and 1, and a `reasoning` string ≤ 200 chars.
  - Smoke test `apps/web/src/app/api/identify/route.test.ts` (Vitest) — calls the route handler with `?demo=true` and asserts shape. **One test file, ≤ 20 lines.** This is the "smoke test" the CEO brief permits.
  - `pnpm --filter web typecheck` and `pnpm --filter web lint` pass.
  - `pnpm install` from repo root succeeds after the dependency add.
- **Dependencies:** Subtask 1 (consumes `getCatalogForPrompt()` and `MOCK_INVENTORY`).
- **Invariants applied:** N/A. NOTE: this route bypasses tRPC auth/tenant context **intentionally** for the prototype.

### Subtask 3 — `/identify` page UI (mobile-first, shadcn-based)

- **Assignee:** `frontend-builder`
- **Spec:** Build a single-page Client Component at `apps/web/src/app/identify/page.tsx` with three states managed by a state machine (`idle` → `uploading` → `loading` → `result` → optional `disambiguating` → `final`). Use a native `<input type="file" accept="image/*" capture="environment">` for mobile camera capture. Display a loading spinner while the API call runs, then render up to 3 candidate cards (image thumbnail + name + confidence bar + reasoning). If `disambiguatingQuestion` is non-null, show it with a free-text answer input; on submit, call `/api/identify` again with the answer plus the original photo. Selecting a candidate shows the full `InventoryItem` record (raw material, batch, location, open orders table). Add a "Demo mode" toggle in the header that, when on, calls `/api/identify?demo=true`. Use shadcn primitives (`Button`, `Card`, `Input`, `Badge`, `Skeleton`, `Switch`) — run `shadcn init` and add only what is needed.
- **Files (predicted):**
  - `apps/web/src/app/identify/page.tsx` (new — Client Component, `'use client'`).
  - `apps/web/src/app/identify/_components/PhotoUpload.tsx` (new).
  - `apps/web/src/app/identify/_components/CandidateCard.tsx` (new).
  - `apps/web/src/app/identify/_components/ItemDetail.tsx` (new).
  - `apps/web/src/app/identify/_components/DisambiguationPrompt.tsx` (new).
  - `apps/web/src/components/ui/*` (new — shadcn primitives added on init: `button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`, `skeleton.tsx`, `switch.tsx`).
  - `apps/web/components.json` (new — shadcn config).
  - `apps/web/src/lib/utils.ts` (new — `cn()` from shadcn init, if not already present).
- **Acceptance criteria:**
  - Page renders correctly at viewport widths 360px (small mobile), 768px (tablet), 1280px (desktop) — verified visually in Subtask 4.
  - File input has `accept="image/*"` and `capture="environment"` attributes (camera-friendly on mobile).
  - State machine transitions are explicit; no candidate card or item detail is shown until `result` state is reached.
  - Confidence bar shows percentage; styling differs for confidence < 0.6 (yellow) vs ≥ 0.6 (green).
  - "Demo mode" toggle, when ON, makes the next upload call `/api/identify?demo=true` and produces the canned response. When OFF, calls the real endpoint.
  - All text is in English (matches existing app, no Hebrew here — keeps the screencast accessible to international leads).
  - Page-level error state: API returns non-200 → user sees a clear message with a "Try again" button.
  - `pnpm --filter web typecheck` and `pnpm --filter web lint` pass; `pnpm --filter web build` succeeds.
- **Dependencies:** Subtask 2 (consumes `/api/identify`).
- **Invariants applied:** N/A.

### Subtask 4 — Browser verification + demo flow documentation

- **Assignee:** `frontend-builder`
- **Spec:** Run the dev server (`pnpm --filter web dev`), open `http://localhost:3000/identify` in a desktop browser AND simulate mobile viewport in DevTools. Walk the full demo flow in **demo mode** (no API key needed): upload one of the seeded images, see candidates, answer disambiguation, see final detail view. Then run **once with the real Anthropic API** (using a temporary key the founder provides — see open question Q1) to verify Claude vision returns sensible candidates for at least 2 of the demo images. Capture 5–8 screenshots of key states and write a one-page demo-script document.
- **Files (predicted):**
  - `vault/Engineering/2026-05-07-visual-item-identification-demo-script.md` (new — the 90-second screencast script: shot list, narration beats, fallbacks).
  - `apps/web/src/app/identify/_screenshots/*.png` (new, 5–8 screenshots) **OR** describe states inline in the demo-script doc — frontend-builder picks. Either works.
- **Acceptance criteria:**
  - Demo-mode flow completes end-to-end without any console errors (verified in browser DevTools console — empty or only Next.js dev info).
  - At 360px viewport, no horizontal scroll; all controls reachable with thumb.
  - Real-API flow: ≥ 2 of 8 demo photos produce a top-1 candidate that matches the photo's actual seeded item (sanity check — Claude vision must basically work on the seeded set; if 0/8 pass, that's a Subtask 1 prompt-engineering bug to feed back).
  - Demo-script document exists at the predicted path, is ≤ 1 page, and lists: opening shot, upload action, loading state shot, candidate-list shot, disambiguation shot, final-detail shot, closing shot. Each shot has a one-line narration.
  - Screenshots (or rich text descriptions) cover at least: idle state, loading, candidate list, item detail.
- **Dependencies:** Subtask 3 (page must be built and built without errors).
- **Invariants applied:** N/A.

### Subtask 5 — (folded) Demo-mode response

- **Status:** **MERGED into Subtask 2.**
- **Rationale:** The CEO brief listed this as optional. Implementing demo mode as a `?demo=true` branch inside `/api/identify` is one extra `if` block (~8 lines) and a single hardcoded JSON file — splitting it into its own subtask adds dispatch overhead without saving real time. The acceptance criteria for Subtask 2 already include the demo branch; Subtask 3's UI toggle already includes it; Subtask 4's verification flow uses it as the primary path. No separate subtask needed.

## Open questions / risks

**For CEO/user before dispatch (Q1 is blocking for Subtask 4 real-API verification only):**

- **Q1. Anthropic API key.** Does the founder have an `ANTHROPIC_API_KEY` available locally, and is he OK spending ~$0.50–$2 in API calls during Subtask 4 verification? If no key, Subtask 4's real-API check can be skipped and the demo will run in demo-mode only (still recordable, but the screencast can't truthfully say "this is live AI"). **Recommendation:** founder provides the key; cost is trivial.

- **Q2. Photo format constraint.** Recommend: accept any `image/*` MIME, cap at 8 MB, no client-side resize. Mobile cameras produce 2–5 MB JPEGs; this is fine. No pre-processing in the prototype.

- **Q3. Model choice — `claude-sonnet-4-6` recommended.** `claude-opus-4-7` would give marginally better vision quality but costs ~5x more per call. `claude-haiku-4-5` is cheapest but its vision is noticeably weaker on cluttered warehouse-shelf photos. For a demo where Claude must look credible to leads who will be watching closely, **Sonnet is the right tradeoff**. Hardcoded as a constant in `apps/web/src/lib/identify/prompt.ts` so it's a one-line change later.

**Risks:**

- **R1. Claude vision may fail on the seeded set.** If `getCatalogForPrompt()` is too long or the image quality is poor, Claude may return generic answers ("I see a metal part") with low confidence on every item. Mitigation: Subtask 1 includes ≥ 3 visually-near-identical items with sharp distinguishing details in `visualDescription`; if real-API verification fails, the demo-mode branch (already built) carries the screencast.
- **R2. shadcn init in an existing app.** The Round 7a bootstrap may have left an incomplete shadcn setup. If `components.json` already exists, `frontend-builder` must merge rather than overwrite. Low impact — shadcn init is idempotent for fresh apps.
- **R3. Photo upload size on Vercel function bodies.** Not relevant for local-only demo; if we later deploy, Vercel default body limit is 4.5 MB. The 8 MB cap in Subtask 2 is for local dev convenience and would need lowering on deploy. Out of scope per CEO brief (no production deploy).

## Escalations needed

- [ ] **לארכיטקט: אין.** This prototype is explicitly outside the architectural-invariants envelope by CEO directive. If the prototype validates and we promote it to a real feature, that promotion is a separate architect engagement (new ADR for warehouse-vision module: storage of real photos, multi-tenant catalog access, audit on disambiguation decisions, agent-gating of any auto-update suggestions). Flag for CEO but no architect work for *this* round.
- [ ] **ל-CEO/user: Q1 above** (Anthropic API key availability for the real-API leg of Subtask 4). Non-blocking for Subtasks 1–3.

## Estimated rounds

- **Workers:** 1 round expected. Subtasks 1 + 2 in parallel (independent of each other except 2 reads from 1 — but `getCatalogForPrompt` signature can be agreed up front so 2 can stub against it). Subtask 3 starts after 2 has the route shape working. Subtask 4 starts after 3 lands.
- **Sequencing:** 1 ‖ 2 (parallel) → 3 → 4.
- **Total estimated wall-clock through review:** 2 working sessions (~6–8 hours of focused work), well inside the CEO's 2–3 session target. Assumes one review pass with minor fixes.

## Architectural call I made (most important)

The biggest call was **collapsing the optional Subtask 5 (demo-mode response) into Subtask 2** rather than treating it as a separate piece. Demo mode is not a nice-to-have here — it's the load-bearing path for the screencast, since the founder will be recording on networks (or in front of skeptical contacts) where snapping a real photo and burning API tokens mid-call is fragile. By making `?demo=true` a first-class branch of `/api/identify` from day one, every subtask down the chain (UI toggle, browser verification, screencast script) treats it as the default safe path rather than bolted-on theatre. That choice is the difference between "demo that works in the boardroom" and "demo that works in the lab and breaks in front of leads."

The second meaningful call was **explicitly logging which CLAUDE.md invariants are waived for this prototype** (multi-tenancy, audit, agent gating, migration rollback) so that any future CEO/architect dispatch to "promote this to production" inherits the debt list rather than rediscovering it. The waiver lives in this plan and in the gate-flag `NEXT_PUBLIC_PROTOTYPE_MODE` — both have to be removed deliberately.

Model choice (`claude-sonnet-4-6` over Opus or Haiku) was the third call: Sonnet's vision is good enough that demo viewers won't catch errors, while Opus's price would make us flinch about every test run. Documented in Subtask 2 acceptance, hardcoded as a constant for trivial future change.
