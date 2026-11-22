import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Globe,
  MapPin,
  Cpu,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Scale,
  Atom,
  HardHat,
  Stethoscope,
  Network,
  Trash2,
  Flame,
  AlertOctagon,
  BookOpen,
  Copy,
  Check,
  FileText,
} from 'lucide-react';
import {
  IndoorClimateTelemetryResult,
  IndoorReceptorClimateExposure,
  LegalViolationEntry,
} from '../types/dispersion';
import {
  formatEnvironmentalProfilesForAiSystemPrompt,
  getBuildingEnvironmentalProfile,
} from '../data/ringparkenEnvironmentalSamples';

export type ExpertPersonaRole =
  | 'amr'
  | 'jurist'
  | 'fysiker'
  | 'laege'
  | 'kybernetiker';

export interface ForensicChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
  personaRole?: ExpertPersonaRole;
  groundingTool?: 'search' | 'maps' | 'none';
  webSources?: Array<{ title: string; uri: string }>;
  mapPlaces?: Array<{ title: string; uri: string }>;
}

export interface ForensicChatbotTelemetryContext {
  selectedSourceName: string;
  windSpeedMs: number;
  windDirDeg: number;
  stabilityClass: string;
  sumQuotient: number;
  peakAddress: string;
  selectedDate: string;
  selectedHour: number;
  precipitationMm: number;
  observationsCount: number;
  indoorClimate?: Partial<IndoorClimateTelemetryResult & IndoorReceptorClimateExposure>;
}

interface ForensicChatbotPanelProps {
  telemetryContext: ForensicChatbotTelemetryContext;
  onRunMapsGrounding?: () => void;
  mapsGroundingLoading?: boolean;
  initialPersonaRole?: ExpertPersonaRole;
  selectedLegalViolations?: LegalViolationEntry[];
  externalViolationRequest?: {
    requestId: number;
    violations: LegalViolationEntry[];
    preferredRole?: ExpertPersonaRole;
  } | null;
}

interface ExpertDefinition {
  id: ExpertPersonaRole;
  title: string;
  shortLabel: string;
  subtitle: string;
  badgeText: string;
  accentClasses: string;
  activeButtonClasses: string;
  defaultModelTier: 'complex' | 'general' | 'fast';
  systemRoleSummary: string;
  quickPrompts: Array<{
    label: string;
    prompt: string;
    tier: 'complex' | 'general' | 'fast';
    grounding: 'none' | 'search' | 'maps';
  }>;
}

