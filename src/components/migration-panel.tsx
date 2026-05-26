"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload,
  UserPlus,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Undo2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  MigrationReport,
  RejectedRecord,
  TargetRecord,
} from "@/lib/migration/types";
import { DEMO_MODE, addDemoSubscribers, deleteDemoByEmails } from "@/lib/demo-store";

interface ParsedInput {
  rows: Array<Record<string, string>>;
  headers: string[];
}

// 검증 탈락 사유를 사용자가 이해할 수 있는 문구로 변환 (내부 라벨은 노출하지 않는다).
const REASON_LABEL: Record<string, string> = {
  "이메일 형식 오류": "이메일 형식이 올바르지 않아요",
  "이메일 없음": "이메일이 비어 있어요",
  "배치 내 중복 이메일": "파일 안에 중복된 이메일이에요",
};

const PREVIEW_LIMIT = 20;

export function MigrationPanel({ onAdded }: { onAdded?: () => void }) {
  const [source, setSource] = useState("");
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [loaded, setLoaded] = useState<ParsedInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/migration")
      .then((r) => r.json())
      .then((d) => {
        if (d.sources?.[0]) setSource(d.sources[0].name);
      })
      .catch(() => setError("데이터를 불러오지 못했습니다"));
  }, []);

  async function run(input: ParsedInput) {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const res = await fetch("/api/migration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, ...input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "처리에 실패했어요");
      setReport(data as MigrationReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runWithText(text: string) {
    const { default: Papa } = await import("papaparse");
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const input: ParsedInput = {
      rows: parsed.data,
      headers: parsed.meta.fields ?? [],
    };
    setLoaded(input);
    await run(input);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await runWithText(await file.text());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSample() {
    const res = await fetch(`/migration-samples/${source}.csv`);
    if (!res.ok) {
      setError("샘플 데이터를 찾을 수 없습니다");
      return;
    }
    await runWithText(await res.text());
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-primary" />
        구독자 일괄 추가
      </h1>
      <p className="text-sm text-muted-foreground mb-5">
        CSV 파일을 업로드해 여러 구독자를 한 번에 추가합니다. 형식이 달라도
        자동으로 정리·검증해 추가해요.
      </p>

      <div className="border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-sm rounded-md hover:bg-muted"
          >
            <Upload className="w-3.5 h-3.5" />
            CSV 업로드
          </button>
          <button
            onClick={handleSample}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:opacity-90"
          >
            <Sparkles className="w-3.5 h-3.5" />
            샘플 데이터로 실행
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">파일을 확인하고 있어요…</p>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mb-6">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {report && (
        <ReportView report={report} loaded={loaded} onAdded={onAdded} />
      )}
    </div>
  );
}

function ReportView({
  report,
  loaded,
  onAdded,
}: {
  report: MigrationReport;
  loaded: ParsedInput | null;
  onAdded?: () => void;
}) {
  if (report.aborted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          파일을 읽지 못했어요. CSV에 이메일 항목이 있는지 확인해주세요.
        </div>
        {loaded && <DataPreview input={loaded} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loaded && <DataPreview input={loaded} />}
      {report.rejected.length > 0 && (
        <ExcludedList rejected={report.rejected} />
      )}
      <ResultCard
        records={report.records}
        rejectedCount={report.rejected.length}
        onAdded={onAdded}
      />
    </div>
  );
}

// 요약 + 추가 버튼을 한 카드로 합쳤다.
function ResultCard({
  records,
  rejectedCount,
  onAdded,
}: {
  records: TargetRecord[];
  rejectedCount: number;
  onAdded?: () => void;
}) {
  const [committing, setCommitting] = useState(false);
  const [done, setDone] = useState(false);
  const [committedEmails, setCommittedEmails] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const valid = records.length;

  async function commit() {
    setCommitting(true);
    setMsg("");
    setIsError(false);
    try {
      if (DEMO_MODE) {
        // 데모: Brevo 대신 브라우저(localStorage)에 추가 (일부는 수신거부로 섞임)
        const n = addDemoSubscribers(records);
        setDone(true);
        setCommittedEmails(records.map((r) => r.email));
        setMsg(`${n}명을 추가했어요`);
        if (onAdded) setTimeout(onAdded, 900);
        return;
      }
      const res = await fetch("/api/migration/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추가에 실패했어요");
      setDone(true);
      setCommittedEmails(records.map((r) => r.email));
      const dup = data.duplicates
        ? ` (이미 있던 ${data.duplicates}명은 정보가 갱신됐어요)`
        : "";
      setMsg(`${data.added}명을 추가했어요${dup}`);
      // 성공 메시지를 잠깐 보여준 뒤 모달을 닫고 목록을 새로고침한다.
      if (onAdded) setTimeout(onAdded, 900);
    } catch (e) {
      setIsError(true);
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setCommitting(false);
    }
  }

  async function undo() {
    setCommitting(true);
    setMsg("");
    setIsError(false);
    try {
      if (DEMO_MODE) {
        deleteDemoByEmails(committedEmails);
        const n = committedEmails.length;
        setDone(false);
        setCommittedEmails([]);
        setMsg(`${n}명을 되돌렸어요`);
        return;
      }
      const res = await fetch("/api/migration/commit", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: committedEmails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "되돌리기에 실패했어요");
      setDone(false);
      setCommittedEmails([]);
      setMsg(`${data.deleted}명을 되돌렸어요`);
    } catch (e) {
      setIsError(true);
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 flex-wrap rounded-lg border border-success/20 bg-success/5 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">
            {done ? msg : `${valid}명을 추가할 수 있어요`}
          </p>
          {!done && isError && (
            <p className="text-xs text-destructive mt-0.5">{msg}</p>
          )}
          {!done && !isError && rejectedCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {rejectedCount}개 항목은 제외됐어요 — 아래에서 확인하세요
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!done ? (
          <button
            onClick={commit}
            disabled={committing || valid === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:opacity-90 disabled:opacity-50"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {committing ? "추가 중…" : `${valid}명 추가하기`}
          </button>
        ) : (
          <button
            onClick={undo}
            disabled={committing}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-sm rounded-md hover:bg-muted disabled:opacity-50"
          >
            <Undo2 className="w-3.5 h-3.5" />
            되돌리기
          </button>
        )}
      </div>
    </div>
  );
}

function ExcludedList({ rejected }: { rejected: RejectedRecord[] }) {
  return (
    <section>
      <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4 text-warning" />
        제외된 항목 ({rejected.length})
      </h2>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <Th>이메일</Th>
              <Th>이름</Th>
              <Th>이유</Th>
            </tr>
          </thead>
          <tbody>
            {rejected.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">
                  {r.record.email || "(없음)"}
                </td>
                <td className="px-4 py-2">{r.record.name || "-"}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {r.reasons
                    .map((reason) => REASON_LABEL[reason] ?? reason)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// 불러온(샘플/업로드) 원본 데이터를 그대로 펼쳐볼 수 있는 미리보기.
function DataPreview({ input }: { input: ParsedInput }) {
  const [open, setOpen] = useState(false);
  const rows = input.rows.slice(0, PREVIEW_LIMIT);

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
        불러온 데이터 미리보기 ({input.rows.length}행)
      </button>
      {open && (
        <div className="mt-2 border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {input.headers.map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {input.headers.map((h) => (
                    <td
                      key={h}
                      className="px-4 py-2 text-xs whitespace-nowrap"
                    >
                      {row[h] || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {input.rows.length > PREVIEW_LIMIT && (
            <p className="text-[11px] text-muted-foreground px-4 py-2 border-t border-border">
              외 {input.rows.length - PREVIEW_LIMIT}행 더 있음
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left px-4 py-2.5 font-medium text-xs text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}
