# Sahayak — Mobile-First School Risk Intelligence & Governance

> **Predict. Validate. Decide. Intervene.**

Sahayak turns school attendance into *action* — a governance layer for
India's 1.5M schools that surfaces at-risk students, keeps every decision
human, and works on paper registers, 2G connectivity, and feature phones.

## What this repo ships (Phase 1)

- **Landing page** with Vedic palette + Hindi/Tamil-friendly typography.
- **Auth** (email/password) with role-based access for 5 roles.
- **Teacher capture flow** — scan register → AI OCR → 3-gate verification → confirm.
- **Principal briefing** — spoken morning briefing, explainable risk list,
  one-click interventions.
- **Rule-based risk engine** with full explainability.
- **Real Gemini Flash OCR** with mock fallback toggle.
- **Database**: Postgres (via Lovable Cloud) with RLS, `user_roles`, audit logs.

## What's planned (Phase 2)

- Counsellor, Education Officer, District Admin dashboards
- DuckDB analytics + Excel/PDF export
- Real Twilio / WhatsApp / SMS / IVR adapters
- Government API adapters (UDISE / EMIS / DIKSHA / Shiksha Setu / State MIS / e-Office)
- Flutter Android shell + FastAPI backend (1:1 port)

See `docs/ARCHITECTURE.md`, `docs/PYTHON_FLUTTER_SPEC.md`, `docs/DEMO_SCRIPT.md`.

## Tech stack (shipped MVP)

| Layer | Tech |
|---|---|
| UI | TanStack Start · React 19 · Tailwind v4 · shadcn |
| Server | TanStack server functions (TypeScript RPC) |
| Database | Postgres (Lovable Cloud) with RLS + `has_role()` |
| AI | Lovable AI Gateway → `google/gemini-2.5-flash` |
| Auth | Lovable Cloud (JWT) |
| Offline | TanStack Query cache + PWA-ready |

## Run locally

```
bun install
bun run dev
```

No Docker required for the web MVP — Lovable Cloud provisions the backend.
The Python/Flutter Phase-2 port has its own Docker compose spec in
`docs/PYTHON_FLUTTER_SPEC.md`.