# Sahayak — 5-Minute Demo Script

## 0. Setup (one-time)

1. Open the app, click **Get started**.
2. Create two accounts:
   - `teacher@demo.in` / `demo1234` · role: **Teacher**
   - `principal@demo.in` / `demo1234` · role: **Principal**
3. Both accounts auto-attach to the seeded school
   (Govt Primary School, Anjanapura · Bengaluru South · Karnataka).

## 1. Use Case 1 — Rural Paper Register (Teacher)

1. Sign in as `teacher@demo.in`. You land on **Teacher · Capture attendance**.
2. Set Grade `5`, Section `A`, Date today.
3. Toggle **Use real Gemini Flash OCR** OFF (mock mode for offline demo).
4. Click **Extract** — 15 students appear with confidence scores.
5. Note the **Avg confidence** chip and the **Gate 1 & 2 flags** banner.
6. Edit one student's status (Gate 3 verification).
7. Click **Confirm & send to Principal**. Toast: "Attendance saved & risk
   scores updated".

## 2. Use Case 2 — Real AI OCR (optional, if online)

1. Tap **Scan register**, take a photo of any handwritten attendance list.
2. Toggle **Use real Gemini Flash OCR** ON.
3. Click **Extract**. Gemini Flash returns structured rows.
4. If the AI fails, the system silently falls back to mock — verify the
   chip says "Mock — Real AI unavailable".

## 3. Use Case 3 — Principal Morning Briefing

1. Sign out, sign in as `principal@demo.in`.
2. Navigate to **Principal · Morning briefing**.
3. Toggle **Use real AI** ON, click **Generate briefing**.
4. Click **Play** — hear the spoken briefing via Web Speech TTS
   (Sarvam adapter in Phase 2).
5. Scroll through the **Students needing attention** list. Each row shows:
   - risk score + level chip
   - explainable reasons
   - recommended actions
   - SMS / Call / Approve intervention buttons (mocked, surfaces toast +
     audit-log entry).

## 4. Use Case 4 — Governance & Audit

- All teacher saves and principal generations write to `audit_logs`.
- `user_roles` table enforces role-based access; principal cannot edit raw
  attendance, teacher cannot generate briefings.

## 5. Use Case 5 — Cost & Offline

- Mock extraction = ₹0. Real OCR = ~₹0.05 per register page.
- Browser caches dashboard state via TanStack Query; PWA installable.

## What's mocked vs real

| Capability                  | Status      |
|----------------------------|-------------|
| Auth (email/password)      | Real (Lovable Cloud) |
| Database + RLS             | Real        |
| Risk engine                | Real (rule-based) |
| OCR                        | Real (Gemini Flash) **or** mock toggle |
| Briefing generation        | Real (Gemini Flash) **or** rule-based fallback |
| TTS (briefing playback)    | Real (Web Speech), Sarvam adapter Phase 2 |
| SMS / IVR / WhatsApp       | Mocked (toast + audit log) |
| Government API uploads     | Mocked endpoints, Phase 2 |
| Counsellor/Officer/District | Phase 2 |