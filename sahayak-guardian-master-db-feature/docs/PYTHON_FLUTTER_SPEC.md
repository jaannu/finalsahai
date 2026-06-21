# Phase-2 Spec: Python (FastAPI + DuckDB) and Flutter

This is the porting spec — written so a Python/Flutter team can rebuild the
exact same product behind the same UX.

## Backend — FastAPI

```
app/
├── main.py                # FastAPI app, CORS, JWT middleware
├── core/
│   ├── config.py          # pydantic-settings, env-driven
│   ├── security.py        # JWT (HS256), role-based dependency
│   └── audit.py           # writes to audit_logs
├── db/
│   ├── postgres.py        # SQLAlchemy engine (prod)
│   ├── sqlite.py          # local dev / single-school deploy
│   └── duckdb.py          # analytics + report generation
├── models/                # SQLAlchemy ORM (mirrors Lovable Cloud schema)
├── schemas/               # Pydantic (mirrors zod schemas in src/lib/*)
├── services/
│   ├── ocr.py             # Gemini Flash OCR — port of ocr.functions.ts
│   ├── risk.py            # rule-based risk — port of risk-engine.ts
│   ├── briefing.py        # principal briefing — port of sahayak.functions.ts
│   ├── intervention.py    # case tracker
│   └── analytics.py       # DuckDB queries
├── api/
│   ├── teacher.py         # POST /api/teacher/extract, /verify
│   ├── principal.py       # GET /api/principal/briefing, POST /generate
│   ├── counsellor.py
│   ├── officer.py
│   └── public/
│       ├── webhooks.py
│       └── gov_mock.py    # /mock/udise /emis /diksha /shiksha-setu /state-mis /e-office
└── adapters/
    ├── twilio_mock.py
    ├── whatsapp_mock.py
    ├── sms_mock.py
    └── sarvam_tts_mock.py
```

Endpoint contract is 1:1 with `src/lib/*.functions.ts` shapes; same JSON in,
same JSON out, so the Flutter app can be developed against either backend.

## Mobile — Flutter Android

```
lib/
├── main.dart
├── core/
│   ├── auth.dart          # JWT storage (FlutterSecureStorage)
│   ├── api_client.dart    # dio with offline-queue interceptor
│   └── theme.dart         # Vedic palette: terracotta/marigold/sandalwood/indigo
├── data/
│   ├── local/             # sqflite_cipher: students, attendance_queue
│   └── repositories/
├── features/
│   ├── teacher/
│   │   ├── capture_screen.dart      # camera, voice, manual, CSV
│   │   ├── verify_screen.dart       # 3-gate verification UI
│   │   └── upload_history.dart
│   ├── principal/
│   │   ├── briefing_screen.dart     # TTS (Sarvam)
│   │   └── risk_list_screen.dart
│   ├── counsellor/
│   ├── officer/
│   └── district/
└── shared/
    ├── widgets/                     # MandalaDivider, RiskChip, etc.
    └── connectivity.dart            # 2G-friendly sync
```

### Offline-First Sync

- All writes go to a local `attendance_queue` table first.
- Background isolate flushes the queue when connectivity returns.
- Conflict resolution: server timestamp wins; teacher gets a notification
  if their queued row was overridden.

## Analytics — DuckDB

Materialized SQL views on top of attendance + risk:

- `v_class_attendance_trend(day, grade, present, absent, rate)`
- `v_consecutive_absences(student_id, streak_days)`
- `v_dropout_risk_trend(month, school_id, high, medium, low)`
- `v_intervention_success(intervention_id, before_rate, after_rate, delta)`
- `v_gender_disparity(grade, gender, rate)`

Reports:

- Daily attendance .xlsx (per school)
- Weekly risk summary .pdf
- Monthly school report .pdf
- Government upload .csv (UDISE/EMIS format)

## Deployment

- **Backend**: Docker compose with FastAPI + Postgres + DuckDB volume.
- **Mobile**: Android APK signed for school distribution; Play Store optional.
- **Web dashboard**: same Flutter codebase compiled with `flutter build web`.
- **Edge installs**: single-school SQLite-only mode runs on a school principal's laptop.

## Security

- TLS everywhere; HSTS preload.
- JWT (HS256) with 15-min access + 7-day refresh.
- Roles in `user_roles` table; `has_role()` SECURITY DEFINER fn.
- `audit_logs` append-only; service-role writes only.
- DPDP-Act-aware: raw photo + audio deleted after extraction; only structured
  verified data is retained.
- Zero training on school data.