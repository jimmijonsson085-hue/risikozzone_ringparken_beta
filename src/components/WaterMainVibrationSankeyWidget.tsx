import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  Check,
  Download,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import {
  DemolitionSourceNode,
  WaterMainLiveTelemetry,
} from '../types/dispersion';
import { computeForensicSha256Hash } from '../services/dispersionEngine';

export interface WaterMainVibrationSankeyWidgetProps {
  waterMainTelemetry: WaterMainLiveTelemetry;
  sources: DemolitionSourceNode[];
  manualMachineNoiseOutputDb?: number;
  compact?: boolean;
}

interface SankeyNodeBox {
  id: string;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sublabel: string;
  valueText: string;
  fillHex: string;
  strokeHex: string;
}

interface SankeyFlowRibbon {
  id: string;
  fromLabel: string;
  toLabel: string;
  d: string;
  fillHex: string;
  sharePct: number;
  energyText: string;
  explanationDa: string;
}

export const WaterMainVibrationSankeyWidget: React.FC<
  WaterMainVibrationSankeyWidgetProps
> = ({
  waterMainTelemetry,
  sources,
  manualMachineNoiseOutputDb = 114,
  compact = false,
}) => {
  const [hoveredFlowId, setHoveredFlowId] = useState<string | null>(null);
  const [isExportingJson, setIsExportingJson] = useState<boolean>(false);
  const [jsonExportNotice, setJsonExportNotice] = useState<string | null>(null);

  const physics = useMemo(() => {
    const activeSources = sources.filter((s) => s.active);
    const activeCount = Math.max(1, activeSources.length);
    const lwaDb = Math.max(85, manualMachineNoiseOutputDb || 114);
    // Reference mechanical-vibrational input energy density at demolition tool footprint (kJ/t equivalent)
    const acousticScale = Math.pow(10, (lwaDb - 114) / 14);
    const totalInputEnergyKjH = Number(
      (1480 * acousticScale * (0.82 + activeCount * 0.14)).toFixed(0)
    );

    const hasPlates = waterMainTelemetry.hasSteelRoadPlates;
    // Steel road plates redistribute Boussinesq bogie load (32.9 -> 10.2 kPa, ~69% surface reflection/dispersion)
    const plateDissipatedShare = hasPlates ? 0.56 : 0.08;
    const soilEnteredShare = Number((1 - plateDissipatedShare).toFixed(2));
    const plateDissipatedKjH = Math.round(
      totalInputEnergyKjH * plateDissipatedShare
    );
    const soilEnteredKjH = Math.max(
      1,
      totalInputEnergyKjH - plateDissipatedKjH
    );

    // Bornitz attenuation in saturated moraine clay (alpha = 0.036 1/m, z = 1.65 m under 1.05 m district heating)
    const pipePpv = waterMainTelemetry.pipePpvMmPerSec;
    const branchPpv = waterMainTelemetry.nearestBranchPpvMmPerSec;
    // Surface Rayleigh-wave propagation into shallow Ringparken strip/basement foundations (-1.20 m to -2.10 m)
    const foundationPpv = Number(
      Math.max(branchPpv * 0.92, pipePpv * 0.68).toFixed(1)
    );
    // Accumulated PPV at Kierulffsvej DN200 corridor (Bornitz superposition across simultaneous active machines & branch coupling)
    const secondaryWaveContribution =
      activeSources.length > 1
        ? (activeSources.length - 1) * pipePpv * 0.22 + branchPpv * 0.45
        : activeSources.length === 1
        ? branchPpv * 0.35
        : 0;
    const accumulatedPpv = Number(
      Math.max(
        pipePpv,
        Math.hypot(pipePpv, secondaryWaveContribution)
      ).toFixed(1)
    );
    const isKierulffsvejPipeDamageRisk = accumulatedPpv > 25 || pipePpv > 25;
    const accumulatedPpvExcessMmPerSec = Number(
      Math.max(0, accumulatedPpv - 25).toFixed(1)
    );
    const soilAttenuationShare = Math.min(
      0.72,
      Math.max(0.32, 0.64 - (pipePpv / 120) * 0.25)
    );
    const clayDampedKjH = Math.round(soilEnteredKjH * soilAttenuationShare);
    const transmittedKjH = Math.max(1, soilEnteredKjH - clayDampedKjH);

    // Target energy split: Building Foundations (Blok 1-3 strip/basement footings), DN200 Eternit 1964, PE100 section, Service Branches
    const foundationShare = 0.28;
    const eternitMainShare = 0.44;
    const pe100Share = 0.16;

    const foundationKjH = Math.round(transmittedKjH * foundationShare);
    const eternitMainKjH = Math.round(transmittedKjH * eternitMainShare);
    const pe100KjH = Math.round(transmittedKjH * pe100Share);
    const branchKjH = Math.max(
      1,
      transmittedKjH - foundationKjH - eternitMainKjH - pe100KjH
    );

    const dinStatusLabel =
      pipePpv >= 80
        ? 'OVER METAL/BETON-GRÆNSE (80 mm/s)'
        : pipePpv >= 50
        ? 'OVER PLAST/MURVÆRK-GRÆNSE (50 mm/s)'
        : isKierulffsvejPipeDamageRisk
        ? `RØRSKADE-RISIKO KIERULFFSVEJ (${accumulatedPpv.toFixed(1)} > 25 mm/s)`
        : foundationPpv >= 15
        ? 'FUNDAMENT-ADVARSEL (≥15 mm/s)'
        : 'UNDER 25 mm/s (DIN 4150-3)';

    return {
      lwaDb,
      activeCount,
      activeSourcesCountRaw: activeSources.length,
      totalInputEnergyKjH,
      hasPlates,
      plateDissipatedShare,
      soilEnteredShare,
      plateDissipatedKjH,
      soilEnteredKjH,
      clayDampedKjH,
      pipeTransferredKjH: transmittedKjH,
      foundationKjH,
      eternitMainKjH,
      pe100KjH,
      branchKjH,
      pipePpv,
      branchPpv,
      foundationPpv,
      accumulatedPpv,
      accumulatedPpvExcessMmPerSec,
      isKierulffsvejPipeDamageRisk,
      dinStatusLabel,
    };
  }, [sources, manualMachineNoiseOutputDb, waterMainTelemetry]);

  const svgModel = useMemo(() => {
    const W = 740;
    const H = compact ? 252 : 284;
    const padTop = 24;
    const usableH = H - padTop - 16;

    const total = Math.max(1, physics.totalInputEnergyKjH);
    const scaleY = (kj: number) => Math.max(14, (kj / total) * usableH);

    // Col 0: Source Machines
    const hSrc = usableH;
    const ySrc = padTop;

    // Col 1: PSS W22085 Road Plate Layer vs Unplated Ground Transmission
    const hPlateAbs = scaleY(physics.plateDissipatedKjH);
    const hSoilEnter = scaleY(physics.soilEnteredKjH);
    const gap1 = 16;
    const total1 = hPlateAbs + hSoilEnter + gap1;
    const startY1 = padTop + Math.max(0, (usableH - total1) / 2);

    // Col 2: Moraine Clay (Bornitz alpha=0.036) vs Transferred Wavefront
    const hClayDamped = scaleY(physics.clayDampedKjH);
    const hPipeIn = scaleY(physics.pipeTransferredKjH);
    const gap2 = 16;
    const total2 = hClayDamped + hPipeIn + gap2;
    const startY2 = padTop + Math.max(0, (usableH - total2) / 2);

    // Col 3: Final Structural Targets (Ringparken Fundamenter, DN200 Eternit 1964, PE100, Service Branches)
    const hFoundation = Math.max(22, scaleY(physics.foundationKjH));
    const hEternit = Math.max(22, scaleY(physics.eternitMainKjH));
    const hPe100 = Math.max(16, scaleY(physics.pe100KjH));
    const hBranch = Math.max(16, scaleY(physics.branchKjH));
    const gap3 = 8;
    const total3 = hFoundation + hEternit + hPe100 + hBranch + gap3 * 3;
    const startY3 = padTop + Math.max(0, (usableH - total3) / 2);

    const nodes: SankeyNodeBox[] = [
      {
        id: 'src_machines',
        col: 0,
        x: 10,
        y: ySrc,
        w: 148,
        h: hSrc,
        label: 'Entreprenørmaskiner',
        sublabel: `${physics.activeCount} aktive · ${physics.lwaDb.toFixed(0)} dB LwA`,
        valueText: `${physics.totalInputEnergyKjH} kJ/t`,
        fillHex: '#1E293B',
        strokeHex: '#F59E0B',
      },
      {
        id: 'pss_plates',
        col: 1,
        x: 198,
        y: startY1,
        w: 152,
        h: hPlateAbs,
        label: physics.hasPlates
          ? 'PSS W22085 Køreplader'
          : 'Overflade-spredning',
        sublabel: physics.hasPlates
          ? 'Boussinesq −69% last'
          : 'Ingen køreplader',
        valueText: `${physics.plateDissipatedKjH} kJ/t`,
        fillHex: physics.hasPlates ? '#064E3B' : '#1E293B',
        strokeHex: physics.hasPlates ? '#34D399' : '#64748B',
      },
      {
        id: 'subsurface_entry',
        col: 1,
        x: 198,
        y: startY1 + hPlateAbs + gap1,
        w: 152,
        h: hSoilEnter,
        label: 'Jordtryk → Moræneler',
        sublabel: `Krone: ${waterMainTelemetry.crownStressKpa.toFixed(1)} kPa`,
        valueText: `${physics.soilEnteredKjH} kJ/t`,
        fillHex: '#172554',
        strokeHex: '#38BDF8',
      },
      {
        id: 'clay_damping',
        col: 2,
        x: 392,
        y: startY2,
        w: 146,
        h: hClayDamped,
        label: 'Bornitz Ler-Dæmpning',
        sublabel: 'α=0,036 m⁻¹ · -1,65 m u.t.',
        valueText: `${physics.clayDampedKjH} kJ/t`,
        fillHex: '#0F172A',
        strokeHex: '#22D3EE',
      },
      {
        id: 'pipe_wavefront',
        col: 2,
        x: 392,
        y: startY2 + hClayDamped + gap2,
        w: 146,
        h: hPipeIn,
        label: 'Energi → Fund. & Rør',
        sublabel: `Rayleigh + trykbølge`,
        valueText: `${physics.pipeTransferredKjH} kJ/t`,
        fillHex: physics.isKierulffsvejPipeDamageRisk ? '#4C0519' : '#1E1B4B',
        strokeHex: physics.isKierulffsvejPipeDamageRisk ? '#F43F5E' : '#A78BFA',
      },
      {
        id: 'building_foundations',
        col: 3,
        x: 576,
        y: startY3,
        w: 154,
        h: hFoundation,
        label: 'Fundamenter (Blok 1–3)',
        sublabel: `PPV ${physics.foundationPpv.toFixed(1)} mm/s (Gr. 5–20)`,
        valueText: `${physics.foundationKjH} kJ/t`,
        fillHex: physics.foundationPpv >= 15 ? '#78350F' : '#1E293B',
        strokeHex: physics.foundationPpv >= 15 ? '#F59E0B' : '#38BDF8',
      },
      {
        id: 'eternit_main',
        col: 3,
        x: 576,
        y: startY3 + hFoundation + gap3,
        w: 154,
        h: hEternit,
        label: 'DN200 Eternit (1964)',
        sublabel: `Akk. ${physics.accumulatedPpv.toFixed(1)} / Rør ${physics.pipePpv.toFixed(1)} mm/s`,
        valueText: `${physics.eternitMainKjH} kJ/t`,
        fillHex: physics.isKierulffsvejPipeDamageRisk ? '#881337' : '#0C4A6E',
        strokeHex: physics.isKierulffsvejPipeDamageRisk ? '#FB7185' : '#38BDF8',
      },
      {
        id: 'pe100_segment',
        col: 3,
        x: 576,
        y: startY3 + hFoundation + hEternit + gap3 * 2,
        w: 154,
        h: hPe100,
        label: 'PE100 Renoveret Stræk',
        sublabel: `Plast-grænse: 50 mm/s`,
        valueText: `${physics.pe100KjH} kJ/t`,
        fillHex: '#083344',
        strokeHex: '#06B6D4',
      },
      {
        id: 'service_branches',
        col: 3,
        x: 576,
        y: startY3 + hFoundation + hEternit + hPe100 + gap3 * 3,
        w: 154,
        h: hBranch,
        label: 'Stikledninger (Blok 1)',
        sublabel: `PPV ${physics.branchPpv.toFixed(1)} mm/s`,
        valueText: `${physics.branchKjH} kJ/t`,
        fillHex: physics.branchPpv >= 20 ? '#78350F' : '#0F172A',
        strokeHex: physics.branchPpv >= 20 ? '#FBBF24' : '#34D399',
      },
    ];

    const makeRibbon = (
      x1: number,
      y1Top: number,
      y1Bot: number,
      x2: number,
      y2Top: number,
      y2Bot: number
    ) => {
      const mx = (x1 + x2) * 0.5;
      return `M ${x1} ${y1Top} C ${mx} ${y1Top}, ${mx} ${y2Top}, ${x2} ${y2Top} L ${x2} ${y2Bot} C ${mx} ${y2Bot}, ${mx} ${y1Bot}, ${x1} ${y1Bot} Z`;
    };

    const srcNode = nodes[0];
    const plateNode = nodes[1];
    const soilNode = nodes[2];
    const clayNode = nodes[3];
    const pipeNode = nodes[4];
    const foundationNode = nodes[5];
    const eternitNode = nodes[6];
    const peNode = nodes[7];
    const branchNode = nodes[8];

    const srcSplitY =
      srcNode.y + srcNode.h * physics.plateDissipatedShare;
    const soilSplitY =
      soilNode.y +
      soilNode.h * (physics.clayDampedKjH / Math.max(1, physics.soilEnteredKjH));
    const pipeSplit0Y = pipeNode.y + pipeNode.h * 0.28;
    const pipeSplit1Y = pipeSplit0Y + pipeNode.h * 0.44;
    const pipeSplit2Y = pipeSplit1Y + pipeNode.h * 0.16;

    const flows: SankeyFlowRibbon[] = [
      {
        id: 'flow-src-plates',
        fromLabel: srcNode.label,
        toLabel: plateNode.label,
        d: makeRibbon(
          srcNode.x + srcNode.w,
          srcNode.y,
          srcSplitY,
          plateNode.x,
          plateNode.y,
          plateNode.y + plateNode.h
        ),
        fillHex: physics.hasPlates ? '#10B981' : '#64748B',
        sharePct: Math.round(physics.plateDissipatedShare * 100),
        energyText: `${physics.plateDissipatedKjH} kJ/t`,
        explanationDa: physics.hasPlates
          ? 'Wissenberg PSS W22085 stålkøreplader fordeler bogielast og reducerer kronebelastning fra ~32,9 til ~10,2 kPa.'
          : 'Kun naturlig overfladerefleksion — manglende køreplader sender næsten al dynamisk energi direkte ned mod fundamenter og rørtracé.',
      },
      {
        id: 'flow-src-soil',
        fromLabel: srcNode.label,
        toLabel: soilNode.label,
        d: makeRibbon(
          srcNode.x + srcNode.w,
          srcSplitY,
          srcNode.y + srcNode.h,
          soilNode.x,
          soilNode.y,
          soilNode.y + soilNode.h
        ),
        fillHex: '#38BDF8',
        sharePct: Math.round(physics.soilEnteredShare * 100),
        energyText: `${physics.soilEnteredKjH} kJ/t`,
        explanationDa: `Vertikal Boussinesq-kronebelastning (${waterMainTelemetry.crownStressKpa.toFixed(
          1
        )} kPa) og Rayleigh/kompressionsbølger forplantes ned i jordprofilet.`,
      },
      {
        id: 'flow-soil-clay',
        fromLabel: soilNode.label,
        toLabel: clayNode.label,
        d: makeRibbon(
          soilNode.x + soilNode.w,
          soilNode.y,
          soilSplitY,
          clayNode.x,
          clayNode.y,
          clayNode.y + clayNode.h
        ),
        fillHex: '#06B6D4',
        sharePct: Math.round(
          (physics.clayDampedKjH / Math.max(1, physics.soilEnteredKjH)) * 100
        ),
        energyText: `${physics.clayDampedKjH} kJ/t`,
        explanationDa:
          'Geometrisk spredning og materialedæmpning i mættet moræneler (Bornitz α = 0,036 m⁻¹) ned til -1,65 m u.t.',
      },
      {
        id: 'flow-soil-pipe',
        fromLabel: soilNode.label,
        toLabel: pipeNode.label,
        d: makeRibbon(
          soilNode.x + soilNode.w,
          soilSplitY,
          soilNode.y + soilNode.h,
          pipeNode.x,
          pipeNode.y,
          pipeNode.y + pipeNode.h
        ),
        fillHex: physics.pipePpv >= 25 ? '#F43F5E' : '#818CF8',
        sharePct: Math.round(
          (physics.pipeTransferredKjH / Math.max(1, physics.soilEnteredKjH)) * 100
        ),
        energyText: `${physics.pipeTransferredKjH} kJ/t`,
        explanationDa: `Resterende vibrationsenergi der rammer Ringparken-fundamenter og DN200 hovedledning under -1,05 m fjernvarme (afstand ${waterMainTelemetry.nearestSourceDistanceMeters} m fra ${waterMainTelemetry.nearestSourceCode}).`,
      },
      {
        id: 'flow-pipe-foundation',
        fromLabel: pipeNode.label,
        toLabel: foundationNode.label,
        d: makeRibbon(
          pipeNode.x + pipeNode.w,
          pipeNode.y,
          pipeSplit0Y,
          foundationNode.x,
          foundationNode.y,
          foundationNode.y + foundationNode.h
        ),
        fillHex: physics.foundationPpv >= 15 ? '#F59E0B' : '#38BDF8',
        sharePct: 28,
        energyText: `${physics.foundationKjH} kJ/t`,
        explanationDa: `Overfladenære Rayleigh-bølger overføres til Ringparken kælder- og stribefundamenter (-1,2 til -2,1 m): PPV ${physics.foundationPpv.toFixed(
          1
        )} mm/s (DIN 4150-3 boligfundamenter 5–20 mm/s).`,
      },
      {
        id: 'flow-pipe-eternit',
        fromLabel: pipeNode.label,
        toLabel: eternitNode.label,
        d: makeRibbon(
          pipeNode.x + pipeNode.w,
          pipeSplit0Y,
          pipeSplit1Y,
          eternitNode.x,
          eternitNode.y,
          eternitNode.y + eternitNode.h
        ),
        fillHex: physics.pipePpv >= 25 ? '#E11D48' : '#0EA5E9',
        sharePct: 44,
        energyText: `${physics.eternitMainKjH} kJ/t`,
        explanationDa: `Primær påvirkning på skør 1964 asbestcement/eternit (skærpet advarsel >= 25 mm/s · nu ${physics.pipePpv.toFixed(
          1
        )} mm/s).`,
      },
      {
        id: 'flow-pipe-pe100',
        fromLabel: pipeNode.label,
        toLabel: peNode.label,
        d: makeRibbon(
          pipeNode.x + pipeNode.w,
          pipeSplit1Y,
          pipeSplit2Y,
          peNode.x,
          peNode.y,
          peNode.y + peNode.h
        ),
        fillHex: '#06B6D4',
        sharePct: 16,
        energyText: `${physics.pe100KjH} kJ/t`,
        explanationDa:
          'Delstræk i PE100 SDR17 (DIN 4150-3 plastgrænse 50 mm/s), men udsat for PAH/PCB-permeation i våd ler.',
      },
      {
        id: 'flow-pipe-branch',
        fromLabel: pipeNode.label,
        toLabel: branchNode.label,
        d: makeRibbon(
          pipeNode.x + pipeNode.w,
          pipeSplit2Y,
          pipeNode.y + pipeNode.h,
          branchNode.x,
          branchNode.y,
          branchNode.y + branchNode.h
        ),
        fillHex: physics.branchPpv >= 20 ? '#F59E0B' : '#34D399',
        sharePct: 12,
        energyText: `${physics.branchKjH} kJ/t`,
        explanationDa: `Nærmeste stikledning ved bygningssokkel (PPV ${physics.branchPpv.toFixed(
          1
        )} mm/s mod DIN 4150-3 bygningsgrænse 5–20 mm/s).`,
      },
    ];

    return { W, H, nodes, flows };
  }, [physics, waterMainTelemetry, compact]);

  const hoveredFlow = useMemo(
    () => svgModel.flows.find((f) => f.id === hoveredFlowId) || null,
    [svgModel.flows, hoveredFlowId]
  );

  const handleExportEnergyFlowJson = async () => {
    if (isExportingJson) return;
    setIsExportingJson(true);
    try {
      const exportedAtIso = new Date().toISOString();
      const corePayload = {
        schemaVersion: 'ringparken-vibrations-sankey-v1',
        exportedAtIso,
        caseReference: 'PSS W22085 · Ringparken, 4200 Slagelse (Kierulffsvej DN200 Drikkevand)',
        regulatoryStandards: [
          'DIN 4150-3:2016 Tabel 3 (Rørledninger & Fundamenter)',
          'BEK nr. 1272/2025 (Drikkevandsbekendtgørelsen)',
          'BEK 613/2026 & Vandforsyningsloven § 62',
        ],
        vibrationParameters: {
          machineSoundPowerLevelDbLwa: Number(physics.lwaDb.toFixed(1)),
          activeSourcesCount: physics.activeSourcesCountRaw,
          nearestSourceCode: waterMainTelemetry.nearestSourceCode,
          nearestSourceDistanceMeters: waterMainTelemetry.nearestSourceDistanceMeters,
          hasSteelRoadPlates: physics.hasPlates,
          crownStressWithPlatesKpa: waterMainTelemetry.crownStressKpa,
          crownStressWithoutPlatesKpa: waterMainTelemetry.crownStressWithoutPlatesKpa,
          soilAttenuationModel: 'Bornitz moræneler (α = 0.036 m⁻¹, dybde -1.65 m u.t.)',
        },
        ppvRiskEvaluation: {
          pipePpvMmPerSec: physics.pipePpv,
          nearestBranchPpvMmPerSec: physics.branchPpv,
          foundationPpvMmPerSec: physics.foundationPpv,
          accumulatedPpvMmPerSec: physics.accumulatedPpv,
          din4150CriticalEternitLimitMmPerSec: 25,
          isPipeDamageRiskKierulffsvej: physics.isKierulffsvejPipeDamageRisk,
          accumulatedExcessAbove25MmPerSec: physics.accumulatedPpvExcessMmPerSec,
          dinStatusLabel: physics.dinStatusLabel,
          ppvThresholdStatus: waterMainTelemetry.ppvThresholdStatus,
          overallRiskStatus: waterMainTelemetry.overallStatus,
        },
        energyFlowSummaryKjPerHour: {
          totalInputEnergyKjH: physics.totalInputEnergyKjH,
          plateDissipatedKjH: physics.plateDissipatedKjH,
          plateDissipatedSharePct: Math.round(physics.plateDissipatedShare * 100),
          soilEnteredKjH: physics.soilEnteredKjH,
          soilEnteredSharePct: Math.round(physics.soilEnteredShare * 100),
          clayDampedKjH: physics.clayDampedKjH,
          transmittedToTargetsKjH: physics.pipeTransferredKjH,
          structuralTargets: {
            buildingFoundationsBlok1to3KjH: physics.foundationKjH,
            dn200Eternit1964KjH: physics.eternitMainKjH,
            pe100RenovatedSegmentKjH: physics.pe100KjH,
            serviceBranchesBlok1KjH: physics.branchKjH,
          },
        },
        activeDemolitionSources: sources
          .filter((s) => s.active)
          .map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            emissionFactor: s.sourceEmissionFactor ?? 1.0,
            position: s.position,
          })),
        sankeyFlowRibbons: svgModel.flows.map((f) => ({
          id: f.id,
          from: f.fromLabel,
          to: f.toLabel,
          sharePct: f.sharePct,
          energyText: f.energyText,
          explanationDa: f.explanationDa,
        })),
      };

      const sha256Seal = await computeForensicSha256Hash(corePayload);
      const exportDocument = {
        ...corePayload,
        forensicChainOfCustody: {
          sha256Seal,
          hashAlgorithm: 'SHA-256 (WebCrypto)',
          purpose: 'Bilag til retsmedicinsk / teknisk rapport vedr. Kierulffsvej DN200 hovedledning',
        },
      };

      const blob = new Blob([JSON.stringify(exportDocument, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const safeStamp = exportedAtIso.replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `Ringparken_Vibrations_Sankey_EnergiFlow_${safeStamp}.json`;
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setJsonExportNotice(`JSON gemt (${sha256Seal.slice(0, 10)}...)`);
      window.setTimeout(() => setJsonExportNotice(null), 4000);
    } finally {
      setIsExportingJson(false);
    }
  };

  return (
    <div
      data-testid="water-main-vibration-sankey-widget"
      className="p-3 rounded-md bg-[#0B0E17] border border-[#253042] space-y-2.5 font-mono tabular-nums"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E293B] pb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
          <Waves className="w-3.5 h-3.5 shrink-0" />
          <span>Vibrations-Sankey · Entreprenørmaskiner → Fundamenter &amp; PPV</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-[11px] font-bold flex items-center gap-1 whitespace-nowrap ${
              physics.isKierulffsvejPipeDamageRisk
                ? 'text-rose-300'
                : physics.hasPlates
                ? 'text-emerald-300'
                : 'text-amber-300'
            }`}
          >
            {physics.isKierulffsvejPipeDamageRisk ? (
              <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{physics.dinStatusLabel}</span>
          </span>

          <button
            type="button"
            data-testid="export-vibration-sankey-json-btn"
            onClick={() => void handleExportEnergyFlowJson()}
            disabled={isExportingJson}
            className="px-2.5 py-1 rounded border border-cyan-500/60 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-200 text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors disabled:opacity-60"
            title="Eksportér Sankey energistrømsdata som SHA-256 forseglet JSON-fil til retsmedicinske rapporter"
          >
            {jsonExportNotice ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span className="text-emerald-200">{jsonExportNotice}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span>{isExportingJson ? 'Eksporterer...' : 'Eksportér JSON'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Kierulffsvej Pipe Damage Risk Warning when Accumulated PPV > 25 mm/s */}
      {physics.isKierulffsvejPipeDamageRisk && (
        <div
          role="alert"
          data-testid="vibration-sankey-ppv-damage-alert"
          className="p-2.5 rounded border border-rose-500/75 bg-rose-950/65 text-rose-100 flex flex-wrap items-center justify-between gap-2 text-[11px]"
        >
          <div className="flex items-start gap-2 min-w-0">
            <AlertOctagon className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
            <div className="space-y-0.5 font-sans">
              <div className="font-bold text-rose-200">
                ADVARSEL: Risiko for rørskade på Kierulffsvej (Akkumuleret PPV &gt; 25 mm/s)
              </div>
              <div className="text-rose-100/90 leading-snug">
                Akkumuleret vibrationsbelastning er{' '}
                <strong className="font-mono text-white">
                  {physics.accumulatedPpv.toFixed(1)} mm/s
                </strong>{' '}
                (+{physics.accumulatedPpvExcessMmPerSec.toFixed(1)} mm/s over DIN 4150-3
                skærpet Eternit-grænse på 25,0 mm/s · DN200 enkelt-PPV:{' '}
                <span className="font-mono">{physics.pipePpv.toFixed(1)} mm/s</span>).
                Øjeblikkelig risiko for muffesprængning og brud i 1964 asbestcement-hovedledning.
              </div>
            </div>
          </div>
          <span className="font-mono font-bold text-rose-200 whitespace-nowrap shrink-0">
            DIN 4150-3 · BRUDRISIKO
          </span>
        </div>
      )}

      {/* Column Stage Headers + Interactive SVG Sankey */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgModel.W} ${svgModel.H}`}
          className="w-full min-w-[540px] h-auto select-none"
          role="img"
          aria-label="Vibrations-Sankey diagram fra entreprenørmaskiner til Ringparken fundamenter og Kierulffsvej DN200 drikkevandsrør"
        >
          {/* Stage Headers */}
          <text x={10} y={15} className="fill-slate-400 text-[10px] font-mono uppercase">
            1. Maskin-Kilde
          </text>
          <text x={198} y={15} className="fill-slate-400 text-[10px] font-mono uppercase">
            2. Overflade / PSS W22085
          </text>
          <text x={392} y={15} className="fill-slate-400 text-[10px] font-mono uppercase">
            3. Moræneler (-1,65 m)
          </text>
          <text x={576} y={15} className="fill-slate-400 text-[10px] font-mono uppercase">
            4. Fundamenter &amp; Rør (PPV)
          </text>

          {/* Sankey Ribbons */}
          {svgModel.flows.map((flow) => {
            const isHovered = hoveredFlowId === flow.id;
            return (
              <path
                key={flow.id}
                d={flow.d}
                fill={flow.fillHex}
                fillOpacity={isHovered ? 0.62 : hoveredFlowId ? 0.16 : 0.34}
                stroke={flow.fillHex}
                strokeOpacity={isHovered ? 0.95 : 0.45}
                strokeWidth={isHovered ? 1.5 : 0.7}
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={() => setHoveredFlowId(flow.id)}
                onMouseLeave={() => setHoveredFlowId(null)}
              />
            );
          })}

          {/* Sankey Nodes */}
          {svgModel.nodes.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                rx={4}
                fill={node.fillHex}
                stroke={node.strokeHex}
                strokeWidth={1.4}
              />
              <text
                x={node.x + 8}
                y={node.y + Math.min(16, node.h * 0.42)}
                className="fill-white text-[10.5px] font-mono font-bold"
              >
                {node.label}
              </text>
              {node.h >= 34 && (
                <text
                  x={node.x + 8}
                  y={node.y + Math.min(30, node.h * 0.72)}
                  className="fill-slate-300 text-[9.5px] font-mono"
                >
                  {node.sublabel}
                </text>
              )}
              {node.h >= 48 && (
                <text
                  x={node.x + 8}
                  y={node.y + node.h - 7}
                  className="fill-cyan-300 text-[10px] font-mono font-bold"
                >
                  {node.valueText}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Live Inspection Footer */}
      <div className="p-2 rounded bg-[#151C28] border border-[#253042] text-[11px] flex flex-wrap items-center justify-between gap-2">
        {hoveredFlow ? (
          <div className="space-y-0.5 w-full">
            <div className="flex items-center justify-between gap-2 text-cyan-200 font-bold">
              <span>
                {hoveredFlow.fromLabel} → {hoveredFlow.toLabel} ({hoveredFlow.sharePct}%)
              </span>
              <span className="text-amber-300">{hoveredFlow.energyText}</span>
            </div>
            <div className="text-slate-300 font-sans">{hoveredFlow.explanationDa}</div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 w-full text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                Hold musen over en energistrøm for Bornitz/Boussinesq-fordeling · Krone:{' '}
                <strong className="text-white">
                  {waterMainTelemetry.crownStressKpa.toFixed(1)} kPa
                </strong>{' '}
                (uden plader: {waterMainTelemetry.crownStressWithoutPlatesKpa.toFixed(1)} kPa)
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span
                className={`font-bold ${
                  physics.isKierulffsvejPipeDamageRisk ? 'text-rose-300' : 'text-cyan-300'
                }`}
              >
                Akk. PPV: {physics.accumulatedPpv.toFixed(1)} mm/s
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-amber-300 font-bold">
                Fundamenter: {physics.foundationPpv.toFixed(1)} mm/s
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-sky-300 font-bold">
                DN200: {physics.pipePpv.toFixed(1)} mm/s
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
