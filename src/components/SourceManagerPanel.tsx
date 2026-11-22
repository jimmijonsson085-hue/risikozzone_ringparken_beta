import React, { useMemo } from 'react';
import { Biohazard, Minus, Plus, RotateCcw, Volume2 } from 'lucide-react';
import { getDefaultSourceBaseLwaDb, SUBSTANCE_SPECS } from '../data/ringparkenData';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  ReceptorExposureResult,
  ReceptorZone,
} from '../types/dispersion';

export interface SourceManagerPanelProps {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  receptorExposures: ReceptorExposureResult[];
  currentWeather: HourlyWeatherPoint;
  selectedSourceId: string | null;
  onSelectSource: (sourceId: string) => void;
  onToggleSourceActive: (sourceId: string) => void;
  onToggleSourceAsbestosSubstance: (sourceId: string) => void;
  onUpdateSourceReleaseHeight: (sourceId: string, heightMeters: number) => void;
  onUpdateSourceFiberReleaseIndex: (sourceId: string, fiberIndex: number) => void;
  onUpdateSourceBaseLwaDb: (sourceId: string, nextLwaDb: number) => void;
  onResetSourceBaseLwaDb: (sourceId: string) => void;
  onSelectReceptor?: (receptorId: string) => void;
}

function haversineDistMeters(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function bearingDegrees(from: LatLngPoint, to: LatLngPoint): number {
  const r = Math.PI / 180;
  const dLng = (to.lng - from.lng) * r;
  const lat1 = from.lat * r;
  const lat2 = to.lat * r;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export const SourceManagerPanel: React.FC<SourceManagerPanelProps> = ({
  sources,
  receptors,
  receptorExposures,
  currentWeather,
  selectedSourceId,
  onSelectSource,
  onToggleSourceActive,
  onToggleSourceAsbestosSubstance,
  onUpdateSourceReleaseHeight,
  onUpdateSourceFiberReleaseIndex,
  onUpdateSourceBaseLwaDb,
  onResetSourceBaseLwaDb,
  onSelectReceptor,
}) => {
  const isDaytime = currentWeather.hourIndex >= 7 && currentWeather.hourIndex < 18;
  const isEvening = currentWeather.hourIndex >= 18 && currentWeather.hourIndex < 22;
  const legalLimitDb = isDaytime ? 70.0 : isEvening ? 45.0 : 40.0;
  const windPropagationDeg = (currentWeather.windDirection10m + 180) % 360;

  const residentialReceptors = useMemo(
    () => receptors.filter((r) => r.category === 'residential_block' || r.id === 'rec-byg-5-daginst'),
    [receptors]
  );

  const activeSources = useMemo(() => sources.filter((s) => s.active), [sources]);

  return (
    <div data-testid="source-manager-panel" className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Aktive Emissions-Kildenoder ({sources.length} fra Bygningsregister)
        </h4>
        <span className="text-[11px] font-mono text-slate-400 tabular-nums">
          {sources.filter((s) => s.active).length} aktive · Grænse {legalLimitDb.toFixed(0)} dB(A)
        </span>
      </div>

      <div className="space-y-2">
        {sources.map((src) => {
          const hasAsbestos = src.substances.includes('asbestos');
          const fiberPct = Math.round((src.fiberReleaseIndex ?? 0.75) * 100);
          const defaultLwa = getDefaultSourceBaseLwaDb(src.id, src.buildingCategory);
          const currentLwa = Number((src.baseSoundPowerLwaDb ?? defaultLwa).toFixed(1));
          const deltaFromBaseline = Number((currentLwa - defaultLwa).toFixed(1));
          const isOverridden = Math.abs(deltaFromBaseline) >= 0.1;

          // Compute single-source and combined neighbor block acoustic impact across active sources
          const computeSourceAtReceptorDb = (s: DemolitionSourceNode, recPos: LatLngPoint) => {
            const d = Math.max(12, haversineDistMeters(s.position, recPos));
            const sl = Math.hypot(d, Math.max(1, s.releaseHeightMeters - 1.5));
            const b = bearingDegrees(s.position, recPos);
            let df = Math.abs(b - windPropagationDeg) % 360;
            if (df > 180) df = 360 - df;
            const wc = Math.cos((df * Math.PI) / 180);
            const wa =
              wc >= 0
                ? wc * Math.min(6.4, 0.55 * currentWeather.windSpeed10m)
                : wc * Math.min(4.5, 0.35 * currentWeather.windSpeed10m);
            const aDiv = 20 * Math.log10(sl) + 11.0;
            const sLwa = s.baseSoundPowerLwaDb ?? getDefaultSourceBaseLwaDb(s.id, s.buildingCategory);
            return {
              dist: d,
              db: Math.max(32, sLwa - aDiv - d * 0.004 + wa),
            };
          };

          const neighborImpacts = residentialReceptors
            .map((rec) => {
              const single = computeSourceAtReceptorDb(src, rec.center);
              let sumLinear = Math.pow(10, 4.2); // 42 dB ambient baseline
              activeSources.forEach((actSrc) => {
                sumLinear += Math.pow(10, computeSourceAtReceptorDb(actSrc, rec.center).db / 10);
              });
              const combinedTotalDb = Number((10 * Math.log10(sumLinear)).toFixed(1));
              return {
                receptorId: rec.id,
                receptorCode: rec.code,
                receptorName: rec.name,
                distM: Math.round(single.dist),
                sourceAtRecDb: Number(single.db.toFixed(1)),
                displayTotalDb: src.active ? combinedTotalDb : Number(single.db.toFixed(1)),
              };
            })
            .sort((a, b) => b.sourceAtRecDb - a.sourceAtRecDb)
            .slice(0, 2);

          return (
            <div
              key={src.id}
              data-testid={`source-card-${src.id}`}
              onClick={() => onSelectSource(src.id)}
              className={`p-3 rounded-md border transition-colors cursor-pointer ${
                selectedSourceId === src.id
                  ? 'bg-slate-900 border-cyan-500/60'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-xs text-white">{src.name}</div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSourceActive(src.id);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold cursor-pointer ${
                    src.active
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {src.active ? '● KILDE AKTIV' : '○ INAKTIV'}
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center justify-between gap-2">
                <span>
                  {src.address} · GPS: {src.position.lat.toFixed(4)}, {src.position.lng.toFixed(4)} · H=
                  {src.releaseHeightMeters}m
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold shrink-0 inline-flex items-center gap-1">
                  <Biohazard className="w-3 h-3 shrink-0" />
                  <span>&lt;1997 Fiber: {fiberPct}%</span>
                </span>
              </div>

              {/* Interactive Real-Time Source Parameters + Individual Sound Power Level (LwA) Fine-Tune */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="mt-2 p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                  <span className="text-cyan-300 font-semibold uppercase">
                    Kilde-Parametre → 3D Asbest-Heatmap &amp; Akustik
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleSourceAsbestosSubstance(src.id)}
                    className={`px-1.5 py-0.5 rounded border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                      hasAsbestos
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    {hasAsbestos ? (
                      <>
                        <Biohazard className="w-3 h-3 shrink-0" />
                        <span>Asbest: AKTIV</span>
                      </>
                    ) : (
                      'Asbest: FRA'
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] font-mono">
                  <div>
                    <div className="flex items-center justify-between text-slate-300 mb-0.5">
                      <span>Frigivelseshøjde (H):</span>
                      <strong className="text-cyan-300">{src.releaseHeightMeters} m</strong>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={24}
                      step={1}
                      value={src.releaseHeightMeters}
                      onChange={(e) => onUpdateSourceReleaseHeight(src.id, Number(e.target.value))}
                      aria-label={`Frigivelseshøjde for ${src.name}`}
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-slate-300 mb-0.5">
                      <span>Asbest Fiber-Indeks:</span>
                      <strong className="text-emerald-300">{fiberPct}%</strong>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={180}
                      step={5}
                      value={fiberPct}
                      onChange={(e) =>
                        onUpdateSourceFiberReleaseIndex(src.id, Number(e.target.value) / 100)
                      }
                      aria-label={`Asbest fiber-frigivelsesindeks for ${src.name}`}
                      className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>
                </div>

                {/* +/- Fine-Tune Sound Power Level (LwA) Override for Neighbor Block Impact */}
                <div
                  data-testid={`source-lwa-controls-${src.id}`}
                  className="pt-2 border-t border-slate-800/90 space-y-1.5 font-mono text-[11px] tabular-nums"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-amber-300 font-semibold inline-flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Lydeffektniveau (L_WA):</span>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${
                          isOverridden
                            ? 'bg-amber-500/20 border-amber-400/70 text-amber-200'
                            : 'bg-slate-900 border-slate-700 text-slate-300'
                        }`}
                      >
                        {deltaFromBaseline > 0
                          ? `+${deltaFromBaseline.toFixed(1)} dB`
                          : deltaFromBaseline < 0
                          ? `${deltaFromBaseline.toFixed(1)} dB`
                          : `Baseline ${defaultLwa.toFixed(1)}`}
                      </span>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        data-testid={`source-lwa-minus-5-${src.id}`}
                        onClick={() => onUpdateSourceBaseLwaDb(src.id, currentLwa - 5)}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold cursor-pointer"
                        title="Sænk kilde-lydeffekt med 5 dB(A)"
                      >
                        −5
                      </button>
                      <button
                        type="button"
                        data-testid={`source-lwa-minus-${src.id}`}
                        onClick={() => onUpdateSourceBaseLwaDb(src.id, currentLwa - 1)}
                        aria-label={`Sænk LwA for ${src.code}`}
                        className="p-1 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 border border-slate-700 text-cyan-300 cursor-pointer"
                        title="Finjustér −1 dB(A)"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span
                        data-testid={`source-lwa-value-${src.id}`}
                        className="px-2 py-0.5 rounded bg-[#0B101B] border border-amber-400/50 text-white font-extrabold min-w-[78px] text-center"
                      >
                        {currentLwa.toFixed(1)} dB
                      </span>
                      <button
                        type="button"
                        data-testid={`source-lwa-plus-${src.id}`}
                        onClick={() => onUpdateSourceBaseLwaDb(src.id, currentLwa + 1)}
                        aria-label={`Øg LwA for ${src.code}`}
                        className="p-1 rounded bg-slate-900 hover:bg-amber-400 hover:text-slate-950 border border-slate-700 text-amber-300 cursor-pointer"
                        title="Finjustér +1 dB(A)"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        data-testid={`source-lwa-plus-5-${src.id}`}
                        onClick={() => onUpdateSourceBaseLwaDb(src.id, currentLwa + 5)}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold cursor-pointer"
                        title="Øg kilde-lydeffekt med 5 dB(A)"
                      >
                        +5
                      </button>
                      {isOverridden && (
                        <button
                          type="button"
                          data-testid={`source-lwa-reset-${src.id}`}
                          onClick={() => onResetSourceBaseLwaDb(src.id)}
                          className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                          title={`Nulstil til baseline (${defaultLwa.toFixed(1)} dB(A))`}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Neighbor Block Acoustic Impact Preview */}
                  {neighborImpacts.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {neighborImpacts.map((imp) => {
                        const exceeds = imp.displayTotalDb > legalLimitDb;
                        const elevated = imp.displayTotalDb > 55;
                        return (
                          <button
                            key={`${src.id}-imp-${imp.receptorId}`}
                            type="button"
                            onClick={() => onSelectReceptor?.(imp.receptorId)}
                            className={`px-2 py-1 rounded border text-left flex items-center justify-between gap-1.5 cursor-pointer transition-colors ${
                              exceeds
                                ? 'bg-rose-950/60 border-rose-500/60 text-rose-100'
                                : elevated
                                ? 'bg-amber-950/40 border-amber-500/40 text-amber-100'
                                : 'bg-slate-900/80 border-slate-800 text-slate-300'
                            }`}
                            title={`Klik for at fokusere ${imp.receptorName} (${imp.distM} m fra ${src.code})`}
                          >
                            <span className="truncate">
                              <strong className="text-cyan-300">{imp.receptorCode}</strong> ({imp.distM}m)
                            </span>
                            <span
                              className={`font-bold shrink-0 ${
                                exceeds
                                  ? 'text-rose-300'
                                  : elevated
                                  ? 'text-amber-300'
                                  : 'text-emerald-300'
                              }`}
                            >
                              {imp.displayTotalDb.toFixed(1)} dB
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {src.constructionYearRange && (
                <div className="mt-1.5 p-2 rounded bg-emerald-950/30 border border-emerald-500/30 text-[11px] space-y-0.5">
                  <div className="font-mono text-emerald-300 font-semibold">
                    {src.constructionYearRange} · {src.materialAgeCategory}
                  </div>
                  {src.healthRiskCorrelation && (
                    <div className="text-slate-300 leading-snug">{src.healthRiskCorrelation}</div>
                  )}
                </div>
              )}
              <div className="mt-2 space-y-0.5 text-[11px] text-slate-300">
                {src.substances.map((sk) => (
                  <div key={sk} className="truncate">
                    <span className="text-slate-400 font-mono">
                      {SUBSTANCE_SPECS[sk].shortName}:
                    </span>{' '}
                    {src.substanceDetails[sk]}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
