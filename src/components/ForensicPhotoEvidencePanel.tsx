import React, { useState, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  Biohazard,
  Camera,
  CheckCircle2,
  FileCheck2,
  Image as ImageIcon,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AlgedonicObservation,
  ForensicEvidenceCategoryTag,
  ForensicPhotoAnalysis,
  ForensicPhotoEvidence,
  HourlyWeatherPoint,
  LatLngPoint,
  PlumeCorroborationResult,
  ReporterRole,
  SubstanceKey,
} from '../types/dispersion';
import { SUBSTANCE_SPECS } from '../data/ringparkenData';
import { computeForensicSha256Hash } from '../services/dispersionEngine';

interface ForensicPhotoEvidencePanelProps {
  dateIso: string;
  currentWeather: HourlyWeatherPoint;
  pendingPosition: LatLngPoint;
  locationLabel: string;
  reporterRole: ReporterRole;
  reporterId: string;
  observationType: string;
  corroboration: PlumeCorroborationResult;
  observationsWithPhotos: AlgedonicObservation[];
  onSelectObservation: (obs: AlgedonicObservation) => void;
  onRegisterPhotoEvidenceObservation: (params: {
    photoEvidence: ForensicPhotoEvidence;
    observationType: string;
    description: string;
    position: LatLngPoint;
    locationLabel: string;
    evidenceCategory?: ForensicEvidenceCategoryTag;
  }) => Promise<void>;
  onApplyAiDescriptionToForm?: (params: {
    observationType: string;
    description: string;
    photoEvidence: ForensicPhotoEvidence;
  }) => void;
  onOpenReportModal: () => void;
}

interface DemoPhotoScenario {
  id: string;
  label: string;
  shortTag: string;
  fileName: string;
  position: LatLngPoint;
  locationLabel: string;
  observationTypeHint: string;
  drawKind: 'dust_plume_blok1' | 'open_container_wool' | 'trench_leaching';
}

const DEMO_PHOTO_SCENARIOS: DemoPhotoScenario[] = [
  {
    id: 'demo-dust-blok1',
    label: 'Blok 1: Uafskærmet støvsky ved nedbrydning',
    shortTag: 'Demo 1: Støvsky (Blok 1)',
    fileName: 'ringparken_blok1_stoevsky_kierulffsvej.jpg',
    position: { lat: 55.41295, lng: 11.35365 },
    locationLabel: 'Kierulffsvej 14-22 (Blok 1 / Afd. 23)',
    observationTypeHint: 'Synlig støvsky fra Blok 1 uden vanddæmpning',
    drawKind: 'dust_plume_blok1',
  },
  {
    id: 'demo-container-wool',
    label: 'Bygning 2: Åben container med <1997 asbest/mineraluld',
    shortTag: 'Demo 2: Åben Container (<1997)',
    fileName: 'ringparken_byg2_aaben_container_mineraluld.jpg',
    position: { lat: 55.41335, lng: 11.35455 },
    locationLabel: 'Kierulffsvej 12 (Bygning 2 — tidl. Bazar)',
    observationTypeHint: 'Åbne containere med gammel mineraluld i blæsevejr',
    drawKind: 'open_container_wool',
  },
  {
    id: 'demo-trench-mud',
    label: 'Rødtjørnevej 2 / Blok 1: Vandfyldt udgravning & mudderslæb',
    shortTag: 'Demo 3: Udgravning & Mudder',
    fileName: 'ringparken_kloak_udgravning_roedtjoornevej2.jpg',
    position: { lat: 55.4122, lng: 11.3522 },
    locationLabel: 'Rødtjørnevej 2, 4200 Slagelse (C962+VV Slagelse)',
    observationTypeHint: 'Kørsel med entreprenørmaskiner på uforseglet jord i regnvejr',
    drawKind: 'trench_leaching',
  },
];

