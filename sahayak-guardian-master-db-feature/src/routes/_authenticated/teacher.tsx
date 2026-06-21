import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  extractAttendance,
  extractAttendanceFromTranscript,
  importAttendanceRows,
  transcribeVoice,
  type ExtractionResult,
} from "@/lib/ocr.functions";
import { saveVerifiedAttendance, getTeacherSnapshot } from "@/lib/sahayak.functions";
import {
  validateMasterDatabaseCsv,
  loadSampleMasterDatabase,
  getSampleAttendanceImage,
  getActiveMasterDatabase,
  extractAttendanceAgainstMasterDb,
  type MasterDbValidationResult,
  type MasterMatchResult,
} from "@/lib/master-db.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  Mic,
  Square,
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  RefreshCw,
  BarChart2,
  Download,
  Users,
  UserCheck,
  UserX,
  Clock,
  FlaskConical,
  PhoneCall,
  Database,
  XCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/teacher")({
  head: () => ({ meta: [{ title: "Teacher · Sahayak" }] }),
  component: TeacherPage,
});

type Row = ExtractionResult["rows"][number];

/** Try to map arbitrary spreadsheet/CSV column headers to our fields. */
function mapImportRow(raw: Record<string, any>): {
  student_name: string;
  status?: string;
  gender?: string;
} {
  const lower: Record<string, any> = {};
  for (const k of Object.keys(raw)) lower[k.trim().toLowerCase()] = raw[k];

  const nameKey = ["student_name", "name", "student", "student name"].find((k) => lower[k] != null);
  const statusKey = ["status", "attendance", "present", "present/absent"].find(
    (k) => lower[k] != null,
  );
  const genderKey = ["gender", "sex"].find((k) => lower[k] != null);

  return {
    student_name: String(nameKey ? lower[nameKey] : "").trim(),
    status: statusKey ? String(lower[statusKey]) : undefined,
    gender: genderKey ? String(lower[genderKey]) : undefined,
  };
}

// ── Analytics helpers ────────────────────────────────────────────────────────

interface Analytics {
  total: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
  lowConfidence: number;
  avgConfidence: number;
  genderBreakdown: { M: number; F: number; other: number };
  absentNames: string[];
  lateNames: string[];
}

function computeAnalytics(rows: Row[], avgConf: number): Analytics {
  const total = rows.length;
  const present = rows.filter((r) => r.status === "present").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const late = rows.filter((r) => r.status === "late").length;
  const lowConfidence = rows.filter((r) => r.confidence < 0.9).length;
  const genderBreakdown = { M: 0, F: 0, other: 0 };
  for (const r of rows) {
    const g = (r.gender ?? "").toUpperCase();
    if (g === "M") genderBreakdown.M++;
    else if (g === "F") genderBreakdown.F++;
    else genderBreakdown.other++;
  }
  return {
    total,
    present,
    absent,
    late,
    attendanceRate: total ? Math.round((present / total) * 100) : 0,
    lowConfidence,
    avgConfidence: Math.round(avgConf * 100),
    genderBreakdown,
    absentNames: rows.filter((r) => r.status === "absent").map((r) => r.student_name),
    lateNames: rows.filter((r) => r.status === "late").map((r) => r.student_name),
  };
}

/** Download a printable PDF-style HTML report as a .html file that the browser
 *  can print-to-PDF. We use the browser's native print dialog — no extra lib needed. */
