import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stethoscope,
  Activity,
  HeartPulse,
  ShieldAlert,
  FileCheck2,
  PlusCircle,
  Download,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Trash2,
  AlertTriangle,
  FileText,
  UserCheck,
  Microscope,
  Wind,
  Volume2,
  Scale,
  BookOpen,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { HourlyWeatherPoint, ReceptorExposureResult } from '../types/dispersion';
import { computeForensicSha256Hash } from '../services/dispersionEngine';
import { SUBSTANCE_SPECS } from '../data/ringparkenData';
import {
  formatEnvironmentalProfilesForAiSystemPrompt,
  getBuildingEnvironmentalProfile,
} from '../data/ringparkenEnvironmentalSamples';

export interface AffectedOrganSystem {
  organSystem: string;
  icd10Code: string;
  physiologicalMechanism: string;
  clinicalSymptoms: string[];
  latencyPeriod: string;
  severityLevel: 'LAV' | 'MODERAT' | 'HØJ' | 'KRITISK';
  measuredTriggerText: string;
}

export interface MedicalExpertAnalysisResponse {
  clinicalHeadline: string;
  clinicalSeverity:
    | 'NORMAL'
    | 'FORHØJET_OPMÆRKSOMHED'
    | 'SUNDHEDSFARLIG_EKSPONERING'
    | 'AKUT_SUNDHEDSRISIKO'
    | string;
  bodyReactionExplanation: {
    acutePhysiologicalReaction: string;
    alveolarAndCellularMechanism: string;
    subacuteAndChronicPathophysiology: string;
    synergisticCocktailEffect: string;
    affectedOrganSystems: AffectedOrganSystem[];
  };
  healthGuidance: {
    immediateResidentActions: string[];
    occupationalSiteActions: string[];
    vulnerableGroupsGuidance: string[];
    clinicalFollowUpAndDocumentation: string[];
  };
  forensicAnnexSummary: string;
  statutoryMedicalReferences: string[];
  generatedAtIso: string;
  modelUsed?: string;
}

export interface MedicalEvidenceAnnexRecord {
  id: string;
  bilagNumber: string;
  recordedAtIso: string;
  incidentDateIso: string;
  incidentHour: number;
  receptorId: string;
  receptorName: string;
  patientFocusGroup: string;
  sumQuotientS: number;
  cumulativeSumQuotient24h: number;
  exceedsLimit: boolean;
  acousticRefractionDb: number;
  windSpeedMs: number;
  windDirectionDeg: number;
  temperatureC: number;
  humidityPct: number;
  substancesSnapshot: {
    id: string;
    shortName: string;
    concentrationText: string;
    limitText: string;
    quotientRatio: number;
  }[];
  clinicalHeadline: string;
  clinicalSeverity: string;
  acuteReactionSummary: string;
  cellularMechanismSummary: string;
  chronicPathophysiologySummary: string;
  synergisticCocktailSummary: string;
  affectedOrgans: AffectedOrganSystem[];
  residentGuidance: string[];
  clinicalFollowUp: string[];
  forensicAnnexSummary: string;
  statutoryReferences: string[];
  operatorMedicalNote: string;
  sha256EvidenceHash: string;
}

interface MedicalExpertAiWidgetProps {
  selectedReceptorExposure: ReceptorExposureResult;
  allReceptorExposures: ReceptorExposureResult[];
  onSelectReceptor?: (receptorId: string) => void;
  currentWeather: HourlyWeatherPoint;
  currentDateIso: string;
  cumulativeSumQuotient24h: number;
  acousticRefractionDb?: number;
  compactMode?: boolean;
}

const STORAGE_KEY_MEDICAL_ANNEX = 'ringparken_medical_evidence_annex_v1';

const PATIENT_FOCUS_GROUPS = [
  'Alle Beboere & Naboer i Ringparken',
  'Børn (<7 år), Spædbørn & Gravide',
  'Kronisk Lungesyge (Astma, KOL & Bronkiektasier)',
  'Ældre & Hjerte-kar-patienter',
  'Nedrivningsarbejdere, Sanører & AMR',
];

const SUBSTANCE_COLOR_MAP: Record<string, string> = {
  asbestos: '#f43f5e',
  pcb: '#f59e0b',
  heavyMetals: '#a855f7',
  quartzWool: '#06b6d4',
  moldSewer: '#10b981',
};

