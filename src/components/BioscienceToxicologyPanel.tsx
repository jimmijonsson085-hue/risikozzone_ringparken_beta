/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as $3Dmol from '3dmol';
import SmilesDrawer from 'smiles-drawer';
import {
  Atom,
  BookOpen,
  CheckCircle2,
  Compass,
  Dna,
  ExternalLink,
  FlaskConical,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import {
  AlphaFoldPredictionMeta,
  EuropePmcArticle,
  fetchAlphaFoldStructureAndMeta,
  fetchEuropePmcLiterature,
  fetchPubChemCompound,
  fetchUniProtProfile,
  fetchWithRetry,
  PlddtSummary,
  PubChemCompoundProfile,
  ResiduePlddtScore,
  RINGPARKEN_TOXICOLOGY_PRESETS,
  RingparkenToxicologyPreset,
  resolveToUniProtAccession,
  UniProtFeatureItem,
  UniProtProteinProfile,
} from '../services/bioscienceApi';
import { RINGPARKEN_ENVIRONMENTAL_PROFILES } from '../data/ringparkenEnvironmentalSamples';
import {
  HourlyWeatherPoint,
  PuffAccumulationResult,
  ReceptorExposureResult,
  SubstanceConcentrationBreakdown,
} from '../types/dispersion';
import {
  buildReceptorWhoProfile,
  WhoCumulativeExposureScoreWidget,
} from './WhoCumulativeExposureScoreWidget';

interface BioscienceToxicologyPanelProps {
  selectedReceptorName: string;
  selectedReceptorSubstances: SubstanceConcentrationBreakdown[];
  hourLabel: string;
  dateIso: string;
  puff24h?: PuffAccumulationResult;
  receptorExposures?: ReceptorExposureResult[];
  selectedReceptorId?: string;
  onSelectReceptor?: (receptorId: string) => void;
  selectedHourIndex?: number;
  onSelectHour?: (hourIndex: number) => void;
  currentWeather?: HourlyWeatherPoint;
}

type InspectorSubTab = 'structure' | 'chemistry' | 'literature' | 'who_score';
type StructureSourceMode = 'alphafold' | 'pdb';
type ViewerRenderStyle = 'cartoon_plddt' | 'cartoon_spectrum' | 'stick' | 'sphere';

export const BioscienceToxicologyPanel: React.FC<BioscienceToxicologyPanelProps> = ({
  selectedReceptorName,
  selectedReceptorSubstances,
  hourLabel,
  dateIso,
  puff24h,
  receptorExposures,
  selectedReceptorId,
  onSelectReceptor,
  selectedHourIndex,
  onSelectHour,
  currentWeather,
}) => {
  const [activePreset, setActivePreset] = useState<RingparkenToxicologyPreset>(
    RINGPARKEN_TOXICOLOGY_PRESETS[0]
  );
  const [subTab, setSubTab] = useState<InspectorSubTab>('structure');

  // Search inputs for custom queries
  const [customProteinInput, setCustomProteinInput] = useState<string>('Q92560');
  const [customChemicalInput, setCustomChemicalInput] = useState<string>('24261');
  const [customLitInput, setCustomLitInput] = useState<string>(
    RINGPARKEN_TOXICOLOGY_PRESETS[0].literatureQuery
  );

  // Live API states
  const [afMeta, setAfMeta] = useState<AlphaFoldPredictionMeta | null>(null);
  const [plddtSummary, setPlddtSummary] = useState<PlddtSummary | null>(null);
  const [uniprotProfile, setUniprotProfile] = useState<UniProtProteinProfile | null>(null);
  const [pubchemProfile, setPubchemProfile] = useState<PubChemCompoundProfile | null>(null);
  const [litHitCount, setLitHitCount] = useState<number>(0);
  const [litArticles, setLitArticles] = useState<EuropePmcArticle[]>([]);

  // Loading & Error states
  const [isLoadingProtein, setIsLoadingProtein] = useState<boolean>(false);
  const [proteinError, setProteinError] = useState<string | null>(null);
  const [isLoadingChem, setIsLoadingChem] = useState<boolean>(false);
  const [chemError, setChemError] = useState<string | null>(null);
  const [isLoadingLit, setIsLoadingLit] = useState<boolean>(false);
  const [litError, setLitError] = useState<string | null>(null);

  // 3Dmol.js Viewer State
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const viewerInstanceRef = useRef<any>(null);
  const cifCacheRef = useRef<string>('');
  const [structureSourceMode, setStructureSourceMode] = useState<StructureSourceMode>('alphafold');
  const [activePdbId, setActivePdbId] = useState<string>(
    RINGPARKEN_TOXICOLOGY_PRESETS[0].experimentalPdbId
  );
  const [renderStyle, setRenderStyle] = useState<ViewerRenderStyle>('cartoon_plddt');
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [isLightCanvas, setIsLightCanvas] = useState<boolean>(false);
  const [selectedResidue, setSelectedResidue] = useState<{
    resi: number;
    resn: string;
    chain: string;
    plddt: number;
    description?: string;
  } | null>(null);

  // SmilesDrawer 2D Canvas Ref
  const smilesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [expandedPmid, setExpandedPmid] = useState<string | null>(null);

  // Apply style and pLDDT coloring to the active 3Dmol viewer
  const applyViewerStyling = useCallback(
    (viewer: any, styleMode: ViewerRenderStyle, sourceMode: StructureSourceMode) => {
      if (!viewer) return;
      viewer.setStyle({}, {}); // Clear previous styles

      const plddtColorFunc = (atom: any) => {
        const b = atom.b ?? 0;
        if (b > 90) return '#0053D6'; // Very high (>90): Dark Blue
        if (b > 70) return '#65CBF3'; // Confident (70-90): Light Blue
        if (b > 50) return '#FFDB13'; // Low (50-70): Yellow
        return '#FF7D45'; // Very low (<50): Orange / Disordered
      };

      if (styleMode === 'cartoon_plddt' && sourceMode === 'alphafold') {
        viewer.setStyle({}, { cartoon: { colorfunc: plddtColorFunc } });
      } else if (styleMode === 'cartoon_spectrum' || styleMode === 'cartoon_plddt') {
        viewer.setStyle({ hetflag: false }, { cartoon: { color: 'spectrum' } });
        viewer.setStyle(
          { hetflag: true, resn: ['HOH', 'WAT'], invert: true },
          {
            stick: { radius: 0.25, colorscheme: 'Jmol' },
            sphere: { scale: 0.3, colorscheme: 'Jmol' },
          }
        );
      } else if (styleMode === 'stick') {
        viewer.setStyle(
          {},
          {
            cartoon: { color: '#64748b', opacity: 0.45 },
            stick: { radius: 0.18, colorfunc: sourceMode === 'alphafold' ? plddtColorFunc : undefined },
          }
        );
      } else if (styleMode === 'sphere') {
        viewer.setStyle(
          {},
          {
            sphere: {
              scale: 0.65,
              colorfunc: sourceMode === 'alphafold' ? plddtColorFunc : undefined,
            },
          }
        );
      }

      viewer.render();
    },
    []
  );

  // Initialize 3Dmol viewer once
  useEffect(() => {
    if (!viewerContainerRef.current) return;
    if (!viewerInstanceRef.current) {
      try {
        viewerInstanceRef.current = $3Dmol.createViewer(viewerContainerRef.current, {
          defaultcolors: $3Dmol.rasmolElementColors,
          backgroundColor: '#0f172a',
          antialias: true,
        });
      } catch (err) {
        console.error('3Dmol viewer initialization failed:', err);
      }
    }
  }, []);

  // Load coordinate text into 3Dmol viewer
  const renderCoordinateModel = useCallback(
    (cifText: string, sourceMode: StructureSourceMode, styleMode: ViewerRenderStyle) => {
      const viewer = viewerInstanceRef.current;
      if (!viewer || !cifText) return;

      try {
        viewer.removeAllShapes();
        viewer.clear();
        viewer.addModel(cifText, 'cif');
        applyViewerStyling(viewer, styleMode, sourceMode);
        viewer.zoomTo();
        viewer.render();

        viewer.setClickable({}, true, (atom: any) => {
          if (!atom) return;
          setSelectedResidue({
            resi: atom.resi,
            resn: atom.resn,
            chain: atom.chain || 'A',
            plddt: Number((atom.b ?? 0).toFixed(1)),
          });
          viewer.removeAllShapes();
          viewer.addSphere({
            center: { x: atom.x, y: atom.y, z: atom.z },
            radius: 2.2,
            color: '#38bdf8',
            opacity: 0.55,
          });
          viewer.render();
        });
      } catch (err) {
        console.error('Error rendering 3D structure:', err);
      }
    },
    [applyViewerStyling]
  );

  // Focus 3D camera on a specific residue or domain range
  const focusResidueRangeIn3D = useCallback(
    (startRes: number, endRes?: number, label?: string) => {
      const viewer = viewerInstanceRef.current;
      if (!viewer) return;
      const targetEnd = endRes && endRes >= startRes ? endRes : startRes;
      const resList: number[] = [];
      for (let r = startRes; r <= Math.min(targetEnd, startRes + 60); r++) {
        resList.push(r);
      }

      const matchedResidue = plddtSummary?.residues.find((r) => r.residueNumber === startRes);
      setSelectedResidue({
        resi: startRes,
        resn: matchedResidue?.residueName ?? 'RES',
        chain: matchedResidue?.chain ?? 'A',
        plddt: matchedResidue?.plddt ?? 0,
        description: label,
      });

      try {
        applyViewerStyling(viewer, renderStyle, structureSourceMode);
        viewer.addStyle(
          { resi: resList },
          {
            stick: { radius: 0.3, color: '#f43f5e' },
            cartoon: { color: '#f43f5e' },
          }
        );
        viewer.zoomTo({ resi: resList }, 600);
        viewer.render();
      } catch (err) {
        console.error('Failed to focus residue range:', err);
      }
    },
    [applyViewerStyling, plddtSummary, renderStyle, structureSourceMode]
  );

  // Update 3D viewer background color when toggled
  useEffect(() => {
    const viewer = viewerInstanceRef.current;
    if (!viewer) return;
    viewer.setBackgroundColor(isLightCanvas ? '#F8FAFC' : '#0F172A');
    viewer.render();
  }, [isLightCanvas]);

  // Update spin state
  useEffect(() => {
    const viewer = viewerInstanceRef.current;
    if (!viewer) return;
    viewer.spin(isSpinning ? 'y' : false);
  }, [isSpinning]);

  // Re-apply style when renderStyle changes
  useEffect(() => {
    const viewer = viewerInstanceRef.current;
    if (!viewer || !cifCacheRef.current) return;
    applyViewerStyling(viewer, renderStyle, structureSourceMode);
  }, [applyViewerStyling, renderStyle, structureSourceMode]);

  // Load AlphaFold + UniProt protein data
  const loadProteinTarget = useCallback(
    async (accessionOrGene: string, fallbackPdbId?: string) => {
      setIsLoadingProtein(true);
      setProteinError(null);
      setSelectedResidue(null);
      try {
        const resolvedAcc = await resolveToUniProtAccession(accessionOrGene);
        setCustomProteinInput(resolvedAcc);

        const [afData, uniData] = await Promise.all([
          fetchAlphaFoldStructureAndMeta(resolvedAcc),
          fetchUniProtProfile(resolvedAcc),
        ]);

        setAfMeta(afData.meta);
        setPlddtSummary(afData.plddtSummary);
        setUniprotProfile(uniData);
        setStructureSourceMode('alphafold');

        if (fallbackPdbId) {
          setActivePdbId(fallbackPdbId);
        } else if (uniData.pdbIds.length > 0) {
          setActivePdbId(uniData.pdbIds[0]);
        }

        cifCacheRef.current = afData.cifText;
        renderCoordinateModel(afData.cifText, 'alphafold', renderStyle);
      } catch (err: any) {
        setProteinError(err?.message || 'Kunne ikke hente proteinstruktur fra AlphaFold/UniProt.');
      } finally {
        setIsLoadingProtein(false);
      }
    },
    [renderCoordinateModel, renderStyle]
  );

  // Switch between AlphaFold predicted model and experimental RCSB PDB structure
  const handleSwitchStructureSource = useCallback(
    async (mode: StructureSourceMode, pdbIdOverride?: string) => {
      const targetPdb = (pdbIdOverride || activePdbId).trim().toUpperCase();
      setStructureSourceMode(mode);
      setSelectedResidue(null);

      if (mode === 'alphafold' && afMeta) {
        setIsLoadingProtein(true);
        try {
          const res = await fetchWithRetry(afMeta.cifUrl);
          const cifText = await res.text();
          cifCacheRef.current = cifText;
          renderCoordinateModel(cifText, 'alphafold', 'cartoon_plddt');
          setRenderStyle('cartoon_plddt');
        } catch (err: any) {
          setProteinError(err?.message || 'Fejl ved skift til AlphaFold struktur.');
        } finally {
          setIsLoadingProtein(false);
        }
      } else if (mode === 'pdb' && targetPdb) {
        setIsLoadingProtein(true);
        setProteinError(null);
        try {
          setActivePdbId(targetPdb);
          const res = await fetchWithRetry(
            `https://files.rcsb.org/download/${targetPdb}.cif`
          );
          if (!res.ok) {
            throw new Error(`RCSB PDB struktur ${targetPdb} kunne ikke hentes (HTTP ${res.status})`);
          }
          const cifText = await res.text();
          cifCacheRef.current = cifText;
          setRenderStyle('cartoon_spectrum');
          renderCoordinateModel(cifText, 'pdb', 'cartoon_spectrum');
        } catch (err: any) {
          setProteinError(err?.message || `Kunne ikke hente eksperimentel PDB ${targetPdb}.`);
        } finally {
          setIsLoadingProtein(false);
        }
      }
    },
    [activePdbId, afMeta, renderCoordinateModel]
  );

  // Load PubChem compound data
  const loadChemicalCompound = useCallback(
    async (cidOrName: number | string, displayName?: string) => {
      setIsLoadingChem(true);
      setChemError(null);
      try {
        const profile = await fetchPubChemCompound(cidOrName, displayName);
        setPubchemProfile(profile);
        setCustomChemicalInput(String(profile.cid));
      } catch (err: any) {
        setChemError(err?.message || 'Kunne ikke hente kemiske data fra PubChem PUG REST.');
      } finally {
        setIsLoadingChem(false);
      }
    },
    []
  );

  // Render 2D SMILES to Canvas using SmilesDrawer whenever pubchemProfile updates or subTab==='chemistry'
  useEffect(() => {
    if (subTab !== 'chemistry') return;
    const smiles = pubchemProfile?.canonicalSmiles || activePreset.fallbackSmiles;
    if (!smiles || !smilesCanvasRef.current) return;

    try {
      const options = {
        width: 220,
        height: 180,
        bondThickness: 1.6,
        bondLength: 16,
        themes: {
          dark: {
            C: '#f8fafc',
            O: '#ef4444',
            N: '#3b82f6',
            S: '#eab308',
            P: '#f97316',
            Cl: '#22c55e',
            F: '#10b981',
            Br: '#a855f7',
            Si: '#38bdf8',
            Cr: '#f59e0b',
            Pb: '#f43f5e',
            BACKGROUND: 'transparent',
          },
        },
      };
      const drawer = new SmilesDrawer.Drawer(options);
      SmilesDrawer.parse(
        smiles,
        (tree: any) => {
          if (smilesCanvasRef.current) {
            drawer.draw(tree, smilesCanvasRef.current, 'dark', false);
          }
        },
        (err: any) => {
          console.warn('SmilesDrawer parse fallback:', err);
        }
      );
    } catch (err) {
      console.warn('SmilesDrawer render warning:', err);
    }
  }, [pubchemProfile, activePreset, subTab]);

  // Load Europe PMC literature
  const loadLiterature = useCallback(async (query: string) => {
    setIsLoadingLit(true);
    setLitError(null);
    try {
      const res = await fetchEuropePmcLiterature(query, 6);
      setLitHitCount(res.hitCount);
      setLitArticles(res.articles);
    } catch (err: any) {
      setLitError(err?.message || 'Kunne ikke hente biomedicinsk litteratur fra Europe PMC.');
    } finally {
      setIsLoadingLit(false);
    }
  }, []);

  // Load full preset (Protein + Chemical + Literature)
  const handleSelectPreset = useCallback(
    (preset: RingparkenToxicologyPreset) => {
      setActivePreset(preset);
      setCustomProteinInput(preset.uniprotAccession);
      setCustomChemicalInput(String(preset.pubchemCid));
      setCustomLitInput(preset.literatureQuery);
      setActivePdbId(preset.experimentalPdbId);

      loadProteinTarget(preset.uniprotAccession, preset.experimentalPdbId);
      loadChemicalCompound(preset.pubchemCid, preset.pubchemCompoundName);
      loadLiterature(preset.literatureQuery);
    },
    [loadChemicalCompound, loadLiterature, loadProteinTarget]
  );

  // Auto-load initial Ringparken preset on mount
  useEffect(() => {
    handleSelectPreset(RINGPARKEN_TOXICOLOGY_PRESETS[0]);
  }, [handleSelectPreset]);

  // Match current preset's substance to live dispersion exposure at selected receptor
  const liveSubstanceTelemetry = selectedReceptorSubstances.find(
    (s) => s.key === activePreset.substanceKey
  );

  // Compute WHO daily cumulative dust exposure forecast for the active receptor
  const activeReceptorWhoForecast = React.useMemo(() => {
    if (!puff24h || puff24h.receptorSummaries.length === 0) return null;
    const recIdx = puff24h.receptorSummaries.findIndex(
      (r) =>
        r.receptorId === selectedReceptorId ||
        r.receptorName === selectedReceptorName
    );
    const targetIdx = recIdx >= 0 ? recIdx : 0;
    const targetRec = puff24h.receptorSummaries[targetIdx];
    return buildReceptorWhoProfile(
      targetRec,
      targetIdx,
      selectedHourIndex ?? 0,
      true,
      true
    );
  }, [puff24h, selectedReceptorId, selectedReceptorName, selectedHourIndex]);

  return (
    <div className="space-y-3.5">
      {/* Header Banner: Bioscience & Molekylær Toksikologi Workbench */}
      <div className="p-3.5 bg-slate-900/90 border border-teal-500/40 rounded-md space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-teal-300">
            <Dna className="w-4 h-4 text-teal-400 shrink-0" />
            <span>Molekylær Toksikologi &amp; Strukturbiologi (DeepMind Science)</span>
          </div>
          <span className="text-[10px] font-mono text-teal-200">
            AlphaFold v6 · UniProt · PubChem · Europe PMC
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Kobl de 5 nedrivningsstoffer fra Ringparken direkte til deres humane receptor- og
          target-proteiner i 3D (<strong className="text-white">AlphaFold DB / RCSB PDB</strong>),
          fysisk-kemiske toksikokinetik (<strong className="text-white">PubChem PUG REST</strong>)
          og peer-reviewed evidens (<strong className="text-white">Europe PMC</strong>).
        </p>

        {/* Live Receptor Dispersion Link */}
        {liveSubstanceTelemetry && (
          <div className="p-2 rounded bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2 text-[11px] font-mono">
            <div className="truncate">
              <span className="text-slate-400">Aktiv Receptor ({hourLabel}):</span>{' '}
              <strong className="text-white">{selectedReceptorName.split('(')[0]}</strong> ·{' '}
              <span className="text-teal-300">{liveSubstanceTelemetry.name}</span>
            </div>
            <div className="shrink-0 font-bold text-amber-300 tabular-nums">
              {liveSubstanceTelemetry.concentration} {liveSubstanceTelemetry.unit} (C/GV={' '}
              {liveSubstanceTelemetry.quotient.toFixed(3)})
            </div>
          </div>
        )}

        {/* Verificerede Bygningsdele & DMA-Prøveresultater for valgt stof i Ringparken */}
        <div className="p-2.5 rounded bg-slate-950/90 border border-teal-500/30 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
            <span className="text-teal-300 font-bold uppercase tracking-wider">
              Konstaterede Bygningsdele i Ringparken ({activePreset.shortLabel}) — DMA & Wissenberg PSS W22085
            </span>
            <span className="text-slate-400">RING_K18_C08.7 & 2021-2791</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-1.5 text-[10px]">
            {[
              RINGPARKEN_ENVIRONMENTAL_PROFILES.find((p) => p.buildingId === 'BLOK-1'),
              RINGPARKEN_ENVIRONMENTAL_PROFILES.find((p) => p.buildingId === 'BYG-1-BOERNEHAVE'),
              RINGPARKEN_ENVIRONMENTAL_PROFILES.find((p) => p.buildingId === 'BYG-2-BAZAR'),
              RINGPARKEN_ENVIRONMENTAL_PROFILES.find((p) => p.buildingId === 'BYG-3-FRITIDSHJEM'),
              RINGPARKEN_ENVIRONMENTAL_PROFILES.find((p) => p.buildingId === 'BLOK-2'),
            ]
              .filter(Boolean)
              .map((prof) => {
                if (!prof) return null;
                const sKey = activePreset.substanceKey;
                const sample = prof.substanceSamples.find((s) => s.substanceKey === sKey);
                const components = sample?.exactBuildingComponents || [];
                return (
                  <div
                    key={prof.buildingId}
                    className="p-1.5 rounded bg-slate-900/90 border border-slate-800 space-y-0.5"
                  >
                    <div className="font-mono font-bold text-amber-300 truncate">
                      {prof.buildingId === 'BLOK-2' ? 'Blok 2–20 (Afd. 23-32)' : prof.buildingName}
                    </div>
                    <div className="text-slate-300 leading-snug line-clamp-3">
                      {components.join(' · ')}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* VISUAL WARNING IN BIOSCIENCE PANEL: CUMULATIVE DUST SCORE EXCEEDS WHO DAILY RECOMMENDATION BEFORE END OF DAY */}
        {activeReceptorWhoForecast &&
          activeReceptorWhoForecast.exceedsWhoDailyBeforeEndOfDay && (
            <div
              className={`p-2.5 rounded border space-y-2 ${
                activeReceptorWhoForecast.score24hTotal >= 50
                  ? 'bg-rose-950/55 border-rose-500/60'
                  : 'bg-amber-950/55 border-amber-500/60'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <ShieldAlert
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      activeReceptorWhoForecast.score24hTotal >= 50
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  />
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-mono font-bold text-white">
                      {activeReceptorWhoForecast.isAlreadyBreachedAtSelectedHour
                        ? `WHO STØV-ADVARSEL: Daglig Anbefaling Overskredet kl. ${activeReceptorWhoForecast.whoAqgBreachHourLabel} (${activeReceptorWhoForecast.hoursBeforeEndOfDayAtBreach}t før døgnets afslutning)`
                        : `PROGNOSERET WHO STØV-ADVARSEL: Daglig Anbefaling Overskrides kl. ${activeReceptorWhoForecast.whoAqgBreachHourLabel} (${activeReceptorWhoForecast.hoursBeforeEndOfDayAtBreach}t før døgnets afslutning)`}
                    </div>
                    <p className="text-[11px] text-slate-200 leading-relaxed">
                      Ifølge vejrudsigten for {dateIso} overskrider den kumulative
                      støv-eksponeringsscore for{' '}
                      <strong className="text-white">
                        {activeReceptorWhoForecast.shortName}
                      </strong>{' '}
                      WHO&apos;s daglige 24t anbefaling (
                      <span className="font-mono text-amber-200">
                        25,0 pt · 15 µg/m³ PM2.5
                      </span>
                      ) allerede kl.{' '}
                      <strong className="font-mono text-rose-300">
                        {activeReceptorWhoForecast.whoAqgBreachHourLabel}
                      </strong>{' '}
                      og når{' '}
                      <strong className="font-mono text-rose-300 tabular-nums">
                        {activeReceptorWhoForecast.score24hTotal.toFixed(1)} pt (
                        {activeReceptorWhoForecast.dailyBudgetRatio24h}× WHO&apos;s
                        døgngrænse)
                      </strong>{' '}
                      inden kl. 23:59.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onSelectHour &&
                    activeReceptorWhoForecast.whoAqgBreachHourIndex !== null && (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectHour(
                            activeReceptorWhoForecast.whoAqgBreachHourIndex!
                          )
                        }
                        className="px-2 py-1 rounded bg-rose-500 hover:bg-rose-400 text-slate-950 font-mono text-[10px] font-bold transition-colors whitespace-nowrap shrink-0"
                      >
                        Spring til kl.{' '}
                        {activeReceptorWhoForecast.whoAqgBreachHourLabel}
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => setSubTab('who_score')}
                    className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 font-mono text-[10px] font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    Vis WHO Graf
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Quick-Try Example Pill Bar (Mapped to Ringparken's 5 Demolition Substance Classes) */}
      <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-md space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Hurtigvalg: Ringparken Nedrivningstoksin → Humant Biomarkør-Target
          </span>
          <span className="text-[10px] font-mono text-teal-400">
            {activePreset.geneSymbol} ({activePreset.uniprotAccession})
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {RINGPARKEN_TOXICOLOGY_PRESETS.map((preset) => {
            const isSelected = activePreset.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`px-2.5 py-1.5 rounded text-left text-[11px] font-mono transition-colors border flex items-center justify-between gap-1 ${
                  isSelected
                    ? 'bg-teal-500/20 text-teal-200 border-teal-400 font-bold shadow-xs'
                    : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span className="truncate">{preset.shortLabel}</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-slate-900 text-slate-400 shrink-0">
                  {preset.uniprotAccession}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mechanistic & BEK 613/2026 Explanation Box */}
        <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800/90 space-y-1 text-xs">
          <div className="font-bold text-white flex items-center justify-between gap-2">
            <span>{activePreset.danishTitle}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {activePreset.mechanisticSummary}
          </p>
          <div className="text-[10px] font-mono text-amber-300/90 pt-1 border-t border-slate-800/80">
            ⚖ {activePreset.bek613RegulatoryNote}
          </div>
        </div>
      </div>

      {/* Interactive 3D Molecular Structure Viewport (3Dmol.js WebGL) */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-md space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white font-mono">
                {uniprotProfile?.geneName || activePreset.geneSymbol} ·{' '}
                {uniprotProfile?.accession || activePreset.uniprotAccession}
              </span>
              {structureSourceMode === 'alphafold' ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  [Predicted by model · AlphaFold v6]
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  [Experimentally determined · PDB {activePdbId}]
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 truncate max-w-[340px]">
              {uniprotProfile?.proteinName || afMeta?.uniprotDescription || 'Human target protein'}{' '}
              ({uniprotProfile?.organismName || 'Homo sapiens'})
            </div>
          </div>

          {/* Toggle AlphaFold vs Experimental RCSB PDB */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
            <button
              type="button"
              onClick={() => handleSwitchStructureSource('alphafold')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                structureSourceMode === 'alphafold'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AlphaFold DB
            </button>
            <button
              type="button"
              onClick={() => handleSwitchStructureSource('pdb')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                structureSourceMode === 'pdb'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RCSB PDB ({activePdbId})
            </button>
          </div>
        </div>

        {/* Custom Gene / UniProt Accession Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (customProteinInput.trim()) {
              loadProteinTarget(customProteinInput.trim());
            }
          }}
          className="flex items-center gap-1.5"
        >
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={customProteinInput}
              onChange={(e) => setCustomProteinInput(e.target.value)}
              placeholder="Søg UniProt ID eller Gen-symbol (fx Q92560, P04637, EGFR, BRCA1)..."
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
            />
          </div>
          <button
            type="submit"
            disabled={isLoadingProtein}
            className="px-2.5 py-1 rounded bg-teal-500 text-slate-950 font-mono text-xs font-bold hover:bg-teal-400 transition-colors shrink-0"
          >
            {isLoadingProtein ? 'Henter...' : 'Indlæs 3D'}
          </button>
        </form>

        {/* 3Dmol WebGL Canvas Container */}
        <div className="relative w-full h-64 rounded-md overflow-hidden border border-slate-700/80 bg-[#0F172A]">
          <div ref={viewerContainerRef} className="w-full h-full relative" />

          {isLoadingProtein && (
            <div className="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center gap-2 z-10">
              <RefreshCw className="w-5 h-5 text-teal-400 animate-spin" />
              <span className="text-xs font-mono text-teal-200">
                Henter 3D-koordinater (.cif) &amp; pLDDT fra EBI AlphaFold / PDB...
              </span>
            </div>
          )}

          {proteinError && (
            <div className="absolute inset-x-2 top-2 p-2 rounded bg-rose-950/90 border border-rose-500/60 text-[11px] font-mono text-rose-200 z-10">
              {proteinError}
            </div>
          )}

          {/* Top-Left Overlay: Selected Residue Readout */}
          {selectedResidue && (
            <div className="absolute top-2 left-2 px-2.5 py-1.5 rounded bg-slate-950/90 border border-teal-500/50 text-[11px] font-mono text-slate-200 z-10 shadow-md">
              <div className="font-bold text-teal-300">
                Residue: {selectedResidue.resn} {selectedResidue.resi} (Chain {selectedResidue.chain})
              </div>
              {structureSourceMode === 'alphafold' && selectedResidue.plddt > 0 && (
                <div className="text-[10px] text-slate-300">
                  pLDDT Konfidens:{' '}
                  <strong
                    style={{
                      color:
                        selectedResidue.plddt > 90
                          ? '#60a5fa'
                          : selectedResidue.plddt > 70
                          ? '#65CBF3'
                          : selectedResidue.plddt > 50
                          ? '#FFDB13'
                          : '#FF7D45',
                    }}
                  >
                    {selectedResidue.plddt}
                  </strong>
                </div>
              )}
              {selectedResidue.description && (
                <div className="text-[10px] text-amber-300 max-w-[220px] truncate">
                  {selectedResidue.description}
                </div>
              )}
            </div>
          )}

          {/* Bottom Controls Toolbar inside 3D Viewport */}
          <div className="absolute bottom-2 inset-x-2 flex flex-wrap items-center justify-between gap-1.5 bg-slate-950/85 backdrop-blur-xs px-2 py-1 rounded border border-slate-800 z-10">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'cartoon_plddt', label: 'Cartoon (pLDDT)' },
                  { id: 'cartoon_spectrum', label: 'Spektrum' },
                  { id: 'stick', label: 'Sticks' },
                  { id: 'sphere', label: 'Sfærer' },
                ] as Array<{ id: ViewerRenderStyle; label: string }>
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setRenderStyle(st.id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    renderStyle === st.id
                      ? 'bg-teal-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSpinning((s) => !s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                  isSpinning
                    ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                    : 'bg-slate-900 text-slate-300 border-slate-700'
                }`}
                title="Rotér 3D-model"
              >
                Spin
              </button>
              <button
                type="button"
                onClick={() => setIsLightCanvas((v) => !v)}
                className="p-1 rounded bg-slate-900 text-slate-300 border border-slate-700 hover:text-white"
                title="Skift mellem mørk (#0F172A) og publikations-lys (#F8FAFC) 3D-baggrund"
              >
                {isLightCanvas ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  const viewer = viewerInstanceRef.current;
                  if (viewer) {
                    viewer.removeAllShapes();
                    applyViewerStyling(viewer, renderStyle, structureSourceMode);
                    viewer.zoomTo({}, 500);
                    viewer.render();
                    setSelectedResidue(null);
                  }
                }}
                className="p-1 rounded bg-slate-900 text-slate-300 border border-slate-700 hover:text-white"
                title="Nulstil 3D-kamera"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Canonical 4-Band AlphaFold pLDDT Confidence Scale Legend & Distribution */}
        {plddtSummary && structureSourceMode === 'alphafold' && (
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400 uppercase font-semibold">
                AlphaFold pLDDT Konfidens-Skala ({plddtSummary.residueCount} aminosyrer)
              </span>
              <span className="text-white font-bold">
                Middel pLDDT: {plddtSummary.meanPlddt} / 100
              </span>
            </div>

            {/* Stacked 4-band Bar */}
            <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-900">
              <div
                style={{ width: `${plddtSummary.veryHighPct}%`, backgroundColor: '#0053D6' }}
                title={`Meget høj (>90): ${plddtSummary.veryHighPct}%`}
              />
              <div
                style={{ width: `${plddtSummary.confidentPct}%`, backgroundColor: '#65CBF3' }}
                title={`Konfident (70-90): ${plddtSummary.confidentPct}%`}
              />
              <div
                style={{ width: `${plddtSummary.lowPct}%`, backgroundColor: '#FFDB13' }}
                title={`Lav (50-70): ${plddtSummary.lowPct}%`}
              />
              <div
                style={{ width: `${plddtSummary.veryLowPct}%`, backgroundColor: '#FF7D45' }}
                title={`Meget lav / Uordnet (<50): ${plddtSummary.veryLowPct}%`}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[10px] font-mono pt-0.5">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: '#0053D6' }} />
                <span className="text-slate-300 truncate">&gt;90 ({plddtSummary.veryHighPct}%)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: '#65CBF3' }} />
                <span className="text-slate-300 truncate">70-90 ({plddtSummary.confidentPct}%)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: '#FFDB13' }} />
                <span className="text-slate-300 truncate">50-70 ({plddtSummary.lowPct}%)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: '#FF7D45' }} />
                <span className="text-slate-300 truncate">&lt;50 IDPR ({plddtSummary.veryLowPct}%)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Synchronized Sub-Navigation Tabs for Deep Molecular Inspection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
        <button
          type="button"
          onClick={() => setSubTab('structure')}
          className={`py-1.5 px-2 rounded text-[11px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'structure'
              ? 'bg-teal-500/20 text-teal-200 border border-teal-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Atom className="w-3.5 h-3.5" />
          <span>Domæner &amp; Sekvens</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('chemistry')}
          className={`py-1.5 px-2 rounded text-[11px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'chemistry'
              ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>PubChem Kemi</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('literature')}
          className={`py-1.5 px-2 rounded text-[11px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'literature'
              ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>PubMed ({litArticles.length})</span>
        </button>
        {puff24h && receptorExposures && currentWeather && (
          <button
            type="button"
            onClick={() => setSubTab('who_score')}
            className={`py-1.5 px-2 rounded text-[11px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'who_score'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>WHO Score (Graf)</span>
          </button>
        )}
      </div>

      {/* SUB-TAB 1: UNIPROT DOMAINS, VARIANT LOCI, REACTOME PATHWAYS & INTERACTIVE SEQUENCE */}
      {subTab === 'structure' && uniprotProfile && (
        <div className="space-y-3">
          {/* Interactive Linear Sequence Track (Click any residue to fly 3D camera) */}
          {plddtSummary && plddtSummary.residues.length > 0 && (
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                  Interaktiv Aminosyresekvens (Klik på residue for 3D-zoom)
                </span>
                <span className="text-[10px] font-mono text-teal-300">
                  1–{ Math.min(180, plddtSummary.residues.length) } af {plddtSummary.residueCount} aa
                </span>
              </div>

              <div className="max-h-24 overflow-y-auto p-1.5 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] flex flex-wrap gap-0.5 leading-none">
                {plddtSummary.residues.slice(0, 180).map((res) => {
                  const bgColor =
                    res.band === 'very_high'
                      ? '#0053D6'
                      : res.band === 'confident'
                      ? '#65CBF3'
                      : res.band === 'low'
                      ? '#FFDB13'
                      : '#FF7D45';
                  const textColor = res.band === 'very_high' ? '#ffffff' : '#0f172a';
                  const isSel = selectedResidue?.resi === res.residueNumber;
                  return (
                    <button
                      key={res.residueNumber}
                      type="button"
                      onClick={() =>
                        focusResidueRangeIn3D(
                          res.residueNumber,
                          res.residueNumber,
                          `${res.residueName}${res.residueNumber} (pLDDT ${res.plddt})`
                        )
                      }
                      title={`${res.residueName} ${res.residueNumber} · pLDDT: ${res.plddt}`}
                      style={{ backgroundColor: bgColor, color: textColor }}
                      className={`w-4 h-4 rounded-xs flex items-center justify-center font-bold text-[10px] transition-transform ${
                        isSel ? 'ring-2 ring-white scale-125 z-10' : 'hover:scale-110'
                      }`}
                    >
                      {res.oneLetterCode}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* UniProt Functional Description & Subcellular Location */}
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-md space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                UniProtKB Funktion &amp; Biologisk Rolle [Literature curated]
              </span>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <a
                  href={`https://www.uniprot.org/uniprotkb/${uniprotProfile.accession}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-300 hover:underline flex items-center gap-0.5"
                >
                  <span>UniProt</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={`https://alphafold.ebi.ac.uk/entry/${uniprotProfile.accession}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300 hover:underline flex items-center gap-0.5"
                >
                  <span>AlphaFold</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {uniprotProfile.functionText && (
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {uniprotProfile.functionText}
              </p>
            )}

            {uniprotProfile.catalyticActivity.length > 0 && (
              <div className="p-2 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] text-amber-200">
                <strong className="text-amber-400">Katalytisk reaktion:</strong>{' '}
                {uniprotProfile.catalyticActivity[0]}
              </div>
            )}

            {/* Experimental RCSB PDB Cross-References */}
            {uniprotProfile.pdbIds.length > 0 && (
              <div className="pt-1 space-y-1">
                <div className="text-[10px] font-mono text-slate-400">
                  Eksperimentelle RCSB PDB Strukturer [Experimentally determined] (Klik for 3D-skift):
                </div>
                <div className="flex flex-wrap gap-1">
                  {uniprotProfile.pdbIds.slice(0, 8).map((pdb) => (
                    <button
                      key={pdb}
                      type="button"
                      onClick={() => handleSwitchStructureSource('pdb', pdb)}
                      className={`px-2 py-0.5 rounded font-mono text-[10px] border transition-colors ${
                        structureSourceMode === 'pdb' && activePdbId === pdb
                          ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-bold'
                          : 'bg-slate-950 text-emerald-300 border-emerald-500/30 hover:bg-emerald-950/60'
                      }`}
                    >
                      PDB: {pdb}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Domains, Active Sites & Binding Pockets Table (1-click 3D focus) */}
          {uniprotProfile.features.length > 0 && (
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                  Funktionelle Domæner, Aktive Sites &amp; Varianter (1-klik 3D-fokus)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {uniprotProfile.features.length} loci
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {uniprotProfile.features.map((feat: UniProtFeatureItem, idx: number) => (
                  <button
                    key={`${feat.type}-${feat.start}-${idx}`}
                    type="button"
                    onClick={() =>
                      focusResidueRangeIn3D(
                        feat.start,
                        feat.end,
                        `${feat.type}: ${feat.description}`
                      )
                    }
                    className="w-full p-2 rounded bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/50 text-left flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                            feat.type === 'Active site' || feat.type === 'Binding site'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : feat.type === 'Natural variant' || feat.type === 'Mutagenesis'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                          }`}
                        >
                          {feat.type}
                        </span>
                        <span className="text-xs text-slate-200 font-medium truncate">
                          {feat.description}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-teal-300 shrink-0">
                      aa {feat.start}
                      {feat.end !== feat.start ? `–${feat.end}` : ''} →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reactome Biological Pathways */}
          {uniprotProfile.reactomePathways.length > 0 && (
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-md space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                Reactome Signalveje &amp; Biologiske Netværk
              </div>
              <div className="space-y-1">
                {uniprotProfile.reactomePathways.slice(0, 5).map((pw) => (
                  <a
                    key={pw.id}
                    href={`https://reactome.org/content/detail/${pw.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-950 border border-slate-800 hover:border-teal-500/40 text-[11px]"
                  >
                    <span className="text-slate-200 truncate">{pw.name}</span>
                    <span className="font-mono text-[10px] text-teal-400 shrink-0 flex items-center gap-1">
                      {pw.id}
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: PUBCHEM CHEMICAL TOXICOKINETICS & SMILES 2D STRUCTURE */}
      {subTab === 'chemistry' && (
        <div className="space-y-3">
          {/* Custom PubChem Compound Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customChemicalInput.trim()) {
                loadChemicalCompound(customChemicalInput.trim());
              }
            }}
            className="flex items-center gap-1.5"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customChemicalInput}
                onChange={(e) => setCustomChemicalInput(e.target.value)}
                placeholder="Søg PubChem CID eller kemisk navn (fx 37034, benzo(a)pyrene, aspirin)..."
                className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <button
              type="submit"
              disabled={isLoadingChem}
              className="px-3 py-1.5 rounded bg-amber-400 text-slate-950 font-mono text-xs font-bold hover:bg-amber-300 transition-colors shrink-0"
            >
              {isLoadingChem ? 'Henter...' : 'Slå op'}
            </button>
          </form>

          {chemError && (
            <div className="p-2.5 rounded bg-rose-950/50 border border-rose-500/50 text-xs font-mono text-rose-200">
              {chemError}
            </div>
          )}

          {pubchemProfile && (
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-md space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      PubChem CID: {pubchemProfile.cid}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      [Experimentally / Computed PUG REST]
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1">{pubchemProfile.name}</h4>
                  <div className="text-[11px] font-mono text-slate-400 break-all">
                    IUPAC: {pubchemProfile.iupacName}
                  </div>
                </div>
                <a
                  href={pubchemProfile.pubchemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-amber-400 text-[11px] font-mono text-amber-300 flex items-center gap-1 shrink-0"
                >
                  <span>PubChem</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Dual 2D Chemical Structure View: SmilesDrawer Canvas + PubChem Official 2D PNG */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex flex-col items-center justify-center">
                  <div className="text-[10px] font-mono text-slate-400 mb-1">
                    SmilesDrawer 2D (WebGL/Canvas)
                  </div>
                  <canvas
                    ref={smilesCanvasRef}
                    width={220}
                    height={180}
                    className="max-w-full h-36 object-contain"
                  />
                </div>
                <div className="p-2 rounded bg-white border border-slate-700 flex flex-col items-center justify-center">
                  <div className="text-[10px] font-mono text-slate-700 font-semibold mb-1">
                    PubChem PUG REST 2D Depiction
                  </div>
                  <img
                    src={pubchemProfile.image2dUrl}
                    alt={pubchemProfile.name}
                    className="h-36 object-contain"
                  />
                </div>
              </div>

              {/* Physicochemical & Toxicokinetic Properties Grid */}
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400">SUMFORMEL</div>
                  <div className="font-bold text-white mt-0.5">{pubchemProfile.molecularFormula}</div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400">MOLEKYLVÆGT</div>
                  <div className="font-bold text-white mt-0.5">
                    {pubchemProfile.molecularWeight.toFixed(2)} Da
                  </div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400">LIPOFILICITET (XLogP)</div>
                  <div
                    className={`font-bold mt-0.5 ${
                      pubchemProfile.xlogp !== null && pubchemProfile.xlogp > 4
                        ? 'text-rose-400'
                        : 'text-emerald-300'
                    }`}
                  >
                    {pubchemProfile.xlogp !== null ? pubchemProfile.xlogp : 'Uorganisk/Ion'}
                  </div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400">TPSA (Polær Overfl.)</div>
                  <div className="font-bold text-cyan-300 mt-0.5">{pubchemProfile.tpsa} Å²</div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400">H-DONOR / ACCEPTOR</div>
                  <div className="font-bold text-white mt-0.5">
                    {pubchemProfile.hBondDonorCount} / {pubchemProfile.hBondAcceptorCount}
                  </div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400">ROTERBARE BINDINGER</div>
                  <div className="font-bold text-white mt-0.5">
                    {pubchemProfile.rotatableBondCount}
                  </div>
                </div>
              </div>

              {/* Lipinski Rule of Five & Veber Bioavailability / Bioaccumulation Heuristics */}
              <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-1.5 text-[11px] font-mono">
                <div className="text-[10px] uppercase text-slate-400 font-semibold">
                  Toksikokinetisk Membran- &amp; Bioakkumulerings-Profil (Lipinski / Veber)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded border ${
                      pubchemProfile.lipinskiPass
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    Lipinski Ro5: {pubchemProfile.lipinskiViolations} brud
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded border ${
                      pubchemProfile.veberPass
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Veber Membran-Permeabilitet: {pubchemProfile.veberPass ? 'Høj' : 'Lav'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded border ${
                      pubchemProfile.bbbPermeableLikely
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Blod-Hjerne-Barriere (TPSA&lt;90Å²):{' '}
                    {pubchemProfile.bbbPermeableLikely ? 'Krydser sandsynligt' : 'Begrænset'}
                  </span>
                </div>
                {pubchemProfile.canonicalSmiles && (
                  <div className="text-[10px] text-slate-400 break-all pt-1">
                    <strong className="text-slate-300">Canonical SMILES:</strong>{' '}
                    {pubchemProfile.canonicalSmiles}
                  </div>
                )}
                <div className="text-[10px] text-slate-500 break-all">
                  <strong>InChIKey:</strong> {pubchemProfile.inchikey}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: EUROPE PMC / PUBMED BIOMEDICAL LITERATURE */}
      {subTab === 'literature' && (
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customLitInput.trim()) {
                loadLiterature(customLitInput.trim());
              }
            }}
            className="flex items-center gap-1.5"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customLitInput}
                onChange={(e) => setCustomLitInput(e.target.value)}
                placeholder="Søg i Europe PMC / PubMed (fx asbestos AND BAP1, crystalline silica NLRP3)..."
                className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <button
              type="submit"
              disabled={isLoadingLit}
              className="px-3 py-1.5 rounded bg-cyan-400 text-slate-950 font-mono text-xs font-bold hover:bg-cyan-300 transition-colors shrink-0"
            >
              {isLoadingLit ? 'Søger...' : 'Søg PubMed'}
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-0.5">
            <span>Kilde: Europe PMC / MEDLINE REST API [Literature curated]</span>
            <span className="text-cyan-300 font-bold">
              {litHitCount.toLocaleString('da-DK')} videnskabelige træffere
            </span>
          </div>

          {litError && (
            <div className="p-2.5 rounded bg-rose-950/50 border border-rose-500/50 text-xs font-mono text-rose-200">
              {litError}
            </div>
          )}

          <div className="space-y-2">
            {litArticles.map((art) => {
              const isExpanded = expandedPmid === (art.pmid || art.id);
              const articleKey = art.pmid || art.id;
              return (
                <div
                  key={articleKey}
                  className="p-3 bg-slate-900/80 border border-slate-800 rounded-md space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                    <div className="flex items-center gap-1.5">
                      {art.pmid && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                          PMID: {art.pmid}
                        </span>
                      )}
                      {art.isOpenAccess && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Open Access
                        </span>
                      )}
                    </div>
                    <span className="text-amber-300 font-semibold">
                      Citeret af: {art.citedByCount}
                    </span>
                  </div>

                  <div className="font-bold text-white leading-snug">{art.title}</div>
                  <div className="text-[11px] text-slate-400 truncate">{art.authorString}</div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 pt-1 border-t border-slate-800/80">
                    <span className="truncate text-teal-300">
                      {art.journalTitle} ({art.pubYear})
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {art.abstractText && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedPmid(isExpanded ? null : articleKey)
                          }
                          className="text-slate-300 hover:text-white underline"
                        >
                          {isExpanded ? 'Skjul abstract' : 'Vis abstract'}
                        </button>
                      )}
                      {art.pmid && (
                        <a
                          href={`https://europepmc.org/article/MED/${art.pmid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:underline flex items-center gap-0.5"
                        >
                          <span>Artikel</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {isExpanded && art.abstractText && (
                    <div className="p-2.5 mt-1.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                      {art.abstractText}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: WHO CUMULATIVE EXPOSURE SCORE WIDGET */}
      {subTab === 'who_score' &&
        puff24h &&
        receptorExposures &&
        currentWeather &&
        onSelectReceptor &&
        onSelectHour && (
          <WhoCumulativeExposureScoreWidget
            puff24h={puff24h}
            receptorExposures={receptorExposures}
            selectedReceptorId={
              selectedReceptorId || receptorExposures[0]?.receptorId || ''
            }
            onSelectReceptor={onSelectReceptor}
            selectedHourIndex={selectedHourIndex ?? 0}
            onSelectHour={onSelectHour}
            currentWeather={currentWeather}
            dateIso={dateIso}
          />
        )}
    </div>
  );
};
