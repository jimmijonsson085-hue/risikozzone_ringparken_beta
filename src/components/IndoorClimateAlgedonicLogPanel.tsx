import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Download,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  HourlyWeatherPoint,
  IndoorClimateTelemetryResult,
} from '../types/dispersion';
import { computeForensicSha256Hash } from '../services/dispersionEngine';

export const INDOOR_ALARM_LOG_STORAGE_KEY = 'ringparken_indoor_algedonic_log_v1';
export const MAX_INDOOR_ALARM_LOG_ENTRIES = 50;

export interface IndoorClimateAlgedonicLogEntry {
  id: string;
  dedupeKey: string;
  loggedAtIso: string;
  dateIso: string;
  hourIndex: number;
  hourLabel: string;
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  ventilationMode: string;
  indoorSumQuotientSin: number;
  indoorAsbestosFibrePerCm3: number;
  indoorAsbestosPctOfGv: number;
  deltaPCavPa: number;
  zNplEffectiveMeters: number;
  ppvFoundationMmPerSec: number;
  qTotSuperposedM3PerH: number;
  windSpeed10m: number;
  windGusts10m: number;
  outdoorTempC: number;
  sha256Signature: string;
}

export function buildIndoorAlarmCanonicalPayload(
  entry: Omit<IndoorClimateAlgedonicLogEntry, 'sha256Signature'>
) {
  return {
    id: entry.id,
    dedupeKey: entry.dedupeKey,
    loggedAtIso: entry.loggedAtIso,
    dateIso: entry.dateIso,
    hourIndex: entry.hourIndex,
    hourLabel: entry.hourLabel,
    receptorId: entry.receptorId,
    receptorCode: entry.receptorCode,
    receptorName: entry.receptorName,
    ventilationMode: entry.ventilationMode,
    indoorSumQuotientSin: entry.indoorSumQuotientSin,
    indoorAsbestosFibrePerCm3: entry.indoorAsbestosFibrePerCm3,
    deltaPCavPa: entry.deltaPCavPa,
    zNplEffectiveMeters: entry.zNplEffectiveMeters,
    ppvFoundationMmPerSec: entry.ppvFoundationMmPerSec,
    qTotSuperposedM3PerH: entry.qTotSuperposedM3PerH,
    windSpeed10m: entry.windSpeed10m,
    windGusts10m: entry.windGusts10m,
    outdoorTempC: entry.outdoorTempC,
  };
}

export function loadStoredIndoorAlarms(): IndoorClimateAlgedonicLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(INDOOR_ALARM_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IndoorClimateAlgedonicLogEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e) =>
          e &&
          typeof e.id === 'string' &&
          typeof e.indoorSumQuotientSin === 'number' &&
          typeof e.sha256Signature === 'string'
      )
      .slice(0, MAX_INDOOR_ALARM_LOG_ENTRIES);
  } catch {
    return [];
  }
}

export function persistStoredIndoorAlarms(
  entries: IndoorClimateAlgedonicLogEntry[]
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      INDOOR_ALARM_LOG_STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_INDOOR_ALARM_LOG_ENTRIES))
    );
  } catch {
    // Ignore storage quota issues
  }
}

