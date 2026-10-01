"use client";

import { useEffect, useState } from "react";
import {
  Card,
  PageHeader,
  api,
  inputCls,
  btnPrimaryCls,
  btnSecondaryCls,
} from "@/components/lab";

interface Control {
  id: string;
  name: string;
  paramName: string;
  unit: string;
  mean: number;
  sd: number;
  runs: Array<{ date: string; value: number; violation?: string }>;
}

interface ChartData {
  control: { id: string; name: string; paramName: string; unit: string; mean: number; sd: number };
  points: Array<{ i: number; date: string; value: number; z: number; violation: string | null }>;
  lines: { mean: number; plus1: number; minus1: number; plus2: number; minus2: number; plus3: number; minus3: number };
}

/** Simplified Levey–Jennings chart (SVG): runs vs mean ±1/2/3 SD. */
function LeveyJennings({ chart }: { chart: ChartData }) {
  const W = 680;
  const H = 300;
  const padL = 52;
  const padR = 12;
  const padT = 16;
  const padB = 30;
  const { mean, sd } = chart.control;
  const lo = mean - 3.4 * sd;
  const hi = mean + 3.4 * sd;
  const n = Math.max(1, chart.points.length);
  const X = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

  const hline = (v: number, color: string, dash: string, label: string) => (
    <g key={label}>
      <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke={color} strokeWidth={1} strokeDasharray={dash} />
      <text x={4} y={Y(v) + 3} fontSize={9} fill={color}>{label}</text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Levey-Jennings chart for ${chart.control.name}`}>
      {hline(chart.lines.plus3, "#dc2626", "5,3", "+3SD")}
      {hline(chart.lines.plus2, "#f59e0b", "5,3", "+2SD")}
      {hline(chart.lines.plus1, "#94a3b8", "3,3", "+1SD")}
      {hline(chart.lines.mean, "#0d9488", "", "mean")}
      {hline(chart.lines.minus1, "#94a3b8", "3,3", "−1SD")}
      {hline(chart.lines.minus2, "#f59e0b", "5,3", "−2SD")}
      {hline(chart.lines.minus3, "#dc2626", "5,3", "−3SD")}
      <polyline
        points={chart.points.map((p) => `${X(p.i)},${Y(p.value)}`).join(" ")}
        fill="none"
        stroke="#0f766e"
        strokeWidth={1.5}
      />
      {chart.points.map((p) => (
        <g key={p.i}>
          <circle
            cx={X(p.i)}
            cy={Y(p.value)}
            r={p.violation ? 5 : 3.5}
            fill={p.violation ? "#dc2626" : "#0d9488"}
            stroke="#fff"
            strokeWidth={1}
          >
            <title>{`${p.date}: ${p.value} ${chart.control.unit} (z=${p.z})${p.violation ? ` — ${p.violation}` : ""}`}</title>
          </circle>
        </g>
      ))}
      {chart.points.filter((_, i) => i % 4 === 0).map((p) => (
        <text key={"d" + p.i} x={X(p.i)} y={H - 10} fontSize={8.5} fill="#94a3b8" textAnchor="middle">
          {p.date.slice(5)}
        </text>
      ))}
    </svg>
  );
}

export default function QcPage() {
  const [controls, setControls] = useState<Control[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [err, setErr] = useState("");
  const [runValue, setRunValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const d = await api<{ items: Control[] }>("/api/lab/qc");
      setControls(d.items);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function open(id: string) {
    setOpenId(id);
    setChart(null);
    try {
      const d = await api<ChartData>(`/api/lab/qc/${id}`);
      setChart(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load chart");
    }
  }

  async function logRun() {
    if (!openId || !Number.isFinite(Number(runValue))) {
      setErr("Enter a numeric run value.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const d = await api<{ run: { violation?: string } }>(`/api/lab/qc/${openId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: Number(runValue) }),
      });
      setRunValue("");
      await open(openId);
      await load();
      if (d.run.violation) setErr(`Run logged — Westgard violation: ${d.run.violation}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to log run");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Quality Control" sub="QC controls with Levey–Jennings charts & Westgard rules" />
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {controls.map((c) => {
          const isOpen = openId === c.id;
          const violations = c.runs.filter((r) => r.violation).length;
          return (
            <Card key={c.id}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-xs text-slate-500">
                    {c.paramName} · mean {c.mean} {c.unit} · SD {c.sd} · {c.runs.length} runs
                    {violations > 0 && <span className="ml-1 font-semibold text-red-600">· {violations} violation(s)</span>}
                  </p>
                </div>
                <button onClick={() => (isOpen ? setOpenId(null) : open(c.id))} className={btnSecondaryCls() + " !px-3 !py-1.5 !text-xs"}>
                  {isOpen ? "Close" : "View chart"}
                </button>
              </div>
              {isOpen && chart && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <LeveyJennings chart={chart} />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      className={`${inputCls()} max-w-[160px]`}
                      placeholder="New run value"
                      value={runValue}
                      onChange={(e) => setRunValue(e.target.value)}
                    />
                    <button disabled={busy} onClick={logRun} className={btnPrimaryCls() + " !px-3 !py-2 !text-xs"}>
                      {busy ? "…" : "Log run"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Rules: 1_3s = point beyond 3 SD · 2_2s = two consecutive beyond 2 SD same side · R_4s = 4 SD range between consecutive runs.
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
