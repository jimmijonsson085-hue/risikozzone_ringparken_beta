import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  FileCode2,
  Flame,
  Layers,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

export interface MonteCarloRowResult {
  season: string;
  scenario: string;
  dPTotalPaMean: number;
  qOpM3hMean: number;
  cInFibreM3Mean: number;
  cInFibreM3P95: number;
  cInFibreCm3Mean: number;
  cInFibreCm3P95: number;
  pctOfBek613LimitP95: number;
}

interface BasementMonteCarloSimulationWidgetProps {
  currentOutdoorTempC?: number;
  onLogMonteCarloEvidence?: (title: string, details: string) => void;
}

const SEASONS_CONFIG: Array<{ name: string; tMin: number; tMax: number }> = [
  { name: 'Vinter (-5 til 2 °C)', tMin: -5.0, tMax: 2.0 },
  { name: 'Forår/Efterår (5 til 12 °C)', tMin: 5.0, tMax: 12.0 },
  { name: 'Sommer - Kølig (14 til 18 °C)', tMin: 14.0, tMax: 18.0 },
  { name: 'Sommer - Varm (20 til 25 °C)', tMin: 20.0, tMax: 25.0 },
];

const SCENARIOS_CONFIG: Array<{
  name: string;
  shortLabel: string;
  cMean: number;
  cSd: number;
}> = [
  {
    name: '1. En tur i vaskekælderen (Almindelig gang)',
    shortLabel: '1. Vaskekælder (Gang)',
    cMean: 4500,
    cSd: 1200,
  },
  {
    name: '2. Går ned med barnevogn (Stempelskub & hjul)',
    shortLabel: '2. Barnevogn (Stempelskub)',
    cMean: 9500,
    cSd: 2500,
  },
  {
    name: '3. Et barn løber gennem kælderen (Turbulent wake)',
    shortLabel: '3. Barn løber (Wake)',
    cMean: 16000,
    cSd: 4000,
  },
  {
    name: '4. Elløbehjul til udgangen (Høj hastighed & hvirvel)',
    shortLabel: '4. Elløbehjul (Hvirvel)',
    cMean: 28000,
    cSd: 6500,
  },
  {
    name: '5. Tømning af kælderrum ved flytning (Langvarig & rørkontakt)',
    shortLabel: '5. Tømning af kælderrum',
    cMean: 65000,
    cSd: 18000,
  },
];

