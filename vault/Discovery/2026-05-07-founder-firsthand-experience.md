# Discovery: Founder's Firsthand Experience — 3 Israeli Manufacturers

**Date:** 2026-05-07
**Source:** Primary research from CEO/founder Ronen — direct work experience at three Israeli manufacturing plants over the years.
**Reliability:** ⭐⭐⭐⭐⭐ — first-person experience inside the plants, not desk research.

## Why this document matters

The vertical-mapping report (`2026-05-07-vertical-mapping-v1.md`) was desk research — sourced from G2/Capterra reviews and industry directories. **This document is primary research:** the founder personally worked inside three Israeli manufacturers ranging from 20 to 800+ employees, and lived through the actual ERP/process pain. Patterns observed here override conflicting signals from desk research.

## The three plants

### 1. Inbar Metalworking (ענבר עיבודי מתכות) — ~20 employees

- **ERP in use:** Kitron (קיטרון = Priority's Israeli SMB-tier system).
- **Reality:** "Very flexible and open system, but here it was very minimal — used only as a base to store data and manage orders, that's it."
- **Shop floor reality:** "Workers don't report and won't report properly. There's no reporting option in the plant at all."
- **Founder's verdict:** "Probably a plant that doesn't want anything."

**Implications for SUPER-MESHINE:**
- ❌ NOT ICP. 20-person shops at this profile have no willingness-to-pay for richer software. They use the bare-minimum tier of an existing ERP precisely because they don't want more.
- The "shop floor reporting gap" is real and universal — but here it's a SYMPTOM that the owner doesn't care, not a pain we can sell into.

### 2. Amtan Karmiel (אמתן כרמיאל בע"מ) — weapons manufacturer, ~100 employees

- **CEO profile:** Changes his mind every Monday and Thursday. Founder describes him as **"קמצן" (cheap/stingy)**.
- **Concrete pain observed:** Warehouse managing hundreds of items that **look visually identical but differ in raw material** — no way to distinguish them at the shelf or in the system.
- **Stated refusal:** Won't pay an external label company to align labels with the ERP, even though the labeling gap is a real operational problem.

**Implications for SUPER-MESHINE:**
- ❌ NOT ICP. Cheap CEO + chaotic decision-making = sales cycle that never closes.
- BUT — the **specific pain** (visually identical items differing in raw material) is a **textbook AI-native use case**. Document Intelligence + computer vision: photo of part → match to inventory record by raw material composition. This is a feature we should build for the **right** customer (one who'll pay), not for Amtan.
- Defense vertical (weapons mfg) is a flag for ITAR / Israel-MoD overlays — keep in mind for future regulation work.

### 3. Sanmina Karmiel (סנמינה) — EMS contract manufacturer, ~800 employees

- **ERP in use:** Oracle.
- **Management profile:** "Relatively orderly management" — adults in the room.
- **Reality of work:** "The Oracle is very closed and employees work half through downloading reports to Excel and Google Sheets and lots of mappings and VLOOKUPs."

**Implications for SUPER-MESHINE:**
- ❌ NOT MVP ICP — too big (800 employees), locked into Oracle. But this is the **target persona for Phase 2** (5+ years out, after we've proven SMB).
- ✅ The **"Excel/VLOOKUP escape hatch from a closed ERP"** is the most valuable insight from this whole conversation. It's a pattern that repeats at every plant scale ≥50 employees. **It is the wedge for SUPER-MESHINE.**

## Cross-cutting patterns (3-of-3 plants)

These patterns appeared across multiple plants — increasing confidence they generalize:

### Pattern 1: ERP exists but is bypassed for daily work
- Inbar: ERP exists, used only as a thin DB for orders.
- Amtan: ERP exists, can't solve the visual-id problem so workers improvise.
- Sanmina: ERP is robust (Oracle) but closed → Excel/Sheets become the actual operating layer.

**The wedge for SUPER-MESHINE:** The product doesn't have to *replace* the ERP at every layer. It has to *replace the Excel/Google Sheets layer* that sits on top of (or alongside) the existing ERP. That layer is where the daily pain lives.

### Pattern 2: Shop-floor reporting is broken
- Inbar: workers can't report (no system on floor).
- Amtan: implicit (warehouse confusion = no real-time tracking).
- Sanmina: not detailed but presumed (Oracle is rarely floor-friendly).

**Implication:** Mobile-first + voice/photo input on the shop floor is a recurring need. AI-native UX (talk to the system, photo of parts) is the differentiator that closes this gap, not "yet another mobile UI".

### Pattern 3: Customization is locked behind expensive implementers
- Sanmina: Oracle changes go through long IT processes → users build VLOOKUP graveyards in Sheets to avoid that path.
- Amtan: External label-mapping vendor was needed; CEO refused → operational gap stayed.
- Inbar: Implicit — they don't customize because they can't justify the spend.

**Implication:** The Customization Agent (per the original SUPER-MESHINE plan) is the right bet. **The willingness-to-pay isn't for "ERP" anymore — it's for "ERP that I can change without paying ₪200K to an implementer."**

## Refined ICP based on this evidence

### Anti-patterns (flag these in outreach screening)

| Anti-pattern | Signal during discovery call | Decision |
|---|---|---|
| Owner ≤25 employees who uses ERP minimally | "We just use it for orders" | ❌ Pass — no willingness-to-pay |
| "Cheap" / chaotic-decision CEO | Multiple opinion reversals in one call, refuses to pay for fixes to known problems | ❌ Pass — sales cycle never closes |
| 500+ employees locked into Oracle/SAP | Mentions multi-year Oracle contract, dedicated SAP team | ⏸️ Defer to Phase 2 |
| "Excel works fine for us" | Genuine satisfaction with Excel, no pain | ❌ Pass — wrong persona |

### Target ICP (refined)

| Criterion | Value | Why |
|---|---|---|
| Size | **50-200 employees** | Big enough to feel pain, small enough to decide fast |
| Current ERP spend | **₪80K-₪250K/year** | Has budget, has pain |
| Decision-maker | **COO / VP Operations / CFO** (NOT IT manager, NOT chaotic owner) | Has authority, feels the daily pain personally |
| Pain signal | **"We export to Excel/Sheets to actually work"** | The wedge |
| Process complexity | Batch tracking, serial numbers, multi-customer, regulatory traceability | High enough that Excel is failing |
| Management style | Orderly, makes decisions and sticks to them | Sales cycle closeable in <90 days |

## The strategic pivot: two product paths

This experience surfaces a fork in the strategic road:

### Path A — "Replace the ERP" (the original SUPER-MESHINE plan)
- Greenfield ERP that competes with Priority/SAP B1 head-on for SMB.
- Higher margins, deep lock-in.
- BUT: long sales cycle, high resistance ("we just spent ₪500K on Priority implementation"), Sanmina-class customers will never switch.

### Path B — "Sit on top of the ERP" (new option from this discovery)
- An AI Layer that connects to Priority/Oracle/SAP/Hashavshevet via API/MCP.
- **Replaces the Excel/Google Sheets layer**, not the underlying ERP.
- Customization Agent talks to the ERP via integration; user gets modern UX without IT project.
- Faster time-to-value, sales cycle of months not years.
- Works for Sanmina-scale and Inbar-scale; willingness-to-pay sits in the workflow improvement, not the ERP replacement.
- Lower margins per customer, weaker lock-in — but **much wider TAM**.

### Recommendation

**Investigate Path B in the next 5 discovery calls.** Ask a specific question:

> "If a tool plugged into your existing Priority/Oracle and replaced 80% of your Excel/Google Sheets work — kept your ERP, replaced your Excel — what would you pay per month?"

If 4 out of 5 give a number > ₪3,000/month, Path B is real. We may want to pivot the architecture to support both modes (integration adapter as a first-class concept in ADR-002 and ADR-006).

## Open questions for follow-up research

- **What % of Israeli SMB manufacturers actually have an exposed ERP API** (Priority does; Hashavshevet does not; Kitron is Priority so yes; old systems may not)? This determines whether Path B is technically feasible at the SMB tier or only at the mid-market.
- **Is there a precedent product** sitting on top of Israeli ERPs (above Priority/Hashavshevet)? If yes, study their pricing and friction. If no, why not — is integration too painful?
- **What does the Customization Agent need from the underlying ERP** to be useful? Read-only is easy; write access (creating new fields, new entities) is harder and varies by ERP.
- **Sanmina specifically**: a 800-person EMS in Karmiel using Oracle — do their existing Excel-export pains mean they'd buy a layer, or are they on a 5-year Oracle modernization track that'll close the gap internally?

## Action items for the founder

1. ✅ This document captures the firsthand insights — referenced from `vault/Meeting Notes/vertical-selection.md` and the next-rounds plan.
2. ⏭️ The 6-company outreach list (`vault/Discovery/_outreach-2026-05-07.md` — to be created) should be re-scored against the refined ICP. Some of the original 6 may drop, others rise.
3. ⏭️ During the first 5 discovery calls, **explicitly ask the Path A vs Path B question** to validate which path has stronger PMF.
4. ⏭️ Update `lively-juggling-starlight.md` (master strategic plan) with the Path A/B fork as an explicit decision pending discovery validation.

---

**Related:** [[vertical-selection]], [[founding-decisions]], `vault/Discovery/2026-05-07-vertical-mapping-v1.md`.