const INITIAL_MEDICAL_EVIDENCE_RECORDS: MedicalEvidenceAnnexRecord[] = [
  {
    id: 'med-ev-init-01',
    bilagNumber: 'BILAG-MED-01',
    recordedAtIso: '2026-04-08T11:15:00.000Z',
    incidentDateIso: '2026-04-08',
    incidentHour: 11,
    receptorId: 'rec-nord',
    receptorName: 'Beboer-zone Nord (Børnehave & Boligblok A)',
    patientFocusGroup: 'Børn (<7 år), Spædbørn & Gravide',
    sumQuotientS: 1.48,
    cumulativeSumQuotient24h: 18.6,
    exceedsLimit: true,
    acousticRefractionDb: 5.4,
    windSpeedMs: 7.8,
    windDirectionDeg: 225,
    temperatureC: 11.2,
    humidityPct: 58,
    substancesSnapshot: [
      {
        id: 'asbestos',
        shortName: 'Asbest (Krysotil/Amosit)',
        concentrationText: '0.0021 fibre/cm³',
        limitText: '0.003 fibre/cm³',
        quotientRatio: 0.7,
      },
      {
        id: 'quartzWool',
        shortName: 'Respirabelt Kvarts (SiO₂)',
        concentrationText: '44.0 µg/m³',
        limitText: '100 µg/m³',
        quotientRatio: 0.44,
      },
      {
        id: 'pcb',
        shortName: 'PCB (Polychlorerede Biphenyler)',
        concentrationText: '610 ng/m³',
        limitText: '3000 ng/m³',
        quotientRatio: 0.2,
      },
      {
        id: 'heavyMetals',
        shortName: 'Tungmetaller (Bly/Cadmium)',
        concentrationText: '7.0 µg/m³',
        limitText: '50 µg/m³',
        quotientRatio: 0.14,
      },
    ],
    clinicalHeadline:
      'Sundhedsfaglig overskridelse af Sumformlen (S = 1.48 > 1.00) i Beboer-zone Nord med 70% udnyttelse af asbestgrænseværdien og samtidig eksponering for respirabelt kvarts',
    clinicalSeverity: 'SUNDHEDSFARLIG_EKSPONERING',
    acuteReactionSummary:
      'Ved den målte kombinerede eksponering ses neurogen og mekanisk slimhindeirritation i øvre og nedre luftveje med reflektorisk bronkokonstriktion, hosterefleks og øget mukociliær sekretion. Hos børn under 7 år medfører højere minutventilation pr. kg kropsvægt en ca. 2,1 gange højere alveolær deponeringsrate end hos voksne.',
    cellularMechanismSummary:
      'Respirable asbestfibre (<3 µm diameter, >5 µm længde) og krystallinske SiO₂-partikler (<4 µm aerodynamisk diameter) passerer fimrehårsbarrieren og deponeres i de respiratoriske bronkioler og alveoler. Alveolære makrofager forsøger at omslutte de lange asbestfibre (frustreret fagocytose), hvilket udløser vedvarende ROS-frigivelse (reaktive iltradikaler), aktivering af NLRP3-inflammasomet og udskillelse af IL-1β, TNF-α og TGF-β.',
    chronicPathophysiologySummary:
      'Gentagen eksponering over Sumformel-grænsen (S > 1.0) øger den kumulative fiber- og kvartsdosis i lungeparenkymet og pleura, hvilket på lang sigt er forbundet med interstitiel fibrosedannelse og forhøjet livstidsrisiko for pleura-mesotheliom (latenstid 20–40 år). Samtidig medfører +5,4 dB positiv vindrefraktion øget støjbelastning med sympatikus-aktivering.',
    synergisticCocktailSummary:
      'Toksikologisk synergi jf. Arbejdstilsynets At-vejledning C.0.1 Sumformel (S = 1.48): Kvartspartiklernes cytotoksiske beskadigelse af det respiratoriske epitel nedsætter den mukociliære clearance, hvorved retentionstiden for både asbestfibre, blyholdigt nedrivningsstøv og partikelbundet PCB i alveolerne forlænges væsentligt.',
    affectedOrgans: [
      {
        organSystem: 'Alveoler, Lungeparenkym & Pleura (Nedre luftveje)',
        icd10Code: 'J61 / J62.8 / J68.0',
        physiologicalMechanism:
          'Alveolær deponering af asbestfibre og respirabelt krystallinsk kvarts med frustreret fagocytose, NLRP3-inflammasom aktivering og oxidativt stress.',
        clinicalSymptoms: [
          'Tør irritationshoste',
          'Trykken for brystet',
          'Bronkial hyperreaktivitet hos børn og astmatikere',
        ],
        latencyPeriod: 'Akut irritation: minutter–timer | Kronisk patologi: 10–40 år',
        severityLevel: 'HØJ',
        measuredTriggerText: 'Asbest C/GV = 0.70 + Kvarts C/GV = 0.44 (Sum S = 1.48)',
      },
      {
        organSystem: 'Centralnervesystem & Endokrine Akse (Bly, PCB & Støj)',
        icd10Code: 'T56.0 / T53.7 / Z57.0',
        physiologicalMechanism:
          'Alveolær og gastrointestinal absorption af blypartikler samt lipofil akkumulering af lavklorerede PCB-congenere kombineret med +5,4 dB akustisk medvinds-refraktion.',
        clinicalSymptoms: ['Hovedpine', 'Koncentrationsbesvær', 'Søvnforstyrrelse og autonom stressrespons'],
        latencyPeriod: 'Subakut til kronisk bioakkumulering',
        severityLevel: 'MODERAT',
        measuredTriggerText: 'PCB 610 ng/m³ + Bly/Tungmetaller 7.0 µg/m³ + Vindrefraktion +5.4 dB',
      },
    ],
    residentGuidance: [
      'Hold vinduer, altandøre og friskluftventiler i Beboer-zone Nord lukkede, så længe Sumformlen S ≥ 1.0 i vindretningen 225° (SV).',
      'Udendørs ophold for børnehavebørn og spædbørn i direkte nedfaldsvind bør midlertidigt flyttes indendørs eller til læside.',
      'Sluk eller sæt decentral mekanisk ventilation på recirkulation uden udeluftindtag fra sydvestlig facade.',
    ],
    clinicalFollowUp: [
      'Ved nyopstået hoste, hvæsende vejrtrækning eller åndenød bør egen læge kontaktes med oplysning om dokumenteret blandet støveksponering fra Ringparken (Sag W22085).',
      'Anmod om journalføring af eksponeringstidspunkt, målt Sumformel S = 1.48 og bilagsreference BILAG-MED-01 af hensyn til senere arbejds- eller miljømedicinsk udredning.',
    ],
    forensicAnnexSummary:
      'Retsmedicinsk og arbejds-/miljømedicinsk vurdering dokumenterer, at den målte kombinationseksponering i Beboer-zone Nord (Sumformel S = 1.48 > 1.00) udgør en biologisk aktiv og sundhedsskadelig luftforurening med synergistisk belastning af de nedre luftveje (asbest + kvarts) og bioakkumulerende stoffer (PCB + tungmetaller).',
    statutoryReferences: [
      'BEK nr. 613 af 2026 (Asbestbekendtgørelsen): Grænseværdi 0,003 fibre/cm³.',
      'Arbejdstilsynets At-vejledning C.0.1: Sumformlen S = Σ(Ci / GVi) > 1,00 dokumenterer overskridelse ved kombineret eksponering.',
      'Sundhedsstyrelsens & Miljøstyrelsens retningslinjer for PCB i udeluft og B-værdier for boligområder.',
    ],
    operatorMedicalNote:
      'Automatisk baseline-registrering fra sidste uges kontrolkørsel under aktiv facadeknusning ved sydvestlig vind (225°).',
    sha256EvidenceHash: '9f84b2c7e14a09d3871bc623a84950f1d7c4209ab8e1736c450129fa83bc712e',
  },
  {
    id: 'med-ev-init-02',
    bilagNumber: 'BILAG-MED-02',
    recordedAtIso: '2026-04-11T14:30:00.000Z',
    incidentDateIso: '2026-04-11',
    incidentHour: 14,
    receptorId: 'rec-institution',
    receptorName: 'Sydøst Skole & Daginstitution',
    patientFocusGroup: 'Kronisk Lungesyge (Astma, KOL & Bronkiektasier)',
    sumQuotientS: 1.19,
    cumulativeSumQuotient24h: 14.2,
    exceedsLimit: true,
    acousticRefractionDb: 4.1,
    windSpeedMs: 6.2,
    windDirectionDeg: 305,
    temperatureC: 13.0,
    humidityPct: 52,
    substancesSnapshot: [
      {
        id: 'asbestos',
        shortName: 'Asbest (Krysotil/Amosit)',
        concentrationText: '0.0016 fibre/cm³',
        limitText: '0.003 fibre/cm³',
        quotientRatio: 0.53,
      },
      {
        id: 'quartzWool',
        shortName: 'Respirabelt Kvarts (SiO₂)',
        concentrationText: '38.0 µg/m³',
        limitText: '100 µg/m³',
        quotientRatio: 0.38,
      },
      {
        id: 'moldSewer',
        shortName: 'Skimmelsporer & Endotoksiner',
        concentrationText: '420 CFU/m³',
        limitText: '1500 CFU/m³',
        quotientRatio: 0.28,
      },
    ],
    clinicalHeadline:
      'Kombineret bioaerosol-, kvarts- og asbesteksponering (S = 1.19) ved Sydøst Skole & Daginstitution med forhøjet bronkospasme-risiko hos astmatikere',
    clinicalSeverity: 'SUNDHEDSFARLIG_EKSPONERING',
    acuteReactionSummary:
      'Indånding af endotoksiner og β-glucaner fra opblæst kloak-/skimmelstøv sammen med skarpe kvartskorn udløser Toll-like receptor 4 (TLR4)-medieret luftvejsinflammation og øjeblikkelig bronkial hyperreaktivitet hos personer med astma eller KOL.',
    cellularMechanismSummary:
      'Samtidig deponering af bioaerosoler (skimmel/endotoksin) og uorganiske mineralfibre (asbest/kvarts) forstærker rekrutteringen af neutrofile granulocytter til bronkialslimhinden og reducerer fimrehårenes selvrensende funktion.',
    chronicPathophysiologySummary:
      'Ved gentagne episoder ses persisterende eosinofil/neutrofil bronkitis, fald i FEV1 hos følsomme individer samt kumulativ deponering af uopløselige mineralfibre i alveolerne.',
    synergisticCocktailSummary:
      'Selvom hver enkelt komponent ligger under 100% af sin isolerede grænseværdi (Asbest 53%, Kvarts 38%, Bioaerosoler 28%), overstiger den samlede belastning grænsen via Sumformlen (S = 1.19 > 1.00).',
    affectedOrgans: [
      {
        organSystem: 'Bronkialtræ & Øvre Luftvejsslimhinder',
        icd10Code: 'J45.9 / J68.0 / J30.8',
        physiologicalMechanism:
          'TLR4- og komplementaktivering fra bioaerosoler kombineret med mekanisk epitelirritation fra mineralstøv.',
        clinicalSymptoms: ['Hvæsende vejrtrækning', 'Øget behov for SABA-inhalator', 'Svie i øjne og svælg'],
        latencyPeriod: 'Akut: 15–120 minutter efter eksponering',
        severityLevel: 'HØJ',
        measuredTriggerText: 'Asbest 53% + Kvarts 38% + Skimmel/Endotoksin 28% (Sum S = 1.19)',
      },
    ],
    residentGuidance: [
      'Personer med astma eller KOL ved Sydøst Skole & Daginstitution bør undgå ophold i støvfanen og have reliever-inhalator tilgængelig.',
      'Rengør udendørs legeredskaber og vindueskarme med våd aftørring (H-klasse / vådklud) frem for tør fejning.',
    ],
    clinicalFollowUp: [
      'Dokumentér evt. øget forbrug af astmamedicin eller peak-flow fald i tidsrummet kl. 13:00–16:00 til brug for det samlede sundhedsbilag.',
    ],
    forensicAnnexSummary:
      'Klinisk miljømedicinsk dokumentation af at bioaerosoler og mineralstøv ved nordvestlig vind (305°) skaber en samlet sundhedsmæssig overskridelse (S = 1.19) ved Sydøst Skole & Daginstitution.',
    statutoryReferences: [
      'BEK nr. 613 af 2026 (Asbestbekendtgørelsen).',
      'At-vejledning C.0.1: Additiv toksikologisk vurdering via Sumformlen S = Σ(Ci / GVi).',
    ],
    operatorMedicalNote:
      'Registreret under opgravning af gammel kloakledning og sanering af fugtskadet facadebeton i Blok B.',
    sha256EvidenceHash: '4d29a8f0c31e67b5902da418e73b69510c84f2a19d3e76b401829c5a74e31b90',
  },
];