export async function createSignedIndoorAlarmEntry(params: {
  telemetry: IndoorClimateTelemetryResult;
  currentWeather: HourlyWeatherPoint;
  dateIso: string;
}): Promise<IndoorClimateAlgedonicLogEntry> {
  const { telemetry, currentWeather, dateIso } = params;
  const quantizedSin = Math.round(telemetry.indoorSumQuotientSin * 100);
  const dedupeKey = `${dateIso}::${currentWeather.hourIndex}::${telemetry.receptorId}::${telemetry.ventilationMode}::${quantizedSin}`;
  const baseEntry: Omit<IndoorClimateAlgedonicLogEntry, 'sha256Signature'> = {
    id: `sin-alarm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dedupeKey,
    loggedAtIso: new Date().toISOString(),
    dateIso,
    hourIndex: currentWeather.hourIndex,
    hourLabel: currentWeather.hourLabel,
    receptorId: telemetry.receptorId,
    receptorCode: telemetry.receptorCode,
    receptorName: telemetry.receptorName,
    ventilationMode: telemetry.ventilationMode,
    indoorSumQuotientSin: Number(telemetry.indoorSumQuotientSin.toFixed(3)),
    indoorAsbestosFibrePerCm3: Number(telemetry.indoorAsbestosFibrePerCm3.toFixed(5)),
    indoorAsbestosPctOfGv: telemetry.indoorAsbestosPctOfGv,
    deltaPCavPa: Number(telemetry.deltaPCavPa.toFixed(1)),
    zNplEffectiveMeters: Number(telemetry.zNplEffectiveMeters.toFixed(1)),
    ppvFoundationMmPerSec: Number(telemetry.ppvFoundationMmPerSec.toFixed(1)),
    qTotSuperposedM3PerH: Number(telemetry.qTotSuperposedM3PerH.toFixed(1)),
    windSpeed10m: Number(currentWeather.windSpeed10m.toFixed(1)),
    windGusts10m: Number(currentWeather.windGusts10m.toFixed(1)),
    outdoorTempC: Number(currentWeather.temperature2m.toFixed(1)),
  };
  const sha256Signature = await computeForensicSha256Hash(
    buildIndoorAlarmCanonicalPayload(baseEntry)
  );
  return {
    ...baseEntry,
    sha256Signature,
  };
}

export interface IndoorClimateAlgedonicLogPanelProps {
  telemetry: IndoorClimateTelemetryResult;
  dateIso: string;
  entries: IndoorClimateAlgedonicLogEntry[];
  onClearEntries: () => void;
}

export const IndoorClimateAlgedonicLogPanel: React.FC<
  IndoorClimateAlgedonicLogPanelProps
> = ({ telemetry, dateIso, entries, onClearEntries }) => {
  const [verificationStatus, setVerificationStatus] = useState<
    Record<string, 'VERIFICERET' | 'AFVIGELSE'>
  >({});
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL_GT_2'>('ALL');

  const handleVerifyEntry = useCallback(async (entry: IndoorClimateAlgedonicLogEntry) => {
    const recomputed = await computeForensicSha256Hash(
      buildIndoorAlarmCanonicalPayload(entry)
    );
    const valid = recomputed === entry.sha256Signature;
    setVerificationStatus((prev) => ({
      ...prev,
      [entry.id]: valid ? 'VERIFICERET' : 'AFVIGELSE',
    }));
  }, []);

  const handleVerifyAll = useCallback(async () => {
    const nextStatus: Record<string, 'VERIFICERET' | 'AFVIGELSE'> = {};
    for (const entry of entries) {
      const recomputed = await computeForensicSha256Hash(
        buildIndoorAlarmCanonicalPayload(entry)
      );
      nextStatus[entry.id] =
        recomputed === entry.sha256Signature ? 'VERIFICERET' : 'AFVIGELSE';
    }
    setVerificationStatus(nextStatus);
  }, [entries]);

  const handleExportLogJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAtIso: new Date().toISOString(),
            retentionPolicy: `Seneste ${MAX_INDOOR_ALARM_LOG_ENTRIES} algedoniske indendørs-alarmer (S_in > 1,0)`,
            statutoryBasis: 'BEK nr. 613 af 29/06/2026 § 3, stk. 3',
            count: entries.length,
            entries,
          },
          null,
          2
        ),
      ],
      { type: 'application/json;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ringparken_Indeklima_Algedonisk_Log_50_${dateIso}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEntries = useMemo(() => {
    if (severityFilter === 'CRITICAL_GT_2') {
      return entries.filter((e) => e.indoorSumQuotientSin > 2.0);
    }
    return entries;
  }, [entries, severityFilter]);

  const verifiedCount = useMemo(
    () =>
      entries.filter((e) => verificationStatus[e.id] === 'VERIFICERET').length,
    [entries, verificationStatus]
  );

  return (
    <div
      data-testid="indoor-climate-algedonic-log-panel"
      className="p-3.5 rounded-lg bg-[#111827] border border-rose-500/45 space-y-3 font-mono"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#1E293B] pb-2.5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-extrabold text-rose-300">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              DEDIKERET ALGEDONISK INDEKLIMA-LOG (AUTO-ARKIV · SENESTE 50 MED S_in &gt; 1,0)
            </span>
          </div>
          <p className="text-[11px] font-sans text-slate-300 leading-snug">
            Gemmer automatisk de seneste <strong className="text-white">50</strong> overskridelser hvor
            indendørs sumkvotient <code className="text-rose-300">S_in &gt; 1,0</code> (BEK 613/2026),
            forseglet med kryptografisk Web Crypto <strong className="text-emerald-300">SHA-256</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] font-bold text-cyan-300 tabular-nums">
            {entries.length} / {MAX_INDOOR_ALARM_LOG_ENTRIES} logposter
          </span>
          <button
            type="button"
            data-testid="indoor-alarm-verify-all-btn"
            onClick={() => void handleVerifyAll()}
            disabled={entries.length === 0}
            className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-[11px] cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>
              Verificér alle SHA-256{verifiedCount > 0 ? ` (${verifiedCount})` : ''}
            </span>
          </button>
          <button
            type="button"
            onClick={handleExportLogJson}
            disabled={entries.length === 0}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-cyan-300 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
          >
            <Download className="w-3 h-3 shrink-0" />
            <span>Log (.json)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setVerificationStatus({});
              onClearEntries();
            }}
            disabled={entries.length === 0}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-rose-950 disabled:opacity-40 border border-slate-700 text-slate-300 hover:text-rose-200 text-[11px] cursor-pointer inline-flex items-center gap-1"
            title="Ryd lokal logbuffer"
          >
            <Trash2 className="w-3 h-3 shrink-0" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSeverityFilter('ALL')}
            className={`px-2 py-0.5 rounded border cursor-pointer ${
              severityFilter === 'ALL'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            Alle S_in &gt; 1,0 ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => setSeverityFilter('CRITICAL_GT_2')}
            className={`px-2 py-0.5 rounded border cursor-pointer ${
              severityFilter === 'CRITICAL_GT_2'
                ? 'bg-rose-500/25 border-rose-400 text-rose-200 font-bold'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            Kritisk S_in &gt; 2,0 ({entries.filter((e) => e.indoorSumQuotientSin > 2.0).length})
          </button>
        </div>
        <span className="text-slate-400 font-sans">
          Aktuel tilstand:{' '}
          <strong
            className={
              telemetry.indoorSumQuotientSin > 1.0 ? 'text-rose-400' : 'text-emerald-300'
            }
          >
            S_in = {telemetry.indoorSumQuotientSin.toFixed(2)}{' '}
            {telemetry.indoorSumQuotientSin > 1.0 ? '(Auto-logges)' : '(Under 1,0)'}
          </strong>
        </span>
      </div>

      {/* Ring Buffer Table */}
      {filteredEntries.length === 0 ? (
        <div className="p-4 rounded bg-slate-950/90 border border-slate-800 text-center text-xs font-sans text-slate-400">
          Ingen algedoniske indeklima-alarmer (S_in &gt; 1,0) registreret endnu. Så snart S_in
          overstiger 1,0, gemmes hændelsen automatisk her med verificerbar SHA-256-signatur.
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded border border-slate-800 bg-slate-950/95">
          <table className="w-full text-left border-collapse text-[11px] tabular-nums">
            <thead className="sticky top-0 bg-slate-900 text-slate-300 border-b border-slate-800 z-10">
              <tr>
                <th className="py-1.5 px-2">Tidspunkt</th>
                <th className="py-1.5 px-2">Receptor</th>
                <th className="py-1.5 px-2">S_in</th>
                <th className="py-1.5 px-2">Asbest / ΔP_CAV</th>
                <th className="py-1.5 px-2">SHA-256 Digest</th>
                <th className="py-1.5 px-2 text-right">Integritet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredEntries.map((entry) => {
                const status = verificationStatus[entry.id];
                return (
                  <tr key={entry.id} className="hover:bg-slate-900/70">
                    <td className="py-1.5 px-2 text-slate-300 whitespace-nowrap">
                      <div className="font-bold text-slate-100">
                        {entry.dateIso} kl. {entry.hourLabel}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {entry.loggedAtIso.slice(11, 19)}Z
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="font-bold text-cyan-200">{entry.receptorCode}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                        {entry.receptorName}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-extrabold ${
                          entry.indoorSumQuotientSin >= 2.5
                            ? 'text-rose-400'
                            : 'text-amber-300'
                        }`}
                      >
                        <AlertOctagon className="w-3 h-3 shrink-0" />
                        {entry.indoorSumQuotientSin.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-slate-300 whitespace-nowrap">
                      <div>{entry.indoorAsbestosFibrePerCm3.toFixed(4)} f/cm³</div>
                      <div className="text-[10px] text-slate-400">
                        {entry.deltaPCavPa.toFixed(1)} Pa · PPV {entry.ppvFoundationMmPerSec.toFixed(1)} mm/s
                      </div>
                    </td>
                    <td className="py-1.5 px-2 font-mono text-[10px] text-emerald-300">
                      <span title={entry.sha256Signature}>
                        {entry.sha256Signature.slice(0, 14)}…{entry.sha256Signature.slice(-6)}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">
                      {status === 'VERIFICERET' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>VERIFICERET</span>
                        </span>
                      ) : status === 'AFVIGELSE' ? (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                          <span>AFVIGELSE</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleVerifyEntry(entry)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white border border-slate-700 text-[10px] font-bold cursor-pointer"
                        >
                          Verificér
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
