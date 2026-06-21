# Sahayak — Architecture (Web MVP + Future Mobile/Python Port)

This document captures the original Sahayak architecture (Flutter Android +
Flutter Web + FastAPI + SQLite + DuckDB) and how the **shipped web MVP**
maps to it. The MVP is built on TanStack Start (React 19, Vite, TypeScript)
with Lovable Cloud (Postgres + Auth + Storage), but every component is
designed to port cleanly to the original stack.

---

## 1. Layered View

```
┌─────────────────────────────────────────────────────────────┐
│ PRESENTATION                                                │
│  • Flutter Android (Teacher capture, offline)               │
│  • Flutter Web Dashboard (Principal, Counsellor, Officer)   │
│  ─── MVP equivalent: TanStack Start mobile-first PWA ───    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS / JWT
┌──────────────────────▼──────────────────────────────────────┐
│ API LAYER                                                   │
│  • FastAPI (Python)                                         │
│  ─── MVP equivalent: TanStack server functions (TS RPC) ─── │
└──────────────────────┬──────────────────────────────────────┘
┌──────────────────────▼──────────────────────────────────────┐
│ DOMAIN SERVICES                                             │
│  • OCR/Extraction (Gemini Flash)                            │
│  • 3-Gate Data Quality (confidence/consistency/teacher)     │
│  • Risk Engine (pure Python rules)                          │
│  • Briefing generator (LLM-assisted)                        │
│  • Intervention tracker                                     │
│  • Mock services (Twilio/WhatsApp/SMS/IVR/Gov APIs)         │
└──────────────────────┬──────────────────────────────────────┘
┌──────────────────────▼──────────────────────────────────────┐
│ DATA LAYER                                                  │
│  • SQLite (on-device, encrypted, offline queue)             │
│  • DuckDB (server-side analytics, reports)                  │
│  • Postgres (optional cloud scale)                          │
│  ─── MVP equivalent: Lovable Cloud Postgres + browser IDB ──│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Mapping Table — Original ↔ Shipped MVP

| Original spec               | Shipped MVP                                      | Phase-2 port target |
|----------------------------|--------------------------------------------------|---------------------|
| Flutter Android (teacher)  | Mobile-first PWA `/teacher` (installable, camera capture) | Flutter Android |
| Flutter Web dashboard      | `/principal` (and future `/counsellor`, `/officer`, `/district`) | Flutter Web |
| FastAPI backend            | `createServerFn` RPC in `src/lib/*.functions.ts` | FastAPI routers `app/api/*.py` |
| Pydantic validation        | Zod input validators                             | Pydantic models     |
| JWT auth + RBAC            | Supabase JWT + `user_roles` + `has_role()` RLS  | python-jose + dependency guards |
| SQLite offline             | TanStack Query cache + browser IndexedDB queue   | `sqflite_cipher` (Flutter) |
| DuckDB analytics           | SQL views on Postgres; export adapter to DuckDB  | `duckdb` Python |
| Gemini Flash OCR           | Lovable AI Gateway → `google/gemini-2.5-flash`   | Direct Gemini API |
| Sarvam TTS                 | Browser `SpeechSynthesisUtterance` (mocked)      | Sarvam Bulbul TTS |
| Twilio IVR / SMS           | Mock action buttons (toasts + audit logs)        | Twilio Programmable Voice + Messaging |
| WhatsApp Business API      | Mock action buttons                              | WhatsApp Cloud API |
| Gov APIs (UDISE/EMIS/etc.) | `/api/public/mock/*` endpoints returning stubs   | Adapter pattern over each portal |

---

## 3. Data Quality — Three Safety Gates

1. **Confidence gate** — every OCR row carries a `confidence ∈ [0,1]`.
   Rows < 0.9 are highlighted yellow in the verification table.
2. **Consistency gate** — server-side check vs last 3 days
   (planned for Phase 2: duplicate name, > 100% attendance,
   sudden P/A/P patterns).
3. **Teacher verification gate** — nothing is written to `attendance`
   until the teacher clicks **Confirm & send to Principal**.
   The raw image and the structured payload are stored in `extractions`
   for audit / override.

## 4. Risk Engine (rule-based, deterministic)

Implementation: `src/lib/risk-engine.ts` (port to `app/services/risk.py`).

| Factor                        | Points |
|------------------------------|--------|
| Attendance < 75%             | +30    |
| ≥ 5 consecutive absences     | +25    |
| Academic score drop ≥ 10%    | +20    |
| Previous intervention on file| +15    |
| Vulnerable group             | +10    |

- 0-40 → low · 41-70 → medium · 71-100 → high
- Output includes `reasons[]` and `recommended_actions[]` — fully explainable.

## 5. Governance Flow

`Teacher → Principal → Counsellor → Education Officer → District Admin`

- Roles stored in `public.user_roles` (never on `profiles`).
- All privileged checks via `public.has_role(uid, role)` security-definer fn.
- Every state change writes to `public.audit_logs`.
- Decisions are **always human** — AI surfaces signals, never auto-acts.

## 6. Cost Envelope

- Target: **< ₹1,000 / school / year**.
- AI is called **only** for OCR + briefing — never for dashboards, reports, risk.
- Mock channels in MVP keep demo cost = ₹0.

## 7. Phase-2 Roadmap

- Counsellor / Officer / District dashboards
- DuckDB analytics adapter + Excel/PDF export
- Mock IVR / WhatsApp / SMS adapters wired to real APIs (Twilio / Meta)
- Government API adapters (`/api/public/mock/{udise,emis,diksha,...}`)
- On-device OCR (compressed Tesseract / Gemini Nano) for 100% local processing
- Native Flutter Android shell (ports the React PWA screens)
- FastAPI port of `*.functions.ts` (1:1 endpoint mapping)