function renderDemoFieldPhotoDataUrl(
  scenario: DemoPhotoScenario,
  dateIso: string,
  hourLabel: string,
  windSpeedMs: number,
  windDirDeg: number
): { dataUrl: string; byteSize: number } {
  const W = 720;
  const H = 460;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: '', byteSize: 0 };
  }

  // Sky & background gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.58);
  skyGrad.addColorStop(0, '#1e293b');
  skyGrad.addColorStop(0.6, '#334155');
  skyGrad.addColorStop(1, '#475569');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Ground surface
  const groundGrad = ctx.createLinearGradient(0, H * 0.55, 0, H);
  groundGrad.addColorStop(0, '#27272a');
  groundGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  if (scenario.drawKind === 'dust_plume_blok1') {
    // Partially demolished residential block (Blok 1 Kierulffsvej 14-22)
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(75, 115, 250, 155);
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 2;
    ctx.strokeRect(75, 115, 250, 155);

    // Exposed <1997 facade panels & window openings
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(95 + c * 56, 132 + r * 44, 36, 26);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(95 + c * 56, 160 + r * 44, 36, 9);
      }
    }

    // Excavator hydraulic arm breaking concrete
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(490, 275);
    ctx.lineTo(410, 170);
    ctx.lineTo(315, 195);
    ctx.stroke();

    ctx.fillStyle = '#d97706';
    ctx.fillRect(465, 245, 95, 50);

    // Dense visible dust plume drifting downwind without water suppression
    const plumePositions = [
      { x: 310, y: 195, r: 52, a: 0.55 },
      { x: 375, y: 175, r: 68, a: 0.5 },
      { x: 455, y: 155, r: 84, a: 0.44 },
      { x: 545, y: 140, r: 96, a: 0.36 },
      { x: 625, y: 130, r: 105, a: 0.28 },
    ];
    for (const p of plumePositions) {
      const g = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, p.r);
      g.addColorStop(0, `rgba(226, 232, 240, ${p.a})`);
      g.addColorStop(0.6, `rgba(148, 163, 184, ${p.a * 0.65})`);
      g.addColorStop(1, 'rgba(100, 116, 139, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Red forensic callout box on photo
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 4]);
    ctx.strokeRect(255, 85, 395, 165);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(153, 27, 27, 0.88)';
    ctx.fillRect(255, 62, 310, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('AI DETEKTION: SYNLIG STØVFANE UDEN VANDDÆMPNING', 263, 77);
  } else if (scenario.drawKind === 'open_container_wool') {
    // Open roll-off waste container with exposed <1997 mineral wool & broken fiber-cement boards
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(140, 195, 420, 115);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.strokeRect(140, 195, 420, 115);

    // Heap of yellow/ochre <1997 mineral wool batts and grey asbestos/fiber-cement shards
    const woolBatts = [
      { x: 175, y: 162, w: 95, h: 42, col: '#eab308' },
      { x: 260, y: 148, w: 110, h: 50, col: '#ca8a04' },
      { x: 365, y: 158, w: 95, h: 40, col: '#facc15' },
      { x: 445, y: 168, w: 85, h: 36, col: '#cbd5e1' },
    ];
    for (const b of woolBatts) {
      ctx.fillStyle = b.col;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#422006';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }

    // Loose wind-blown fibers drifting right
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const sx = 390 + i * 16;
      const sy = 135 + ((i * 23) % 70);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 26, sy - 6);
      ctx.stroke();
    }

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 4]);
    ctx.strokeRect(130, 132, 450, 188);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(146, 64, 14, 0.9)';
    ctx.fillRect(130, 108, 355, 22);
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('AI DETEKTION: UAFDÆKKET CONTAINER (<1997 MINERALULD)', 138, 123);
  } else {
    // Open waterlogged sewer/crawlspace trench & heavy machinery mud tracks
    ctx.fillStyle = '#3f2e21';
    ctx.fillRect(85, 210, 550, 145);

    // Standing contaminated water in open excavation trench
    const waterGrad = ctx.createLinearGradient(130, 235, 480, 325);
    waterGrad.addColorStop(0, 'rgba(14, 116, 144, 0.78)');
    waterGrad.addColorStop(1, 'rgba(21, 94, 117, 0.85)');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(135, 235, 340, 88);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(135, 235, 340, 88);

    // Mud tracks leading onto public road
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 14;
    ctx.setLineDash([12, 6]);
    ctx.beginPath();
    ctx.moveTo(465, 275);
    ctx.lineTo(680, 355);
    ctx.moveTo(465, 305);
    ctx.lineTo(680, 385);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 4]);
    ctx.strokeRect(115, 215, 385, 120);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(8, 51, 68, 0.92)';
    ctx.fillRect(115, 190, 375, 22);
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('AI DETEKTION: ÅBEN KLOAKUDSKIFTNING & MUDDERSLÆB', 123, 205);
  }

  // Forensic camera HUD metadata stamp at top & bottom of image
  ctx.fillStyle = 'rgba(9, 13, 22, 0.88)';
  ctx.fillRect(0, 0, W, 38);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(
    `RETSMEDICINSK FELTFOTO · RINGPARKEN 4200 SLAGELSE · ${dateIso} KL. ${hourLabel}`,
    14,
    24
  );

  ctx.fillStyle = 'rgba(9, 13, 22, 0.9)';
  ctx.fillRect(0, H - 42, W, 42);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '11px monospace';
  ctx.fillText(
    `GPS: ${scenario.position.lat.toFixed(4)}°N, ${scenario.position.lng.toFixed(4)}°E (${
      scenario.locationLabel
    }) · Vind: ${windSpeedMs} m/s fra ${windDirDeg}°`,
    14,
    H - 16
  );

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const byteSize = Math.round((dataUrl.length * 3) / 4);
  return { dataUrl, byteSize };
}

