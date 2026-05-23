# Stakeholder Meeting #2 — Pak Tito (Front Office)

**Date:** Week of 21 May 2026
**Attendee:** Pak Tito (Front Office stakeholder)
**Purpose:** Progress review + feature feedback
**Prior meeting:** [stakeholder-meeting-1.md](./stakeholder-meeting-1.md) (8 May 2026)

---

## Summary

Strongly positive engagement. Pak Tito **approved the Housekeeping module** ("HK sudah oke") and validated the Food & Beverage order flow (table → order → cashier → bill) that matches what was shipped. He also provided a substantial set of forward-looking feature requests, several of which he feels strongly about.

These requests **exceed the remaining MVP/defense timeline** and are therefore triaged below into: confirmations of shipped work, a Night Audit specification clarification (actionable now), a small MVP inclusion, and a Phase 2 roadmap for post-deployment development. The Phase 2 list represents validated requirements for the product the department intends to deploy — it is the roadmap, not the defense deliverable.

---

## A. Confirmations — already shipped

These match current implementation and serve as stakeholder validation:

- **Housekeeping is mobile-first** — confirmed appropriate
- **HK dashboard scoped to the cleaning section** — confirmed
- **Admin can manage the F&B menu** — exists in the Admin module
- **F&B flow** — click table → order appears → continue to cashier → generate bill — matches the shipped FB module
- **Housekeeping module approved** ("HK sudah oke")

---

## B. Night Audit specification clarification (actionable — feeds AC-02)

Pak Tito clarified the intended Night Audit behavior, which directly informs the AC-02 build:

- When Night Audit runs, it **posts all room charges for checked-in guests** for that business date.
- It is **triggered by a Manager.** *(MVP note: no Manager role exists yet — Manager-gating is deferred. For MVP the Accounting user runs it.)*
- After it runs, the **business date locks** — no further charges can be posted to that date.
- It produces a **revenue / profit breakdown.**

**Action:** fold these behaviors into the AC-02 Night Audit implementation — especially the day-locking state after a successful run.

---

## C. Decision — INCLUDED in MVP (small, feasible after ACC)

### HK direct status override
Pak Tito wants the HK admin to **set a room's status directly, bypassing the normal cleaning → inspection workflow**, for situations like a guest suddenly requesting a room change.

- **Why included:** small, contained, addresses a concrete operational scenario, and does not require the full role system — it can be made available to HK users for MVP (sub-role gating deferred), consistent with the "anyone in HK can access for now" simplification Pak Tito already accepted.
- **Scope:** an override action on the room detail screen that transitions a room to any status directly, recorded in the housekeeping log.
- **Sequencing:** only after the ACC module is complete. Not on the critical path.

---

## D. DEFERRED to Phase 2 — post-deployment roadmap

Ordered by stakeholder priority. None of these are in the defense MVP; all are validated requirements for the deployed product.

### High priority (Pak Tito feels strongly)

1. **Group booking / multiple-room reservation** — one reservation covering a group of rooms. *(Largest single feature; affects reservations, folios, check-in/out, billing.)*
2. **Master bill + dummy bill** — a group reservation has a master bill; activating it bills under the reservation name. Tied to group booking and to Accounting.
3. **Pay-later / deferred settlement** — billing settled after stay, related to the master-bill flow.
4. **Per-department admin / supervisor / manager roles (RBAC)** — each department has its own admin to enforce the correct workflow (e.g., only the F&B admin manages the menu). *(MVP simplification, already accepted: department users can perform department-admin actions; sub-role gating is Phase 2.)*
5. **Full-board-meeting (FBM) custom articles + adjustable pricing** — when the FBM arrangement is selected, allow adding custom articles with adjustable prices (e.g., a guest requesting an upgraded dinner for a meeting).

### Medium priority

6. **Two-role workflow per module** (supervisor / staff split, e.g. HK supervisor inspects vs room boy cleans). *(A supervisor desktop design already exists as a mockup and can be shown to demonstrate the vision without implementation.)*
7. **Per-article custom pricing options** (e.g., coffee break price options) — generalization of the FBM custom-pricing request.
8. **FO ↔ HK messaging** — Front Office can send requests to Housekeeping.
9. **FO GRC enhancements (FO-only):** option to capture a photo of the guest ID (KTP), capture a written signature, and indicate whether the photo has been captured.
10. **Guest name shown per room in HK, linked to FO data.**

### Low priority / to confirm

11. **Default GRC template as a blank form.** *(Interpretation of "default regist card item putih" — confirm with Pak Tito.)*

---

## E. Items to confirm (ambiguous in notes)

- "Default regist card — item putih" → interpreted as a blank default GRC template. Confirm.
- The pay-later reference ("mirip … bayar belakangan") → confirm the comparison/example Pak Tito intended.

---

## Decision rationale

The defense deliverable is the five-module MVP; completing the Accounting module (foundation → dashboard → Night Audit → night report) finishes it. Pak Tito's feature requests, while valuable and validated, total more development than the remaining timeline allows alongside Accounting. Attempting to build them now would risk leaving multiple features half-finished.

The chosen approach — finish the MVP, include only the small HK override if time allows, and capture the rest as a prioritized Phase 2 roadmap — protects the academic deliverable while preserving and documenting the stakeholder's vision for the deployed product. This roadmap also forms the basis for the post-acquisition development discussion.

---

## Expectation alignment (action item)

Communicate to Pak Tito which items are in the defense MVP versus the Phase 2 roadmap, so expectations for the defense are set correctly and his requests are clearly acknowledged as planned future work.