// Deterministic PRNG (Mulberry32) + Box-Muller normal generator seeded with 42
function createSeededRng(seed: number) {
  let state = seed >>> 0;
  const nextUniform01 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const uniform = (min: number, max: number): number =>
    min + (max - min) * nextUniform01();

  let spareNormal: number | null = null;
  const normal = (mean: number, sd: number): number => {
    if (spareNormal !== null) {
      const val = spareNormal;
      spareNormal = null;
      return mean + sd * val;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = nextUniform01();
    while (v === 0) v = nextUniform01();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    const z0 = mag * Math.cos(2.0 * Math.PI * v);
    const z1 = mag * Math.sin(2.0 * Math.PI * v);
    spareNormal = z1;
    return mean + sd * z0;
  };

  return { uniform, normal };
}

export const BasementMonteCarloSimulationWidget: React.FC<
  BasementMonteCarloSimulationWidgetProps
> = ({ currentOutdoorTempC = 6.8, onLogMonteCarloEvidence }) => {
  const [nSim, setNSim] = useState<number>(10000);
  const [seed, setSeed] = useState<number>(42);
  const [z1SalMeters, setZ1SalMeters] = useState<number>(4.8);
  const [vBoligM3, setVBoligM3] = useState<number>(200.0);
  const [aEffCm2Mean, setAEffCm2Mean] = useState<number>(25.0); // 25 cm² = 0.0025 m²
  const [kDepPerH, setKDepPerH] = useState<number>(0.18);
  const [cavMinPa, setCavMinPa] = useState<number>(5.0);
  const [cavMaxPa, setCavMaxPa] = useState<number>(15.0);
  const [selectedSeasonFilter, setSelectedSeasonFilter] = useState<string>('ALL');
  const [copiedTable, setCopiedTable] = useState<boolean>(false);
  const [copiedPython, setCopiedPython] = useState<boolean>(false);
  const [loggedConfirmation, setLoggedConfirmation] = useState<boolean>(false);

  // Physical constants from user specification (Blok 6, Afd. 23)
  const rho0 = 1.293; // kg/m³ ved T0 = 273.15 K
  const T0 = 273.15; // K
  const g = 9.81; // m/s²
  const C_const = rho0 * g * T0; // ~3464.725 Pa*K/m
  const rho_air = 1.2; // kg/m³ ved stuetemperatur
  const Cd = 0.65; // Udløbskoefficient for revner/rørgennemføringer
  const bek613LimitFibreM3 = 3000; // 0.003 fibre/cm³ = 3.000 fibre/m³

  const simulationRows: MonteCarloRowResult[] = useMemo(() => {
    const rng = createSeededRng(seed);
    const rows: MonteCarloRowResult[] = [];
    const aEffM2Mean = aEffCm2Mean / 10000.0; // cm² -> m²
    const aEffM2Sd = aEffM2Mean * 0.24; // 0.0006 / 0.0025 = 0.24

    const dPBuffer = new Float64Array(nSim);
    const qOpBuffer = new Float64Array(nSim);
    const achBuffer = new Float64Array(nSim);
    const cInBuffer = new Float64Array(nSim);

    for (const sCfg of SEASONS_CONFIG) {
      let sumDP = 0;
      let sumQOp = 0;

      for (let i = 0; i < nSim; i++) {
        const tUdeC = rng.uniform(sCfg.tMin, sCfg.tMax);
        const tUdeK = tUdeC + 273.15;
        const tSkaktC = rng.normal(22.0, 1.2);
        const tSkaktK = tSkaktC + 273.15;

        const dPTermisk =
          C_const * (1.0 / tUdeK - 1.0 / tSkaktK) * z1SalMeters;
        const dPCav = rng.uniform(cavMinPa, Math.max(cavMinPa + 0.1, cavMaxPa));
        const dPTotal = Math.max(0.1, dPTermisk + dPCav);

        const rawAEff = rng.normal(aEffM2Mean, aEffM2Sd);
        const aEff = Math.min(0.005, Math.max(0.001, rawAEff));
        const qOpM3h =
          Cd * aEff * Math.sqrt((2.0 * dPTotal) / rho_air) * 3600.0;
        const ach = rng.uniform(0.15, 0.45);

        dPBuffer[i] = dPTotal;
        qOpBuffer[i] = qOpM3h;
        achBuffer[i] = ach;

        sumDP += dPTotal;
        sumQOp += qOpM3h;
      }

      const dPTotalMean = sumDP / nSim;
      const qOpMean = sumQOp / nSim;

      for (const scCfg of SCENARIOS_CONFIG) {
        let sumCIn = 0;
        for (let i = 0; i < nSim; i++) {
          const cKld = Math.max(500.0, rng.normal(scCfg.cMean, scCfg.cSd));
          const cInFibM3 =
            (qOpBuffer[i] * cKld) / (vBoligM3 * (achBuffer[i] + kDepPerH));
          cInBuffer[i] = cInFibM3;
          sumCIn += cInFibM3;
        }

        const sorted = Float64Array.from(cInBuffer).sort();
        const p95Idx = Math.min(
          nSim - 1,
          Math.max(0, Math.floor(0.95 * (nSim - 1)))
        );
        const cInMean = sumCIn / nSim;
        const cInP95 = sorted[p95Idx];

        rows.push({
          season: sCfg.name,
          scenario: scCfg.name,
          dPTotalPaMean: Number(dPTotalMean.toFixed(4)),
          qOpM3hMean: Number(qOpMean.toFixed(4)),
          cInFibreM3Mean: Number(cInMean.toFixed(2)),
          cInFibreM3P95: Number(cInP95.toFixed(2)),
          cInFibreCm3Mean: Number((cInMean / 1_000_000).toFixed(5)),
          cInFibreCm3P95: Number((cInP95 / 1_000_000).toFixed(5)),
          pctOfBek613LimitP95: Math.round((cInP95 / bek613LimitFibreM3) * 100),
        });
      }
    }

    return rows;
  }, [
    C_const,
    aEffCm2Mean,
    cavMaxPa,
    cavMinPa,
    kDepPerH,
    nSim,
    seed,
    vBoligM3,
    z1SalMeters,
  ]);

  const filteredRows = useMemo(
    () =>
      selectedSeasonFilter === 'ALL'
        ? simulationRows
        : simulationRows.filter((r) => r.season === selectedSeasonFilter),
    [selectedSeasonFilter, simulationRows]
  );

  // Format as exact pandas df_out.to_string(index=False)
  const dataframeStringOutput = useMemo(() => {
    const header =
      '                        Årstid                                                      Scenarie  dP_total_Pa_mean  Q_op_m3h_mean  C_in_fibre_m3_mean  C_in_fibre_m3_p95';
    const lines = simulationRows.map((r) => {
      const colSeason = r.season.padStart(30, ' ');
      const colScenario = r.scenario.padStart(62, ' ');
      const colDp = r.dPTotalPaMean.toFixed(6).padStart(16, ' ');
      const colQop = r.qOpM3hMean.toFixed(6).padStart(14, ' ');
      const colMean = r.cInFibreM3Mean.toFixed(2).padStart(19, ' ');
      const colP95 = r.cInFibreM3P95.toFixed(2).padStart(18, ' ');
      return `${colSeason}  ${colScenario}  ${colDp}  ${colQop}  ${colMean}  ${colP95}`;
    });
    return [header, ...lines].join('\n');
  }, [simulationRows]);

  const worstRow = useMemo(() => {
    return simulationRows.reduce(
      (acc, r) => (r.cInFibreM3P95 > acc.cInFibreM3P95 ? r : acc),
      simulationRows[0]
    );
  }, [simulationRows]);

  const activeWeatherMatchedSeason = useMemo(() => {
    if (currentOutdoorTempC <= 2.0) return 'Vinter (-5 til 2 °C)';
    if (currentOutdoorTempC <= 12.0) return 'Forår/Efterår (5 til 12 °C)';
    if (currentOutdoorTempC <= 18.0) return 'Sommer - Kølig (14 til 18 °C)';
    return 'Sommer - Varm (20 til 25 °C)';
  }, [currentOutdoorTempC]);

  const handleCopyDataframe = () => {
    navigator.clipboard.writeText(dataframeStringOutput);
    setCopiedTable(true);
    window.setTimeout(() => setCopiedTable(false), 2500);
  };

  const handleResetCalibratedDefaults = () => {
    setNSim(10000);
    setSeed(42);
    setZ1SalMeters(4.8);
    setVBoligM3(200.0);
    setAEffCm2Mean(25.0);
    setKDepPerH(0.18);
    setCavMinPa(5.0);
    setCavMaxPa(15.0);
  };

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-purple-400 rounded-md p-3.5 space-y-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400 shrink-0" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-extrabold text-purple-300">
              Monte Carlo Kælder-til-1.-Sal Asbest-Infiltration (Blok 6, Afd. 23 · N = {nSim.toLocaleString('da-DK')})
            </h3>
          </div>
          <p className="text-[11px] text-slate-300 font-mono">
            Stokastisk modellering af termisk skorstenstryk{' '}
            <code className="text-cyan-300">
              dP_termisk = C_const · (1/T_ude - 1/T_skakt) · z_1sal
            </code>{' '}
            + CAV-undertryk (<code className="text-amber-300">{cavMinPa}–{cavMaxPa} Pa</code>) &amp;
            resuspension fra kældergulv/rørisolering (<code className="text-rose-300">C_kld</code>) op
            til 1. sal (<code className="text-emerald-300">z = {z1SalMeters} m, V = {vBoligM3} m³</code>).
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded bg-purple-950/90 border border-purple-400/60 text-[11px] font-mono font-bold text-purple-200">
            seed = {seed} · C_const = {C_const.toFixed(1)} Pa·K/m
          </span>
          <button
            type="button"
            onClick={handleResetCalibratedDefaults}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-mono text-slate-200 flex items-center gap-1 cursor-pointer"
            title="Nulstil til Python-scriptets kalibrerede standardværdier"
          >
            <RefreshCw className="w-3 h-3 text-cyan-400" />
            <span>Nulstil (Blok 6)</span>
          </button>
        </div>
      </div>

      {/* Physical Constants & Interactive Sliders */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
        <div className="p-2 rounded bg-slate-950/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>HØJDE KÆLDER → 1. SAL (z_1sal)</span>
            <strong className="text-cyan-300">{z1SalMeters.toFixed(1)} m</strong>
          </div>
          <input
            type="range"
            min={2.5}
            max={10.8}
            step={0.1}
            value={z1SalMeters}
            onChange={(e) => setZ1SalMeters(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="text-[11px] text-slate-400">Standard Blok 6: 4,8 m (1. sal)</div>
        </div>

        <div className="p-2 rounded bg-slate-950/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>LÆKAGEAREAL RØR/REVNER (A_eff)</span>
            <strong className="text-amber-300">
              {aEffCm2Mean.toFixed(0)} cm² ({(aEffCm2Mean / 10000).toFixed(4)} m²)
            </strong>
          </div>
          <input
            type="range"
            min={10}
            max={50}
            step={1}
            value={aEffCm2Mean}
            onChange={(e) => setAEffCm2Mean(Number(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
          <div className="text-[11px] text-slate-400">Normalfordelt μ=25 cm², σ=6 cm²</div>
        </div>

        <div className="p-2 rounded bg-slate-950/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>BOLIGVOLUMEN 1. SAL (V_bolig)</span>
            <strong className="text-emerald-300">{vBoligM3.toFixed(0)} m³</strong>
          </div>
          <input
            type="range"
            min={120}
            max={260}
            step={5}
            value={vBoligM3}
            onChange={(e) => setVBoligM3(Number(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer"
          />
          <div className="text-[11px] text-slate-400">k_dep = {kDepPerH} h⁻¹ · Cd = {Cd}</div>
        </div>

        <div className="p-2 rounded bg-slate-950/90 border border-rose-500/40 space-y-1">
          <div className="text-slate-400 text-[11px]">SPIDS P95 (VINTER · FLYTNING)</div>
          <div className="text-sm font-extrabold text-rose-400">
            {worstRow.cInFibreM3P95.toLocaleString('da-DK', {
              maximumFractionDigits: 0,
            })}{' '}
            fibre/m³
          </div>
          <div className="text-[11px] text-amber-300">
            = {worstRow.cInFibreCm3P95.toFixed(4)} f/cm³ ({worstRow.pctOfBek613LimitP95} % af BEK 613/2026)
          </div>
        </div>
      </div>

      {/* Formula & Seasonal Filter Bar */}
      <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
        <div className="text-slate-200 space-y-0.5">
          <div>
            <span className="text-purple-300 font-bold">Massebalance (1. sal): </span>
            <code className="text-white">
              C_in = (Q_op · C_kld) / (V_bolig · (ACH + k_dep))
            </code>{' '}
            &nbsp;|&nbsp;{' '}
            <code className="text-cyan-300">
              Q_op = Cd · A_eff · √(2 · dP_total / ρ_air) · 3600
            </code>
          </div>
          <div className="text-[11px] text-slate-400">
            Aktuel Open-Meteo udetemperatur ({currentOutdoorTempC.toFixed(1)} °C) svarer til:{' '}
            <strong className="text-amber-300">{activeWeatherMatchedSeason}</strong> · BEK 613/2026
            grænseværdi: <strong className="text-rose-300">3.000 fibre/m³ (0,003 fibre/cm³)</strong>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedSeasonFilter('ALL')}
            className={`px-2 py-1 rounded text-[11px] font-mono border cursor-pointer ${
              selectedSeasonFilter === 'ALL'
                ? 'bg-purple-500/25 border-purple-400 text-purple-100 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Alle 4 Årstider (20 rækker)
          </button>
          {SEASONS_CONFIG.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setSelectedSeasonFilter(s.name)}
              className={`px-2 py-1 rounded text-[11px] font-mono border cursor-pointer ${
                selectedSeasonFilter === s.name
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {s.name.split(' (')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Visual Comparison of Scenarios (Mean vs. P95 across Seasons) */}
      <div className="p-3 rounded bg-slate-950/95 border border-slate-800 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
          <span className="text-cyan-300 font-bold uppercase flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Fordeling af Indendørs Asbest på 1. Sal (C_in_fibre_m3_mean vs. P95-percentil)
            </span>
          </span>
          <span className="text-rose-300 text-[11px]">
            Rød stiplet linje = BEK 613/2026 Grænseværdi (3.000 fibre/m³ = 0,003 fibre/cm³)
          </span>
        </div>

        <svg
          viewBox="0 0 760 220"
          className="w-full h-auto bg-slate-950 rounded border border-slate-800/90"
        >
          {/* Horizontal grid lines & BEK 613/2026 threshold */}
          {[0, 3000, 6000, 9000, 12000, 15000].map((val) => {
            const maxScale = 16000;
            const y = 185 - (Math.min(maxScale, val) / maxScale) * 155;
            const isLimit = val === 3000;
            return (
              <g key={val}>
                <line
                  x1={62}
                  y1={y}
                  x2={740}
                  y2={y}
                  stroke={isLimit ? '#f43f5e' : '#1e293b'}
                  strokeWidth={isLimit ? 1.5 : 1}
                  strokeDasharray={isLimit ? '5,4' : undefined}
                />
                <text
                  x={56}
                  y={y + 3}
                  textAnchor="end"
                  fill={isLimit ? '#fda4af' : '#94a3b8'}
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {val.toLocaleString('da-DK')}
                </text>
                {isLimit && (
                  <text
                    x={736}
                    y={y - 4}
                    textAnchor="end"
                    fill="#fda4af"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    BEK 613/2026 GV: 3.000 fibre/m³ (0,003 f/cm³)
                  </text>
                )}
              </g>
            );
          })}

          {/* Grouped bars per scenario for Winter vs. Warm Summer */}
          {SCENARIOS_CONFIG.map((sc, scIdx) => {
            const winterRow = simulationRows.find(
              (r) => r.season.startsWith('Vinter') && r.scenario === sc.name
            );
            const summerRow = simulationRows.find(
              (r) => r.season.startsWith('Sommer - Varm') && r.scenario === sc.name
            );
            const maxScale = 16000;
            const groupX = 82 + scIdx * 132;

            const wMeanH = Math.min(
              155,
              ((winterRow?.cInFibreM3Mean ?? 0) / maxScale) * 155
            );
            const wP95H = Math.min(
              155,
              ((winterRow?.cInFibreM3P95 ?? 0) / maxScale) * 155
            );
            const sP95H = Math.min(
              155,
              ((summerRow?.cInFibreM3P95 ?? 0) / maxScale) * 155
            );

            return (
              <g key={sc.name}>
                {/* Winter Mean */}
                <rect
                  x={groupX}
                  y={185 - wMeanH}
                  width={24}
                  height={wMeanH}
                  rx={2}
                  fill="#38bdf8"
                  opacity={0.9}
                />
                {/* Winter P95 */}
                <rect
                  x={groupX + 27}
                  y={185 - wP95H}
                  width={24}
                  height={wP95H}
                  rx={2}
                  fill="#f43f5e"
                  opacity={0.92}
                />
                {/* Warm Summer P95 */}
                <rect
                  x={groupX + 54}
                  y={185 - sP95H}
                  width={24}
                  height={sP95H}
                  rx={2}
                  fill="#f59e0b"
                  opacity={0.88}
                />

                {/* Value labels on top of Winter P95 */}
                <text
                  x={groupX + 39}
                  y={Math.max(14, 181 - wP95H)}
                  textAnchor="middle"
                  fill="#fecdd3"
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {Math.round(winterRow?.cInFibreM3P95 ?? 0).toLocaleString('da-DK')}
                </text>

                {/* X-axis scenario label */}
                <text
                  x={groupX + 39}
                  y={202}
                  textAnchor="middle"
                  fill="#e2e8f0"
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {sc.shortLabel}
                </text>
              </g>
            );
          })}

          {/* Legend */}
          <g transform="translate(72, 12)">
            <rect x={0} y={0} width={10} height={8} fill="#38bdf8" rx={1} />
            <text x={14} y={7.5} fill="#cbd5e1" fontSize="9.5" fontFamily="monospace">
              Vinter Middel (Mean)
            </text>
            <rect x={145} y={0} width={10} height={8} fill="#f43f5e" rx={1} />
            <text x={159} y={7.5} fill="#fecdd3" fontSize="9.5" fontFamily="monospace">
              Vinter 95-Percentil (P95)
            </text>
            <rect x={315} y={0} width={10} height={8} fill="#f59e0b" rx={1} />
            <text x={329} y={7.5} fill="#fde68a" fontSize="9.5" fontFamily="monospace">
              Varm Sommer 95-Percentil (P95)
            </text>
          </g>
        </svg>
      </div>

      {/* DataFrame Table (20 rows) */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-mono font-bold text-slate-200 uppercase">
            Simulerings-DataFrame (`df_out` · {filteredRows.length} rækker):
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyDataframe}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-mono text-cyan-300 flex items-center gap-1 cursor-pointer"
            >
              {copiedTable ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Kopieret df_out!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Kopiér df_out.to_string(index=False)</span>
                </>
              )}
            </button>
            {onLogMonteCarloEvidence && (
              <button
                type="button"
                onClick={() => {
                  onLogMonteCarloEvidence(
                    `Monte Carlo Kælder-Infiltration (Blok 6, Afd. 23 · N=${nSim})`,
                    `Vinter P95 ved tømning af kælderrum: C_in,P95 = ${worstRow.cInFibreM3P95.toFixed(
                      0
                    )} fibre/m³ (${worstRow.cInFibreCm3P95.toFixed(
                      4
                    )} fibre/cm³ = ${worstRow.pctOfBek613LimitP95}% af BEK 613/2026 GV). dP_total = ${worstRow.dPTotalPaMean.toFixed(
                      2
                    )} Pa, Q_op = ${worstRow.qOpM3hMean.toFixed(2)} m³/h.`
                  );
                  setLoggedConfirmation(true);
                  window.setTimeout(() => setLoggedConfirmation(false), 3000);
                }}
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer"
              >
                <ShieldAlert className="w-3 h-3" />
                <span>
                  {loggedConfirmation
                    ? 'Forseglet i SHA-256 Bevislog!'
                    : 'Log i Algedonisk SHA-256 Bevis-Kæde'}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded border border-slate-800 bg-slate-950 max-h-80">
          <table className="w-full text-left border-collapse font-mono text-[11px]">
            <thead>
              <tr className="bg-slate-900/95 border-b border-slate-800 text-slate-300 text-[11px] uppercase">
                <th className="py-1.5 px-2.5">Årstid</th>
                <th className="py-1.5 px-2.5">Scenarie (Kælder-Aktivitet)</th>
                <th className="py-1.5 px-2 text-right">dP_total_Pa_mean</th>
                <th className="py-1.5 px-2 text-right">Q_op_m3h_mean</th>
                <th className="py-1.5 px-2 text-right">C_in_fibre_m3_mean</th>
                <th className="py-1.5 px-2 text-right">C_in_fibre_m3_p95</th>
                <th className="py-1.5 px-2.5 text-right">BEK 613 Status (P95)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredRows.map((row, idx) => {
                const exceedsGv = row.cInFibreM3P95 >= bek613LimitFibreM3;
                const exceedsWho = row.cInFibreM3P95 >= 1000;
                return (
                  <tr
                    key={`${row.season}-${row.scenario}-${idx}`}
                    className={
                      exceedsGv
                        ? 'bg-rose-950/25 hover:bg-rose-950/40'
                        : exceedsWho
                        ? 'bg-amber-950/15 hover:bg-amber-950/30'
                        : 'hover:bg-slate-900/60'
                    }
                  >
                    <td className="py-1.5 px-2.5 text-cyan-300 whitespace-nowrap">
                      {row.season}
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-200">
                      {row.scenario}
                    </td>
                    <td className="py-1.5 px-2 text-right text-amber-300">
                      {row.dPTotalPaMean.toFixed(2)} Pa
                    </td>
                    <td className="py-1.5 px-2 text-right text-emerald-300">
                      {row.qOpM3hMean.toFixed(2)} m³/h
                    </td>
                    <td className="py-1.5 px-2 text-right text-white font-semibold">
                      {row.cInFibreM3Mean.toFixed(1)}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right font-bold ${
                        exceedsGv
                          ? 'text-rose-400'
                          : exceedsWho
                          ? 'text-amber-300'
                          : 'text-slate-200'
                      }`}
                    >
                      {row.cInFibreM3P95.toFixed(1)}
                    </td>
                    <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                          exceedsGv
                            ? 'bg-rose-600/90 text-white'
                            : exceedsWho
                            ? 'bg-amber-500/25 border border-amber-400/50 text-amber-200'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {row.pctOfBek613LimitP95}% af GV ({row.cInFibreCm3P95.toFixed(4)} f/cm³)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