export const MedicalExpertAiWidget: React.FC<MedicalExpertAiWidgetProps> = ({
  selectedReceptorExposure,
  allReceptorExposures,
  onSelectReceptor,
  currentWeather,
  currentDateIso,
  cumulativeSumQuotient24h,
  acousticRefractionDb = 0,
  compactMode = false,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'reaction' | 'guidance' | 'annex'>('reaction');
  const [patientFocusGroup, setPatientFocusGroup] = useState<string>(PATIENT_FOCUS_GROUPS[0]);
  const [customClinicalQuestion, setCustomClinicalQuestion] = useState<string>('');
  const [operatorMedicalNote, setOperatorMedicalNote] = useState<string>('');
  const [analysis, setAnalysis] = useState<MedicalExpertAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [annexRecords, setAnnexRecords] = useState<MedicalEvidenceAnnexRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MEDICAL_ANNEX);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_MEDICAL_EVIDENCE_RECORDS;
  });

  const [justRegisteredId, setJustRegisteredId] = useState<string | null>(null);
  const [copiedAnnex, setCopiedAnnex] = useState<boolean>(false);

  const exceedsLimit = selectedReceptorExposure.sumQuotient >= 1.0;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MEDICAL_ANNEX, JSON.stringify(annexRecords));
    } catch {
      // ignore quota errors
    }
  }, [annexRecords]);

  const runMedicalExpertAnalysis = useCallback(
    async (overrideQuestion?: string) => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const payload = {
          receptorName: selectedReceptorExposure.receptorName,
          receptorId: selectedReceptorExposure.receptorId,
          totalSumQuotient: selectedReceptorExposure.sumQuotient,
          cumulativeSumQuotient24h,
          exceedsLimit: selectedReceptorExposure.sumQuotient >= 1.0,
          windSpeedMs: currentWeather.windSpeed10m,
          windDirectionDeg: currentWeather.windDirection10m,
          temperatureC: currentWeather.temperature2m,
          humidityPct: currentWeather.relativeHumidity2m,
          acousticRefractionDb,
          patientFocusGroup,
          dominantSourceName: selectedReceptorExposure.dominantSourceName,
          environmentalProfileSystemPrompt: formatEnvironmentalProfilesForAiSystemPrompt(
            selectedReceptorExposure.dominantSourceName
          ),
          customQuestion: overrideQuestion !== undefined ? overrideQuestion : customClinicalQuestion,
          substances: selectedReceptorExposure.substances.map((s) => {
            const spec = SUBSTANCE_SPECS[s.key];
            return {
              id: s.key,
              name: s.name,
              shortName: spec?.shortName || s.name,
              unit: s.unit,
              concentration: s.concentration,
              limitValue: s.limitValue,
              quotientRatio: s.quotient,
              exceeded: s.isExceedingIndividual,
              healthEffect: spec?.description || '',
              regulatoryReference: spec?.regulationRef || '',
            };
          }),
        };

        const res = await fetch('/api/medical-expert-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`Server svarede med status ${res.status}`);
        }

        const data: MedicalExpertAnalysisResponse = await res.json();
        setAnalysis(data);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Kunne ikke hente lægefaglig AI-analyse.');
      } finally {
        setIsLoading(false);
      }
    },
    [
      selectedReceptorExposure,
      cumulativeSumQuotient24h,
      currentWeather.windSpeed10m,
      currentWeather.windDirection10m,
      currentWeather.temperature2m,
      currentWeather.relativeHumidity2m,
      acousticRefractionDb,
      patientFocusGroup,
      customClinicalQuestion,
    ]
  );

  // Auto-run when selected receptor or focus group changes
  useEffect(() => {
    runMedicalExpertAnalysis();
  }, [selectedReceptorExposure.receptorId, patientFocusGroup]);

  const handleRegisterToAnnex = useCallback(async () => {
    if (!analysis) return;

    const nextIndex = annexRecords.length + 1;
    const bilagNumber = `BILAG-MED-${String(nextIndex).padStart(2, '0')}`;
    const recordedAtIso = new Date().toISOString();

    const sha256EvidenceHash = await computeForensicSha256Hash({
      bilagNumber,
      recordedAtIso,
      incidentDateIso: currentDateIso,
      incidentHour: currentWeather.hourIndex,
      receptorId: selectedReceptorExposure.receptorId,
      receptorName: selectedReceptorExposure.receptorName,
      sumQuotientS: Number(selectedReceptorExposure.sumQuotient.toFixed(4)),
      substances: selectedReceptorExposure.substances.map((s) => ({
        id: s.key,
        c: Number(s.concentration.toFixed(5)),
        q: Number(s.quotient.toFixed(4)),
      })),
      clinicalHeadline: analysis.clinicalHeadline,
      forensicAnnexSummary: analysis.forensicAnnexSummary,
    });

    const newRecord: MedicalEvidenceAnnexRecord = {
      id: `med-ev-${Date.now()}`,
      bilagNumber,
      recordedAtIso,
      incidentDateIso: currentDateIso,
      incidentHour: currentWeather.hourIndex,
      receptorId: selectedReceptorExposure.receptorId,
      receptorName: selectedReceptorExposure.receptorName,
      patientFocusGroup,
      sumQuotientS: selectedReceptorExposure.sumQuotient,
      cumulativeSumQuotient24h,
      exceedsLimit: selectedReceptorExposure.sumQuotient >= 1.0,
      acousticRefractionDb,
      windSpeedMs: currentWeather.windSpeed10m,
      windDirectionDeg: currentWeather.windDirection10m,
      temperatureC: currentWeather.temperature2m,
      humidityPct: currentWeather.relativeHumidity2m,
      substancesSnapshot: selectedReceptorExposure.substances.map((s) => {
        const spec = SUBSTANCE_SPECS[s.key];
        return {
          id: s.key,
          shortName: spec?.shortName || s.name,
          concentrationText: `${s.concentration < 0.01 ? s.concentration.toFixed(4) : s.concentration.toFixed(2)} ${s.unit}`,
          limitText: `${s.limitValue} ${s.unit}`,
          quotientRatio: s.quotient,
        };
      }),
      clinicalHeadline: analysis.clinicalHeadline,
      clinicalSeverity: analysis.clinicalSeverity,
      acuteReactionSummary: analysis.bodyReactionExplanation.acutePhysiologicalReaction,
      cellularMechanismSummary: analysis.bodyReactionExplanation.alveolarAndCellularMechanism,
      chronicPathophysiologySummary: analysis.bodyReactionExplanation.subacuteAndChronicPathophysiology,
      synergisticCocktailSummary: analysis.bodyReactionExplanation.synergisticCocktailEffect,
      affectedOrgans: analysis.bodyReactionExplanation.affectedOrganSystems || [],
      residentGuidance: analysis.healthGuidance.immediateResidentActions || [],
      clinicalFollowUp: analysis.healthGuidance.clinicalFollowUpAndDocumentation || [],
      forensicAnnexSummary: analysis.forensicAnnexSummary,
      statutoryReferences: analysis.statutoryMedicalReferences || [],
      operatorMedicalNote:
        operatorMedicalNote.trim() ||
        `Registreret ved målt Sumformel S = ${selectedReceptorExposure.sumQuotient.toFixed(2)} i ${selectedReceptorExposure.receptorName}.`,
      sha256EvidenceHash,
    };

    setAnnexRecords((prev) => [newRecord, ...prev]);
    setJustRegisteredId(newRecord.id);
    setOperatorMedicalNote('');
    setActiveSubTab('annex');
    setTimeout(() => setJustRegisteredId(null), 4000);
  }, [
    analysis,
    annexRecords.length,
    currentDateIso,
    currentWeather,
    selectedReceptorExposure,
    patientFocusGroup,
    cumulativeSumQuotient24h,
    acousticRefractionDb,
    operatorMedicalNote,
  ]);

  const handleDeleteAnnexRecord = (id: string) => {
    setAnnexRecords((prev) => prev.filter((r) => r.id !== id));
  };

  // Generate complete formatted text for the Samlet Bilag
  const formattedSamletBilagText = useMemo(() => {
    const lines: string[] = [];
    lines.push('================================================================================');
    lines.push('SAMLET BILAG: LÆGEFAGLIG & MILJØMEDICINSK BEVISFØRELSE OVER SUNDHEDSMÆSSIGE KONSEKVENSER');
    lines.push('Lokation: Ringparken, 4200 Slagelse | PSS Sag W22085 | BEK nr. 613 af 2026 & At-vejledning C.0.1');
    lines.push(`Udskrevet: ${new Date().toLocaleString('da-DK')} | Antal registrerede hændelses-bilag: ${annexRecords.length}`);
    lines.push('================================================================================\n');

    annexRecords.forEach((rec, idx) => {
      lines.push(`--------------------------------------------------------------------------------`);
      lines.push(`${rec.bilagNumber} (Post #${idx + 1}) — ${rec.receptorName}`);
      lines.push(`Hændelsestidspunkt: ${rec.incidentDateIso} kl. ${String(rec.incidentHour).padStart(2, '0')}:00 | Registreret: ${new Date(rec.recordedAtIso).toLocaleString('da-DK')}`);
      lines.push(`Målgruppe / Fokus: ${rec.patientFocusGroup} | Klinisk alvorsgrad: ${rec.clinicalSeverity}`);
      lines.push(`Målt Sumformel S = Σ(Ci/GVi): ${rec.sumQuotientS.toFixed(2)} (${rec.exceedsLimit ? 'OVERSKREDET > 1.00' : 'Under 1.00'}) | 24t Kumuleret Dosis: ${rec.cumulativeSumQuotient24h.toFixed(1)} S·t`);
      lines.push(`Meteorologi & Akustik: Vind ${rec.windSpeedMs.toFixed(1)} m/s (${rec.windDirectionDeg}°), Temp ${rec.temperatureC.toFixed(1)}°C, RF ${rec.humidityPct}% | Lydbølgebøjning: ${rec.acousticRefractionDb >= 0 ? '+' : ''}${rec.acousticRefractionDb.toFixed(1)} dB`);
      lines.push('');
      lines.push('1. MÅLTE STOFKONCENTRATIONER & KVOTIENTBIDRAG (Ci / GVi):');
      rec.substancesSnapshot.forEach((s) => {
        lines.push(`   - ${s.shortName}: Målt ${s.concentrationText} (Grænseværdi: ${s.limitText}) -> Kvotient C/GV = ${(s.quotientRatio * 100).toFixed(1)}%`);
      });
      lines.push('');
      lines.push('2. LÆGEFAGLIG FORKLARING AF KROPPENS REAKTION GRUNDET MÅLT EKSPONERING:');
      lines.push(`   [Klinisk Konklusion]: ${rec.clinicalHeadline}`);
      lines.push(`   [Akut Fysiologisk Reaktion]: ${rec.acuteReactionSummary}`);
      lines.push(`   [Alveolær & Cellulær Mekanisme]: ${rec.cellularMechanismSummary}`);
      lines.push(`   [Subakut & Kronisk Patofysiologi]: ${rec.chronicPathophysiologySummary}`);
      lines.push(`   [Synergistisk Cocktaileffekt (Sumformlen)]: ${rec.synergisticCocktailSummary}`);
      lines.push('');
      lines.push('3. PÅVIRKEDE ORGANSYSTEMER & ICD-10 KLASSIFIKATION:');
      rec.affectedOrgans.forEach((org) => {
        lines.push(`   * ${org.organSystem} [${org.icd10Code}] (Alvorsgrad: ${org.severityLevel} | Trigger: ${org.measuredTriggerText})`);
        lines.push(`     Mekanisme: ${org.physiologicalMechanism}`);
        lines.push(`     Symptomer: ${org.clinicalSymptoms.join(', ')} | Latenstid: ${org.latencyPeriod}`);
      });
      lines.push('');
      lines.push('4. SUNDHEDSFAGLIGE RÅD, VEJLEDNING & KLINISK OPFØLGNING:');
      rec.residentGuidance.forEach((g) => lines.push(`   - [Forholdsregel]: ${g}`));
      rec.clinicalFollowUp.forEach((c) => lines.push(`   - [Lægefaglig Opfølgning]: ${c}`));
      lines.push('');
      lines.push('5. RETSMEDICINSK KONKLUSION TIL BEVISFØRELSE:');
      lines.push(`   ${rec.forensicAnnexSummary}`);
      lines.push(`   Operatør-/Klinisk Note: ${rec.operatorMedicalNote}`);
      lines.push(`   Lovgrundlag: ${rec.statutoryReferences.join(' | ')}`);
      lines.push(`   SHA-256 Integritetshash: ${rec.sha256EvidenceHash}`);
      lines.push('--------------------------------------------------------------------------------\n');
    });

    return lines.join('\n');
  }, [annexRecords]);

  const handleCopySamletBilag = async () => {
    try {
      await navigator.clipboard.writeText(formattedSamletBilagText);
      setCopiedAnnex(true);
      setTimeout(() => setCopiedAnnex(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadTxtBilag = () => {
    const blob = new Blob([formattedSamletBilagText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Samlet_Laegefagligt_Bevis_Bilag_Ringparken_${currentDateIso}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadStructuredMedicalJson = async () => {
    const exportedAtIso = new Date().toISOString();

    // Collect deduplicated ICD-10 codes and organ systems across all accumulated annex records + active analysis
    const icd10Set = new Set<string>();
    const organSystemsSet = new Set<string>();

    annexRecords.forEach((rec) => {
      rec.affectedOrgans.forEach((org) => {
        if (org.icd10Code) icd10Set.add(org.icd10Code.trim());
        if (org.organSystem) organSystemsSet.add(org.organSystem.trim());
      });
    });

    if (analysis?.bodyReactionExplanation?.affectedOrganSystems) {
      analysis.bodyReactionExplanation.affectedOrganSystems.forEach((org) => {
        if (org.icd10Code) icd10Set.add(org.icd10Code.trim());
        if (org.organSystem) organSystemsSet.add(org.organSystem.trim());
      });
    }

    const allSumQuotients = [
      selectedReceptorExposure.sumQuotient,
      ...annexRecords.map((r) => r.sumQuotientS),
    ];
    const peakRecordedSumQuotientS = Number(
      Math.max(...allSumQuotients).toFixed(4)
    );
    const meanRecordedSumQuotientS = Number(
      (
        allSumQuotients.reduce((acc, v) => acc + v, 0) /
        Math.max(1, allSumQuotients.length)
      ).toFixed(4)
    );
    const totalAccumulated24hDoseSt = Number(
      annexRecords
        .reduce((acc, r) => acc + r.cumulativeSumQuotient24h, 0)
        .toFixed(2)
    );

    const bundlePayloadCore = {
      exportedAtIso,
      incidentDateIso: currentDateIso,
      receptorId: selectedReceptorExposure.receptorId,
      totalRecords: annexRecords.length,
      recordHashes: annexRecords.map((r) => r.sha256EvidenceHash),
      liveSumQuotientS: Number(selectedReceptorExposure.sumQuotient.toFixed(4)),
    };

    const bundleSha256IntegrityHash =
      await computeForensicSha256Hash(bundlePayloadCore);

    const structuredMedicalJournalPayload = {
      documentMetadata: {
        schemaVersion: '1.0.0-DK-EPJ-MILJOEMEDICIN',
        documentType: 'STRUKTURERET_LAEGEFAGLIGT_SUNDHEDSBILAG_JSON',
        title:
          'Akkumulerede Sundhedsdata & Miljømedicinsk Eksponeringsjournal (Ringparken 4200 Slagelse)',
        clinicalPurpose:
          'Struktureret dataudtræk til brug for lægelig journalføring (egen læge, arbejds- og miljømedicinsk klinik samt retsmedicinsk bevisførelse)',
        siteLocation: 'Ringparken, 4200 Slagelse',
        caseReference: 'PSS Sag W22085',
        regulatoryFramework: [
          'BEK nr. 613 af 2026 (Asbestbekendtgørelsen - grænseværdi 0,003 fibre/cm³)',
          'Arbejdstilsynets At-vejledning C.0.1 (Sumformlen S = Σ Ci / GVi)',
          'WHO Global Air Quality Guidelines (2021) for luftbårne partikler (PM2.5 / PM10)',
        ],
        exportedAtIso,
        bundleSha256IntegrityHash,
      },
      accumulatedHealthDataSummary: {
        totalRegisteredAnnexRecords: annexRecords.length,
        exceedanceAnnexRecordsCount: annexRecords.filter((r) => r.exceedsLimit)
          .length,
        peakRecordedSumQuotientS,
        meanRecordedSumQuotientS,
        current24hCumulativeSumDoseSt: Number(
          cumulativeSumQuotient24h.toFixed(2)
        ),
        historicalAccumulated24hDoseSumSt: totalAccumulated24hDoseSt,
        documentedIcd10Classifications: Array.from(icd10Set),
        documentedAffectedOrganSystems: Array.from(organSystemsSet),
        activePatientFocusGroup: patientFocusGroup,
      },
      currentLiveClinicalExposureSnapshot: {
        dateIso: currentDateIso,
        hourIndex: currentWeather.hourIndex,
        hourLabel: currentWeather.hourLabel,
        selectedReceptor: {
          receptorId: selectedReceptorExposure.receptorId,
          receptorCode: selectedReceptorExposure.receptorCode,
          receptorName: selectedReceptorExposure.receptorName,
          address: selectedReceptorExposure.address,
          distanceFromNearestSourceMeters:
            selectedReceptorExposure.distanceFromNearestSourceMeters,
          dominantSourceName: selectedReceptorExposure.dominantSourceName,
          sumQuotientS: Number(selectedReceptorExposure.sumQuotient.toFixed(4)),
          exceedsStatutorySumLimit: selectedReceptorExposure.sumQuotient >= 1.0,
          riskLevel: selectedReceptorExposure.riskLevel,
        },
        meteorologicalAndAcousticConditions: {
          windSpeedMs: currentWeather.windSpeed10m,
          windGustsMs: currentWeather.windGusts10m,
          windDirectionDeg: currentWeather.windDirection10m,
          temperatureC: currentWeather.temperature2m,
          relativeHumidityPct: currentWeather.relativeHumidity2m,
          pasquillStabilityClass: currentWeather.pasquillClass,
          acousticWindRefractionDb: Number(acousticRefractionDb.toFixed(2)),
        },
        measuredSubstancesBreakdown: selectedReceptorExposure.substances.map(
          (s) => {
            const spec = SUBSTANCE_SPECS[s.key];
            return {
              substanceKey: s.key,
              substanceName: s.name,
              shortName: spec?.shortName || s.name,
              measuredConcentration: s.concentration,
              unit: s.unit,
              limitValue2026: s.limitValue,
              quotientRatioCiOverGvi: Number(s.quotient.toFixed(4)),
              percentOfLimitValue: Number((s.quotient * 100).toFixed(1)),
              exceedsIndividualLimit: s.isExceedingIndividual,
              regulatoryReference: spec?.regulationRef || '',
            };
          }
        ),
        activeAiMedicalAssessment: analysis
          ? {
              clinicalHeadline: analysis.clinicalHeadline,
              clinicalSeverity: analysis.clinicalSeverity,
              generatedAtIso: analysis.generatedAtIso,
              bodyReactionExplanation: analysis.bodyReactionExplanation,
              healthGuidance: analysis.healthGuidance,
              forensicAnnexSummary: analysis.forensicAnnexSummary,
              statutoryMedicalReferences: analysis.statutoryMedicalReferences,
            }
          : null,
      },
      allReceptorsCurrentExposureOverview: allReceptorExposures.map((r) => ({
        receptorId: r.receptorId,
        receptorCode: r.receptorCode,
        receptorName: r.receptorName,
        address: r.address,
        sumQuotientS: Number(r.sumQuotient.toFixed(4)),
        exceedsLimit: r.sumQuotient >= 1.0,
        riskLevel: r.riskLevel,
      })),
      accumulatedMedicalEvidenceAnnexRecords: annexRecords,
    };

    const jsonString = JSON.stringify(structuredMedicalJournalPayload, null, 2);
    const blob = new Blob([jsonString], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Akkumulerede_Sundhedsdata_Laegejournal_Ringparken_${currentDateIso}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPdfBilag = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 18;

    const ensureSpace = (neededMm: number) => {
      if (y + neededMm > pageHeight - 16) {
        doc.addPage();
        y = 18;
      }
    };

    // Header Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('SAMLET BILAG: SUNDHEDSMÆSSIGE KONSEKVENSER & LÆGEFAGLIG BEVISFØRELSE', margin, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Lokation: Ringparken, 4200 Slagelse | PSS Sag W22085 | BEK nr. 613 af 2026 & At-vejledning C.0.1`,
      margin,
      19
    );
    doc.text(
      `Genereret: ${new Date().toLocaleString('da-DK')} | Antal registrerede medicinske bevis-poster: ${annexRecords.length}`,
      margin,
      25
    );

    y = 40;

    annexRecords.forEach((rec, idx) => {
      ensureSpace(55);

      doc.setFillColor(rec.exceedsLimit ? 127 : 30, rec.exceedsLimit ? 29 : 41, rec.exceedsLimit ? 29 : 59);
      doc.rect(margin, y, contentWidth, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(
        `${rec.bilagNumber} (#${idx + 1}) - ${rec.receptorName} | Sumformel S = ${rec.sumQuotientS.toFixed(2)}`,
        margin + 3,
        y + 6
      );
      y += 13;

      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(
        `Tidspunkt: ${rec.incidentDateIso} kl. ${String(rec.incidentHour).padStart(2, '0')}:00 | Fokus: ${rec.patientFocusGroup} | Lydbølgebøjning: ${rec.acousticRefractionDb >= 0 ? '+' : ''}${rec.acousticRefractionDb.toFixed(1)} dB`,
        margin,
        y
      );
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const subSummary = rec.substancesSnapshot
        .map((s) => `${s.shortName}: ${s.concentrationText} (${(s.quotientRatio * 100).toFixed(0)}% af GV)`)
        .join('  |  ');
      const subLines = doc.splitTextToSize(`Målt eksponering: ${subSummary}`, contentWidth);
      ensureSpace(subLines.length * 4 + 4);
      doc.text(subLines, margin, y);
      y += subLines.length * 4 + 2;

      const writeSection = (title: string, body: string) => {
        const wrapped = doc.splitTextToSize(body, contentWidth);
        ensureSpace(wrapped.length * 4 + 7);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(title, margin, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 4 + 2.5;
      };

      writeSection('Klinisk Vurdering:', rec.clinicalHeadline);
      writeSection('1. Akut Fysiologisk Reaktion:', rec.acuteReactionSummary);
      writeSection('2. Alveolær & Cellulær Mekanisme:', rec.cellularMechanismSummary);
      writeSection('3. Subakut & Kronisk Patofysiologi:', rec.chronicPathophysiologySummary);
      writeSection('4. Synergistisk Cocktaileffekt (Sumformlen):', rec.synergisticCocktailSummary);

      if (rec.affectedOrgans.length > 0) {
        const organsText = rec.affectedOrgans
          .map(
            (o) =>
              `• ${o.organSystem} [${o.icd10Code}] (${o.severityLevel}): ${o.physiologicalMechanism} Symptomer: ${o.clinicalSymptoms.join(', ')}.`
          )
          .join('\n');
        writeSection('5. Påvirkede Organsystemer (ICD-10):', organsText);
      }

      if (rec.residentGuidance.length > 0 || rec.clinicalFollowUp.length > 0) {
        const adviceText = [...rec.residentGuidance, ...rec.clinicalFollowUp].map((a) => `• ${a}`).join('\n');
        writeSection('6. Sundhedsfaglige Råd & Klinisk Opfølgning:', adviceText);
      }

      writeSection('7. Retsmedicinsk Konklusion til Bevisførelse:', rec.forensicAnnexSummary);

      ensureSpace(12);
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`SHA-256 Bevis-Hash: ${rec.sha256EvidenceHash}`, margin, y);
      y += 7;
    });

    doc.save(`Samlet_Bilag_Sundhedsmaessige_Konsekvenser_Ringparken_${currentDateIso}.pdf`);
  };

  const severityBadgeColor = (severity?: string) => {
    if (!severity) return 'bg-slate-800 text-slate-300 border-slate-700';
    if (severity.includes('AKUT') || severity.includes('KRITISK')) {
      return 'bg-red-950/90 text-red-200 border-red-500/60';
    }
    if (severity.includes('SUNDHEDSFARLIG') || severity.includes('HØJ')) {
      return 'bg-amber-950/90 text-amber-200 border-amber-500/60';
    }
    if (severity.includes('FORHØJET') || severity.includes('MODERAT')) {
      return 'bg-yellow-950/80 text-yellow-200 border-yellow-500/50';
    }
    return 'bg-emerald-950/80 text-emerald-200 border-emerald-500/50';
  };

  return (
    <div className="bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-lg overflow-hidden text-[var(--text-primary)]">
      {/* Top Clinical Header */}
      <div className="bg-[var(--surface-card)] px-4 py-3 border-b border-[var(--border-subtle)] border-l-4 border-l-rose-500 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 shadow-inner">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold tracking-wide uppercase text-rose-100">
                Lægefaglig AI Ekspert — Arbejds-, Miljø- & Retsmedicin
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-400/30">
                BEK 613/2026 & At-vejledning C.0.1
              </span>
              {analysis && (
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${severityBadgeColor(
                    analysis.clinicalSeverity
                  )}`}
                >
                  {analysis.clinicalSeverity.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Fysiologisk organrespons på aktuel målt eksponering, sundhedsfaglig vejledning & registrering i Samlet Bevis-Bilag
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRegisterToAnnex}
            disabled={isLoading || !analysis}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white border border-rose-400/40 shadow-sm transition-colors cursor-pointer"
            title="Registrér den aktuelle målte eksponering og lægefaglige vurdering i det samlede bevis-bilag"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Registrér i Samlet Bilag ({annexRecords.length})</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdfBilag}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-rose-200 border border-rose-500/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Download Samlet Bilag over Sundhedsmæssige Konsekvenser som PDF til bevisførelse"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Bilag</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadStructuredMedicalJson}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono font-semibold bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Download alle akkumulerede sundhedsdata som struktureret JSON-fil til lægelig journalføring (EPJ / egen læge)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON (Lægejournal)</span>
          </button>

          <button
            type="button"
            onClick={() => runMedicalExpertAnalysis()}
            disabled={isLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Genberegn lægefaglig AI-analyse med aktuelle måledata"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-rose-400' : ''}`} />
            <span>{isLoading ? 'Analyserer...' : 'Opdater AI'}</span>
          </button>
        </div>
      </div>

      {/* Exposure & Receptor Selection Bar */}
      <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
        <div className="lg:col-span-4 flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase text-slate-400 whitespace-nowrap">Receptor-zone:</span>
          {onSelectReceptor ? (
            <select
              value={selectedReceptorExposure.receptorId}
              onChange={(e) => onSelectReceptor(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 font-medium focus:outline-none focus:border-rose-500"
            >
              {allReceptorExposures.map((rec) => (
                <option key={rec.receptorId} value={rec.receptorId}>
                  {rec.receptorCode}: {rec.receptorName} — S = {rec.sumQuotient.toFixed(2)}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-bold text-slate-100 truncate">
              {selectedReceptorExposure.receptorName}
            </span>
          )}
        </div>

        <div className="lg:col-span-4 flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase text-slate-400 whitespace-nowrap">Patientgruppe:</span>
          <select
            value={patientFocusGroup}
            onChange={(e) => setPatientFocusGroup(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 font-medium focus:outline-none focus:border-rose-500"
          >
            {PATIENT_FOCUS_GROUPS.map((grp) => (
              <option key={grp} value={grp}>
                {grp}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-4 flex items-center justify-end gap-2 flex-wrap text-[11px] font-mono">
          <span
            className={`px-2 py-0.5 rounded border ${
              exceedsLimit
                ? 'bg-red-950/80 border-red-500/60 text-red-200 font-bold'
                : 'bg-slate-900 border-slate-700 text-slate-200'
            }`}
          >
            Sumformel S = {selectedReceptorExposure.sumQuotient.toFixed(2)}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
            24t Dosis: {cumulativeSumQuotient24h.toFixed(1)} S·t
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300">
            Refraktion: {acousticRefractionDb >= 0 ? '+' : ''}
            {acousticRefractionDb.toFixed(1)} dB
          </span>
        </div>
      </div>

      {/* Measured Exposure Snapshot Strip */}
      <div className="px-4 py-2 bg-slate-900/70 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-mono uppercase text-slate-400 whitespace-nowrap flex items-center gap-1">
          <Microscope className="w-3.5 h-3.5 text-rose-400" />
          Målt Eksponering:
        </span>
        {selectedReceptorExposure.substances.map((s) => {
          const pct = s.quotient * 100;
          const spec = SUBSTANCE_SPECS[s.key];
          const dotColor = SUBSTANCE_COLOR_MAP[s.key] || '#f43f5e';
          return (
            <div
              key={s.key}
              className={`px-2 py-1 rounded border text-[11px] font-mono whitespace-nowrap flex items-center gap-1.5 ${
                pct >= 50
                  ? 'bg-red-950/60 border-red-500/50 text-red-200'
                  : pct >= 25
                  ? 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
              <span className="font-semibold">{spec?.shortName || s.name}:</span>
              <span>
                {s.concentration < 0.01 ? s.concentration.toFixed(4) : s.concentration.toFixed(2)} {s.unit}
              </span>
              <span className="text-[11px] opacity-80">({pct.toFixed(0)}% GV)</span>
            </div>
          );
        })}
      </div>

      {/* Building Environmental Sample & DMA Grounding Strip for Dominant Source */}
      {(() => {
        const srcProfile = getBuildingEnvironmentalProfile(
          selectedReceptorExposure.dominantSourceName || 'Blok 1'
        );
        const asbSample = srcProfile.substanceSamples.find((s) => s.substanceKey === 'asbestos');
        const pcbSample = srcProfile.substanceSamples.find((s) => s.substanceKey === 'pcb');
        return (
          <div className="px-4 py-2 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-slate-300 truncate">
              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-amber-300 font-bold">
                Kilde-Bygningsprøver ({srcProfile.buildingName}):
              </span>
              <span className="truncate text-slate-300">
                Asbest: {(asbSample?.exactBuildingComponents || []).slice(0, 2).join(', ')} · PCB:{' '}
                {(pcbSample?.exactBuildingComponents || []).slice(0, 1).join(', ')} ·{' '}
                {srcProfile.crawlspaceOrBasementNoteDa}
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 shrink-0">
              Rapport: {srcProfile.reportIds[0]}
            </span>
          </div>
        );
      })()}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/60">
        <button
          type="button"
          onClick={() => setActiveSubTab('reaction')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'reaction'
              ? 'border-rose-500 text-rose-300 bg-rose-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          <span>1. Kroppens Reaktion (Målt Eksponering)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('guidance')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'guidance'
              ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>2. Sundhedsfaglige Råd & Vejledning</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('annex')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'annex'
              ? 'border-amber-500 text-amber-300 bg-amber-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>3. Samlet Bevis-Bilag ({annexRecords.length} registreringer)</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className={`p-4 space-y-4 ${compactMode ? 'max-h-[540px] overflow-y-auto' : ''}`}>
        {/* Custom Clinical Query & Registration Bar */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex flex-col md:flex-row gap-2.5 items-stretch md:items-center">
          <div className="flex-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
            <input
              type="text"
              value={customClinicalQuestion}
              onChange={(e) => setCustomClinicalQuestion(e.target.value)}
              placeholder="Stil et specifikt lægefagligt spørgsmål (f.eks. 'Hvordan påvirker 0.0021 fibre/cm³ asbest og +5 dB lavfrekvent støj børn med astma?')..."
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
          <button
            type="button"
            onClick={() => runMedicalExpertAnalysis(customClinicalQuestion)}
            disabled={isLoading}
            className="px-3 py-1.5 rounded bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            Spørg Lægefaglig AI
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-950/60 border border-red-500/50 rounded p-3 text-xs text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {justRegisteredId && (
          <div className="bg-emerald-950/80 border border-emerald-500/60 rounded p-2.5 text-xs text-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>
                Lægefaglig vurdering og målt eksponering er nu kryptografisk registreret i det{' '}
                <strong>Samlede Bevis-Bilag over Sundhedsmæssige Konsekvenser</strong>.
              </span>
            </div>
          </div>
        )}

        {/* Clinical Headline Banner */}
        {analysis && (
          <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-rose-500 rounded-lg p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono uppercase text-rose-400 tracking-wider mb-1">
                  Lægefaglig Konklusion for {selectedReceptorExposure.receptorName} ({patientFocusGroup})
                </div>
                <h4 className="text-sm font-bold text-slate-100 leading-snug">{analysis.clinicalHeadline}</h4>
              </div>
              <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                {new Date(analysis.generatedAtIso).toLocaleTimeString('da-DK')}
              </span>
            </div>
          </div>
        )}

        {/* TAB 1: KROPPENS REAKTION GRUNDET MÅLT EKSPONERING */}
        {activeSubTab === 'reaction' && analysis && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-300 uppercase tracking-wide">
                  <Activity className="w-4 h-4 text-rose-400" />
                  <span>Akut Fysiologisk Reaktion (0–24 timer)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {analysis.bodyReactionExplanation.acutePhysiologicalReaction}
                </p>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wide">
                  <Microscope className="w-4 h-4 text-cyan-400" />
                  <span>Alveolær & Cellulær Mekanisme (Makrofag / Inflammasom)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {analysis.bodyReactionExplanation.alveolarAndCellularMechanism}
                </p>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wide">
                  <HeartPulse className="w-4 h-4 text-amber-400" />
                  <span>Subakut & Kronisk Patofysiologi (Langtidseffekt)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {analysis.bodyReactionExplanation.subacuteAndChronicPathophysiology}
                </p>
              </div>

              <div className="bg-slate-950/90 border border-rose-500/30 rounded-lg p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wide">
                  <Scale className="w-4 h-4 text-purple-400" />
                  <span>Synergistisk Cocktaileffekt (Sumformlen S = Σ Ci/GVi)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {analysis.bodyReactionExplanation.synergisticCocktailEffect}
                </p>
              </div>
            </div>

            {/* Affected Organ Systems with ICD-10 */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-rose-400" />
                  <span>Påvirkede Organsystemer & Klinisk Patologi (ICD-10 Klassificeret)</span>
                </h5>
                <span className="text-[11px] font-mono text-slate-400">
                  {analysis.bodyReactionExplanation.affectedOrganSystems?.length || 0} organsystemer vurderet
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(analysis.bodyReactionExplanation.affectedOrganSystems || []).map((org, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 flex flex-col justify-between gap-2"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-100">{org.organSystem}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                            ICD-10: {org.icd10Code}
                          </span>
                          <span
                            className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded border ${severityBadgeColor(
                              org.severityLevel
                            )}`}
                          >
                            {org.severityLevel}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] font-mono text-rose-300/90 bg-rose-950/30 border border-rose-500/20 rounded px-2 py-1">
                        Målt udløser: {org.measuredTriggerText}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">{org.physiologicalMechanism}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {(org.clinicalSymptoms || []).map((sym, sIdx) => (
                          <span
                            key={sIdx}
                            className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300"
                          >
                            {sym}
                          </span>
                        ))}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Klinisk latenstid: <span className="text-slate-300">{org.latencyPeriod}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SUNDHEDSFAGLIGE RÅD & VEJLEDNING */}
        {activeSubTab === 'guidance' && analysis && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Immediate Resident Actions */}
              <div className="bg-slate-950/90 border border-emerald-500/30 rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 uppercase tracking-wide">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                  <span>Akutte Sundhedsfaglige Råd til Beboere & Naboer</span>
                </div>
                <ul className="space-y-2">
                  {(analysis.healthGuidance.immediateResidentActions || []).map((item, idx) => (
                    <li key={idx} className="text-xs text-slate-200 flex items-start gap-2 leading-relaxed">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Vulnerable Groups Guidance */}
              <div className="bg-slate-950/90 border border-rose-500/30 rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-300 uppercase tracking-wide">
                  <HeartPulse className="w-4 h-4 text-rose-400" />
                  <span>Særlig Vejledning for Sårbare Grupper (Børn, Gravide, Astma/KOL)</span>
                </div>
                <ul className="space-y-2">
                  {(analysis.healthGuidance.vulnerableGroupsGuidance || []).map((item, idx) => (
                    <li key={idx} className="text-xs text-slate-200 flex items-start gap-2 leading-relaxed">
                      <span className="w-4 h-4 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-mono flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Occupational Site Actions */}
              <div className="bg-slate-950/90 border border-amber-500/30 rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wide">
                  <Wind className="w-4 h-4 text-amber-400" />
                  <span>Arbejdsmedicinske & Tekniske Tiltag på Nedrivningspladsen</span>
                </div>
                <ul className="space-y-2">
                  {(analysis.healthGuidance.occupationalSiteActions || []).map((item, idx) => (
                    <li key={idx} className="text-xs text-slate-200 flex items-start gap-2 leading-relaxed">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-mono flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Clinical Follow-up & Medical Record Documentation */}
              <div className="bg-slate-950/90 border border-cyan-500/30 rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wide">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>Klinisk Opfølgning, Egen Læge & Medicinsk Journalføring</span>
                </div>
                <ul className="space-y-2">
                  {(analysis.healthGuidance.clinicalFollowUpAndDocumentation || []).map((item, idx) => (
                    <li key={idx} className="text-xs text-slate-200 flex items-start gap-2 leading-relaxed">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Statutory References */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                Lægefaglige & Regulatoriske Referencer
              </div>
              <div className="flex flex-wrap gap-2">
                {(analysis.statutoryMedicalReferences || []).map((ref, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SAMLET BEVIS-BILAG OVER SUNDHEDSMÆSSIGE KONSEKVENSER */}
        {activeSubTab === 'annex' && (
          <div className="space-y-4">
            {/* Registration Input Box for adding current assessment to the Samlet Bilag */}
            <div className="bg-slate-950 border border-amber-500/40 rounded-lg p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-amber-400" />
                    <span>Registrér Aktuel Eksponering & Lægefaglig Konsekvens i Samlet Bilag</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Tilføjer den aktuelle målte eksponering i <strong>{selectedReceptorExposure.receptorName}</strong> (S ={' '}
                    {selectedReceptorExposure.sumQuotient.toFixed(2)}), kroppens reaktion, ICD-10 organvurdering og SHA-256 hash som nyt bilagspunkt.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySamletBilag}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedAnnex ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAnnex ? 'Kopieret!' : 'Kopiér Samlet Bilag'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadStructuredMedicalJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/50 cursor-pointer whitespace-nowrap shrink-0"
                    title="Download alle brugerens akkumulerede sundhedsdata som struktureret JSON-fil til brug for lægelig journalføring"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Download JSON (Lægelig Journalføring)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTxtBilag}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Download .TXT</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPdfBilag}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Eksportér Samlet Bilag (PDF)</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="text"
                  value={operatorMedicalNote}
                  onChange={(e) => setOperatorMedicalNote(e.target.value)}
                  placeholder="Tilføj klinisk bemærkning eller observation til bilaget (f.eks. 'Borger i blok A rapporterede akut hoste og svie i øjne kl. 13:15')..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleRegisterToAnnex}
                  disabled={isLoading || !analysis}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Tilføj til Samlet Bevis-Bilag</span>
                </button>
              </div>
            </div>

            {/* List of Registered Evidence Annex Entries */}
            <div className="space-y-3">
              {annexRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-lg p-3.5 space-y-2.5 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {rec.bilagNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-100">{rec.receptorName}</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        ({rec.incidentDateIso} kl. {String(rec.incidentHour).padStart(2, '0')}:00)
                      </span>
                      <span
                        className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                          rec.exceedsLimit
                            ? 'bg-red-950/90 text-red-200 border-red-500/50'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        Sumformel S = {rec.sumQuotientS.toFixed(2)}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                        Fokus: {rec.patientFocusGroup}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteAnnexRecord(rec.id)}
                      className="text-slate-500 hover:text-red-400 p-1 rounded cursor-pointer"
                      title="Fjern post fra bilag"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Substance pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {rec.substancesSnapshot.map((s) => (
                      <span
                        key={s.id}
                        className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                      >
                        <strong>{s.shortName}:</strong> {s.concentrationText} ({(s.quotientRatio * 100).toFixed(0)}% GV)
                      </span>
                    ))}
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300 flex items-center gap-1">
                      <Volume2 className="w-3 h-3" />
                      Vindrefraktion: {rec.acousticRefractionDb >= 0 ? '+' : ''}
                      {rec.acousticRefractionDb.toFixed(1)} dB
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-rose-200">{rec.clinicalHeadline}</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-slate-300">
                    <div className="bg-slate-900/60 border border-slate-800/80 rounded p-2.5">
                      <div className="text-[11px] font-mono uppercase text-rose-400 mb-1">
                        Kroppens Akutte & Cellulære Reaktion
                      </div>
                      <p className="leading-relaxed">{rec.acuteReactionSummary}</p>
                      <p className="leading-relaxed mt-1.5 text-slate-400">{rec.cellularMechanismSummary}</p>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800/80 rounded p-2.5">
                      <div className="text-[11px] font-mono uppercase text-amber-400 mb-1">
                        Retsmedicinsk Bevis-Konklusion & Synergi
                      </div>
                      <p className="leading-relaxed">{rec.forensicAnnexSummary}</p>
                      <p className="leading-relaxed mt-1.5 text-slate-400">{rec.synergisticCocktailSummary}</p>
                    </div>
                  </div>

                  {/* ICD-10 tags */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono text-slate-400">
                    <div className="flex flex-wrap gap-1.5">
                      {rec.affectedOrgans.map((o, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300"
                        >
                          {o.organSystem} [{o.icd10Code}]
                        </span>
                      ))}
                    </div>
                    <span className="truncate max-w-md" title={rec.sha256EvidenceHash}>
                      SHA-256: {rec.sha256EvidenceHash.slice(0, 24)}...
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