export const ForensicChatbotPanel: React.FC<ForensicChatbotPanelProps> = ({
  telemetryContext,
  onRunMapsGrounding,
  mapsGroundingLoading = false,
  initialPersonaRole = 'jurist',
  selectedLegalViolations,
  externalViolationRequest,
}) => {
  const [personaRole, setPersonaRole] =
    useState<ExpertPersonaRole>(initialPersonaRole);
  const [modelTier, setModelTier] = useState<'complex' | 'general' | 'fast'>(
    'complex'
  );
  const [groundingTool, setGroundingTool] = useState<
    'search' | 'maps' | 'none'
  >('none');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(
    'Almenlejeloven genhusning sundhedsfare asbest BEK 613/2026 tortgodtgørelse Slagelse Ringparken'
  );
  const [searchLoading, setSearchLoading] = useState(false);

  const plumeDirDeg = (telemetryContext.windDirDeg + 180) % 360;
  const hourFormatted = `${String(telemetryContext.selectedHour).padStart(2, '0')}:00`;
  const activeBuildingProfile = useMemo(
    () => getBuildingEnvironmentalProfile(telemetryContext.selectedSourceName),
    [telemetryContext.selectedSourceName]
  );
  const environmentalProfileSystemPrompt = useMemo(
    () => formatEnvironmentalProfilesForAiSystemPrompt(telemetryContext.selectedSourceName),
    [telemetryContext.selectedSourceName]
  );

  // Calibrated IndoorReceptorClimateExposure telemetry scoped to Primary Focus-Receptor:
  // "Alle beboede naboblokke (Afd. 23, 24, 26, 32, Rødtjørnevej 2 & Kierulffsvej 4)"
  const indoorClimateData = useMemo(() => {
    const ic = telemetryContext.indoorClimate;
    const distanceMeters = ic?.distanceMeters ?? 32;
    const ppvFoundationMmPerSec =
      ic?.structural?.calculatedPpvFoundationMmS ?? ic?.ppvFoundationMmPerSec ?? 8.7;
    const dominantFrequencyHz =
      ic?.structural?.dominantFrequencyHz ?? ic?.dominantFrequencyHz ?? 3.0;
    const degradedPermeabilityQ75DegM3PerHm2 =
      ic?.structural?.degradedPermeabilityQ75 ?? ic?.degradedPermeabilityQ75DegM3PerHm2 ?? 6.57;
    const deltaPCavPa =
      ic?.cav?.inducedCavDepressurizationPa ?? ic?.deltaPCavPa ?? -45.3;
    const shaftAndCrackInflowQopM3PerH =
      ic?.stack?.crawlspaceSuctionFlowM3h ?? ic?.shaftAndCrackInflowQopM3PerH ?? 78.1;
    const deltaPsSpanPa = ic?.deltaPsSpanPa ?? 5.0;
    const stackGradientPaPerM =
      ic?.stack?.pressureGradientPaPerMeter ?? ic?.stackGradientPaPerM ?? 1.04;
    const zNplEffectiveMeters =
      ic?.stack?.effectiveNeutralPressureLevelMeters ?? ic?.zNplEffectiveMeters ?? 12.0;
    const buildingHeightMeters =
      ic?.stack?.buildingHeightMeters ?? ic?.buildingHeightMeters ?? 12.0;
    const indoorAsbestosFibrePerCm3 =
      ic?.indoorSubstances?.find((s) => s.key === 'asbestos')?.indoorConc ??
      ic?.indoorAsbestosFibrePerCm3 ??
      0.0071;
    const indoorAsbestosPctOfGv = ic?.indoorAsbestosPctOfGv ?? 237;
    const moldCfuPerM3 = ic?.moldCfuPerM3 ?? 685;
    const indoorSumQuotientSin =
      ic?.indoorSumQuotientS ?? ic?.indoorSumQuotientSin ?? 3.15;
    const outdoorSumQuotientSout =
      ic?.outdoorSumQuotientS ??
      ic?.outdoorSumQuotientSout ??
      Math.max(3.43, telemetryContext.sumQuotient);
    const br18Section443Compliant = ic?.br18Section443Compliant ?? false;

    // Cybernetic Crisis Interval Δt vs. Relaxation Time T_r coupling with ΔP_CAV and ΔP_s:
    // Baseline Δt_0 = 6.0 h; suction acceleration from |ΔP_CAV| = 45.3 Pa, ΔP_s = +5.0 Pa (1.04 Pa/m) and Q_op = 78.1 m³/h compresses Δt to 1.08 h
    const suctionAccelFactor =
      1 +
      Math.abs(deltaPCavPa) / 14.0 +
      Math.abs(deltaPsSpanPa) / 5.0 +
      shaftAndCrackInflowQopM3PerH / 120.0;
    const crisisIntervalDeltaTHours = Number((6.0 / suctionAccelFactor).toFixed(2));
    const relaxationTimeTrHours = 18.5;
    const systemicTetanusRatio = Number((relaxationTimeTrHours / Math.max(0.1, crisisIntervalDeltaTHours)).toFixed(1));
    const rentReductionPctRange =
      indoorSumQuotientSin >= 1.0 || indoorAsbestosFibrePerCm3 >= 0.003
        ? '75–100 %'
        : indoorSumQuotientSin >= 0.5
        ? '25–75 %'
        : '25 %';

    return {
      primaryFocusReceptor:
        'Alle beboede naboblokke (Afd. 23, 24, 26, 32, Rødtjørnevej 2 & Kierulffsvej 4)',
      distanceMeters,
      ppvFoundationMmPerSec,
      dominantFrequencyHz,
      degradedPermeabilityQ75DegM3PerHm2,
      deltaPCavPa,
      shaftAndCrackInflowQopM3PerH,
      deltaPsSpanPa,
      stackGradientPaPerM,
      zNplEffectiveMeters,
      buildingHeightMeters,
      indoorAsbestosFibrePerCm3,
      indoorAsbestosPctOfGv,
      moldCfuPerM3,
      indoorSumQuotientSin,
      outdoorSumQuotientSout,
      br18Section443Compliant,
      crisisIntervalDeltaTHours,
      relaxationTimeTrHours,
      systemicTetanusRatio,
      rentReductionPctRange,
      legalTriggerActive:
        indoorSumQuotientSin >= 0.5 ||
        indoorAsbestosFibrePerCm3 > 0 ||
        moldCfuPerM3 > 500 ||
        !br18Section443Compliant,
    };
  }, [telemetryContext.indoorClimate, telemetryContext.sumQuotient]);

  const expertDefinitions: Record<ExpertPersonaRole, ExpertDefinition> = useMemo(
    () => ({
      amr: {
        id: 'amr',
        title: 'Arbejdsmiljørepræsentanten (AMR)',
        shortLabel: 'AMR',
        subtitle:
          'Arbejdsmiljøloven, BEK 613/2026, Sumformlen, § 25 standsningsret, værnemidler & akut støv-/støjbekæmpelse',
        badgeText: 'PSS Sag W22085 · § 25 Standsningsret',
        accentClasses: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200',
        activeButtonClasses:
          'bg-emerald-500/25 border-emerald-400 text-emerald-100 shadow-xs font-bold',
        defaultModelTier: 'general',
        systemRoleSummary:
          'Fokus på akut arbejdsmiljøsikkerhed, vandkanon-vinkel, H-klasse sug, undertrykssluser, P3/turbo-åndedrætsværn, tredjeparts-asbestprøver og beskyttelse af både håndværkere og beboere.',
        quickPrompts: [
          {
            label: 'Akut AMR Standsnings-Vurdering',
            prompt: `Som Arbejdsmiljørepræsentant (AMR): Vurdér om Sumformel S_out = ${telemetryContext.sumQuotient.toFixed(2)} og indendørs S_in = ${indoorClimateData.indoorSumQuotientSin.toFixed(2)} (C_in = ${indoorClimateData.indoorAsbestosFibrePerCm3.toFixed(4)} fibre/cm³, ${indoorClimateData.indoorAsbestosPctOfGv} % af GV) ved ${indoorClimateData.primaryFocusReceptor} kræver øjeblikkelig arbejdsstandsning på ${telemetryContext.selectedSourceName} og hvilke konkrete tiltag der skal iværksættes nu.`,
            tier: 'general',
            grounding: 'none',
          },
          {
            label: 'Vandkanon, H-Sug & Værnemidler',
            prompt: `Giv en konkret teknisk instruks til justering af vandkanoner, støjskærme, undertrykssluser og P3/TM3 åndedrætsværn på ${telemetryContext.selectedSourceName} ved aktuel vind (${telemetryContext.windSpeedMs.toFixed(1)} m/s @ ${telemetryContext.windDirDeg}°).`,
            tier: 'fast',
            grounding: 'none',
          },
          {
            label: 'Kræv Tredjeparts-Asbestprøver',
            prompt: `Formulér et skriftligt AMR-krav til byggeledelsen og Arbejdstilsynet om udlevering af akkrediterede tredjeparts-asbestprøver jf. reglerne pr. 1. juli 2026 og BEK 613/2026.`,
            tier: 'complex',
            grounding: 'none',
          },
        ],
      },
      jurist: {
        id: 'jurist',
        title: 'Juristen (Almenlejeloven, Byfornyelsesloven & BEK 613/2026)',
        shortLabel: 'Juristen',
        subtitle:
          'Almenlejeloven (LBK nr. 928) §§ 11, 15, 17, 18, 81, 86 stk. 3 & 90 · Byfornyelseslovens § 75 (Kondemnering) · BEK 613/2026 · BR18 § 443 / DS 447',
        badgeText: 'Liability Bomb · ALL §§ 11-18, 81-90 · ByfornL § 75',
        accentClasses: 'border-amber-500/50 bg-amber-950/25 text-amber-100',
        activeButtonClasses:
          'bg-amber-500/25 border-amber-400 text-amber-100 shadow-xs font-bold',
        defaultModelTier: 'complex',
        systemRoleSummary:
          'Når S_in ≥ 0,5 (aktuelt S_in = 3,15), asbestfibre fra kælder/nedrivning påvises i indeluften (C_in = 0,0071 fibre/cm³, 237 % af GV), skimmel overstiger 500 CFU/m³ (685 CFU/m³), eller BR18 § 443 / DS 447 tilsidesættes (ΔP_CAV = -45,3 Pa), genererer Juristen automatisk retskrav efter Almenlejeloven (LBK nr. 928) §§ 11, 15, 17 og 18 (forholdsmæssigt afslag i huslejen 25–100 %, huslejedeponering i Beboerklagenævnet), §§ 81, 86, stk. 3 og § 90 (midlertidig/permanent genhusning inkl. flytteudgifter) samt Byfornyelseslovens § 75 (kommunal kondemneringspligt ved sundhedsfare).',
        quickPrompts: [
          {
            label: 'Generér Retskrav: ALL §§ 11, 15, 17, 18, 81-90 & ByfornL § 75',
            prompt: `Generér det fulde retskrav for "${indoorClimateData.primaryFocusReceptor}" baseret på IndoorReceptorClimateExposure:
- Indendørs Sumkvotient: S_in = ∑ (C_in,i / GV_i) = ${indoorClimateData.indoorSumQuotientSin.toFixed(2)} (ULOVLIG ≥ 1,0; S_in ≥ 0,5)
- Indendørs Asbest: C_in = ${indoorClimateData.indoorAsbestosFibrePerCm3.toFixed(4)} fibre/cm³ (${indoorClimateData.indoorAsbestosPctOfGv} % af GV = 0,003 fibre/cm³ jf. BEK 613/2026)
- Skimmel i indeluft: ${indoorClimateData.moldCfuPerM3} CFU/m³ (> 500 CFU/m³)
- BR18 § 443 & DS 447 tilsidesættelse: Mekanisk CAV-Undertryk ΔP_CAV = ${indoorClimateData.deltaPCavPa.toFixed(1)} Pa, Skakt-indsugning Q_op = ${indoorClimateData.shaftAndCrackInflowQopM3PerH.toFixed(1)} m³/h, Termisk Skorstenstryk ΔP_s = +${indoorClimateData.deltaPsSpanPa.toFixed(1)} Pa (${indoorClimateData.stackGradientPaPerM.toFixed(2)} Pa/m), z_NPL = ${indoorClimateData.zNplEffectiveMeters.toFixed(1)} m / ${indoorClimateData.buildingHeightMeters.toFixed(1)} m, Vibrations-PPV = ${indoorClimateData.ppvFoundationMmPerSec.toFixed(1)} mm/s (@ ${indoorClimateData.dominantFrequencyHz.toFixed(0)} Hz, d = ${indoorClimateData.distanceMeters} m), q_75,deg = ${indoorClimateData.degradedPermeabilityQ75DegM3PerHm2.toFixed(2)} m³/(h·m²).
Udarbejd konkrete retskrav efter:
1) Almenlejeloven (LBK nr. 928) §§ 11, 15, 17 og 18 om forholdsmæssigt afslag i huslejen (25–100 %) og øjeblikkelig huslejedeponering i Huslejenævnet/Beboerklagenævnet,
2) Almenlejelovens §§ 81, 86, stk. 3 og § 90 om midlertidig eller permanent genhusning inkl. flytteudgifter, samt
3) Byfornyelseslovens § 75 om Slagelse Kommunes kondemneringspligt ved sundhedsfare.`,
            tier: 'complex',
            grounding: 'none',
          },
          {
            label: 'Smid "The Liability Bomb" (Mala Fides Varsling)',
            prompt: `Forklar hvordan jeg smider "The Liability Bomb" lige nu over for boligorganisationen, bygherre, hovedentreprenør og Slagelse Kommune baseret på S_out = ${telemetryContext.sumQuotient.toFixed(2)} og S_in = ${indoorClimateData.indoorSumQuotientSin.toFixed(2)} (C_in = ${indoorClimateData.indoorAsbestosFibrePerCm3.toFixed(4)} fibre/cm³, ΔP_CAV = ${indoorClimateData.deltaPCavPa.toFixed(1)} Pa) ved ${indoorClimateData.primaryFocusReceptor}, og udarbejd det præcise varslingsbrev der sætter dem i dokumenteret ond tro (mala fides).`,
            tier: 'complex',
            grounding: 'none',
          },
          {
            label: 'Byfornyelseslovens § 75 Kondemneringsbegæring',
            prompt: `Udarbejd en formel begæring til Slagelse Kommunes kommunalbestyrelse om straks-undersøgelse og kondemnering (forbud mod beboelse + genhusningspligt) efter Byfornyelseslovens § 75 samt Almenlejelovens §§ 81, 86, stk. 3 og § 90 på baggrund af indendørs asbest C_in = ${indoorClimateData.indoorAsbestosFibrePerCm3.toFixed(4)} fibre/cm³ (237 % af GV), skimmel (${indoorClimateData.moldCfuPerM3} CFU/m³ > 500 CFU/m³) og S_in = ${indoorClimateData.indoorSumQuotientSin.toFixed(2)}.`,
            tier: 'complex',
            grounding: 'none',
          },
        ],
      },
      fysiker: {
        id: 'fysiker',
        title: 'Fysikeren / Matematikeren',
        shortLabel: 'Fysiker/Mat.',
        subtitle:
          'Termodynamisk & matematisk forklaring af spredningsmekanismerne (Advektion-diffusion, Gaussisk Puff, Clausius-Clapeyron & Stokes)',
        badgeText: 'Termodynamik · Partielle Differentialligninger',
        accentClasses: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-100',
        activeButtonClasses:
          'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-xs font-bold',
        defaultModelTier: 'complex',
        systemRoleSummary:
          'Forklarer spredningsmekanismerne matematisk og termodynamisk: Advektions-diffusionsligningen, 3D Gaussisk Puff-integration, Clausius-Clapeyron damptryk for PCB, Stokes faldhastighed og akustisk refraktion.',
        quickPrompts: [
          {
            label: 'Matematisk Udledning af Aktuel Fane',
            prompt: `Giv en fuld matematisk og termodynamisk forklaring af spredningsmekanismerne fra ${telemetryContext.selectedSourceName} mod ${telemetryContext.peakAddress} ved vind u = ${telemetryContext.windSpeedMs.toFixed(1)} m/s (${telemetryContext.windDirDeg}°), Pasquill-klasse ${telemetryContext.stabilityClass} og Sumformel S = ${telemetryContext.sumQuotient.toFixed(2)}.`,
            tier: 'complex',
            grounding: 'none',
          },
          {
            label: 'Termodynamisk PCB-Afgasning & Stokes',
            prompt: `Udled hvordan solindstråling og temperatur styrer PCB-afgasning via Clausius-Clapeyron ligningen, og hvorfor respirable asbestfibre (<3 µm) og kvartspartikler forbliver svævende jf. Stokes' lov ved ${telemetryContext.windSpeedMs.toFixed(1)} m/s.`,
            tier: 'complex',
            grounding: 'none',
          },
          {
            label: 'Lydbølgebøjning (Akustisk Refraktion)',
            prompt: `Forklar matematisk hvordan vertikal vindgradient ∂u/∂z og temperaturgradient ∂T/∂z bøjer lydbølgerne hen over støjskærmene mod ${telemetryContext.peakAddress}.`,
            tier: 'general',
            grounding: 'none',
          },
        ],
      },
      laege: {
        id: 'laege',
        title: 'Lægen (Sundhedsfaglige Råd & Vejledning)',
        shortLabel: 'Lægen',
        subtitle:
          'Lægefaglig forklaring af kroppens reaktion på målt eksponering, sundhedsfaglige råd, sårbare grupper & klinisk dokumentation',
        badgeText: 'Arbejds- & Miljømedicin · ICD-10',
        accentClasses: 'border-rose-500/40 bg-rose-950/20 text-rose-100',
        activeButtonClasses:
          'bg-rose-500/25 border-rose-400 text-rose-100 shadow-xs font-bold',
        defaultModelTier: 'general',
        systemRoleSummary:
          'Speciallæge i arbejds-, miljø- og lungemedicin. Forklarer akut slimhindeirritation, alveolær deponering, frustreret fagocytose, NLRP3-inflammasom, cocktaileffekt (Sumformlen) og giver sundhedsfaglig vejledning.',
        quickPrompts: [
          {
            label: 'Kroppens Reaktion & Sundhedsråd Nu',
            prompt: `Som læge: Forklar kroppens akutte og cellulære reaktion ved den målte eksponering S = ${telemetryContext.sumQuotient.toFixed(2)} ved ${telemetryContext.peakAddress}, og giv konkrete sundhedsfaglige råd til beboere, børn og lungesyge.`,
            tier: 'general',
            grounding: 'none',
          },
          {
            label: 'Råd til Børn (<7 år), Gravide & Astma',
            prompt: `Hvorfor er børn under 7 år, gravide og patienter med astma eller KOL særligt udsatte ved kombineret eksponering for asbestfibre, respirabelt kvarts (SiO₂) og PCB i Ringparken, og hvordan skal de forholde sig?`,
            tier: 'complex',
            grounding: 'none',
          },
          {
            label: 'Guide til Lægejournal & Bevis-Bilag',
            prompt: `Hvilke præcise oplysninger, ICD-10 koder og kliniske undersøgelser (spirometri, biomarkører, eksponeringslog) bør en beboer bede egen læge om at journalføre til brug for bevisførelse?`,
            tier: 'general',
            grounding: 'none',
          },
        ],
      },
      kybernetiker: {
        id: 'kybernetiker',
        title: 'Kybernetikeren (VSM, Ashbys Lov & Systemisk Tetanus)',
        shortLabel: 'Kybernetiker',
        subtitle:
          "Stafford Beers VSM · Ashbys Lov · CAV-Undertryk (ΔP_CAV = -45,3 Pa) & Termisk Opdrift (ΔP_s = +5,0 Pa) ⇒ Systemisk Tetanus (T_r > Δt ⇒ Q → ∞)",
        badgeText: 'VSM · Ashby V_R ≥ V_D/V_C · T_r > Δt ⇒ Q → ∞',
        accentClasses: 'border-fuchsia-500/50 bg-fuchsia-950/25 text-fuchsia-100',
        activeButtonClasses:
          'bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100 shadow-xs font-bold',
        defaultModelTier: 'complex',
        systemRoleSummary:
          'Indregner CAV-undertryk (ΔP_CAV = -45,3 Pa), termisk opdrift (ΔP_s = +5,0 Pa, 1,04 Pa/m, z_NPL = 12,0 m / 12,0 m) og uforseglede rørskakter (Q_op = 78,1 m³/h) direkte i beregningen af Krise-Intervallet Δt (= 1,08 t) kontra byggeledelsens Afslapningstid T_r (= 18,5 t). Dokumenterer matematisk hvordan manglende overtryksfiltrering reducerer Δt og inducerer Systemisk Tetanus (T_r > Δt ⇒ Q → ∞).',
        quickPrompts: [
          {
            label: 'CAV-Undertryk & Termisk Opdrift ⇒ Systemisk Tetanus (T_r > Δt ⇒ Q → ∞)',
            prompt: `Indregn CAV-undertryk (ΔP_CAV = ${indoorClimateData.deltaPCavPa.toFixed(1)} Pa), termisk opdrift (ΔP_s = +${indoorClimateData.deltaPsSpanPa.toFixed(1)} Pa, ${indoorClimateData.stackGradientPaPerM.toFixed(2)} Pa/m, z_NPL = ${indoorClimateData.zNplEffectiveMeters.toFixed(1)} m / ${indoorClimateData.buildingHeightMeters.toFixed(1)} m) og uforseglede rørskakter (Q_op = ${indoorClimateData.shaftAndCrackInflowQopM3PerH.toFixed(1)} m³/h, q_75,deg = ${indoorClimateData.degradedPermeabilityQ75DegM3PerHm2.toFixed(2)} m³/(h·m²) ved PPV = ${indoorClimateData.ppvFoundationMmPerSec.toFixed(1)} mm/s @ 3 Hz, d = ${indoorClimateData.distanceMeters} m) direkte i beregningen af Krise-Intervallet Δt (${indoorClimateData.crisisIntervalDeltaTHours} t) kontra byggeledelsens Afslapningstid T_r (${indoorClimateData.relaxationTimeTrHours} t). Dokumentér matematisk, hvordan manglende overtryksfiltrering og uforseglede rørskakter i "${indoorClimateData.primaryFocusReceptor}" reducerer Δt og inducerer Systemisk Tetanus (T_r > Δt ⇒ Q → ∞) med S_in = ${indoorClimateData.indoorSumQuotientSin.toFixed(2)} og C_in = ${indoorClimateData.indoorAsbestosFibrePerCm3.toFixed(4)} fibre/cm³ (237 % af GV).`,
            tier: 'complex',
            grounding: 'none',
          },
          {
            label: 'Ashbys Lov: Varians-Dræn via ΔP_CAV = -45,3 Pa & Q_op = 78,1 m³/h',
            prompt: `Forklar ud fra W. Ross Ashbys Lov om nødvendig varians \\[V_R \\geq \\frac{V_D}{V_C}\\] (simplificeret \\(V_R \\geq V_D\\)), hvordan den koblede udendørs forstyrrelsesvarians (S_out = ${telemetryContext.sumQuotient.toFixed(2)}) og bygningsfysiske vakuumpumpe (ΔP_CAV = ${indoorClimateData.deltaPCavPa.toFixed(1)} Pa + ΔP_s = +${indoorClimateData.deltaPsSpanPa.toFixed(1)} Pa, Q_op = ${indoorClimateData.shaftAndCrackInflowQopM3PerH.toFixed(1)} m³/h) overstiger byggeledelsens styringsvarians V_R og administrativt varians-dæmpes ved ${indoorClimateData.primaryFocusReceptor}.`,
            tier: 'complex',
            grounding: 'none',
          },
          {
            label: 'Matematisk Bevis: T_r > Δt ⇒ Q → ∞ & Algedonisk Bypass',
            prompt: `Bevis matematisk og kybernetisk hvorfor forholdet mellem byggeledelsens afslapningstid T_r = ${indoorClimateData.relaxationTimeTrHours} timer og det af CAV-undertryk forkortede krise-interval Δt = ${indoorClimateData.crisisIntervalDeltaTHours} timer (\\[T_r > \\Delta t \\Longrightarrow Q \\to \\infty\\]) fører til Systemisk Tetanus og uendelig toksisk akkumulering i indeluften (S_in = ${indoorClimateData.indoorSumQuotientSin.toFixed(2)}), og hvorfor det Algedoniske Signal skal udløse Interlock #5 (BR18 § 443 / DS 447).`,
            tier: 'complex',
            grounding: 'none',
          },
        ],
      },
    }),
    [
      indoorClimateData,
      telemetryContext.peakAddress,
      telemetryContext.selectedSourceName,
      telemetryContext.stabilityClass,
      telemetryContext.sumQuotient,
      telemetryContext.windDirDeg,
      telemetryContext.windSpeedMs,
    ]
  );

  // Build initial welcome messages per expert so each expert greets the user in-character immediately
  const buildInitialWelcomeForRole = (
    role: ExpertPersonaRole
  ): ForensicChatMessage => {
    const nowTime = new Date().toLocaleTimeString('da-DK', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    if (role === 'jurist') {
      return {
        id: `welcome-jurist`,
        role: 'model',
        personaRole: 'jurist',
        modelUsed: 'gemini-4-argon',
        timestamp: nowTime,
        text:
          `### VIGTIGSTE JURIDISKE SKRIDT: SMID "THE LIABILITY BOMB" & AKTIVÉR LEJERETLIGE KRAV (S_in = ${indoorClimateData.indoorSumQuotientSin.toFixed(2)} ≥ 0,5)\n` +
          `For primær fokus-receptor **"${indoorClimateData.primaryFocusReceptor}"** viser den koblede retsmedicinske telemetri (` +
          `Afstand $d = ${indoorClimateData.distanceMeters}\\text{ m}$, Vibrations-PPV $= ${indoorClimateData.ppvFoundationMmPerSec.toFixed(1)}\\text{ mm/s}$ @ $3\\text{ Hz}$, Degraderet Permeabilitet $q_{75,\\text{deg}} = ${indoorClimateData.degradedPermeabilityQ75DegM3PerHm2.toFixed(2)}\\text{ m}^3/(\\text{h}\\cdot\\text{m}^2)$, ` +
          `Mekanisk CAV-Undertryk $\\Delta P_{\\text{CAV}} = ${indoorClimateData.deltaPCavPa.toFixed(1)}\\text{ Pa}$, Skakt-indsugning $Q_{\\text{op}} = ${indoorClimateData.shaftAndCrackInflowQopM3PerH.toFixed(1)}\\text{ m}^3/\\text{h}$, ` +
          `Termisk Skorstenstryk $\\Delta P_s = +${indoorClimateData.deltaPsSpanPa.toFixed(1)}\\text{ Pa}$ ($${indoorClimateData.stackGradientPaPerM.toFixed(2)}\\text{ Pa/m}$), Forskudt Neutraltryksplan $z_{\\text{NPL}} = ${indoorClimateData.zNplEffectiveMeters.toFixed(1)}\\text{ m} / ${indoorClimateData.buildingHeightMeters.toFixed(1)}\\text{ m}$):\n\n` +
          `\\[S_{\\text{in}} = \\sum \\left(\\frac{C_{\\text{in},i}}{GV_i}\\right) = ${indoorClimateData.indoorSumQuotientSin.toFixed(2)} \\ge 0,5 \\longrightarrow \\text{Krav om forholdsmæssigt afslag i lejen (25–100 \\%) jf. ALL §§ 11, 17, 18}\\]\n\n` +
          `Da **$S_{\\text{in}} = ${indoorClimateData.indoorSumQuotientSin.toFixed(2)} \\ge 0,5$ (ULOVLIG $\\ge 1,0$)**, indendørs asbest er **$C_{\\text{in}} = ${indoorClimateData.indoorAsbestosFibrePerCm3.toFixed(4)}\\text{ fibre/cm}^3$ ($${indoorClimateData.indoorAsbestosPctOfGv}\\text{ \\%}$ af GV)**, skimmel overstiger **$500\\text{ CFU/m}^3$ ($${indoorClimateData.moldCfuPerM3}\\text{ CFU/m}^3$)**, og **BR18 § 443 / DS 447** tilsidesættes, udløses automatisk:\n` +
          `1. **Almenlejeloven (LBK nr. 928) §§ 11, 15, 17 og 18:** Krav om **forholdsmæssigt afslag i huslejen (${indoorClimateData.rentReductionPctRange} — op til 100 %)** samt **huslejedeponering i Huslejenævnet / Beboerklagenævnet**.\n` +
          `2. **Almenlejelovens §§ 81, 86, stk. 3 og § 90:** Krav om **midlertidig eller permanent genhusning inkl. fulde flytteudgifter** for udlejers regning.\n` +
          `3. **Byfornyelseslovens § 75:** **Kommunal kondemneringspligt** (Slagelse Kommune) ved nærliggende sundhedsfare i beboede lejligheder.`,
      };
    }

    if (role === 'kybernetiker') {
      return {
        id: `welcome-kybernetiker`,
        role: 'model',
        personaRole: 'kybernetiker',
        modelUsed: 'gemini-4-argon',
        timestamp: nowTime,
        text:
          `### Kybernetikeren — VSM, Ashbys Lov & Systemisk Tetanus ($T_r > \\Delta t \\Longrightarrow Q \\to \\infty$)\n` +
          `Jeg indregner direkte det mekaniske **CAV-undertryk ($\\Delta P_{\\text{CAV}} = ${indoorClimateData.deltaPCavPa.toFixed(1)}\\text{ Pa}$)** og **termiske skorstenstryk ($\\Delta P_s = +${indoorClimateData.deltaPsSpanPa.toFixed(1)}\\text{ Pa}$, $${indoorClimateData.stackGradientPaPerM.toFixed(2)}\\text{ Pa/m}$, $z_{\\text{NPL}} = ${indoorClimateData.zNplEffectiveMeters.toFixed(1)}\\text{ m} / ${indoorClimateData.buildingHeightMeters.toFixed(1)}\\text{ m}$)** i **${indoorClimateData.primaryFocusReceptor}** i forholdet mellem **Krise-Intervallet $\\Delta t$** og byggeledelsens **Afslapningstid $T_r$**:\n\n` +
          `\\[T_r > \\Delta t \\Longrightarrow Q \\to \\infty \\quad (\\text{Systemisk Tetanus \\& Administrativ Varians-Dæmpning})\\]\n\n` +
          `- **Komprimeret Krise-Interval ($\\Delta t$):** Manglende overtryksfiltrering og uforseglede rørskakter ($Q_{\\text{op}} = ${indoorClimateData.shaftAndCrackInflowQopM3PerH.toFixed(1)}\\text{ m}^3/\\text{h}$ samt vibrations-degraderet klimaskærm $q_{75,\\text{deg}} = ${indoorClimateData.degradedPermeabilityQ75DegM3PerHm2.toFixed(2)}\\text{ m}^3/(\\text{h}\\cdot\\text{m}^2)$ ved $PPV = ${indoorClimateData.ppvFoundationMmPerSec.toFixed(1)}\\text{ mm/s}$ @ $3\\text{ Hz}$, $d = ${indoorClimateData.distanceMeters}\\text{ m}$) komprimerer det kritiske infiltrationsinterval fra $6,0\\text{ timer}$ ned til **$\\Delta t = ${indoorClimateData.crisisIntervalDeltaTHours}\\text{ timer}$**.\n` +
          `- **Byggeledelsens Afslapningstid ($T_r$):** System 3's administrative reaktionstid er **$T_r = ${indoorClimateData.relaxationTimeTrHours}\\text{ timer}$** ($T_r / \\Delta t = ${indoorClimateData.systemicTetanusRatio}\\times$).\n` +
          `- **Matematisk Konsekvens:** Da $T_r > \\Delta t$, indtræder **Systemisk Tetanus**, hvor indendørs asbest ($C_{\\text{in}} = ${indoorClimateData.indoorAsbestosFibrePerCm3.toFixed(4)}\\text{ fibre/cm}^3$, $237\\%$ af GV) og den indendørs sumkvotient ($S_{\\text{in}} = ${indoorClimateData.indoorSumQuotientSin.toFixed(2)}$) akkumulerer uden grænse ($Q \\to \\infty$).`,
      };
    }

    if (role === 'fysiker') {
      return {
        id: `welcome-fysiker`,
        role: 'model',
        personaRole: 'fysiker',
        modelUsed: 'gemini-4-argon',
        timestamp: nowTime,
        text:
          `### Fysikeren / Matematikeren — Termodynamik & Matematisk Spredningsmekanik\n` +
          `Klar til stringent fysisk-matematisk analyse af **${telemetryContext.selectedSourceName} → ${telemetryContext.peakAddress}** ved **$u = ${telemetryContext.windSpeedMs.toFixed(1)}\\text{ m/s}$** (${telemetryContext.windDirDeg}° → fane mod ${plumeDirDeg}°), Pasquill-Gifford stabilitetsklasse **${telemetryContext.stabilityClass}** og Sumformel **$S = ${telemetryContext.sumQuotient.toFixed(2)}$**.\n\n` +
          `- **Advektions-Diffusions-PDE:** \\[\\frac{\\partial C_i}{\\partial t} + \\mathbf{u}\\cdot\\nabla C_i = \\nabla\\cdot(\\mathbf{K}\\nabla C_i) + Q_i - S_{\\text{sink}}\\]\n` +
          `- **Termodynamisk PCB-desorption (Clausius-Clapeyron):** \\[\\ln\\left(\\frac{P_2}{P_1}\\right) = -\\frac{\\Delta H_{\\text{vap}}}{R}\\left(\\frac{1}{T_2}-\\frac{1}{T_1}\\right)\\]\n` +
          `- **Aerodynamisk faldhastighed (Stokes):** \\[v_s = \\frac{(\\rho_p - \\rho_a) g d_{\\text{ae}}^2 C_c}{18\\mu}\\]\n\n` +
          `Spørg ind til turbulens-tensorer, Gaussisk Puff-integration, termisk opdrift eller akustisk strålebøjning herunder.`,
      };
    }

    if (role === 'laege') {
      return {
        id: `welcome-laege`,
        role: 'model',
        personaRole: 'laege',
        modelUsed: 'gemini-3.8-flash',
        timestamp: nowTime,
        text:
          `### Lægen — Sundhedsfaglige Råd, Patofysiologi & Klinisk Vejledning\n` +
          `Velkommen til den lægefaglige rådgivning for **Ringparken, 4200 Slagelse**.\n` +
          `Ved den aktuelle eksponering (**Sumformel S = ${telemetryContext.sumQuotient.toFixed(2)}** ved **${telemetryContext.peakAddress}**, vind **${telemetryContext.windSpeedMs.toFixed(1)} m/s** fra **${telemetryContext.windDirDeg}°**) rådgiver jeg om:\n` +
          `- **Kroppens reaktion på målt eksponering:** Akut luftvejsirritation, alveolær deponering af asbestfibre og respirabelt kvarts ($\\text{SiO}_2$), frustreret fagocytose og NLRP3-inflammasom aktivering.\n` +
          `- **Sundhedsfaglige forholdsregler:** Beskyttelse af børn (<7 år), gravide, astma-/KOL-patienter og hjerte-kar-patienter.\n` +
          `- **Klinisk dokumentation:** Vejledning til lægebesøg, spirometri og registrering i det **Samlede Sundhedsfaglige Bevis-Bilag (ICD-10)**.`,
      };
    }

    return {
      id: `welcome-amr`,
      role: 'model',
      personaRole: 'amr',
      modelUsed: 'gemini-3.8-flash',
      timestamp: nowTime,
      text:
        `### Arbejdsmiljørepræsentanten (AMR) — Sikkerhed, Værnemidler & Standsningsret\n` +
        `AMR-vagten er aktiv for **PSS Sag W22085 (Ringparken, 4200 Slagelse)**.\n` +
        `Aktuel måling ved **${telemetryContext.peakAddress}**: **Sumformel S = ${telemetryContext.sumQuotient.toFixed(2)}** (Kilde: **${telemetryContext.selectedSourceName}**, vind **${telemetryContext.windSpeedMs.toFixed(1)} m/s** fra **${telemetryContext.windDirDeg}°**, fane mod **${plumeDirDeg}°**).\n\n` +
        `Jeg hjælper med:\n` +
        `- Vurdering af **umiddelbar og betydelig fare** (Arbejdsmiljølovens § 25 standsningsret).\n` +
        `- Krav til **vandkanon-vinkel**, **H-klasse støvsugning**, **undertrykssluser** og **P3/turbo-åndedrætsværn**.\n` +
        `- Kontrol af **BEK 613/2026 (Sumformlen)** og krav om **tredjeparts-asbestprøver**.`,
    };
  };

  // Maintain multi-turn conversation history per expert role so switching roles preserves each expert's thread
  const [messagesByRole, setMessagesByRole] = useState<
    Record<ExpertPersonaRole, ForensicChatMessage[]>
  >(() => ({
    jurist: [buildInitialWelcomeForRole('jurist')],
    kybernetiker: [buildInitialWelcomeForRole('kybernetiker')],
    fysiker: [buildInitialWelcomeForRole('fysiker')],
    laege: [buildInitialWelcomeForRole('laege')],
    amr: [buildInitialWelcomeForRole('amr')],
  }));

  const currentMessages = messagesByRole[personaRole] || [];
  const activeExpert = expertDefinitions[personaRole];

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, isLoading, personaRole]);

  const handleSelectExpert = (newRole: ExpertPersonaRole) => {
    setPersonaRole(newRole);
    setModelTier(expertDefinitions[newRole].defaultModelTier);
  };

  const sendChatMessage = async (
    customPrompt?: string,
    overrideGrounding?: 'search' | 'maps' | 'none',
    overrideTier?: 'complex' | 'general' | 'fast',
    overrideRole?: ExpertPersonaRole
  ) => {
    const promptToSend = (customPrompt ?? inputText).trim();
    if (!promptToSend || isLoading) return;

    const targetRole = overrideRole ?? personaRole;
    if (overrideRole && overrideRole !== personaRole) {
      setPersonaRole(overrideRole);
    }

    const effectiveGrounding = overrideGrounding ?? groundingTool;
    const effectiveTier = overrideTier ?? modelTier;

    const userMsg: ForensicChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      personaRole: targetRole,
      groundingTool: effectiveGrounding,
    };

    const existingForTargetRole = messagesByRole[targetRole] || [];
    const updatedHistory = [...existingForTargetRole, userMsg];
    setMessagesByRole((prev) => ({
      ...prev,
      [targetRole]: updatedHistory,
    }));
    if (!customPrompt) setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/forensic-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedHistory.map((m) => ({
            role: m.role,
            text: m.text,
          })),
          modelTier: effectiveTier,
          groundingTool: effectiveGrounding,
          personaRole: targetRole,
          telemetryContext: {
            ...telemetryContext,
            indoorClimate: indoorClimateData,
            environmentalProfileSystemPrompt,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Kunne ikke hente svar fra Gemini');
      }

      const replyContent =
        data.text || data.replyText || 'Ingen tekst returneret.';

      const modelMsg: ForensicChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: replyContent,
        timestamp: new Date().toLocaleTimeString('da-DK', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        modelUsed: data.modelUsed,
        personaRole: targetRole,
        groundingTool: effectiveGrounding,
        webSources: data.webSources || [],
        mapPlaces: data.mapPlaces || [],
      };

      setMessagesByRole((prev) => ({
        ...prev,
        [targetRole]: [...(prev[targetRole] || []), modelMsg],
      }));
    } catch (err: any) {
      setMessagesByRole((prev) => ({
        ...prev,
        [targetRole]: [
          ...(prev[targetRole] || []),
          {
            id: `err-${Date.now()}`,
            role: 'model',
            text: `Fejl ved kommunikation med Gemini API: ${err?.message || 'Ukendt fejl'}`,
            timestamp: new Date().toLocaleTimeString('da-DK', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            modelUsed: 'error',
            personaRole: targetRole,
          },
        ],
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const buildViolationInterpretationPrompt = (
    violationsToInterpret: LegalViolationEntry[],
    targetRole: ExpertPersonaRole
  ): string => {
    if (!violationsToInterpret || violationsToInterpret.length === 0) {
      return `Foretag en fuld juridisk og retsmedicinsk tolkning af den aktuelle eksponering i Ringparken, 4200 Slagelse (${telemetryContext.selectedDate} kl. ${hourFormatted}, Sumformel S = ${telemetryContext.sumQuotient.toFixed(2)} ved ${telemetryContext.peakAddress}, vind ${telemetryContext.windSpeedMs.toFixed(1)} m/s @ ${telemetryContext.windDirDeg}°) efter BEK 613/2026, Asbestbekendtgørelsen Bek. 1328/2025, Miljøstyrelsens støjgrænser og Almenlejeloven.`;
    }

    const formattedList = violationsToInterpret
      .map((v, i) => {
        const metricInfo =
          v.legalBasisCategory === 'MST_NOISE_LIMITS' && v.noiseMetrics
            ? `Støjniveau: L_Aeq(+5dB) = ${v.noiseMetrics.impulseAdjustedLaeqDb.toFixed(1)} dB(A) (grænse ${v.noiseMetrics.limitLaeqDb} dB), Spids L_AFmax = ${v.noiseMetrics.lafmaxDb.toFixed(1)} dB(A) (grænse ${v.noiseMetrics.limitLafmaxDb} dB), Vind-refraktion ΔL_met = ${v.noiseMetrics.windRefractionDb} dB`
            : `Sumformel-kvotient: S = ${v.sumQuotient.toFixed(2)} (grænse S = 1,00)`;
        return `${i + 1}. [${v.legalBasisLabel}] ${v.statuteTitle} (${v.statuteReference}) — Rammer: ${v.receptorName} (${v.receptorAddress}) — ${metricInfo}. Konsekvens: ${v.legalConsequence}. Teknisk bevis: ${v.technicalEvidence}`;
      })
      .join('\n');

    const roleAngle =
      targetRole === 'jurist'
        ? 'Som Jurist: Giv en præcis juridisk tolkning af disse valgte lovovertrædelser, herunder "The Liability Bomb" (dokumenteret ond tro), hjemmel til Entreprenørstop, Almenlejelovens krav på genhusning/huslejenedsættelse, Erstatningsansvarslovens § 26 (tort) og strafansvar efter Lovforslag L 69.'
        : targetRole === 'amr'
        ? 'Som Arbejdsmiljørepræsentant (AMR): Giv en arbejdsmiljøfaglig og juridisk tolkning af disse valgte lovovertrædelser med fokus på Arbejdsmiljølovens § 25 standsningsret, BEK 613/2026 § 3 stk. 3, strakspåbud og konkrete tekniske afværgekrav.'
        : targetRole === 'laege'
        ? 'Som Speciallæge i Arbejds- og Miljømedicin: Giv en sundhedsfaglig og retsmedicinsk tolkning af disse valgte lovovertrædelser, den biologiske skadevirkning på beboerne ved de ramte receptorer og anbefalet klinisk dokumentation.'
        : targetRole === 'fysiker'
        ? 'Som Fysiker/Matematiker: Giv en fysisk-matematisk og bevismæssig tolkning af kausaliteten bag disse valgte lovovertrædelser (spredningsfysik, Sumformel-bidrag og akustisk refraktion).'
        : 'Som Kybernetiker (VSM & Ashbys Lov): Giv en systemteoretisk og regulatorisk tolkning af disse valgte lovovertrædelser som Algedoniske Signaler til System 5.';

    return `${roleAngle}\n\nValgte registrerede lovovertrædelser (${violationsToInterpret.length} stk. · ${telemetryContext.selectedDate} kl. ${hourFormatted}):\n${formattedList}`;
  };

  const lastHandledRequestIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      externalViolationRequest &&
      externalViolationRequest.requestId !== lastHandledRequestIdRef.current
    ) {
      lastHandledRequestIdRef.current = externalViolationRequest.requestId;
      const targetRole = externalViolationRequest.preferredRole || 'jurist';
      const prompt = buildViolationInterpretationPrompt(
        externalViolationRequest.violations,
        targetRole
      );
      sendChatMessage(prompt, 'none', 'complex', targetRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalViolationRequest]);

  const runDirectSearchGrounding = async () => {
    if (!searchQuery.trim() || searchLoading) return;
    setSearchLoading(true);

    const userMsg: ForensicChatMessage = {
      id: `search-user-${Date.now()}`,
      role: 'user',
      text: `[Google Search Grounding Forespørgsel]: ${searchQuery}`,
      timestamp: new Date().toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      personaRole,
      groundingTool: 'search',
    };
    setMessagesByRole((prev) => ({
      ...prev,
      [personaRole]: [...(prev[personaRole] || []), userMsg],
    }));

    try {
      const response = await fetch('/api/search-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          windSpeedMs: telemetryContext.windSpeedMs,
          windDirectionDeg: telemetryContext.windDirDeg,
          plumeVectorDeg: plumeDirDeg,
          maxSumQuotient: telemetryContext.sumQuotient,
          peakReceptorName: telemetryContext.peakAddress,
          dateIso: telemetryContext.selectedDate,
          hourLabel: hourFormatted,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Search Grounding fejlede');
      }

      const modelMsg: ForensicChatMessage = {
        id: `search-model-${Date.now()}`,
        role: 'model',
        text: data.text || 'Ingen søgeresultater fundet.',
        timestamp: new Date().toLocaleTimeString('da-DK', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        modelUsed: data.modelUsed || 'gemini-3.8-flash (Google Search)',
        personaRole,
        groundingTool: 'search',
        webSources: data.sources || [],
      };
      setMessagesByRole((prev) => ({
        ...prev,
        [personaRole]: [...(prev[personaRole] || []), modelMsg],
      }));
    } catch (err: any) {
      setMessagesByRole((prev) => ({
        ...prev,
        [personaRole]: [
          ...(prev[personaRole] || []),
          {
            id: `search-err-${Date.now()}`,
            role: 'model',
            text: `Fejl ved Google Search Grounding: ${err?.message || 'Ukendt fejl'}`,
            timestamp: new Date().toLocaleTimeString('da-DK', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            personaRole,
          },
        ],
      }));
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCopyMessage = async (msg: ForensicChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedMsgId(msg.id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const getExpertIcon = (role: ExpertPersonaRole, className = 'w-3.5 h-3.5') => {
    switch (role) {
      case 'amr':
        return <HardHat className={className} />;
      case 'jurist':
        return <Scale className={className} />;
      case 'fysiker':
        return <Atom className={className} />;
      case 'laege':
        return <Stethoscope className={className} />;
      case 'kybernetiker':
        return <Network className={className} />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Top Control Deck: 5 Specialized AI Experts Selector */}
      <div className="bg-slate-900/95 border border-cyan-500/35 rounded-md p-3 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Dedikeret Gemini Chat Bot — 5 Specialiserede AI Eksperter
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Multi-turn samtalehistorik · Live Ringparken-telemetri (S ={' '}
                {telemetryContext.sumQuotient.toFixed(2)}) · SystemInstructions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setMessagesByRole((prev) => ({
                ...prev,
                [personaRole]: [buildInitialWelcomeForRole(personaRole)],
              }))
            }
            className="text-[11px] font-mono text-slate-400 hover:text-rose-400 flex items-center gap-1 px-2 py-1 rounded border border-slate-800 hover:border-rose-500/40 transition-colors cursor-pointer"
            title="Nulstil samtalehistorik for den valgte AI Ekspert"
          >
            <Trash2 className="w-3 h-3" />
            <span>Nulstil Tråd</span>
          </button>
        </div>

        {/* Automatic Legal Violation AI Interpretation Bar when integrated in Lovovertrædelser panel */}
        {selectedLegalViolations && (
          <div className="p-2.5 rounded-md bg-rose-950/35 border border-rose-500/50 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-rose-200 font-bold flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  AUTOMATISK AI JURIDISK TOLKNING AF VALGTE LOVOVERTRÆDELSER (
                  {selectedLegalViolations.length} VALGT)
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-rose-500/40 text-[11px] font-mono text-amber-300">
                Klik for straks-tolkning via valgt ekspert
              </span>
            </div>

            {selectedLegalViolations.length > 0 && (
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                {selectedLegalViolations.map((v) => (
                  <span
                    key={`sel-chip-${v.id}`}
                    className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-rose-500/40 text-[11px] font-mono text-slate-200 truncate max-w-[260px] inline-flex items-center gap-1"
                    title={`${v.statuteTitle} — ${v.receptorName}`}
                  >
                    <Scale className="w-3 h-3 text-amber-300 shrink-0" />
                    <span className="truncate">
                      {v.receptorName}: {v.statuteReference.split('(')[0].trim()}
                    </span>
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  const prompt = buildViolationInterpretationPrompt(
                    selectedLegalViolations,
                    personaRole
                  );
                  sendChatMessage(prompt, 'none', 'complex', personaRole);
                }}
                className="py-1.5 px-2.5 rounded bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Tolk {selectedLegalViolations.length} Valgte Lovovertrædelser Nu (
                  {activeExpert.shortLabel})
                </span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  const prompt = buildViolationInterpretationPrompt(
                    selectedLegalViolations,
                    'jurist'
                  );
                  sendChatMessage(prompt, 'none', 'complex', 'jurist');
                }}
                className="py-1.5 px-2.5 rounded bg-rose-600/90 hover:bg-rose-500 disabled:opacity-50 text-white border border-rose-400/60 font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Fuld Jurist-Tolkning (Liability Bomb &amp; Sanktioner)
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 1. AI Expert Role Selector (5 Experts) */}
        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5">
            1. Vælg AI Ekspert (SystemInstruction Rolle):
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {(
              [
                'jurist',
                'kybernetiker',
                'fysiker',
                'laege',
                'amr',
              ] as ExpertPersonaRole[]
            ).map((roleKey) => {
              const def = expertDefinitions[roleKey];
              const isSelected = personaRole === roleKey;
              return (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => handleSelectExpert(roleKey)}
                  className={`px-2 py-2 rounded text-[11px] font-mono flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                    isSelected
                      ? def.activeButtonClasses
                      : 'bg-slate-950/75 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {getExpertIcon(roleKey, 'w-3.5 h-3.5 shrink-0')}
                    <span className="truncate">{def.shortLabel}</span>
                  </div>
                  <span className="text-[11px] opacity-80 truncate max-w-full">
                    {roleKey === 'jurist'
                      ? 'Liability Bomb'
                      : roleKey === 'kybernetiker'
                      ? 'VSM & Ashby'
                      : roleKey === 'fysiker'
                      ? 'Termo & PDE'
                      : roleKey === 'laege'
                      ? 'Sundhedsråd'
                      : 'Arbejdsmiljø'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Expert Role Banner & Mandatory Domain Highlights */}
        <div
          className={`p-2.5 rounded border text-xs space-y-2 ${activeExpert.accentClasses}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-white">
              {getExpertIcon(personaRole, 'w-4 h-4 shrink-0')}
              <span>{activeExpert.title}</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-950/80 border border-white/15 font-mono text-[11px]">
              {activeExpert.badgeText}
            </span>
          </div>
          <p className="text-[11px] leading-snug opacity-95">
            {activeExpert.systemRoleSummary}
          </p>

          {/* JURISTEN SPECIAL MANDATORY BANNER: THE LIABILITY BOMB + ALMENLEJELOVEN §§ 11-18, 81-90 & BYFORNYELSESLOVENS § 75 */}
          {personaRole === 'jurist' && (
            <div className="p-2.5 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-amber-400 text-amber-100 space-y-2">
              <div className="flex items-center justify-between gap-2 font-mono text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    AUTOMATISK LEJERETLIGT RETSKRAV VED S_in = {indoorClimateData.indoorSumQuotientSin.toFixed(2)} ≥ 0,5 (ALL §§ 11-18, 81-90 &amp; ByfornL § 75)
                  </span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[11px]">
                  S_in = {indoorClimateData.indoorSumQuotientSin.toFixed(2)} · C_in = {indoorClimateData.indoorAsbestosFibrePerCm3.toFixed(4)} f/cm³ (237 % GV)
                </span>
              </div>
              <div className="p-2 rounded bg-slate-950/90 border border-amber-500/40 font-mono text-[11px] text-amber-200 space-y-1">
                <div className="font-bold text-white">
                  S_in = ∑ (C_in,i / GV_i) ≥ 0,5 → Krav om forholdsmæssigt afslag i lejen (25–100 %) jf. ALL §§ 11, 17, 18
                </div>
                <div className="text-[11px] text-slate-300">
                  Primær Fokus-Receptor: <strong className="text-amber-300">{indoorClimateData.primaryFocusReceptor}</strong> · Afstand d = {indoorClimateData.distanceMeters} m · PPV = {indoorClimateData.ppvFoundationMmPerSec.toFixed(1)} mm/s (@ 3 Hz) · q_75,deg = {indoorClimateData.degradedPermeabilityQ75DegM3PerHm2.toFixed(2)} m³/(h·m²) · ΔP_CAV = {indoorClimateData.deltaPCavPa.toFixed(1)} Pa · Q_op = {indoorClimateData.shaftAndCrackInflowQopM3PerH.toFixed(1)} m³/h · ΔP_s = +{indoorClimateData.deltaPsSpanPa.toFixed(1)} Pa (1,04 Pa/m) · z_NPL = {indoorClimateData.zNplEffectiveMeters.toFixed(1)} m / 12,0 m · Skimmel = {indoorClimateData.moldCfuPerM3} CFU/m³ (&gt; 500 CFU/m³).
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 font-mono text-[11px]">
                <div className="p-1.5 rounded bg-slate-950/85 border border-amber-500/40">
                  <div className="font-bold text-amber-300">1. ALL §§ 11, 15, 17 &amp; 18</div>
                  <div className="text-slate-200">
                    Forholdsmæssigt huslejeafslag (<strong>{indoorClimateData.rentReductionPctRange}</strong>) + deponering i Huslejenævnet/Beboerklagenævnet.
                  </div>
                </div>
                <div className="p-1.5 rounded bg-slate-950/85 border border-rose-500/40">
                  <div className="font-bold text-rose-300">2. ALL §§ 81, 86 stk. 3 &amp; 90</div>
                  <div className="text-slate-200">
                    Krav om <strong>midlertidig eller permanent genhusning inkl. flytteudgifter</strong> ved BR18 § 443 / DS 447 svigt.
                  </div>
                </div>
                <div className="p-1.5 rounded bg-slate-950/85 border border-cyan-500/40">
                  <div className="font-bold text-cyan-300">3. Byfornyelseslovens § 75</div>
                  <div className="text-slate-200">
                    <strong>Kommunal kondemneringspligt</strong> ved sundhedsfare (asbest 0,0071 f/cm³ &amp; skimmel &gt; 500 CFU/m³).
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* KYBERNETIKEREN SPECIAL MANDATORY MATHEMATICAL & VSM BANNER */}
          {personaRole === 'kybernetiker' && (
            <div className="p-2.5 rounded bg-slate-950/95 border border-fuchsia-400/60 text-fuchsia-100 space-y-2 font-mono text-[11px]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-300 flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>
                  Kybernetisk Indeklima-Kobling (VSM · Ashbys Lov · ΔP_CAV = -45,3 Pa &amp; ΔP_s = +5,0 Pa ⇒ Systemisk Tetanus)
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <div className="p-2 rounded bg-slate-900/90 border border-fuchsia-500/30">
                  <div className="text-[11px] text-fuchsia-300 font-bold">
                    1. Indlejret Matematisk Formel — Systemisk Tetanus &amp; Administrativ Varians-Dæmpning:
                  </div>
                  <div className="text-xs font-bold text-white mt-0.5 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                    T_r &gt; Δt ⇒ Q → ∞ (Systemisk Tetanus &amp; Administrativ Varians-Dæmpning)
                  </div>
                  <div className="text-[11px] text-slate-200 mt-1">
                    Ukompenseret CAV-undertryk (<strong>ΔP_CAV = {indoorClimateData.deltaPCavPa.toFixed(1)} Pa</strong>), termisk opdrift (<strong>ΔP_s = +{indoorClimateData.deltaPsSpanPa.toFixed(1)} Pa, {indoorClimateData.stackGradientPaPerM.toFixed(2)} Pa/m, z_NPL = {indoorClimateData.zNplEffectiveMeters.toFixed(1)} m / 12,0 m</strong>) og uforseglede rørskakter (<strong>Q_op = {indoorClimateData.shaftAndCrackInflowQopM3PerH.toFixed(1)} m³/h</strong>) komprimerer Krise-Intervallet til <strong>Δt = {indoorClimateData.crisisIntervalDeltaTHours} timer</strong>, mens byggeledelsens Afslapningstid er <strong>T_r = {indoorClimateData.relaxationTimeTrHours} timer</strong> (T_r / Δt = {indoorClimateData.systemicTetanusRatio}×).
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-900/90 border border-cyan-500/30">
                  <div className="text-[11px] text-cyan-300 font-bold">
                    2. W. Ross Ashby&apos;s Lov om nødvendig varians:
                  </div>
                  <div className="text-xs font-bold text-white mt-0.5 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                    \[V_R \geq \frac{'{'}V_D{'}'}{'{'}V_C{'}'}\] &nbsp; (eller simplificeret: \(V_R \geq V_D\))
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Manglende overtryksfiltrering (HEPA H14 ΔP = +10 Pa) i {indoorClimateData.primaryFocusReceptor} medfører V_R ≪ V_D og S_in = {indoorClimateData.indoorSumQuotientSin.toFixed(2)} (C_in = {indoorClimateData.indoorAsbestosFibrePerCm3.toFixed(4)} fibre/cm³, 237 % af GV).
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FYSIKEREN SPECIAL THERMODYNAMIC & PDE BANNER */}
          {personaRole === 'fysiker' && (
            <div className="p-2 rounded bg-slate-950/90 border border-cyan-500/40 font-mono text-[11px] text-cyan-200 space-y-1">
              <div className="font-bold text-cyan-300">
                Termodynamisk &amp; Matematisk Spredningskerne:
              </div>
              <div className="bg-slate-900 px-2 py-1 rounded border border-slate-800 text-white">
                \[\frac{'{'}\partial C{'}'}{'{'}\partial t{'}'} + \mathbf{'{'}u{'}'}\cdot\nabla C = \nabla\cdot(\mathbf{'{'}K{'}'}\nabla C) + Q - S_{'{'}\text{'{'}sink{'}'}{'}'}\] &nbsp;|&nbsp; \[S = \sum_{'{'}i=1{'}'}^n \frac{'{'}C_i{'}'}{'{'}GV_i{'}'} = {telemetryContext.sumQuotient.toFixed(2)}\]
              </div>
            </div>
          )}

          {/* RAPPORTVERIFICERET BYGNINGS- & DMA-PRØVEGRUNDLAG INJICERET I SYSTEMPROMPT */}
          <div className="p-2.5 rounded bg-slate-950/90 border border-amber-500/45 space-y-1.5 text-[11px] font-mono">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-amber-300 font-bold uppercase inline-flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>Injiceret Miljørapport &amp; DMA-Grundlag ({activeBuildingProfile.buildingCode}):</span>
              </span>
              <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-amber-500/40 text-amber-200 text-[11px]">
                {activeBuildingProfile.reportIds[0]}
              </span>
            </div>
            <div className="text-slate-300 leading-snug">
              <strong className="text-white">DMA &amp; PSS Anbefaling:</strong>{' '}
              {activeBuildingProfile.dmaAndPssHeadlineRecommendationDa}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-800">
              <span className="text-[11px] text-cyan-300 truncate max-w-[320px]">
                Grounding: Blok 1 (krybekælder), Bygning 1 (vægfliser), Bygning 2 (kældermembran), Bygning 3 (vindspærreplade), Blok 2-20 (sanering vs. indkapsling)
              </span>
              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  sendChatMessage(
                    `Giv en konkret vurdering som ${activeExpert.title} af prøveresultaterne og DMA's anbefalinger for ${activeBuildingProfile.buildingName} (${activeBuildingProfile.address}, Rapport: ${activeBuildingProfile.reportIds.join(', ')}), samt sammenhold dette med kældermembranen i Bygning 2, vindspærrepladerne/linoleum i Bygning 3, vægfliserne/skimmel i Bygning 1, krybekælderen i Blok 1 og DMA's forbud mod usikker indkapsling i Blok 2-20.`,
                    'none',
                    'complex',
                    personaRole
                  )
                }
                className="px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-[11px] cursor-pointer shrink-0"
              >
                Spørg {activeExpert.shortLabel} om DMA-Prøver
              </button>
            </div>
          </div>
        </div>

        {/* 2. Gemini Model Tier Selector */}
        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
            2. Gemini Model-Arkitektur (Vælg Ræsonnementsdybde)
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setModelTier('complex');
                setGroundingTool('none');
              }}
              className={`px-2 py-1.5 rounded text-[11px] font-mono border text-left transition-colors cursor-pointer ${
                modelTier === 'complex' && groundingTool === 'none'
                  ? 'bg-purple-500/25 border-purple-400 text-purple-100 font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-purple-400 shrink-0" />
                <span className="truncate">Argon (Kompleks)</span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">gemini-4-argon</div>
            </button>

            <button
              type="button"
              onClick={() => setModelTier('general')}
              className={`px-2 py-1.5 rounded text-[11px] font-mono border text-left transition-colors cursor-pointer ${
                modelTier === 'general' || groundingTool !== 'none'
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">Flash 3.8 (Generel)</span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">gemini-3.8-flash</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setModelTier('fast');
                setGroundingTool('none');
              }}
              className={`px-2 py-1.5 rounded text-[11px] font-mono border text-left transition-colors cursor-pointer ${
                modelTier === 'fast' && groundingTool === 'none'
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100 font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">Flash-Lite (Hurtig)</span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                gemini-3.1-flash-lite
              </div>
            </button>
          </div>
        </div>

        {/* 3. Grounding Tool Mode */}
        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
            3. Tilkobl Live Grounding-Værktøj (Valgfrit)
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setGroundingTool('none')}
              className={`px-2 py-1 rounded text-[11px] font-mono flex items-center justify-center gap-1 border transition-colors cursor-pointer ${
                groundingTool === 'none'
                  ? 'bg-slate-700/80 border-slate-400 text-white font-semibold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3 h-3 shrink-0" />
              <span>Ekspert-Ræsonnement</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGroundingTool('search');
                setModelTier('general');
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono flex items-center justify-center gap-1 border transition-colors cursor-pointer ${
                groundingTool === 'search'
                  ? 'bg-blue-500/25 border-blue-400 text-blue-100 font-semibold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3 h-3 shrink-0" />
              <span>Google Search</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGroundingTool('maps');
                setModelTier('general');
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono flex items-center justify-center gap-1 border transition-colors cursor-pointer ${
                groundingTool === 'maps'
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100 font-semibold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3 h-3 shrink-0" />
              <span>Google Maps</span>
            </button>
          </div>
        </div>
      </div>

      {/* Role-Specific Quick Prompts for the Active Expert */}
      <div className="space-y-1">
        <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
          <BookOpen className="w-3 h-3 text-cyan-400" />
          <span>Hurtige Ekspert-Spørgsmål til {activeExpert.shortLabel}:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {activeExpert.quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setModelTier(qp.tier);
                setGroundingTool(qp.grounding);
                sendChatMessage(qp.prompt, qp.grounding, qp.tier);
              }}
              disabled={isLoading}
              className="text-[11px] font-mono px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-cyan-400/60 transition-colors cursor-pointer text-left"
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Multi-Turn Conversation Thread */}
      <div className="bg-slate-950/95 border border-slate-800 rounded-md p-3 h-96 overflow-y-auto space-y-3 font-sans shadow-inner">
        {currentMessages.map((msg) => {
          const msgRoleKey = msg.personaRole || personaRole;
          const msgExpert = expertDefinitions[msgRoleKey] || activeExpert;
          return (
            <div
              key={msg.id}
              className={`rounded-md p-3 text-xs leading-relaxed border ${
                msg.role === 'user'
                  ? 'bg-cyan-950/35 border-cyan-500/40 ml-6 text-cyan-100'
                  : 'bg-slate-900/95 border-slate-800 mr-3 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400 mb-1.5 pb-1 border-b border-slate-800/80">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={
                      msg.role === 'user'
                        ? 'text-cyan-400 font-bold'
                        : 'text-amber-300 font-bold flex items-center gap-1'
                    }
                  >
                    {msg.role === 'user' ? (
                      'BRUGER / BEBOER / OPERATØR'
                    ) : (
                      <>
                        {getExpertIcon(msgRoleKey, 'w-3 h-3')}
                        <span>{msgExpert.title.toUpperCase()}</span>
                      </>
                    )}
                  </span>
                  {msg.modelUsed && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                      {msg.modelUsed}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span>{msg.timestamp}</span>
                  {msg.role === 'model' && (
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg)}
                      className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                      title="Kopiér ekspertsvar"
                    >
                      {copiedMsgId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="whitespace-pre-wrap text-xs text-slate-200 leading-relaxed">
                {msg.text}
              </div>

              {/* Verified Web Sources from Google Search Grounding */}
              {msg.webSources && msg.webSources.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-mono uppercase text-blue-400 mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Verificerede Google Search Kilder ({msg.webSources.length}):
                  </div>
                  <div className="space-y-1">
                    {msg.webSources.map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-950/80 hover:bg-blue-950/30 border border-slate-800 hover:border-blue-500/40 text-[11px] text-blue-300 font-mono transition-colors"
                      >
                        <span className="truncate">{src.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Verified Google Maps Grounding Places */}
              {msg.mapPlaces && msg.mapPlaces.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-mono uppercase text-emerald-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Google Maps Grounding Lokationer ({msg.mapPlaces.length}):
                  </div>
                  <div className="space-y-1">
                    {msg.mapPlaces.map((pl, i) => (
                      <a
                        key={i}
                        href={pl.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        translate="no"
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-950/80 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-500/40 text-[11px] text-emerald-300 font-mono transition-colors"
                      >
                        <span className="truncate" translate="no">
                          {pl.title}
                        </span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="rounded p-2.5 text-xs bg-slate-900/80 border border-cyan-500/40 text-cyan-200 font-mono flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
            <span>
              {activeExpert.title} (
              {groundingTool !== 'none'
                ? 'gemini-3.8-flash + ' + groundingTool
                : modelTier === 'complex'
                ? 'gemini-4-argon'
                : modelTier === 'fast'
                ? 'gemini-3.1-flash-lite'
                : 'gemini-3.8-flash'}
              ) udarbejder svar...
            </span>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Chat Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendChatMessage();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Spørg ${activeExpert.title} (f.eks. ${
            personaRole === 'jurist'
              ? '"Hvordan smider jeg The Liability Bomb og kræver genhusning + tortgodtgørelse?"'
              : personaRole === 'kybernetiker'
              ? '"Forklar VSM, Ashbys lov V_R >= V_D/V_C og hvorfor T_r > ΔT giver Q -> ∞"'
              : personaRole === 'fysiker'
              ? '"Udled den termodynamiske og matematiske spredning for S = ' +
                telemetryContext.sumQuotient.toFixed(2) +
                '"'
              : personaRole === 'laege'
              ? '"Hvilke sundhedsfaglige råd gælder ved den målte eksponering?"'
              : '"Hvilke krav stiller AMR til støvdæmpning og standsning?"'
          })...`}
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="px-3.5 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </form>

      {/* Dedicated Google Search & Maps Grounding Bar */}
      <div className="bg-slate-900/75 border border-blue-500/30 rounded p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            Google Search &amp; Maps Grounding (Almenlejeloven, BEK 613/2026 &amp; Matrikler)
          </span>
          {onRunMapsGrounding && (
            <button
              type="button"
              onClick={onRunMapsGrounding}
              disabled={mapsGroundingLoading}
              className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
            >
              <MapPin className="w-3 h-3" />
              {mapsGroundingLoading ? 'Scanner Maps...' : 'Scan Maps Matrikler'}
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runDirectSearchGrounding();
            }}
            placeholder="Søg i Almenlejeloven, Retsinformation, Arbejdstilsynet, Slagelse Kommune..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            type="button"
            onClick={runDirectSearchGrounding}
            disabled={searchLoading}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-mono font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            {searchLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Globe className="w-3.5 h-3.5" />
            )}
            <span>Søg Web</span>
          </button>
        </div>
      </div>
    </div>
  );
};
