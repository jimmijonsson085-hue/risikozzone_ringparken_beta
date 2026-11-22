import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Clock,
  Copy,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  MapPin,
  Send,
  ShieldAlert,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import {
  RINGPARKEN_BUILDINGS,
  getSamplesForBuilding,
} from '../constants/ringparkenData';
import {
  SiteObservationAnalysisResult,
  SiteObservationSeverity,
  analyzeSiteObservation,
} from '../services/geminiService';
import { checkWorkHoursCompliance } from '../utils/riskEngine';

interface QuickIncidentTemplate {
  id: string;
  labelDa: string;
  defaultBuildingId: string;
  textDa: string;
}

const QUICK_INCIDENT_TEMPLATES: QuickIncidentTemplate[] = [
  {
    id: 'dust-no-water',
    labelDa: 'Støvsky uden vanding',
    defaultBuildingId: 'byg-2-kierulffsvej-12',
    textDa:
      'Synlig, kraftig støvsky under mekanisk nedbrydning/læsning på pladsen uden aktiv vandforstøvning eller støvdæmpning i tørt vejr. Risiko for spredning af usaneret asbest-/bly-/PCB-støv mod beboede naboblokke og gangstier.',
  },
  {
    id: 'missing-containment-airlock',
    labelDa: 'Manglende inddækning / sluse',
    defaultBuildingId: 'blok-1-kierulffsvej-14-22',
    textDa:
      'Nedtagning af asbest-/mineralulds- eller PCB-holdige bygningsdele foregår uden fuldstændig støvtæt inddækning, synlig 3-kammer luftsluse eller mærket HEPA-undertryksafkast jf. BEK 1328/2025.',
  },
  {
    id: 'outside-work-hours',
    labelDa: 'Arbejde uden for arbejdstid',
    defaultBuildingId: 'byg-2-kierulffsvej-12',
    textDa:
      'Tunge entreprenørmaskiner, opbrydning eller lastbilkørsel er i gang uden for de tilladte arbejdstider i Slagelse Kommunes forskrift (ma–fr 07:00–18:00 / lø 07:00–14:00) med tydelig støjgene i skel.',
  },
  {
    id: 'open-excavation-fence',
    labelDa: 'Åben udgravning > 2 m uden fast hegn',
    defaultBuildingId: 'byg-1-kierulffsvej-2',
    textDa:
      'Åben udgravning eller kældergrube med dybde over ca. 2 meter henligger uden fast, ubrudt byggepladshegn eller forsvarlig afspærring mod offentlig sti / beboerområde jf. PSS W22085.',
  },
  {
    id: 'protected-trees-bats',
    labelDa: 'Bevaringsværdige træer / flagermus',
    defaultBuildingId: 'byg-3-valbyvej-58',
    textDa:
      'Tung maskinkørsel, gravearbejde eller oplag af materialer observeret helt inde i dryp-/rodzonen af bevaringsværdige træer langs Valbyvej / nabomatrikel 22c, eller uvarslet indgreb i ældre tag-/hulrum uden dokumenteret § 29 a flagermus-screening.',
  },
  {
    id: 'rain-uncovered-stockpile',
    labelDa: 'Uafdækket affaldsoplag i regnvejr',
    defaultBuildingId: 'byg-2-kierulffsvej-12',
    textDa:
      'Uafdækkede bunker med nedrivningsaffald / opgravet jord ligger direkte i regnvejr på befæstet eller lerholdig plads (lavning Kierulffsvej 12) uden presenning eller opsamlende sikring mod udvaskning til regnvandsbrønde og terrænnært grundvand.',
  },
];

function formatLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function compressImageFileToJpeg(file: File): Promise<{
  base64: string;
  mimeType: string;
  previewUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error('Kunne ikke læse den valgte billedfil.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Tom billedfil modtaget.'));
        return;
      }

      const img = new Image();
      img.onerror = () =>
        reject(new Error('Billedformatet kunne ikke indlæses i browseren.'));
      img.onload = () => {
        const maxSide = 1600;
        let targetW = img.naturalWidth || img.width;
        let targetH = img.naturalHeight || img.height;
        if (targetW > maxSide || targetH > maxSide) {
          const scale = maxSide / Math.max(targetW, targetH);
          targetW = Math.round(targetW * scale);
          targetH = Math.round(targetH * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, targetW);
        canvas.height = Math.max(1, targetH);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const commaIdx = dataUrl.indexOf(',');
          resolve({
            base64: commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl,
            mimeType: file.type || 'image/jpeg',
            previewUrl: dataUrl,
          });
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.84);
        const commaIdx = jpegDataUrl.indexOf(',');
        resolve({
          base64: jpegDataUrl.slice(commaIdx + 1),
          mimeType: 'image/jpeg',
          previewUrl: jpegDataUrl,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function getSeverityClasses(severity: SiteObservationSeverity): {
  banner: string;
  badgeText: string;
  labelDa: string;
} {
  switch (severity) {
    case 'KRITISK':
      return {
        banner: 'bg-rose-950/50 border-rose-500/70 text-rose-100',
        badgeText: 'text-rose-300',
        labelDa: 'KRITISK',
      };
    case 'HØJ':
      return {
        banner: 'bg-amber-950/45 border-amber-500/70 text-amber-100',
        badgeText: 'text-amber-300',
        labelDa: 'HØJ RISIKO',
      };
    case 'MODERAT':
      return {
        banner: 'bg-sky-950/45 border-sky-500/60 text-sky-100',
        badgeText: 'text-sky-300',
        labelDa: 'MODERAT',
      };
    case 'LAV':
      return {
        banner: 'bg-emerald-950/40 border-emerald-500/60 text-emerald-100',
        badgeText: 'text-emerald-300',
        labelDa: 'LAV',
      };
    default:
      return {
        banner: 'bg-slate-900 border-slate-500/70 text-slate-100',
        badgeText: 'text-slate-300',
        labelDa: 'UFULDSTÆNDIG DOKUMENTATION',
      };
  }
}

export interface IncidentAnalyzerProps {
  onOpenBuildingOnGis?: (buildingId: string) => void;
}

export const IncidentAnalyzer: React.FC<IncidentAnalyzerProps> = ({
  onOpenBuildingOnGis,
}) => {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(
    'byg-2-kierulffsvej-12'
  );
  const [observedTimestamp, setObservedTimestamp] = useState<string>(() =>
    formatLocalDatetimeInputValue(new Date())
  );
  const [description, setDescription] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | undefined>(
    undefined
  );
  const [imageFilename, setImageFilename] = useState<string | undefined>(undefined);

  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<SiteObservationAnalysisResult | null>(null);
  const [editableDraft, setEditableDraft] = useState<string>('');
  const [copiedDraft, setCopiedDraft] = useState<boolean>(false);

  const selectedBuilding = useMemo(
    () => RINGPARKEN_BUILDINGS.find((b) => b.id === selectedBuildingId),
    [selectedBuildingId]
  );

  const selectedSamples = useMemo(
    () => (selectedBuilding ? getSamplesForBuilding(selectedBuilding.id) : []),
    [selectedBuilding]
  );

  const liveWorkHours = useMemo(() => {
    const parsed = new Date(observedTimestamp);
    return checkWorkHoursCompliance(
      Number.isNaN(parsed.getTime()) ? new Date() : parsed
    );
  }, [observedTimestamp]);

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleOpenLiveCamera = async () => {
    setCameraError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError(
        'Live-kamera er ikke tilgængeligt i denne browser — brug filupload/mobilkamera i stedet.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setCameraOpen(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      }, 40);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Adgang til kamera blev afvist.';
      setCameraError(`Kunne ikke starte kameraet: ${msg}`);
    }
  };

  const handleCaptureFromCamera = () => {
    const video = videoRef.current;
    if (!video) return;
    const rawW = video.videoWidth || 1280;
    const rawH = video.videoHeight || 720;
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(rawW, rawH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(rawW * scale));
    canvas.height = Math.max(1, Math.round(rawH * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
    const commaIdx = dataUrl.indexOf(',');
    setImageBase64(dataUrl.slice(commaIdx + 1));
    setImageMimeType('image/jpeg');
    setImagePreviewUrl(dataUrl);
    setImageFilename(
      `pladsfoto_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`
    );
    stopCameraStream();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    try {
      const compressed = await compressImageFileToJpeg(file);
      setImageBase64(compressed.base64);
      setImageMimeType(compressed.mimeType);
      setImagePreviewUrl(compressed.previewUrl);
      setImageFilename(file.name);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Kunne ikke indlæse fotoet.'
      );
    }
  };

  const handleClearImage = () => {
    setImageBase64(undefined);
    setImageMimeType(undefined);
    setImagePreviewUrl(undefined);
    setImageFilename(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApplyTemplate = (tpl: QuickIncidentTemplate) => {
    setSelectedBuildingId(tpl.defaultBuildingId);
    setDescription(tpl.textDa);
    setErrorMessage(null);
  };

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setCopiedDraft(false);

    if (!description.trim() && !imageBase64) {
      setErrorMessage(
        'Beskriv hændelsen eller vedhæft et foto fra pladsen før analyse.'
      );
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeSiteObservation({
        description,
        selectedBuilding,
        observedTimestamp,
        imageBase64,
        imageMimeType,
      });
      setAnalysisResult(result);
      setEditableDraft(result.formalInquiryDraft);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Uventet fejl under analyse af observationen.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyDraft = async () => {
    if (!editableDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(editableDraft);
      setCopiedDraft(true);
      window.setTimeout(() => setCopiedDraft(false), 2500);
    } catch {
      setErrorMessage('Kunne ikke kopiere automatisk — markér teksten manuelt.');
    }
  };

  const handleDownloadDraftTxt = () => {
    if (!editableDraft.trim()) return;
    const blob = new Blob([editableDraft], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ringparken_tilsynshenvendelse_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const severityStyle = analysisResult
    ? getSeverityClasses(analysisResult.severity)
    : null;

  return (
    <div
      data-testid="incident-analyzer-panel"
      className="max-w-[1360px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-5"
    >
      {/* VENSTRE KOLONNE: INDTJENING / DOKUMENTATION */}
      <form
        onSubmit={handleRunAnalysis}
        className="xl:col-span-6 bg-[#111827] border border-[#334155] rounded-lg p-5 space-y-4"
      >
        <div className="space-y-1 border-b border-[#1E293B] pb-3">
          <h2 className="text-base font-semibold text-slate-50 flex items-center gap-2">
            <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Indberet Plads-observation &amp; Fotodokumentation</span>
          </h2>
          <p className="text-xs text-slate-400">
            Kombinerer foto, tidspunkt og verificerede miljøprøver for Ringparken mod BEK 1328/2025, BEK 496/2024, BEK 613/2026 og Lokalplan 1269.
          </p>
        </div>

        {/* LOKATION & TIDSPUNKT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="incident-building-select"
              className="block text-xs font-medium text-slate-300"
            >
              Lokation / Bygning i Ringparken
            </label>
            <select
              id="incident-building-select"
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              className="w-full rounded-md bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
            >
              {RINGPARKEN_BUILDINGS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.permitCaseNumber ? ` (Sag ${b.permitCaseNumber.split(' ')[0]})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="incident-timestamp-input"
                className="block text-xs font-medium text-slate-300"
              >
                Observationstidspunkt
              </label>
              <button
                type="button"
                onClick={() =>
                  setObservedTimestamp(formatLocalDatetimeInputValue(new Date()))
                }
                className="text-[11px] font-mono text-cyan-300 hover:text-cyan-200 cursor-pointer"
              >
                Sæt til nu
              </button>
            </div>
            <input
              id="incident-timestamp-input"
              type="datetime-local"
              value={observedTimestamp}
              onChange={(e) => setObservedTimestamp(e.target.value)}
              className="w-full rounded-md bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs font-mono text-slate-100 [color-scheme:dark] focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* KONTEKST-BANNER FOR VALGT LOKATION & ARBEJDSTID */}
        {selectedBuilding && (
          <div className="bg-[#0B0F19] border border-[#1E293B] rounded-md p-3 space-y-1.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{selectedBuilding.canonicalAddresses[0]}</span>
              </div>
              {onOpenBuildingOnGis && (
                <button
                  type="button"
                  onClick={() => onOpenBuildingOnGis(selectedBuilding.id)}
                  className="text-[11px] text-cyan-300 hover:text-cyan-200 underline cursor-pointer"
                >
                  Vis på GIS Risikokort
                </button>
              )}
            </div>
            <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1 font-mono">
              <span>Etape: {selectedBuilding.stage}</span>
              <span>Prøver i register: {selectedSamples.length}</span>
              {selectedBuilding.fobBlockNumber !== null &&
                selectedBuilding.dmaBlockNumber !== null &&
                selectedBuilding.fobBlockNumber !==
                  selectedBuilding.dmaBlockNumber && (
                  <span className="text-amber-300">
                    FOB Blok {selectedBuilding.fobBlockNumber} = DMA Blok{' '}
                    {selectedBuilding.dmaBlockNumber}
                  </span>
                )}
            </div>
            <div
              className={`text-[11px] font-mono pt-1 flex items-center gap-1.5 ${
                liveWorkHours.isAllowed ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{liveWorkHours.statusLabelDa}</span>
            </div>
          </div>
        )}

        {/* HURTIGVALG FOR TYPISKE HÆNDELSER */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-300">
            Hurtigvalg (standardiserede pladsforhold)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {QUICK_INCIDENT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tpl)}
                className="text-left px-2.5 py-2 rounded bg-[#0B0F19] hover:bg-[#162032] border border-[#334155] text-xs text-slate-200 transition-colors cursor-pointer"
              >
                {tpl.labelDa}
              </button>
            ))}
          </div>
        </div>

        {/* FOTO UPLOAD + LIVE KAMERA */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-300">
              Fotodokumentation (valgfrit, men anbefalet)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded bg-[#0B0F19] hover:bg-[#1E293B] border border-[#334155] text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <ImagePlus className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Vælg foto / Mobilkamera</span>
              </button>
              <button
                type="button"
                onClick={cameraOpen ? stopCameraStream : handleOpenLiveCamera}
                className="px-2.5 py-1.5 rounded bg-[#0B0F19] hover:bg-[#1E293B] border border-[#334155] text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Video className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{cameraOpen ? 'Luk kamera' : 'Tag live-foto'}</span>
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload pladsfoto"
          />

          {cameraError && (
            <div className="p-2.5 rounded bg-amber-950/40 border border-amber-500/50 text-xs text-amber-200">
              {cameraError}
            </div>
          )}

          {cameraOpen && (
            <div className="bg-[#0B0F19] border border-cyan-500/50 rounded-md p-3 space-y-2">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-60 rounded object-cover bg-black"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={stopCameraStream}
                  className="px-3 py-1.5 rounded border border-[#334155] text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Annuller</span>
                </button>
                <button
                  type="button"
                  onClick={handleCaptureFromCamera}
                  className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Tag billede</span>
                </button>
              </div>
            </div>
          )}

          {imagePreviewUrl && (
            <div className="relative bg-[#0B0F19] border border-[#334155] rounded-md p-2.5 flex items-center gap-3">
              <img
                src={imagePreviewUrl}
                alt="Vedhæftet pladsdokumentation"
                className="w-20 h-20 object-cover rounded border border-[#334155] shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-xs font-mono text-slate-200 truncate">
                  {imageFilename ?? 'Vedhæftet billede'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Komprimeret til JPEG og placeret først i multimodal forespørgsel.
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearImage}
                aria-label="Fjern vedhæftet foto"
                className="p-1.5 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* OBSERVATIONSBESKRIVELSE */}
        <div className="space-y-1.5">
          <label
            htmlFor="incident-description-textarea"
            className="block text-xs font-medium text-slate-300"
          >
            Beskrivelse af observationen
          </label>
          <textarea
            id="incident-description-textarea"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beskriv hvad du ser (f.eks. manglende vanding ved nedrivning, støvflugt over Kierulffsvej, uafdækket affald i regnvejr, manglende sluse eller arbejde uden for tidsrummet)..."
            className="w-full rounded-md bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="p-3 rounded-md bg-rose-950/50 border border-rose-500/70 text-xs text-rose-100 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isAnalyzing}
          className="w-full py-2.5 px-4 rounded-md bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyserer observation mod lovgivning &amp; miljøprøver...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Analysér observation &amp; generér myndighedsudkast</span>
            </>
          )}
        </button>
      </form>

      {/* HØJRE KOLONNE: STRUKTURERET ANALYSE & HENVENDELSESUDKAST */}
      <div className="xl:col-span-6 bg-[#111827] border border-[#334155] rounded-lg p-5 flex flex-col gap-4">
        <div className="border-b border-[#1E293B] pb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-50 flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Struktureret Compliance- &amp; Tilsynsvurdering</span>
          </h2>
          {analysisResult && (
            <span className="text-[11px] font-mono text-slate-400">
              Model: {analysisResult.usedModel}
            </span>
          )}
        </div>

        {!analysisResult ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 text-xs text-slate-400 space-y-2 border border-dashed border-[#334155] rounded-md bg-[#0B0F19]/50">
            <ShieldAlert className="w-7 h-7 text-slate-500" />
            <p className="max-w-md leading-relaxed">
              Vælg en bygning/lokation i Ringparken, vedhæft eventuelt et foto fra pladsen eller vælg et hurtigscenarie, og klik på{' '}
              <strong className="text-slate-200">
                Analysér observation &amp; generér myndighedsudkast
              </strong>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* ALVORSGRAD & KOMPETENT MYNDIGHED */}
            {severityStyle && (
              <div
                className={`p-3.5 rounded-md border flex flex-wrap items-center justify-between gap-2 ${severityStyle.banner}`}
              >
                <div className="space-y-0.5">
                  <div className="text-[11px] font-mono uppercase tracking-wide opacity-80">
                    Samlet klassificering
                  </div>
                  <div className={`text-sm font-bold font-mono ${severityStyle.badgeText}`}>
                    {severityStyle.labelDa}
                  </div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="text-[11px] font-mono uppercase tracking-wide opacity-80">
                    Kompetent myndighed
                  </div>
                  <div className="text-xs font-semibold">
                    {analysisResult.relevantAuthority}
                  </div>
                </div>
              </div>
            )}

            {/* VISUELLE / FAKTUELLE FUND */}
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-md p-3.5 space-y-2">
              <h3 className="text-xs font-semibold text-slate-200">
                Faktuelle &amp; visuelle fund
              </h3>
              <ul className="list-disc pl-4 space-y-1 text-xs text-slate-300 leading-relaxed">
                {analysisResult.visualFindings.map((finding, idx) => (
                  <li key={idx}>{finding}</li>
                ))}
              </ul>
            </div>

            {/* MULIGT OVERTRÅDTE REGLER & VILKÅR */}
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-md p-3.5 space-y-2">
              <h3 className="text-xs font-semibold text-slate-200">
                Muligt berørte regler, bekendtgørelser &amp; vilkår (
                {analysisResult.potentiallyViolatedRules.length})
              </h3>
              {analysisResult.potentiallyViolatedRules.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Ingen entydige regelbrud identificeret ud fra den angivne dokumentation.
                </p>
              ) : (
                <div className="space-y-2">
                  {analysisResult.potentiallyViolatedRules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="border-l-2 border-amber-400 pl-3 py-0.5 space-y-0.5"
                    >
                      <div className="text-xs font-mono font-semibold text-amber-300">
                        {rule.lawOrPermitRef}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {rule.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STRAKSRÅD TIL SIKKERHED */}
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-md p-3.5 space-y-2">
              <h3 className="text-xs font-semibold text-slate-200">
                Umiddelbare forholdsregler &amp; sikkerhedsråd
              </h3>
              <ul className="list-disc pl-4 space-y-1 text-xs text-cyan-100 leading-relaxed">
                {analysisResult.immediateSafetyAdvice.map((advice, idx) => (
                  <li key={idx}>{advice}</li>
                ))}
              </ul>
            </div>

            {/* KOPIÉRBART HENVENDELSESUDKAST */}
            <div className="bg-[#0B0F19] border border-[#334155] rounded-md p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="formal-inquiry-draft"
                  className="text-xs font-semibold text-slate-100"
                >
                  Kopiérbart henvendelses- &amp; aktindsigtsudkast
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyDraft}
                    className="px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#293548] border border-[#334155] text-[11px] font-mono text-cyan-200 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedDraft ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Kopieret</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopiér udkast</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadDraftTxt}
                    className="px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#293548] border border-[#334155] text-[11px] font-mono text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .txt</span>
                  </button>
                </div>
              </div>
              <textarea
                id="formal-inquiry-draft"
                rows={8}
                value={editableDraft}
                onChange={(e) => setEditableDraft(e.target.value)}
                className="w-full rounded bg-[#111827] border border-[#334155] p-3 text-xs font-mono text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentAnalyzer;