function downloadAnalyticsReport(
  analytics: Analytics,
  rows: Row[],
  grade: string,
  section: string,
  date: string,
  source: string,
) {
  const now = new Date().toLocaleString("en-IN");
  const absentList = analytics.absentNames.length ? analytics.absentNames.join(", ") : "None";
  const lateList = analytics.lateNames.length ? analytics.lateNames.join(", ") : "None";

  const tableRows = rows
    .map(
      (r, i) => `
    <tr class="${r.status === "absent" ? "absent-row" : r.status === "late" ? "late-row" : ""}">
      <td>${i + 1}</td>
      <td>${r.student_name}</td>
      <td>${r.gender || "—"}</td>
      <td><span class="badge badge-${r.status}">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></td>
      <td>${Math.round(r.confidence * 100)}%</td>
    </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Attendance Report — Grade ${grade}-${section} · ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 32px 40px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #e63946; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: #1a1a2e; }
    .brand span { color: #e63946; }
    .meta { text-align: right; font-size: 11px; color: #666; line-height: 1.8; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #e63946; margin-bottom: 8px; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 28px; }
    .stat-card { border: 1px solid #eee; border-radius: 8px; padding: 14px 12px; background: #fafafa; }
    .stat-card .val { font-size: 28px; font-weight: 700; line-height: 1; margin-bottom: 4px; }
    .stat-card .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
    .stat-card.green .val { color: #2d6a4f; }
    .stat-card.red .val { color: #e63946; }
    .stat-card.amber .val { color: #d4831a; }
    .stat-card.blue .val { color: #1d6fa4; }
    .absent-block, .late-block { background: #fff5f5; border: 1px solid #fcc; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
    .late-block { background: #fffbf0; border-color: #ffe4a0; }
    .absent-block .names, .late-block .names { margin-top: 4px; color: #444; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { background: #f2f2f2; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 10px; text-align: left; color: #555; }
    td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; }
    tr.absent-row td { background: #fff5f5; }
    tr.late-row td { background: #fffbf0; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-present { background: #d1fae5; color: #065f46; }
    .badge-absent { background: #fee2e2; color: #991b1b; }
    .badge-late { background: #fef3c7; color: #92400e; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #eee; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; }
    .bar-wrap { height: 10px; background: #eee; border-radius: 99px; overflow: hidden; margin-top: 8px; }
    .bar-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #2d6a4f, #52b788); }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Sahayak <span>·</span> Attendance Report</div>
      <div style="color:#888;margin-top:4px;font-size:12px;">School Risk Intelligence Platform</div>
    </div>
    <div class="meta">
      <div><strong>Grade ${grade}-${section}</strong></div>
      <div>Date: ${date}</div>
      <div>Source: ${source.charAt(0).toUpperCase() + source.slice(1)}</div>
      <div>Generated: ${now}</div>
    </div>
  </div>

  <div class="section-title">Summary</div>
  <div class="summary-grid">
    <div class="stat-card blue"><div class="val">${analytics.total}</div><div class="lbl">Total Students</div></div>
    <div class="stat-card green"><div class="val">${analytics.present}</div><div class="lbl">Present</div></div>
    <div class="stat-card red"><div class="val">${analytics.absent}</div><div class="lbl">Absent</div></div>
    <div class="stat-card amber"><div class="val">${analytics.late}</div><div class="lbl">Late</div></div>
    <div class="stat-card ${analytics.attendanceRate >= 85 ? "green" : analytics.attendanceRate >= 70 ? "amber" : "red"}">
      <div class="val">${analytics.attendanceRate}%</div>
      <div class="lbl">Attendance Rate</div>
      <div class="bar-wrap"><div class="bar-fill" style="width:${analytics.attendanceRate}%"></div></div>
    </div>
  </div>

  ${
    analytics.absentNames.length
      ? `<div class="section-title">Absent Students</div>
  <div class="absent-block">
    <div class="names">${absentList}</div>
  </div>`
      : ""
  }

  ${
    analytics.lateNames.length
      ? `<div class="section-title">Late Arrivals</div>
  <div class="late-block">
    <div class="names">${lateList}</div>
  </div>`
      : ""
  }

  <div class="section-title" style="margin-top:20px">Student-wise Record</div>
  <table>
    <thead><tr><th>#</th><th>Student Name</th><th>Gender</th><th>Status</th><th>OCR Confidence</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="footer">
    <div>Sahayak · School Risk Intelligence · Made in India</div>
    <div>Avg OCR confidence: ${analytics.avgConfidence}% · ${analytics.lowConfidence} rows below 90%</div>
  </div>

  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-report-grade${grade}${section}-${date}.html`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Report opened — use your browser's Print → Save as PDF to download a PDF.");
}

// ── Analytics panel component ─────────────────────────────────────────────

function AnalyticsPanel({
  rows,
  avgConf,
  grade,
  section,
  date,
  source,
}: {
  rows: Row[];
  avgConf: number;
  grade: string;
  section: string;
  date: string;
  source: string;
}) {
  const a = computeAnalytics(rows, avgConf);
  const barW = (n: number) => `${a.total ? Math.round((n / a.total) * 100) : 0}%`;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-[var(--terracotta)]" />
          <h2 className="font-display text-xl">Session Analytics</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => downloadAnalyticsReport(a, rows, grade, section, date, source)}
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total",
            value: a.total,
            Icon: Users,
            color: "text-[var(--indigo)]",
            bg: "bg-[var(--indigo)]/8",
          },
          {
            label: "Present",
            value: a.present,
            Icon: UserCheck,
            color: "text-[var(--risk-low)]",
            bg: "bg-[var(--risk-low)]/8",
          },
          {
            label: "Absent",
            value: a.absent,
            Icon: UserX,
            color: "text-[var(--risk-high)]",
            bg: "bg-[var(--risk-high)]/8",
          },
          {
            label: "Late",
            value: a.late,
            Icon: Clock,
            color: "text-[var(--terracotta)]",
            bg: "bg-[var(--terracotta)]/8",
          },
        ].map(({ label, value, Icon, color, bg }) => (
          <div key={label} className={`rounded-lg border p-4 ${bg}`}>
            <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${color}`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <div className={`font-display text-3xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Attendance rate bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground font-medium">Attendance rate</span>
          <span
            className={`text-sm font-bold ${
              a.attendanceRate >= 85
                ? "text-[var(--risk-low)]"
                : a.attendanceRate >= 70
                  ? "text-[var(--terracotta)]"
                  : "text-[var(--risk-high)]"
            }`}
          >
            {a.attendanceRate}%
          </span>
        </div>
        <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              a.attendanceRate >= 85
                ? "bg-[var(--risk-low)]"
                : a.attendanceRate >= 70
                  ? "bg-[var(--marigold)]"
                  : "bg-[var(--risk-high)]"
            }`}
            style={{ width: `${a.attendanceRate}%` }}
          />
        </div>
        {a.attendanceRate < 75 && (
          <p className="text-xs text-[var(--risk-high)] mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Below 75% — flagged for principal review
          </p>
        )}
      </div>

      {/* Stacked bar: present / late / absent */}
      <div>
        <div className="text-xs text-muted-foreground mb-1.5 font-medium">Status breakdown</div>
        <div className="h-5 rounded-full overflow-hidden flex">
          <div
            className="bg-[var(--risk-low)] h-full transition-all"
            style={{ width: barW(a.present) }}
            title={`Present: ${a.present}`}
          />
          <div
            className="bg-[var(--marigold)] h-full transition-all"
            style={{ width: barW(a.late) }}
            title={`Late: ${a.late}`}
          />
          <div
            className="bg-[var(--risk-high)] h-full transition-all"
            style={{ width: barW(a.absent) }}
            title={`Absent: ${a.absent}`}
          />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--risk-low)]" />
            Present {a.present}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--marigold)]" />
            Late {a.late}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--risk-high)]" />
            Absent {a.absent}
          </span>
        </div>
      </div>

      {/* Gender breakdown */}
      {(a.genderBreakdown.M > 0 || a.genderBreakdown.F > 0) && (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Male", val: a.genderBreakdown.M },
            { label: "Female", val: a.genderBreakdown.F },
            { label: "Not specified", val: a.genderBreakdown.other },
          ].map(({ label, val }) => (
            <div key={label} className="rounded-md border bg-background/60 py-2 px-3">
              <div className="font-display text-lg font-bold">{val}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Absent list */}
      {a.absentNames.length > 0 && (
        <div className="rounded-md border border-[var(--risk-high)]/30 bg-[var(--risk-high)]/5 p-3">
          <div className="text-xs font-semibold text-[var(--risk-high)] mb-1.5 uppercase tracking-wide">
            Absent — {a.absentNames.length} student{a.absentNames.length > 1 ? "s" : ""}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {a.absentNames.map((n) => (
              <span
                key={n}
                className="text-xs px-2 py-0.5 rounded-full bg-background border border-[var(--risk-high)]/30 text-[var(--risk-high)]"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* OCR confidence note */}
      {a.lowConfidence > 0 && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-[var(--terracotta)]" />
          {a.lowConfidence} row{a.lowConfidence > 1 ? "s" : ""} had OCR confidence below 90% —
          please verify those names.
        </div>
      )}
    </div>
  );
}

// ── Master database testing workflow ────────────────────────────────────────

function ValidationWarnings({ result }: { result: MasterDbValidationResult }) {
  if (result.errors.length === 0 && result.warnings.length === 0) return null;
  return (
    <div className="space-y-2">
      {result.errors.length > 0 && (
        <div className="rounded-md border border-[var(--risk-high)] bg-[var(--risk-high)]/5 p-3 text-sm">
          <div className="flex items-center gap-1.5 font-medium text-[var(--risk-high)]">
            <XCircle className="h-4 w-4" />
            {result.errors.length} error{result.errors.length > 1 ? "s" : ""} — fix before uploading
          </div>
          <ul className="list-disc ml-5 mt-1 text-xs text-muted-foreground">
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div className="rounded-md border border-[var(--marigold)] bg-[var(--marigold)]/10 p-3 text-sm">
          <div className="flex items-center gap-1.5 font-medium text-[var(--risk-high)]">
            <AlertTriangle className="h-4 w-4" />
            {result.warnings.length} warning{result.warnings.length > 1 ? "s" : ""}
          </div>
          <ul className="list-disc ml-5 mt-1 text-xs text-muted-foreground">
            {result.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MasterDbTestPanel({ onMatched }: { onMatched: (res: MasterMatchResult) => void }) {
  const loadSample = useServerFn(loadSampleMasterDatabase);
  const fetchSampleImage = useServerFn(getSampleAttendanceImage);
  const uploadCsv = useServerFn(validateMasterDatabaseCsv);
  const fetchActiveDb = useServerFn(getActiveMasterDatabase);
  const runMatch = useServerFn(extractAttendanceAgainstMasterDb);

  const [busy, setBusy] = useState<"sample" | "ocr" | "upload" | null>(null);
  const [validation, setValidation] = useState<MasterDbValidationResult | null>(null);
  const [activeDbCount, setActiveDbCount] = useState(0);
  const [sampleImagePreview, setSampleImagePreview] = useState<string | null>(null);
  const [mode, setMode] = useState<"sample" | "upload" | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  async function handleUseSampleData() {
    setBusy("sample");
    setMode("sample");
    try {
      const dbResult = await loadSample();
      setValidation(dbResult);
      if (!dbResult.valid) {
        toast.error("Sample master database failed validation.");
        return;
      }
      setActiveDbCount(dbResult.rows.length);

      const img = await fetchSampleImage();
      setSampleImagePreview(`data:image/png;base64,${img.imageBase64}`);
      toast.success(`Loaded sample register + ${dbResult.rows.length} students from master DB.`);

      setBusy("ocr");
      const matchResult = await runMatch({ data: { imageBase64: img.imageBase64 } });
      onMatched(matchResult);
      toast.success(
        `OCR complete · ${matchResult.matched_count} matched · ${matchResult.unmatched_count} unmatched`,
      );
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Sample test run failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleCsvFile(file: File) {
    setBusy("upload");
    setMode("upload");
    setSampleImagePreview(null);
    try {
      const csvText = await file.text();
      const result = await uploadCsv({ data: { csvText } });
      setValidation(result);
      if (result.valid) {
        setActiveDbCount(result.rows.length);
        toast.success(
          `Master database saved · ${result.rows.length} students${
            result.warnings.length ? ` · ${result.warnings.length} warning(s)` : ""
          }`,
        );
      } else {
        toast.error(`CSV invalid — ${result.errors.length} error(s) found.`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Could not read CSV file");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-[var(--terracotta)]" />
        <h2 className="font-display text-xl">Test with Sample Attendance Register</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Run the OCR pipeline end-to-end against a known-good attendance register and master database
        — or upload your own master database CSV to use with live scans.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-lg border p-4 space-y-2 bg-secondary/20">
          <div className="font-medium text-sm flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" />
            Sample data
          </div>
          <p className="text-xs text-muted-foreground">
            Loads the bundled sample register (Grade 5B, October 2023, 30 students) and its matching
            master database, runs OCR, and cross-references guardian contacts.
          </p>
          <Button
            variant="hero"
            size="sm"
            className="w-full gap-1.5"
            onClick={handleUseSampleData}
            disabled={busy !== null}
          >
            {busy === "sample" || busy === "ocr" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {busy === "ocr" ? "Running OCR…" : busy === "sample" ? "Loading…" : "Use Sample Data"}
          </Button>
        </div>

        <div className="rounded-lg border p-4 space-y-2 bg-secondary/20">
          <div className="font-medium text-sm flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Your own master database
          </div>
          <p className="text-xs text-muted-foreground">
            CSV columns: student_id, roll_number, student_name, class_name, section, guardian_name,
            guardian_phone, preferred_language, emergency_contact.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => csvInputRef.current?.click()}
            disabled={busy !== null}
          >
            {busy === "upload" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload Master Database CSV
          </Button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
          />
        </div>
      </div>

      {validation && <ValidationWarnings result={validation} />}

      {validation?.valid && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--risk-low)]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Active master database: {activeDbCount} student
          {activeDbCount === 1 ? "" : "s"}
          {mode === "upload" &&
            " — ready. Scan or upload a register photo above to match against it."}
        </div>
      )}

      {sampleImagePreview && (
        <div className="rounded-lg border overflow-hidden">
          <img
            src={sampleImagePreview}
            alt="Sample attendance register"
            className="w-full max-h-72 object-contain bg-background"
          />
        </div>
      )}
    </div>
  );
}

function MasterMatchPanel({ result }: { result: MasterMatchResult }) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[var(--terracotta)]" />
          <h2 className="font-display text-xl">
            Master Database Match — {result.class_name || "—"} · {result.month || "—"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full risk-chip-low">
            {result.matched_count} matched
          </span>
          {result.unmatched_count > 0 && (
            <span className="text-xs px-2 py-1 rounded-full risk-chip-high">
              {result.unmatched_count} unmatched
            </span>
          )}
          <span className="text-xs px-2 py-1 rounded-full risk-chip-medium">
            Avg confidence {Math.round(result.avg_confidence * 100)}%
          </span>
        </div>
      </div>

      {result.flagged_reasons.length > 0 && (
        <div className="rounded-md border border-[var(--risk-medium)] bg-[var(--marigold)]/10 p-3 text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 text-[var(--risk-high)] mt-0.5" />
          <ul className="list-disc ml-5 text-xs text-muted-foreground">
            {result.flagged_reasons.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="text-left">
              <th className="p-2">Roll</th>
              <th>Student</th>
              <th>Status</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Guardian</th>
              <th>Phone</th>
              <th>Match</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r, i) => (
              <tr key={i} className={`border-t ${!r.matched ? "bg-[var(--risk-high)]/5" : ""}`}>
                <td className="p-2">{r.roll_number || "—"}</td>
                <td className="font-medium">{r.student_name}</td>
                <td>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === "present"
                        ? "risk-chip-low"
                        : r.status === "absent"
                          ? "risk-chip-high"
                          : "risk-chip-medium"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td>{r.total_present ?? "—"}</td>
                <td>{r.total_absent ?? "—"}</td>
                <td className="text-xs">{r.guardian_name || "—"}</td>
                <td className="text-xs flex items-center gap-1">
                  {r.guardian_phone ? (
                    <>
                      <PhoneCall className="h-3 w-3 text-muted-foreground" />
                      {r.guardian_phone}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {r.matched ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--risk-low)]" />
                  ) : (
                    <span title="Not found in master database">
                      <XCircle className="h-4 w-4 text-[var(--risk-high)]" />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5" />
        Matched rows use guardian_name and guardian_phone from the active master database. Unmatched
        names should be checked for spelling differences between the register and CSV.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

function TeacherPage() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const extract = useServerFn(extractAttendance);
  const extractFromVoice = useServerFn(extractAttendanceFromTranscript);
  const transcribe = useServerFn(transcribeVoice);
  const importRows = useServerFn(importAttendanceRows);
  const save = useServerFn(saveVerifiedAttendance);
  const snapshotFn = useServerFn(getTeacherSnapshot);

  const { data: snap, refetch } = useQuery({
    queryKey: ["teacher-snapshot"],
    queryFn: () => snapshotFn(),
  });

  const [grade, setGrade] = useState("5");
  const [section, setSection] = useState("A");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [flags, setFlags] = useState<string[]>([]);
  const [avgConf, setAvgConf] = useState(0);
  const [usedAi, setUsedAi] = useState(false);
  const [source, setSource] = useState<"photo" | "voice" | "import" | "manual">("manual");
  const fileRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [masterMatchResult, setMasterMatchResult] = useState<MasterMatchResult | null>(null);

  // ── Voice recording state ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

  // Auto-show analytics when rows arrive
  useEffect(() => {
    if (rows && rows.length > 0) setShowAnalytics(true);
  }, [rows]);

  function onPhoto(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      setPhotoPreview(data);
      setPhotoB64(data.split(",")[1]);
      setSource("photo");
    };
    reader.readAsDataURL(file);
  }

  async function runExtract() {
    if (!photoB64) {
      toast.error("Please scan or upload a register photo first.");
      return;
    }
    setBusy(true);
    try {
      const res = await extract({
        data: { imageBase64: photoB64 ?? undefined, grade, section, date, useReal: true },
      });
      applyResult(res);
    } catch (e) {
      console.error(e);
      toast.error("Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  function applyResult(res: ExtractionResult) {
    setRows(res.rows);
    setFlags(res.flagged_reasons);
    setAvgConf(res.avg_confidence);
    setUsedAi(res.used_real_ai);
    const present = res.rows.filter((r) => r.status === "present").length;
    const absent = res.rows.filter((r) => r.status === "absent").length;
    toast.success(`${res.rows.length} students extracted · ${present} present · ${absent} absent`);
  }

  // ── Voice recording ──
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void handleRecordedAudio(new Blob(audioChunksRef.current, { type: mimeType }), mimeType);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (e) {
      console.error(e);
      toast.error("Microphone access denied or unavailable.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  async function handleRecordedAudio(blob: Blob, mimeType: string) {
    setBusy(true);
    try {
      const transcript = await transcribeAudio(blob, mimeType);
      if (!transcript?.trim()) {
        toast.error("Could not transcribe audio — please try again or speak more clearly.");
        return;
      }
      const res = await extractFromVoice({
        data: { transcript, grade, section },
      });
      setSource("voice");
      setPhotoPreview(null);
      setPhotoB64(null);
      applyResult(res);
    } catch (e) {
      console.error(e);
      toast.error("Voice extraction failed");
    } finally {
      setBusy(false);
    }
  }

  async function transcribeAudio(blob: Blob, mimeType: string): Promise<string> {
    try {
      const audioBase64 = await blobToBase64(blob);
      const format = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : "wav";
      const res = await transcribe({ data: { audioBase64, format } });
      if (res.text?.trim()) return res.text;
    } catch (e) {
      console.warn("Server transcription failed, falling back to local speech recognition:", e);
    }
    return lastLiveTranscriptRef.current.trim();
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const lastLiveTranscriptRef = useRef("");
  const speechRecRef = useRef<any>(null);

  function startRecordingWithLiveTranscript() {
    lastLiveTranscriptRef.current = "";
    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = "en-IN";
        rec.onresult = (e: any) => {
          let text = "";
          for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript + " ";
          lastLiveTranscriptRef.current = text;
        };
        rec.onerror = (e: any) => console.warn("SpeechRecognition error (non-fatal)", e);
        speechRecRef.current = rec;
        rec.start();
      }
    } catch (e) {
      console.warn("SpeechRecognition unavailable (non-fatal):", e);
      speechRecRef.current = null;
    }
    void startRecording();
  }

  function stopRecordingWithLiveTranscript() {
    try {
      speechRecRef.current?.stop?.();
    } catch {
      // ignore
    }
    stopRecording();
  }

  // ── CSV / Excel import ──
  async function onImportFile(file: File) {
    setBusy(true);
    try {
      let parsed: Record<string, any>[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const result = Papa.parse<Record<string, any>>(text, {
          header: true,
          skipEmptyLines: true,
        });
        parsed = result.data;
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        parsed = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      }

      const mapped = parsed.map(mapImportRow).filter((r) => r.student_name);
      if (mapped.length === 0) {
        toast.error(
          "No student rows found. Expect a 'Name' column and optional 'Status'/'Gender' columns.",
        );
        return;
      }

      const res = await importRows({ data: { rows: mapped, grade } });
      setSource("import");
      setPhotoPreview(null);
      setPhotoB64(null);
      applyResult(res);
    } catch (e) {
      console.error(e);
      toast.error("Could not read the file. Please check the format and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!rows) return;
    setBusy(true);
    try {
      await save({
        data: {
          date,
          grade,
          section,
          source,
          used_real_ai: usedAi,
          avg_confidence: avgConf,
          flagged_reasons: flags,
          rows,
        },
      });
      toast.success("Attendance saved & risk scores updated");
      setRows(null);
      setPhotoB64(null);
      setPhotoPreview(null);
      setFlags([]);
      setAvgConf(0);
      setSource("manual");
      setShowAnalytics(false);
      qc.invalidateQueries({ queryKey: ["teacher-snapshot"] });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const summary = useMemo(() => {
    if (!rows) return "";
    const absent = rows.filter((r) => r.status === "absent").map((r) => r.student_name);
    return `Grade ${grade}-${section}. ${absent.length} students absent${
      absent.length ? ": " + absent.slice(0, 5).join(", ") + (absent.length > 5 ? "…" : "") : ""
    }. Confirm?`;
  }, [rows, grade, section]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl">{t("teacher_title")}</h1>
            <p className="text-sm text-muted-foreground">{t("teacher_sub")}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            Today: <strong className="text-foreground">{snap?.todayCount ?? 0}</strong> records
            marked
          </div>
        </div>

        {/* Test with sample / custom master database */}
        <MasterDbTestPanel
          onMatched={async (result) => {
            setMasterMatchResult(result);
            const converted: Row[] = result.rows.map((r) => ({
              student_name: r.student_name,
              grade,
              gender: r.gender,
              status: r.status,
              confidence: r.confidence,
            }));
            setRows(converted);
            setAvgConf(result.avg_confidence);
            setFlags(result.flagged_reasons);
            setUsedAi(result.used_real_ai);
            setSource("photo");
            try {
              await save({
                data: {
                  date,
                  grade,
                  section,
                  source: "photo",
                  used_real_ai: result.used_real_ai,
                  avg_confidence: result.avg_confidence,
                  flagged_reasons: result.flagged_reasons,
                  rows: converted,
                },
              });
              toast.success("Sample data saved & sent to Principal dashboard");
              qc.invalidateQueries({ queryKey: ["teacher-snapshot"] });
            } catch (e: any) {
              console.error(e);
              toast.error(e?.message ?? "Auto-save to principal failed");
            }
          }}
        />
        {masterMatchResult && <MasterMatchPanel result={masterMatchResult} />}

        {/* Capture + recent uploads */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 rounded-xl border bg-card p-5">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Grade</Label>
                <Input value={grade} onChange={(e) => setGrade(e.target.value)} />
              </div>
              <div>
                <Label>Section</Label>
                <Input value={section} onChange={(e) => setSection(e.target.value)} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-sm">
              <Sparkles className="h-4 w-4 text-[var(--terracotta)]" />
              <span>
                Attendance is extracted using AI — photo OCR, voice, or file import. Names in any
                language or script are supported.
              </span>
            </div>

            <div className="mt-5 grid sm:grid-cols-4 gap-3">
              <Button
                variant="outline"
                className="h-20 flex-col gap-1"
                onClick={() => fileRef.current?.click()}
                disabled={busy || isRecording}
              >
                <Camera className="h-5 w-5" />
                <span className="text-xs">Scan register</span>
              </Button>

              {!isRecording ? (
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-1"
                  onClick={startRecordingWithLiveTranscript}
                  disabled={busy}
                >
                  <Mic className="h-5 w-5" />
                  <span className="text-xs">Voice</span>
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  className="h-20 flex-col gap-1"
                  onClick={stopRecordingWithLiveTranscript}
                >
                  <Square className="h-5 w-5" />
                  <span className="text-xs">Stop ({recordSeconds}s)</span>
                </Button>
              )}

              <Button
                variant="outline"
                className="h-20 flex-col gap-1"
                onClick={() => importFileRef.current?.click()}
                disabled={busy || isRecording}
              >
                <FileSpreadsheet className="h-5 w-5" />
                <span className="text-xs">CSV / Excel</span>
              </Button>

              <Button
                variant="hero"
                className="h-20 flex-col gap-1"
                onClick={runExtract}
                disabled={busy || !photoB64 || isRecording}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
                <span className="text-xs">{rows ? "Re-run" : "Extract"}</span>
              </Button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])}
            />
            <input
              ref={importFileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])}
            />

            {isRecording && (
              <p className="mt-3 text-xs text-muted-foreground">
                Listening… read out student names and mark absentees in any language, then press
                Stop.
              </p>
            )}

            {photoPreview && (
              <div className="mt-4 rounded-lg border overflow-hidden">
                <img src={photoPreview} alt="Register" className="w-full max-h-64 object-cover" />
              </div>
            )}
          </div>

          {/* Recent uploads */}
          <div className="rounded-xl border bg-card p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Recent uploads
            </div>
            <div className="mt-2 space-y-2">
              {(snap?.extractions ?? []).slice(0, 6).map((e: any) => (
                <div
                  key={e.id}
                  className="text-xs rounded border px-2 py-1.5 flex items-center justify-between bg-background/60"
                >
                  <div>
                    <div className="font-medium">
                      Grade {e.grade}-{e.section ?? "-"} · {e.date}
                    </div>
                    <div className="text-muted-foreground">
                      Conf {Math.round((e.avg_confidence ?? 0) * 100)}% ·{" "}
                      {e.used_real_ai ? "Real AI" : "Mock"} · {e.status}
                    </div>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-[var(--risk-low)]" />
                </div>
              ))}
              {!snap?.extractions?.length && (
                <div className="text-xs text-muted-foreground">No uploads yet.</div>
              )}
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => refetch()}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Analytics panel — shown when rows exist */}
        {rows && rows.length > 0 && showAnalytics && (
          <AnalyticsPanel
            rows={rows}
            avgConf={avgConf}
            grade={grade}
            section={section}
            date={date}
            source={source}
          />
        )}

        {/* Verify & confirm */}
        {rows && (
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">Verify — Gate 3</h2>
                <p className="text-sm text-muted-foreground">{summary}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full risk-chip-medium">
                  Avg confidence {Math.round(avgConf * 100)}%
                </span>
                {usedAi ? (
                  <span className="text-xs px-2 py-1 rounded-full risk-chip-low">Real AI</span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-full risk-chip-medium">Mock</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={() => setShowAnalytics((v) => !v)}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  {showAnalytics ? "Hide" : "Show"} analytics
                </Button>
              </div>
            </div>

            {flags.length > 0 && (
              <div className="rounded-md border border-[var(--risk-medium)] bg-[var(--marigold)]/10 p-3 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--risk-high)] mt-0.5" />
                <div>
                  <div className="font-medium">Gate 1 & 2 flags</div>
                  <ul className="list-disc ml-5 text-xs text-muted-foreground">
                    {flags.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Note about any-language names */}
            <p className="text-xs text-muted-foreground bg-secondary/40 rounded-md px-3 py-2">
              Student names are stored exactly as extracted — names in Hindi, Tamil, Kannada,
              Telugu, or any other script are supported and preserved.
            </p>

            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="text-left">
                    <th className="p-2">Student</th>
                    <th>Gender</th>
                    <th>Status</th>
                    <th>Confidence</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-t ${r.confidence < 0.9 ? "bg-[var(--marigold)]/5" : ""}`}
                    >
                      <td className="p-2">
                        <Input
                          value={r.student_name}
                          onChange={(e) =>
                            setRows(
                              rows.map((x, j) =>
                                j === i ? { ...x, student_name: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <Input
                          className="w-16"
                          value={r.gender ?? ""}
                          onChange={(e) =>
                            setRows(
                              rows.map((x, j) => (j === i ? { ...x, gender: e.target.value } : x)),
                            )
                          }
                        />
                      </td>
                      <td>
                        <Select
                          value={r.status}
                          onValueChange={(v: "present" | "absent" | "late") =>
                            setRows(rows.map((x, j) => (j === i ? { ...x, status: v } : x)))
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Present</SelectItem>
                            <SelectItem value="absent">Absent</SelectItem>
                            <SelectItem value="late">Late</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-xs">{Math.round(r.confidence * 100)}%</td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRows(rows.filter((_, j) => j !== i))}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <Button
                variant="ghost"
                onClick={() => {
                  setRows(null);
                  setFlags([]);
                  setShowAnalytics(false);
                }}
              >
                Reject
              </Button>
              <div className="flex gap-2 flex-wrap">
                <Link to="/principal">
                  <Button variant="outline">View Principal view</Button>
                </Link>
                <Button variant="hero" onClick={confirm} disabled={busy}>
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirm & send to Principal
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