export const ForensicPhotoEvidencePanel: React.FC<ForensicPhotoEvidencePanelProps> = ({
  dateIso,
  currentWeather,
  pendingPosition,
  locationLabel,
  reporterRole,
  observationType,
  corroboration,
  observationsWithPhotos,
  onSelectObservation,
  onRegisterPhotoEvidenceObservation,
  onApplyAiDescriptionToForm,
  onOpenReportModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedMimeType, setUploadedMimeType] = useState<string>('image/jpeg');
  const [uploadedFileSize, setUploadedFileSize] = useState<number>(0);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [imageSha256Hash, setImageSha256Hash] = useState<string>('');
  const [userPhotoNotes, setUserPhotoNotes] = useState<string>('');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<ForensicPhotoAnalysis | null>(null);
  const [editableVisualTitle, setEditableVisualTitle] = useState<string>('');
  const [editableVisualDescription, setEditableVisualDescription] = useState<string>('');
  const [editableObservationType, setEditableObservationType] = useState<string>(observationType);
  const [additionalUserAdjustment, setAdditionalUserAdjustment] = useState<string>('');
  const [descriptionPromptDecision, setDescriptionPromptDecision] = useState<
    'pending_yn' | 'editing_y' | 'approved_n' | 'adjusted_saved'
  >('pending_yn');
  const [ynQuickInput, setYnQuickInput] = useState<string>('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [isRegisteringEvidence, setIsRegisteringEvidence] = useState<boolean>(false);
  const [registeredSuccessBanner, setRegisteredSuccessBanner] = useState<string | null>(null);
  const [selectedEvidenceCategory, setSelectedEvidenceCategory] =
    useState<ForensicEvidenceCategoryTag>('Beboerklage');
  const adjustmentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const plumeVectorDeg = (currentWeather.windDirection10m + 180) % 360;

  const runGeminiPhotoAnalysis = useCallback(
    async (params: {
      dataUrl: string;
      mimeType: string;
      fileName: string;
      targetPosition?: LatLngPoint;
      targetLocationLabel?: string;
      typeHint?: string;
    }) => {
      setIsAnalyzingPhoto(true);
      setAnalysisError(null);
      setRegisteredSuccessBanner(null);

      try {
        const pos = params.targetPosition || pendingPosition;
        const loc = params.targetLocationLabel || locationLabel;
        const hint = params.typeHint || observationType;

        const res = await fetch('/api/analyze-photo-evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: params.dataUrl,
            mimeType: params.mimeType,
            fileName: params.fileName,
            locationLabel: loc,
            position: pos,
            dateIso,
            hourLabel: currentWeather.hourLabel,
            windSpeedMs: currentWeather.windSpeed10m,
            windGustsMs: currentWeather.windGusts10m,
            windDirectionDeg: currentWeather.windDirection10m,
            plumeVectorDeg,
            maxSumQuotient: corroboration.calculatedSumQuotient,
            inPlume: corroboration.isInsideMathematicalPlume,
            observationTypeHint: hint,
            userNotes: userPhotoNotes,
          }),
        });

        const data = (await res.json()) as ForensicPhotoAnalysis & { error?: string };
        if (!res.ok || data.error) {
          setAnalysisError(data.error || 'Kunne ikke gennemføre AI-billedanalyse.');
          return;
        }

        setAiAnalysis(data);
        setEditableVisualTitle(data.visualTitle);
        setEditableVisualDescription(data.visualDescription);
        setEditableObservationType(data.recommendedObservationType || hint);
        setAdditionalUserAdjustment('');
        setDescriptionPromptDecision('pending_yn');
        setYnQuickInput('');
      } catch (err) {
        setAnalysisError(
          err instanceof Error ? err.message : 'Fejl ved kommunikation med AI-billedanalyse.'
        );
      } finally {
        setIsAnalyzingPhoto(false);
      }
    },
    [
      pendingPosition,
      locationLabel,
      observationType,
      dateIso,
      currentWeather,
      plumeVectorDeg,
      corroboration,
      userPhotoNotes,
    ]
  );

  const processSelectedImageFile = useCallback(
    async (file: File) => {
      setAnalysisError(null);
      setRegisteredSuccessBanner(null);

      const reader = new FileReader();
      reader.onload = async () => {
        const resultDataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!resultDataUrl) return;

        setUploadedFileName(file.name);
        setUploadedMimeType(file.type || 'image/jpeg');
        setUploadedFileSize(file.size);
        setPhotoDataUrl(resultDataUrl);

        const hash = await computeForensicSha256Hash({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          dataSample: resultDataUrl.slice(0, 512) + resultDataUrl.slice(-512),
          dateIso,
          hourLabel: currentWeather.hourLabel,
        });
        setImageSha256Hash(hash);

        await runGeminiPhotoAnalysis({
          dataUrl: resultDataUrl,
          mimeType: file.type || 'image/jpeg',
          fileName: file.name,
        });
      };
      reader.readAsDataURL(file);
    },
    [dateIso, currentWeather.hourLabel, runGeminiPhotoAnalysis]
  );

  const handleLoadDemoScenarioPhoto = async (scenario: DemoPhotoScenario) => {
    setAnalysisError(null);
    setRegisteredSuccessBanner(null);

    const { dataUrl, byteSize } = renderDemoFieldPhotoDataUrl(
      scenario,
      dateIso,
      currentWeather.hourLabel,
      currentWeather.windSpeed10m,
      currentWeather.windDirection10m
    );
    if (!dataUrl) return;

    setUploadedFileName(scenario.fileName);
    setUploadedMimeType('image/jpeg');
    setUploadedFileSize(byteSize);
    setPhotoDataUrl(dataUrl);
    setEditableObservationType(scenario.observationTypeHint);

    const hash = await computeForensicSha256Hash({
      fileName: scenario.fileName,
      fileSize: byteSize,
      scenarioId: scenario.id,
      dateIso,
      hourLabel: currentWeather.hourLabel,
      position: scenario.position,
    });
    setImageSha256Hash(hash);

    await runGeminiPhotoAnalysis({
      dataUrl,
      mimeType: 'image/jpeg',
      fileName: scenario.fileName,
      targetPosition: scenario.position,
      targetLocationLabel: scenario.locationLabel,
      typeHint: scenario.observationTypeHint,
    });
  };

  const handleYnChoice = (choice: 'y' | 'n') => {
    if (choice === 'y') {
      setDescriptionPromptDecision('editing_y');
      setYnQuickInput('y');
      setTimeout(() => {
        adjustmentTextareaRef.current?.focus();
      }, 60);
    } else {
      setDescriptionPromptDecision('approved_n');
      setYnQuickInput('n');
    }
  };

  const handleRegisterAsForensicEvidence = async () => {
    if (!photoDataUrl || !aiAnalysis) return;
    setIsRegisteringEvidence(true);

    try {
      const mergedDescription = additionalUserAdjustment.trim()
        ? `${editableVisualDescription.trim() || aiAnalysis.visualDescription} [Bruger-tilføjelse/justering: ${additionalUserAdjustment.trim()}]`
        : editableVisualDescription.trim() || aiAnalysis.visualDescription;

      const finalAnalysis: ForensicPhotoAnalysis = {
        ...aiAnalysis,
        visualTitle: editableVisualTitle.trim() || aiAnalysis.visualTitle,
        visualDescription: mergedDescription,
        recommendedObservationType:
          editableObservationType.trim() || aiAnalysis.recommendedObservationType,
      };

      const photoEvidence: ForensicPhotoEvidence = {
        id: `photo-ev-${Date.now()}`,
        fileName: uploadedFileName || 'ringparken_feltfoto.jpg',
        mimeType: uploadedMimeType,
        fileSizeBytes: uploadedFileSize,
        dataUrl: photoDataUrl,
        imageSha256Hash: imageSha256Hash || 'verificeret-sha256',
        capturedAtIso: new Date().toISOString(),
        evidenceCategory: selectedEvidenceCategory,
        aiAnalysis: finalAnalysis,
      };

      await onRegisterPhotoEvidenceObservation({
        photoEvidence,
        observationType: finalAnalysis.recommendedObservationType,
        description: `[AI FOTO-BEVIS · ${selectedEvidenceCategory}: ${finalAnalysis.visualTitle}] ${finalAnalysis.visualDescription}`,
        position: pendingPosition,
        locationLabel,
        evidenceCategory: selectedEvidenceCategory,
      });

      onApplyAiDescriptionToForm?.({
        observationType: finalAnalysis.recommendedObservationType,
        description: finalAnalysis.visualDescription,
        photoEvidence,
      });

      setRegisteredSuccessBanner(
        `Foto-dokumentation "${photoEvidence.fileName}" er gennemgået, kryptografisk signeret (SHA-256) og registreret som bevismateriale!`
      );
    } finally {
      setIsRegisteringEvidence(false);
    }
  };

  const handleClearPhoto = () => {
    setPhotoDataUrl('');
    setUploadedFileName('');
    setUploadedFileSize(0);
    setImageSha256Hash('');
    setAiAnalysis(null);
    setEditableVisualTitle('');
    setEditableVisualDescription('');
    setAdditionalUserAdjustment('');
    setDescriptionPromptDecision('pending_yn');
    setYnQuickInput('');
    setAnalysisError(null);
    setRegisteredSuccessBanner(null);
  };

  return (
    <div className="p-3.5 bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-sky-400 rounded-md space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-300">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <span>AI Foto-Dokumentation &amp; Retsmedicinsk Bevis-Registrering</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              1. Upload Foto · 2. Gemini Vision AI-Analyse · 3. Registrér som SHA-256 Bevismateriale
            </div>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 text-[11px] font-mono font-bold shrink-0">
          Gemini Vision AI
        </span>
      </div>

      {/* Step 1: Upload Photo or Choose Realistic Field Demo Photo */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-bold">
            Trin 1: Upload Foto eller Vælg Felt-Optagelse fra Ringparken
          </span>
          {photoDataUrl && (
            <button
              type="button"
              onClick={handleClearPhoto}
              className="text-[11px] font-mono text-rose-300 hover:text-rose-200 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Nulstil foto</span>
            </button>
          )}
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processSelectedImageFile(file);
            e.target.value = '';
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processSelectedImageFile(file);
            e.target.value = '';
          }}
        />

        {/* Drag & Drop / Upload Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file && file.type.startsWith('image/')) {
              processSelectedImageFile(file);
            }
          }}
          className={`p-3 rounded-md border-2 border-dashed transition-colors ${
            isDraggingOver
              ? 'border-cyan-400 bg-cyan-950/40'
              : 'border-slate-700 bg-slate-950/80 hover:border-cyan-500/60'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 text-left">
              <Upload className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-white">
                  Træk foto hertil eller vælg billedfil fra enhed
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Understøtter JPG, PNG, WEBP · Signeres automatisk med SHA-256 og GPS ({pendingPosition.lat.toFixed(4)}°N, {pendingPosition.lng.toFixed(4)}°E)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 sm:flex-initial px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Foto</span>
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-cyan-500/40 font-mono text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                title="Tag foto direkte med mobil-/tablet-kamera"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Kamera</span>
              </button>
            </div>
          </div>

          {/* 1-Click Realistic Ringparken Field Demo Photos for instant testing */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1">
            <div className="text-[11px] font-mono uppercase text-slate-400">
              Eller indlæs et kalibreret felt-foto fra Ringparken til direkte AI-analyse:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {DEMO_PHOTO_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => handleLoadDemoScenarioPhoto(sc)}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400/60 text-left text-[11px] font-mono text-cyan-200 transition-colors truncate"
                  title={sc.label}
                >
                  <span className="inline-flex items-center gap-1 truncate">
                    <Camera className="w-3 h-3 shrink-0" />
                    <span className="truncate">{sc.shortTag}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Uploaded Photo Preview & Metadata */}
      {photoDataUrl && (
        <div className="space-y-3">
          <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-md space-y-2">
            <div className="relative rounded overflow-hidden border border-slate-800 bg-black">
              <img
                src={photoDataUrl}
                alt={uploadedFileName || 'Uploaded fotodokumentation'}
                className="w-full max-h-52 object-cover"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/90 border border-cyan-400/60 text-[11px] font-mono font-bold text-cyan-300 flex items-center gap-1">
                <Camera className="w-3 h-3 shrink-0" />
                <span>
                  {uploadedFileName} ({(uploadedFileSize / 1024).toFixed(1)} KB)
                </span>
              </div>
              {aiAnalysis && (
                <div
                  className={`absolute top-2 right-2 px-2 py-0.5 rounded font-mono text-[11px] font-extrabold border ${
                    aiAnalysis.severityAssessment === 'KRITISK'
                      ? 'bg-rose-600/95 text-white border-rose-300'
                      : aiAnalysis.severityAssessment === 'FORHØJET'
                      ? 'bg-amber-500/95 text-slate-950 border-amber-200'
                      : 'bg-emerald-600/95 text-white border-emerald-300'
                  }`}
                >
                  AI VURDERING: {aiAnalysis.severityAssessment} ({aiAnalysis.confidencePct}% sikkerhed)
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono text-slate-300">
              <div className="truncate">
                <span className="text-slate-400">GPS &amp; Tid:</span>{' '}
                {pendingPosition.lat.toFixed(4)}°N, {pendingPosition.lng.toFixed(4)}°E · {dateIso}{' '}
                kl. {currentWeather.hourLabel}
              </div>
              <div className="truncate text-cyan-300" title={imageSha256Hash}>
                <span className="text-slate-400">Billed SHA-256:</span>{' '}
                {imageSha256Hash ? `${imageSha256Hash.slice(0, 24)}...` : 'Beregner...'}
              </div>
            </div>

            {/* Optional User Notes & Re-Analyze Trigger */}
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={userPhotoNotes}
                onChange={(e) => setUserPhotoNotes(e.target.value)}
                placeholder="Valgfri kontekst til AI (f.eks. 'Taget fra altan mod Blok 1 kl. 13')..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                disabled={isAnalyzingPhoto}
                onClick={() =>
                  runGeminiPhotoAnalysis({
                    dataUrl: photoDataUrl,
                    mimeType: uploadedMimeType,
                    fileName: uploadedFileName,
                  })
                }
                className="px-2.5 py-1 rounded bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/60 font-mono text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors disabled:opacity-50"
              >
                {isAnalyzingPhoto ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyserer...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Gen-Analysér med AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: AI Analysis & Visual Description Output */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Trin 2: AI Analyse &amp; Visuel Beskrivelse</span>
              </span>
              {aiAnalysis && (
                <span className="text-[11px] font-mono text-slate-400">
                  {aiAnalysis.modelUsed}
                </span>
              )}
            </div>

            {isAnalyzingPhoto && (
              <div className="p-4 bg-slate-950/90 border border-cyan-500/40 rounded-md flex items-center justify-center gap-2.5 text-xs font-mono text-cyan-200">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                <span>
                  Gemini Multimodal Vision analyserer foto, støvfaner, &lt;1997 bygningsdele og
                  lovhjemler...
                </span>
              </div>
            )}

            {analysisError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-500/60 rounded text-xs text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{analysisError}</span>
              </div>
            )}

            {!isAnalyzingPhoto && aiAnalysis && (
              <div className="p-3 bg-slate-950/95 border border-cyan-500/40 rounded-md space-y-2.5">
                <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                  <div>
                    <div className="text-[11px] font-mono uppercase text-cyan-400 font-bold">
                      AI VISUEL KONKLUSION &amp; HÆNDELSESTITEL
                    </div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      {aiAnalysis.visualTitle}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[11px] font-extrabold shrink-0 ${
                      aiAnalysis.severityAssessment === 'KRITISK'
                        ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50'
                        : aiAnalysis.severityAssessment === 'FORHØJET'
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                        : 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
                    }`}
                  >
                    {aiAnalysis.severityAssessment} · {aiAnalysis.confidencePct}%
                  </span>
                </div>

                {/* INTERACTIVE USER PROMPT: "Ønsker du at tilføje, eller passer beskrivelsen (y/n)?" */}
                <div className="p-3 rounded-lg bg-[var(--surface-panel)] border border-[var(--border-subtle)] border-l-4 border-l-amber-400 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-mono font-extrabold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        PROMPT VED FOTO-UPLOAD: &quot;Ønsker du at tilføje, eller passer beskrivelsen (y/n)?&quot;
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        descriptionPromptDecision === 'pending_yn'
                          ? 'bg-amber-400 text-slate-950'
                          : descriptionPromptDecision === 'editing_y'
                          ? 'bg-cyan-400 text-slate-950'
                          : 'bg-emerald-500 text-slate-950'
                      }`}
                    >
                      {descriptionPromptDecision === 'pending_yn'
                        ? 'Afventer svar (y/n)'
                        : descriptionPromptDecision === 'editing_y'
                        ? 'Y valgt: Retter justeringer'
                        : descriptionPromptDecision === 'adjusted_saved'
                        ? '✓ Justeringer gemt & godkendt'
                        : '✓ N valgt: Beskrivelsen passer'}
                    </span>
                  </div>

                  {/* Current AI Description Preview */}
                  <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-1 text-xs">
                    <div className="font-mono text-[11px] text-cyan-300 font-semibold">
                      Foreslået titel: {editableVisualTitle || aiAnalysis.visualTitle}
                    </div>
                    <p className="text-slate-200 leading-relaxed">
                      {editableVisualDescription || aiAnalysis.visualDescription}
                    </p>
                    {additionalUserAdjustment.trim() && (
                      <div className="pt-1 text-[11px] font-mono text-emerald-300 border-t border-slate-800/80">
                        + Din tilføjelse: {additionalUserAdjustment}
                      </div>
                    )}
                  </div>

                  {/* Y / N Prompt Controls + Quick y/n Input */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleYnChoice('y')}
                      className={`px-3 py-1.5 rounded font-mono text-xs font-bold border transition-all cursor-pointer ${
                        descriptionPromptDecision === 'editing_y'
                          ? 'bg-amber-400 text-slate-950 border-white shadow-sm'
                          : 'bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border-amber-400/60'
                      }`}
                    >
                      [Y] Ja — Jeg ønsker at tilføje / rette justeringer
                    </button>

                    <button
                      type="button"
                      onClick={() => handleYnChoice('n')}
                      className={`px-3 py-1.5 rounded font-mono text-xs font-bold border transition-all cursor-pointer ${
                        descriptionPromptDecision === 'approved_n'
                          ? 'bg-emerald-400 text-slate-950 border-white shadow-sm'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border-emerald-400/60'
                      }`}
                    >
                      [N] Nej — Beskrivelsen passer som den er
                    </button>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-[11px] font-mono text-slate-400">Tast y/n:</span>
                      <input
                        type="text"
                        maxLength={1}
                        value={ynQuickInput}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase();
                          setYnQuickInput(val);
                          if (val === 'y' || val === 'j') {
                            handleYnChoice('y');
                          } else if (val === 'n') {
                            handleYnChoice('n');
                          }
                        }}
                        placeholder="y/n"
                        aria-label="Svar y eller n på om du ønsker at tilføje eller om beskrivelsen passer"
                        className="w-11 text-center py-1 rounded bg-slate-950 border border-amber-400/60 font-mono text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  {/* Expanded Adjustment Editor when Y is selected (or always accessible) */}
                  {(descriptionPromptDecision === 'editing_y' ||
                    descriptionPromptDecision === 'adjusted_saved') && (
                    <div className="p-3 rounded-lg bg-slate-950 border border-cyan-500/50 space-y-2.5 pt-2.5">
                      <div className="text-[11px] font-mono uppercase text-cyan-300 font-bold">
                        Ret Justeringer &amp; Tilføj til Beskrivelsen inden Bevis-Registrering:
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                            Hændelsestitel:
                          </label>
                          <input
                            type="text"
                            value={editableVisualTitle}
                            onChange={(e) => setEditableVisualTitle(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                            Observationstype:
                          </label>
                          <input
                            type="text"
                            value={editableObservationType}
                            onChange={(e) => setEditableObservationType(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                          Ret AI-Visuel Beskrivelse:
                        </label>
                        <textarea
                          ref={adjustmentTextareaRef}
                          rows={3}
                          value={editableVisualDescription}
                          onChange={(e) => setEditableVisualDescription(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono uppercase text-amber-300 mb-1">
                          Tilføj supplerende observation / præcisering til beviset (valgfrit):
                        </label>
                        <input
                          type="text"
                          value={additionalUserAdjustment}
                          onChange={(e) => setAdditionalUserAdjustment(e.target.value)}
                          placeholder="F.eks. 'Ingen vandkanon i drift i 45 min, støv trængte ind ad vindue på 2. sal'..."
                          className="w-full bg-slate-900 border border-amber-500/50 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setDescriptionPromptDecision('adjusted_saved')}
                          className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold cursor-pointer"
                        >
                          ✓ Bekræft Justeringer (Klar til Registrering)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Detected Visual Hazards */}
                <div className="space-y-1">
                  <div className="text-[11px] font-mono uppercase text-rose-300 font-semibold">
                    AI-Identificerede Miljø- &amp; Arbejdsmiljøfarer på Foto:
                  </div>
                  <ul className="space-y-1 text-xs text-slate-200">
                    {aiAnalysis.detectedHazards.map((haz, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-1.5 bg-slate-900/80 px-2 py-1 rounded border border-slate-800"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span>{haz}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suspected Substances & Statutory References */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2 bg-slate-900/90 rounded border border-slate-800 space-y-1">
                    <div className="text-[11px] font-mono uppercase text-slate-400">
                      Mistænkte Stoffer (BEK 613/2026):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {aiAnalysis.suspectedSubstances.map((subKey) => {
                        const spec = SUBSTANCE_SPECS[subKey as SubstanceKey];
                        return (
                          <span
                            key={subKey}
                            className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/40 text-[11px] font-mono font-semibold inline-flex items-center gap-1"
                          >
                            <Biohazard className="w-3 h-3 shrink-0" />
                            <span>{spec ? spec.shortName : subKey}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-2 bg-slate-900/90 rounded border border-slate-800 space-y-1">
                    <div className="text-[11px] font-mono uppercase text-slate-400">
                      Relevante Lovhjemler:
                    </div>
                    <div className="space-y-0.5 text-[11px] font-mono text-amber-200">
                      {aiAnalysis.statutoryReferences.slice(0, 3).map((ref, i) => (
                        <div key={i} className="truncate" title={ref}>
                          • {ref}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Forensic Conclusion coupling Photo + Open-Meteo Plume */}
                <div className="p-2 bg-cyan-950/30 border border-cyan-500/40 rounded text-[11px] text-cyan-100 leading-snug">
                  <strong className="text-cyan-300 font-mono">
                    Retsmedicinsk korrelation (Foto + Open-Meteo):
                  </strong>{' '}
                  {aiAnalysis.forensicConclusion}
                </div>

                {/* Step 3: Register Photo Documentation as Cryptographically Signed Evidence */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-300 font-bold">
                      Trin 3: Vælg Bevis-Kategori &amp; Registrér Foto-Dokumentation
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {descriptionPromptDecision === 'pending_yn'
                        ? 'Besvar (y/n) ovenfor eller registrér direkte'
                        : '✓ Beskrivelse verificeret'}
                    </span>
                  </div>

                  {/* Evidence Category Selector */}
                  <div className="p-2 rounded bg-slate-950/90 border border-slate-800 space-y-1.5">
                    <div className="text-[11px] font-mono text-slate-300 font-semibold">
                      Tilknyt specifik bevis-kategori (vises på Bevis-Tidslinjen):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          'Beboerklage',
                          'Myndighedskorrespondance',
                          'Tilsynsrapport',
                          'Laboratorieanalyse',
                          'AMR-Observation',
                        ] as ForensicEvidenceCategoryTag[]
                      ).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedEvidenceCategory(cat)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
                            selectedEvidenceCategory === cat
                              ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-bold'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isRegisteringEvidence}
                    onClick={handleRegisterAsForensicEvidence}
                    className="w-full py-2.5 px-3 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-mono font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <FileCheck2 className="w-4 h-4 shrink-0" />
                    <span>
                      {isRegisteringEvidence
                        ? 'Signerer og registrerer foto-bevis...'
                        : `Godkend & Registrér som ${selectedEvidenceCategory} (SHA-256)`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Banner when Registered */}
      {registeredSuccessBanner && (
        <div className="p-2.5 rounded bg-[var(--surface-panel)] border border-emerald-500/50 border-l-4 border-l-emerald-400 text-emerald-100 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{registeredSuccessBanner}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono pt-1">
            <span className="text-emerald-300">
              Inkluderet i SHA-256 Proof-of-State &amp; PDF/JSON Bevis-Rapport
            </span>
            <button
              type="button"
              onClick={onOpenReportModal}
              className="px-2 py-0.5 rounded bg-emerald-400 text-slate-950 font-bold hover:bg-emerald-300 transition-colors"
            >
              Åbn Bevis-Rapport →
            </button>
          </div>
        </div>
      )}

      {/* Registered Photo Evidence Archive */}
      {observationsWithPhotos.length > 0 && (
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-bold flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Registreret Foto-Bevismateriale ({observationsWithPhotos.length} stk.)
              </span>
            </span>
            <button
              type="button"
              onClick={onOpenReportModal}
              className="text-[11px] font-mono text-cyan-400 underline hover:text-cyan-300"
            >
              Se i Bevis-Rapport (PDF) →
            </button>
          </div>

          <div className="space-y-2">
            {observationsWithPhotos.map((obs) => {
              const pe = obs.photoEvidence;
              if (!pe) return null;
              return (
                <div
                  key={obs.id}
                  onClick={() => onSelectObservation(obs)}
                  className="p-2.5 rounded bg-slate-950/90 border border-cyan-500/40 hover:border-cyan-400 cursor-pointer transition-colors flex gap-2.5 items-start"
                >
                  <img
                    src={pe.dataUrl}
                    alt={pe.fileName}
                    className="w-20 h-16 object-cover rounded border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-1 font-mono text-[11px]">
                      <span className="font-bold text-cyan-300 truncate inline-flex items-center gap-1">
                        <Camera className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {obs.code} · {pe.aiAnalysis.visualTitle}
                        </span>
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                          {pe.evidenceCategory || obs.evidenceCategory || 'Beboerklage'}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                          {pe.aiAnalysis.severityAssessment}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-snug">
                      {pe.aiAnalysis.visualDescription}
                    </p>
                    <div className="text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-2 pt-0.5">
                      <span className="flex items-center gap-0.5 text-fuchsia-300">
                        <MapPin className="w-2.5 h-2.5" />
                        {obs.locationLabel}
                      </span>
                      <span>·</span>
                      <span>
                        S = {obs.plumeCorroboration.calculatedSumQuotient.toFixed(2)}
                      </span>
                      <span>·</span>
                      <span className="text-emerald-300 truncate">
                        SHA-256: {pe.imageSha256Hash.slice(0, 14)}...
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
