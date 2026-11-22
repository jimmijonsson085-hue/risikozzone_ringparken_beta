import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  HardHat,
  Home,
  Info,
  MapPin,
  Phone,
  RotateCcw,
  Route,
  Search,
  ShieldAlert,
  Wind,
} from 'lucide-react';
import {
  MATERIAL_SAMPLES,
  RINGPARKEN_BUILDINGS,
  getBuildingById,
  getSamplesForBuilding,
} from '../constants/ringparkenData';
import { MaterialSample, RingparkenBuilding } from '../types';
import {
  BEK_613_2026_LIMITS,
  MaterialSampleClassificationResult,
  calculateDistanceAndBearing,
  calculateReceptorExposure,
  checkWorkHoursCompliance,
  classifyMaterialSample,
  computeFuzzySearchScore,
  evaluateCanonicalBuildingCompliance,
} from '../utils/riskEngine';

export type DashboardUserRole = 'resident' | 'worker';

export interface RoleDashboardProps {
  role: DashboardUserRole;
  onChangeRole?: (nextRole: DashboardUserRole) => void;
  windFromDeg?: number;
  windSpeedMs?: number;
  isDryWeather?: boolean;
  initialBuildingId?: string | null;
  onOpenOnGisMap?: (buildingId: string) => void;
}

interface WorkerChecklistItem {
  id: string;
  category: string;
  statutoryRef: string;
  titleDa: string;
  detailDa: string;
  critical: boolean;
}

interface EmergencyContactEntry {
  id: string;
  roleTitle: string;
  personOrOrg: string;
  addressOrBasis: string;
  phonePrimary: string;
  phoneSecondary?: string;
  email?: string;
  priority: 'P1' | 'AMK' | 'MYNDIGHED';
}

const VERIFIED_KIERULFFSVEJ_12_CONTACTS: EmergencyContactEntry[] = [
  {
    id: 'alarm-112',
    roleTitle: 'Alarm (Politi / Brand / Ambulance)',
    personOrOrg: 'Livstruende ulykke, brand eller akut kollaps',
    addressOrBasis: 'Opgiv byggepladsadresse: Kierulffsvej 12, 4200 Slagelse',
    phonePrimary: '112',
    priority: 'P1',
  },
  {
    id: 'akut-1813',
    roleTitle: 'Akuttelefon / Lægevagt',
    personOrOrg: 'Region Sjælland / Akut eksponering uden for 112',
    addressOrBasis: 'Ved asbest-, PCB- eller blyeksponering / akut skade',
    phonePrimary: '1813',
    priority: 'P1',
  },
  {
    id: 'amk-b',
    roleTitle: 'AMK-B (Arbejdsmiljøkoordinator Byggefasen)',
    personOrOrg: 'Kenny Vibolt Hansen — Titan Nedbrydning',
    addressOrBasis: 'Daglig pladsledelse & byggepladskontrol',
    phonePrimary: '26 30 78 09',
    priority: 'AMK',
  },
  {
    id: 'amk-p',
    roleTitle: 'AMK-P (Arbejdsmiljøkoordinator Projektering)',
    personOrOrg: 'Mathias Hansen — Wissenberg Rådgivende Ingeniører',
    addressOrBasis: 'PSS W22085 & projekteringssikkerhed',
    phonePrimary: '27 25 34 92',
    priority: 'AMK',
  },
  {
    id: 'brand-slagelse',
    roleTitle: 'Slagelse Brand og Redning',
    personOrOrg: 'Midt- og Sydsjællands Brand & Redning',
    addressOrBasis: 'Antvorskov Allé 135, 4200 Slagelse',
    phonePrimary: '58 57 97 24',
    priority: 'MYNDIGHED',
  },
  {
    id: 'politi-slagelse',
    roleTitle: 'Slagelse Lokalpoliti',
    personOrOrg: 'Sydsjællands og Lolland-Falsters Politi',
    addressOrBasis: 'Antvorskov Allé 139 C, 4200 Slagelse',
    phonePrimary: '55 31 14 48',
    priority: 'MYNDIGHED',
  },
  {
    id: 'at-oest',
    roleTitle: 'Arbejdstilsynet Tilsynscenter Øst',
    personOrOrg: 'Anmeldelse af arbejdsulykker & asbest-/blytilsyn',
    addressOrBasis: 'Antvorskov Allé 139, 4200 Slagelse',
    phonePrimary: '70 12 12 88',
    priority: 'MYNDIGHED',
  },
  {
    id: 'museum-vestsjaelland',
    roleTitle: 'Museum Vestsjælland (Arkæologi)',
    personOrOrg: 'Jordarbejde & fortidsminder (§ 24)',
    addressOrBasis: 'Straks-standsning af gravearbejde ved arkæologiske fund',
    phonePrimary: '25 52 83 83',
    priority: 'MYNDIGHED',
  },
  {
    id: 'slagelse-miljoe',
    roleTitle: 'Slagelse Kommune Miljø (Jordforurening § 71)',
    personOrOrg: 'Center for Teknik, Plan og Miljø',
    addressOrBasis: 'Jordforureningsloven § 71 & akut udslip',
    phonePrimary: '58 57 30 54',
    phoneSecondary: '58 57 46 92',
    email: 'teknik@slagelse.dk',
    priority: 'MYNDIGHED',
  },
];

const ELEVATED_ASBESTOS_BASEMENT_BLOCKS_COUNT = 11;

function getRiskStyles(level: 'KRITISK' | 'HØJ' | 'MODERAT' | 'LAV') {
  switch (level) {
    case 'KRITISK':
      return {
        border: 'border-rose-500/70',
        bg: 'bg-rose-950/35',
        text: 'text-rose-200',
        accent: 'text-rose-400',
      };
    case 'HØJ':
      return {
        border: 'border-orange-500/70',
        bg: 'bg-orange-950/35',
        text: 'text-orange-200',
        accent: 'text-orange-400',
      };
    case 'MODERAT':
      return {
        border: 'border-amber-500/65',
        bg: 'bg-amber-950/30',
        text: 'text-amber-200',
        accent: 'text-amber-400',
      };
    case 'LAV':
    default:
      return {
        border: 'border-emerald-500/60',
        bg: 'bg-emerald-950/25',
        text: 'text-emerald-200',
        accent: 'text-emerald-400',
      };
  }
}

export const RoleDashboard: React.FC<RoleDashboardProps> = ({
  role,
  onChangeRole,
  windFromDeg: propWindFromDeg = 250,
  windSpeedMs: propWindSpeedMs = 6.5,
  isDryWeather: propIsDryWeather = true,
  initialBuildingId = null,
  onOpenOnGisMap,
}) => {
  // Beboer-tilstand starter på Blok 2 (49,3 m øst for Blok 1); Arbejder-tilstand starter på Blok 1 / Nedrivningsfelt
  const defaultResidentId =
    initialBuildingId || 'blok-2-kierulffsvej-24-32';
  const defaultWorkerId =
    initialBuildingId || 'blok-1-kierulffsvej-14-22';

  const [selectedResidentId, setSelectedResidentId] =
    useState<string>(defaultResidentId);
  const [residentSearchQuery, setResidentSearchQuery] = useState<string>('');
  const [simWindFromDeg, setSimWindFromDeg] = useState<number>(propWindFromDeg);
  const [simWindSpeedMs, setSimWindSpeedMs] = useState<number>(propWindSpeedMs);
  const [simDryWeather, setSimDryWeather] = useState<boolean>(propIsDryWeather);

  const [selectedWorkerId, setSelectedWorkerId] =
    useState<string>(defaultWorkerId);
  const [selectedMaterialFocus, setSelectedMaterialFocus] = useState<
    'ALL' | 'ASBEST' | 'PCB_SCCP' | 'BLY' | 'MINERALULD' | 'SKIMMEL' | 'KRYBEKAELDER'
  >('ALL');
  const [checkedItemsByBuilding, setCheckedItemsByBuilding] = useState<
    Record<string, Record<string, boolean>>
  >({});

  const activeDemolitionSources = useMemo(
    () =>
      RINGPARKEN_BUILDINGS.filter(
        (b) => b.stage === 'Aktiv nedrivning (2026)'
      ),
    []
  );

  // Alle beboede bygninger & følsomme naboer (prioriteret for Beboer & Nabo)
  const residentBuildings = useMemo(
    () =>
      RINGPARKEN_BUILDINGS.filter(
        (b) =>
          b.stage === 'Beboet / Renoveres' ||
          b.stage === 'Ekstern nabo / Institution' ||
          b.stage === 'Planlagt nedrivning (Etape 2/3)'
      ),
    []
  );

  const filteredResidentBuildings = useMemo(() => {
    const q = residentSearchQuery.trim();
    if (!q) return residentBuildings;
    return residentBuildings
      .map((b) => {
        const hay = [
          b.name,
          b.fobDepartment,
          b.fobBlockNumber !== null ? `FOB Blok ${b.fobBlockNumber}` : '',
          b.dmaBlockNumber !== null ? `DMA Blok ${b.dmaBlockNumber}` : '',
          ...b.canonicalAddresses,
        ].join(' ');
        return { b, score: computeFuzzySearchScore(q, hay) };
      })
      .filter((x) => x.score >= 30)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.b);
  }, [residentBuildings, residentSearchQuery]);

  const selectedResidentBuilding: RingparkenBuilding = useMemo(() => {
    return (
      getBuildingById(selectedResidentId) ??
      residentBuildings[0] ??
      RINGPARKEN_BUILDINGS[0]
    );
  }, [selectedResidentId, residentBuildings]);

  // Deterministisk eksponering & afstand til nærmeste nedrivningsgavl
  const residentExposure = useMemo(
    () =>
      calculateReceptorExposure(
        selectedResidentBuilding,
        activeDemolitionSources,
        simWindFromDeg,
        simWindSpeedMs,
        simDryWeather
      ),
    [
      selectedResidentBuilding,
      activeDemolitionSources,
      simWindFromDeg,
      simWindSpeedMs,
      simDryWeather,
    ]
  );

  const nearestGableDistance = useMemo(() => {
    const targetPoints: Array<{ lat: number; lng: number }> = [
      {
        lat: selectedResidentBuilding.coordinates.lat,
        lng: selectedResidentBuilding.coordinates.lng,
      },
      ...(selectedResidentBuilding.coordinates.referencePoints ?? []),
    ];

    let bestDist = Number.POSITIVE_INFINITY;
    let bestLabel = '';
    for (const src of activeDemolitionSources) {
      const srcPoints = [
        {
          label: src.name.split('(')[0].trim(),
          lat: src.coordinates.lat,
          lng: src.coordinates.lng,
        },
        ...(src.coordinates.referencePoints ?? []).map((rp) => ({
          label: `${src.name.split('(')[0].trim()} · ${rp.label}`,
          lat: rp.lat,
          lng: rp.lng,
        })),
      ];
      for (const tp of targetPoints) {
        for (const sp of srcPoints) {
          const vec = calculateDistanceAndBearing(sp.lat, sp.lng, tp.lat, tp.lng);
          if (vec.distanceMeters < bestDist) {
            bestDist = vec.distanceMeters;
            bestLabel = sp.label;
          }
        }
      }
    }
    return {
      distanceMeters: Number.isFinite(bestDist) ? Number(bestDist.toFixed(1)) : 0,
      sourceLabel: bestLabel || residentExposure.nearestSourceName || 'Aktivt felt',
    };
  }, [selectedResidentBuilding, activeDemolitionSources, residentExposure]);

  const residentSamplesWithClass = useMemo(() => {
    return getSamplesForBuilding(selectedResidentBuilding.id).map((sample) => ({
      sample,
      classification: classifyMaterialSample(sample, {
        constructionYear: 1971,
        isPre1997MineralWool: sample.material.toLowerCase().includes('mineraluld'),
      }),
    }));
  }, [selectedResidentBuilding]);

  const residentAsbestosDustSamples = useMemo(
    () =>
      residentSamplesWithClass.filter(
        ({ sample }) =>
          sample.asbestosDetected &&
          (sample.locationDetail.toLowerCase().includes('kælder') ||
            sample.material.toLowerCase().includes('støv'))
      ),
    [residentSamplesWithClass]
  );

  const blocksWithBasementAsbestos = useMemo(
    () => RINGPARKEN_BUILDINGS.filter((b) => b.hasBasementAsbestosDust),
    []
  );

  // ---------------- ARBEJDER & AMK DATA ----------------
  const selectedWorkerBuilding = useMemo(
    () => getBuildingById(selectedWorkerId) ?? RINGPARKEN_BUILDINGS[0],
    [selectedWorkerId]
  );

  const workerBuildingSamples: Array<{
    sample: MaterialSample;
    classification: MaterialSampleClassificationResult;
  }> = useMemo(() => {
    return getSamplesForBuilding(selectedWorkerBuilding.id).map((sample) => ({
      sample,
      classification: classifyMaterialSample(sample, {
        constructionYear: 1971,
        isPre1997MineralWool: sample.material.toLowerCase().includes('mineraluld'),
      }),
    }));
  }, [selectedWorkerBuilding]);

  const workerComplianceSummary = useMemo(
    () => evaluateCanonicalBuildingCompliance(selectedWorkerBuilding, MATERIAL_SAMPLES),
    [selectedWorkerBuilding]
  );

  const workHoursNow = useMemo(
    () => checkWorkHoursCompliance(new Date(), { timeZone: 'Europe/Copenhagen' }),
    []
  );

  // Dynamisk tjekliste baseret på bygning, prøver og `utils/riskEngine.ts`
  const workerChecklistItems: WorkerChecklistItem[] = useMemo(() => {
    const items: WorkerChecklistItem[] = [];
    const b = selectedWorkerBuilding;
    const hasAsbestos =
      b.hasBasementAsbestosDust ||
      workerBuildingSamples.some((x) => x.sample.asbestosDetected);
    const hasHighPcbOrSccp = workerBuildingSamples.some(
      ({ sample }) =>
        (sample.concentrationsMgKg.PCB ?? 0) >= 50 ||
        (sample.concentrationsMgKg.SCCP_MCCP ?? 0) > 2500
    );
    const hasLead = workerBuildingSamples.some(
      ({ sample }) => (sample.concentrationsMgKg.PB ?? 0) >= 40
    );
    const hasPre1997Wool =
      b.id === 'blok-1-kierulffsvej-14-22' ||
      b.stage === 'Aktiv nedrivning (2026)' ||
      workerBuildingSamples.some(({ sample }) =>
        sample.material.toLowerCase().includes('mineraluld')
      );
    const isFloodedMoldBasement =
      b.id === 'byg-1-kierulffsvej-2' || b.id === 'byg-2-kierulffsvej-12';
    const isBlok1Crawlspace = b.id === 'blok-1-kierulffsvej-14-22';

    // Hent de unikke 2026-krav direkte fra riskEngine.ts klassifikationerne
    const riskEngineRequirements = Array.from(
      new Set(
        workerBuildingSamples.flatMap(
          ({ classification }) => classification.safetyRequirements2026
        )
      )
    );

    if (
      (selectedMaterialFocus === 'ALL' || selectedMaterialFocus === 'ASBEST') &&
      (hasAsbestos || b.stage === 'Aktiv nedrivning (2026)')
    ) {
      items.push(
        {
          id: 'asbestos-auth-amu',
          category: 'ASBEST',
          statutoryRef: 'BEK nr. 1328 af 19.11.2025 (i kraft 21.12.2025)',
          titleDa:
            'Virksomhedsautorisation fra Sikkerhedsstyrelsen & gyldigt 4-dages AMU-kursusbevis',
          detailDa:
            'Alle udførende på asbestopgaven skal fremvise autorisationsnummer, 4-dages kursusbevis og dokumenteret AT-anmeldelse senest 3 dage før opstart. Luftgrænseværdi: 0,003 fibre/cm³.',
          critical: true,
        },
        {
          id: 'asbestos-mask-hours',
          category: 'ASBEST',
          statutoryRef: 'BEK nr. 1328/2025 · Arbejdstidsgrænse',
          titleDa:
            'Maks. 4 timers maskearbejde pr. dag med obligatorisk pause hver 2. time',
          detailDa:
            'Arbejde med luftforsynet/turbomaske må højst vare 4 timer pr. arbejdsdag, og der skal holdes pause senest hver 2. time. Støvtæt 3-kammer luftsluse og H-klasse HEPA-undertryk skal køre konstant.',
          critical: true,
        },
        {
          id: 'asbestos-no-pressure-wash',
          category: 'ASBEST',
          statutoryRef: 'BEK nr. 1328/2025 (Skærpelse pr. 01.07.2026)',
          titleDa:
            'Totalforbud mod højtryksspuling af asbestholdige overflader',
          detailDa:
            'Alle dispensationer til højtryksspuling er bortfaldet pr. 01.07.2026. Brug udelukkende HEPA-støvsugning og kontrolleret våd afvaskning før emballering (EAK 17 06 06* / 17 06 01*).',
          critical: true,
        }
      );
    }

    if (
      (selectedMaterialFocus === 'ALL' || selectedMaterialFocus === 'PCB_SCCP') &&
      (hasHighPcbOrSccp || b.stage !== 'Ekstern nabo / Institution')
    ) {
      items.push({
        id: 'pcb-sccp-ppe',
        category: 'PCB & SCCP',
        statutoryRef: 'AT IN-9-3 / Den gule PCB-vejledning · SCCP/MCCP > 2.500 mg/kg',
        titleDa:
          'Kombinationsfilter A2P3 eller friskluftforsynet maske ved PCB (≥ 50 mg/kg) og klorparaffiner (> 2.500 mg/kg)',
        detailDa:
          'Brug kemikalieresistente handsker, heldragt type 4/5 og effektivt lokalt procesudsug ved skæring/fræsning af fuger og altandækmaling (f.eks. maling/fuge med PCB eller 19.000 mg/kg MCCP).',
        critical: hasHighPcbOrSccp,
      });
    }

    if (
      (selectedMaterialFocus === 'ALL' || selectedMaterialFocus === 'BLY') &&
      (hasLead || b.stage === 'Aktiv nedrivning (2026)')
    ) {
      items.push({
        id: 'lead-2026-limit',
        category: 'BLY',
        statutoryRef: `BEK nr. 613 pr. 01.07.2026 · Grænseværdi ${BEK_613_2026_LIMITS.leadMgPerM3.toFixed(2).replace('.', ',')} mg Pb/m³`,
        titleDa:
          'Skærpet blygrænseværdi 0,03 mg Pb/m³ & lovpligtig arbejdsmedicinsk blodkontrol',
        detailDa:
          'Halveret grænseværdi pr. 01.07.2026. Blodprøve- og helbredsundersøgelse udløses ved > 0,015 mg Pb/m³ i luft eller > 4,5 µg Pb/100 ml blod (kvinder i fødedygtig alder) / > 9 µg/100 ml generelt (biologisk grænse 20 µg/100 ml).',
        critical: hasLead,
      });
    }

    if (
      (selectedMaterialFocus === 'ALL' || selectedMaterialFocus === 'MINERALULD') &&
      hasPre1997Wool
    ) {
      items.push({
        id: 'mineralwool-pre1997',
        category: 'MINERALULD',
        statutoryRef: 'BEK nr. 1399 af 25/06/2021 · EAK 17 06 03*',
        titleDa:
          'Særskilt udsortering af gammel mineraluld før 1997 (tagrum & rørskåle)',
        detailDa:
          'Syntetiske mineralfibre fremstillet før 1997 klassificeres som farligt affald. Skal nedtages støvdæmpet med P2/P3-maske og engangsdragt i lukkede, mærkede sække.',
        critical: false,
      });
    }

    if (
      (selectedMaterialFocus === 'ALL' || selectedMaterialFocus === 'SKIMMEL') &&
      (isFloodedMoldBasement || b.hasBasementAsbestosDust)
    ) {
      items.push({
        id: 'mold-flooded-basements',
        category: 'SKIMMEL',
        statutoryRef: 'Wissenberg PSS W22085 · Oversvømmede kældre (Bygning 1 & 2)',
        titleDa:
          'Skimmelværnemidler & biologisk sikring i oversvømmede kældre (Bygning 1 & 2)',
        detailDa: isFloodedMoldBasement
          ? 'Påvist massiv fugt- og skimmelbelastning samt brun kiselgur i kælder (Kierulffsvej 2 & 12). Kræver P3-/friskluftmaske, væsketæt dragt, vandtætte støvler og kontrolleret pumpning/afrensning før nedbrydning.'
          : '42 % Mycometer Kategori C (> 450 FLU) i stikprøver i Ringparken: Kontrollér fugt og skimmel med P3-værnemidler ved opbrydning i kældre og vådrum.',
        critical: isFloodedMoldBasement,
      });
    }

    if (
      (selectedMaterialFocus === 'ALL' || selectedMaterialFocus === 'KRYBEKAELDER') &&
      (isBlok1Crawlspace || b.basementType.toLowerCase().includes('krybekælder'))
    ) {
      items.push({
        id: 'blok1-crawlspace-rule',
        category: 'KRYBEKÆLDER',
        statutoryRef: 'PSS-sikkerhedsregel · Blok 1 (Kierulffsvej 14-22)',
        titleDa:
          'Blok 1 krybekælder: Må IKKE ryddes før overliggende dæk er fjernet',
        detailDa:
          'Af arbejdsrum-, asbest- og kollapshensyn er direkte indvendig rydning i den lave krybekælder under Blok 1 forbudt. Overliggende stueetagedæk skal fjernes først, så kiselgur/rør kan saneres sikkert ovenfra.',
        critical: true,
      });
    }

    // Tilføj eventuelle dynamisk beregnede punkter fra riskEngine.ts hvis ikke allerede dækket
    if (selectedMaterialFocus === 'ALL' && riskEngineRequirements.length > 0) {
      items.push({
        id: 'riskengine-summary-sync',
        category: 'RISKENGINE',
        statutoryRef: 'Deterministisk kontrol · utils/riskEngine.ts',
        titleDa: `Verificerede prøvespecifikke krav (${workerBuildingSamples.length} prøver på bygningen)`,
        detailDa: riskEngineRequirements.slice(0, 2).join(' · '),
        critical: workerComplianceSummary.hazardousSampleCount > 0,
      });
    }

    return items;
  }, [
    selectedWorkerBuilding,
    selectedMaterialFocus,
    workerBuildingSamples,
    workerComplianceSummary,
  ]);

  const currentBuildingChecks = checkedItemsByBuilding[selectedWorkerBuilding.id] ?? {};
  const completedCount = workerChecklistItems.filter(
    (item) => currentBuildingChecks[item.id]
  ).length;

  const toggleChecklistItem = (itemId: string) => {
    setCheckedItemsByBuilding((prev) => {
      const buildingMap = prev[selectedWorkerBuilding.id] ?? {};
      return {
        ...prev,
        [selectedWorkerBuilding.id]: {
          ...buildingMap,
          [itemId]: !buildingMap[itemId],
        },
      };
    });
  };

  const resetBuildingChecklist = () => {
    setCheckedItemsByBuilding((prev) => ({
      ...prev,
      [selectedWorkerBuilding.id]: {},
    }));
  };

  const riskStyle = getRiskStyles(residentExposure.riskLevel);

  return (
    <section
      aria-label={
        role === 'resident'
          ? 'Beboer og Nabo Risikodashboard'
          : 'Arbejder og AMK Sikkerheds- og Beredskabsdashboard'
      }
      className="w-full h-full overflow-y-auto bg-[#0B0F19] text-slate-100 p-4 lg:p-6 space-y-6 font-sans"
    >
      {/* ØVERSTE ROLLE-KONTEKSTLINJE */}
      <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Ringparken, 4200 Slagelse</span>
            <span aria-hidden="true">·</span>
            <span>
              {role === 'resident'
                ? '1. Beboer & Nabo'
                : '2. Arbejder & AMK (Arbejdsmiljøkoordinator)'}
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={
                workHoursNow.isAllowed ? 'text-emerald-300 font-medium' : 'text-rose-300 font-medium'
              }
            >
              {workHoursNow.statusLabelDa}
            </span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-50">
            {role === 'resident'
              ? 'Personligt Risikokort & Indeklima for Beboere og Naboer'
              : 'Arbejdsplads-tjekliste (BEK 1328/2025 & 613/2026) og Verificeret Beredskab'}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onChangeRole && (
            <div className="flex items-center gap-1 p-1 bg-[#111827] border border-[#334155] rounded-lg">
              <button
                type="button"
                onClick={() => onChangeRole('resident')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                  role === 'resident'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Home className="w-3.5 h-3.5 shrink-0" />
                <span>1. Beboer &amp; Nabo</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeRole('worker')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                  role === 'worker'
                    ? 'bg-amber-400 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <HardHat className="w-3.5 h-3.5 shrink-0" />
                <span>2. Arbejder &amp; AMK</span>
              </button>
            </div>
          )}

          {onOpenOnGisMap && (
            <button
              type="button"
              onClick={() =>
                onOpenOnGisMap(
                  role === 'resident'
                    ? selectedResidentBuilding.id
                    : selectedWorkerBuilding.id
                )
              }
              className="px-3.5 py-2 rounded-lg bg-[#1E293B] hover:bg-[#293548] border border-[#334155] text-xs font-medium text-cyan-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Vis på GIS-kort</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================== ROLLE 1: BEBOER & NABO ======================== */}
      {role === 'resident' && (
        <div className="max-w-[1360px] mx-auto space-y-6">
          {/* ADRESSE- & BLOKVÆLGER + HURTIG VINDSIMULERING */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-[#111827] border border-[#334155] rounded-lg p-4">
            <div className="lg:col-span-7 space-y-3">
              <label
                htmlFor="resident-block-search"
                className="block text-xs font-semibold text-slate-200"
              >
                Vælg din boligblok, opgang eller nabo-adresse i Ringparken (lokal søgning uden DAWA)
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="resident-block-search"
                    type="text"
                    value={residentSearchQuery}
                    onChange={(e) => setResidentSearchQuery(e.target.value)}
                    placeholder="Søg vejnavn eller blok (f.eks. Kierulffsvej 26, Albert Ibsens Vej 16, Blok 9)..."
                    className="w-full pl-9 pr-3 py-2 rounded-md bg-[#0B0F19] border border-[#334155] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <select
                  aria-label="Vælg boligblok eller adresse"
                  value={selectedResidentBuilding.id}
                  onChange={(e) => setSelectedResidentId(e.target.value)}
                  className="sm:w-[320px] px-3 py-2 rounded-md bg-[#0B0F19] border border-[#334155] text-xs text-slate-100 focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  {filteredResidentBuildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.canonicalAddresses[0]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>Valgt: {selectedResidentBuilding.name}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedResidentBuilding.fobDepartment}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedResidentBuilding.stage}</span>
                {selectedResidentBuilding.fobBlockNumber !== null &&
                  selectedResidentBuilding.fobBlockNumber !==
                    selectedResidentBuilding.dmaBlockNumber && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-300 font-medium">
                        FOB/DMA-afvigelse: FOB Blok {selectedResidentBuilding.fobBlockNumber}
                        {selectedResidentBuilding.dmaBlockNumber !== null
                          ? ` ≠ DMA Blok ${selectedResidentBuilding.dmaBlockNumber}`
                          : ' (udeladt i DMA-oversigt)'}
                      </span>
                    </>
                  )}
              </div>
            </div>

            <div className="lg:col-span-5 lg:border-l lg:border-[#1E293B] lg:pl-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Test vindeksponering ved din bolig</span>
                </span>
                <span className="font-mono text-cyan-300 tabular-nums">
                  {simWindFromDeg}° · {simWindSpeedMs.toFixed(1)} m/s ·{' '}
                  {simDryWeather ? 'Tørvejr' : 'Regn/Vanding'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={simWindFromDeg}
                  onChange={(e) => setSimWindFromDeg(Number(e.target.value))}
                  aria-label="Vindretning i grader"
                  className="flex-1 min-w-[140px] accent-cyan-400 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setSimWindFromDeg(250)}
                  className="px-2.5 py-1 rounded bg-[#0B0F19] hover:bg-[#1E293B] border border-[#334155] text-[11px] font-mono text-slate-200 cursor-pointer whitespace-nowrap"
                >
                  VSV 250°
                </button>
                <button
                  type="button"
                  onClick={() => setSimDryWeather((v) => !v)}
                  className={`px-2.5 py-1 rounded border text-[11px] font-mono cursor-pointer whitespace-nowrap ${
                    simDryWeather
                      ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                      : 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                  }`}
                >
                  {simDryWeather ? 'Tørvejr' : 'Regn (-60 % støv)'}
                </button>
              </div>
            </div>
          </div>

          {/* RISIKOKORT: (a) AFSTAND, (b) VINDEKSPONERING, (c) BYGNINGSSKALLENS TÆTHED, (d) KÆLDERSTATUS */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* (a) Afstand i meter til nærmeste nedrivning */}
            <div className="bg-[#111827] border border-[#334155] rounded-lg p-4 space-y-2">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>(a) Afstand til nærmeste nedrivning</span>
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-50 tabular-nums">
                {nearestGableDistance.distanceMeters.toLocaleString('da-DK')} m
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Målt til nærmeste aktive nedrivningsgavl:{' '}
                <strong className="text-slate-100">{nearestGableDistance.sourceLabel}</strong>.
              </p>
              {nearestGableDistance.distanceMeters <= 60 && (
                <p className="text-xs text-amber-300 font-medium">
                  Kritisk nærhedszone (&le; 60 m): Høj risiko for direkte støvnedfald og mekanisk impulsstøj.
                </p>
              )}
            </div>

            {/* (b) Aktuel vindeksponering */}
            <div className={`border rounded-lg p-4 space-y-2 ${riskStyle.bg} ${riskStyle.border}`}>
              <div className="text-xs text-slate-300 flex items-center justify-between">
                <span>(b) Aktuel vindeksponering</span>
                <Wind className={`w-4 h-4 shrink-0 ${riskStyle.accent}`} />
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className={`text-2xl font-mono font-bold tabular-nums ${riskStyle.text}`}>
                  {residentExposure.receptorRiskScore}/100
                </span>
                <span className={`text-xs font-mono font-semibold ${riskStyle.accent}`}>
                  {residentExposure.riskLevel}
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-mono tabular-nums">
                Vindretning i læ: {residentExposure.downwindDirectionDeg}° · Vindpåvirkning{' '}
                {(residentExposure.downwindFactor * 100).toFixed(0)} %
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                {residentExposure.recommendationsDa[0]}
              </p>
            </div>

            {/* (c) Bygningsskallens tæthed (COWI fugesvigt % + CAV-undertryk uden tilluft) */}
            <div className="bg-[#111827] border border-[#334155] rounded-lg p-4 space-y-2">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>(c) Bygningsskallens tæthed</span>
                <Building2 className="w-4 h-4 text-orange-400 shrink-0" />
              </div>
              <div className="text-2xl font-mono font-bold text-slate-50 tabular-nums">
                {selectedResidentBuilding.cowiJointFailurePct} % fugesvigt
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                COWI 2021-registrering af nedbrudte facade-/vinduesfuger.{' '}
                {selectedResidentBuilding.hasCavNegativePressure ? (
                  <strong className="text-orange-300">
                    Mekanisk CAV-udsugning skaber undertryk uden balanceret tilluft
                  </strong>
                ) : (
                  <span>Ingen aktiv CAV-udsugningspåvirkning registreret.</span>
                )}
              </p>
              {selectedResidentBuilding.hasCavNegativePressure && (
                <p className="text-xs text-slate-400 leading-relaxed">
                  Undertrykket suger udendørs nedrivningsstøv og kælderasbest ind gennem utætte fuger og brevsprækker.
                </p>
              )}
            </div>

            {/* (d) Kælderstatus */}
            <div
              className={`border rounded-lg p-4 space-y-2 ${
                selectedResidentBuilding.hasBasementAsbestosDust
                  ? 'bg-rose-950/35 border-rose-500/70'
                  : 'bg-[#111827] border-[#334155]'
              }`}
            >
              <div className="text-xs text-slate-300 flex items-center justify-between">
                <span>(d) Kælderstatus &amp; Asbeststøv</span>
                {selectedResidentBuilding.hasBasementAsbestosDust ? (
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
              </div>
              <div className="text-base font-bold text-slate-50">
                {selectedResidentBuilding.hasBasementAsbestosDust
                  ? 'Advarsel: Asbestfibre påvist i kælderstøv'
                  : 'Ingen påvist asbeststøv i denne bygnings kælder'}
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {selectedResidentBuilding.hasBasementAsbestosDust ? (
                  <>
                    Tilsluttes de <strong>{ELEVATED_ASBESTOS_BASEMENT_BLOCKS_COUNT} blokke</strong> med
                    påviste <strong>Amosit- / Chrysotil-asbestfibre</strong> i DMA&rsquo;s geltapeprøver (
                    {residentAsbestosDustSamples.length > 0
                      ? residentAsbestosDustSamples
                          .map((x) => `${x.sample.id} (${x.sample.dustIntensity})`)
                          .join(', ')
                      : 'dokumenteret i DMA Maj 2025'}
                    ). <strong>Undgå ophold i kælderrum indtil dokumenteret sanering og frikontrol.</strong>
                  </>
                ) : (
                  <>
                    Bemærk fortsat at <strong>{ELEVATED_ASBESTOS_BASEMENT_BLOCKS_COUNT} andre blokke</strong> i
                    Ringparken har påviste Amosit-/Chrysotil-asbestfibre i kælderstøvet og bør undgås uden
                    sanering.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* (e) KONKRETE INDEKLIMA-ANBEFALINGER, PCB-AKTIONSVÆRDIER, SKIMMEL & TRYGGE SKOLEVEJE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Indeklima: PCB + Skimmel */}
            <div className="lg:col-span-7 bg-[#111827] border border-[#334155] rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1E293B]">
                <h2 className="text-sm font-semibold text-slate-100">
                  (e) Konkrete indeklima-anbefalinger: PCB, Skimmel &amp; Støvkontrol
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  Sundhedsstyrelsen · Mycometer
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1.5">
                  <div className="font-semibold text-amber-200">
                    Sundhedsstyrelsens PCB-aktionsværdier i indeluft
                  </div>
                  <p className="text-slate-300 font-mono tabular-nums">
                    Nedre aktionsværdi: <strong>{BEK_613_2026_LIMITS.pcbActionNgPerM3} ng/m³</strong> · Øvre:{' '}
                    <strong>{BEK_613_2026_LIMITS.pcbLimitNgPerM3.toLocaleString('da-DK')} ng/m³</strong>
                  </p>
                  <p className="text-slate-400">
                    Ved 300–3.000 ng/m³ kræves udvidet kildesporing og øget rengøring/udluftning; over 3.000
                    ng/m³ vurderes indeklimaet sundhedsmæssigt uacceptabelt og kræver straksindgreb. I Blok 8
                    er målt op til 28.000 mg/kg PCB i altandækmaling.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-cyan-200">
                    Skimmelopmærksomhed (Mycometer Kategori C)
                  </div>
                  <p className="text-slate-300 font-mono tabular-nums">
                    <strong>42 %</strong> af udtagne stikprøver lå i Kategori C (<strong>&gt; 450 FLU</strong>)
                  </p>
                  <p className="text-slate-400">
                    Høje skimmelfund (bl.a. 720 FLU i Kierulffsvej 64, 2.th samt oversvømmede kældre i
                    Bygning 1 &amp; 2) kræver målrettet fugtstyring: udluft kortvarigt (5–10 min. gennemtræk)
                    når nedrivningen holder pause eller vinden blæser væk fra blokken, og hold friskluftventiler
                    mod aktiv nedrivning lukket i tørt, blæsende vejr.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#1E293B] space-y-1.5 text-xs">
                <div className="font-semibold text-slate-200">
                  Praktiske råd til beboere i de {blocksWithBasementAsbestos.length} berørte kældre/blokke
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  <li>
                    Undgå ophold i uopryddede kælderrum og lad ikke kælderdøre stå åbne ud til hovedtrapper
                    (CAV-undertryk trækker kælderluft op i lejlighederne).
                  </li>
                  <li>
                    Tør vindueskarme og overflader af med fugtig engangsklud (brug ikke almindelig
                    husholdningsstøvsuger uden HEPA-filter til mistænkeligt kælderstøv).
                  </li>
                  <li>
                    Kontakt ejendomsfunktionær eller Slagelse Kommune Miljø, hvis byggearbejde giver synlig
                    støvfane mod facaden trods tørt vejr.
                  </li>
                </ul>
              </div>
            </div>

            {/* Trygge skoleveje */}
            <div className="lg:col-span-5 bg-[#111827] border border-[#334155] rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1E293B]">
                <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                  <Route className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Trygge skoleveje (Marievangsskolen &amp; Nymarkskolen)</span>
                </h2>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                <div className="p-3 rounded bg-rose-950/30 border border-rose-500/45 text-rose-100">
                  <strong>Afspærret sti mod Ndr. Ringgade:</strong> Stien på indersiden af trærækken langs
                  Ndr. Ringgade nedlægges og afspærres under nedrivningen (Situationsplan 14.11.2025). Færdsel
                  gennem Nedrivningsfelt Vest (Kierulffsvej 2/12 &amp; Valbyvej 58) er strengt forbudt.
                </div>

                <div>
                  <strong className="text-emerald-300 block">
                    Rute mod Marievangsskolen (sydøstlig retning):
                  </strong>
                  <span>
                    Benyt de sydlige gårdrum eller fortov øst for Blok 2 (Kierulffsvej 24) ned mod Valbyvej
                    uden om afspærringshegnet ved Blok 1 (Kierulffsvej 14–22).
                  </span>
                </div>

                <div>
                  <strong className="text-cyan-300 block">
                    Rute mod Nymarkskolen (østlig / nordøstlig retning):
                  </strong>
                  <span>
                    Gå østpå via Albert Ibsens Vej / Rosenkildevej eller fortovet på ydersiden af Ndr. Ringgade
                    væk fra tung entreprenørkørsel ved Kierulffsvej 12 og Nordcentret.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================== ROLLE 2: ARBEJDER & AMK ======================== */}
      {role === 'worker' && (
        <div className="max-w-[1360px] mx-auto space-y-6">
          {/* BYGNING & MATERIALE-FILTER */}
          <div className="bg-[#111827] border border-[#334155] rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-6 space-y-1.5">
                <label
                  htmlFor="worker-building-select"
                  className="block text-xs font-semibold text-slate-200"
                >
                  Vælg bygning / nedrivningsfelt for arbejdsplads-tjekliste
                </label>
                <select
                  id="worker-building-select"
                  value={selectedWorkerBuilding.id}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[#0B0F19] border border-[#334155] text-xs text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  {RINGPARKEN_BUILDINGS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.stage}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-6 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="text-slate-300">
                  <span>Højeste affaldsklasse: </span>
                  <strong
                    className={
                      workerComplianceSummary.highestWasteClass === 'Farligt affald'
                        ? 'text-rose-300'
                        : workerComplianceSummary.highestWasteClass === 'Forurenet affald'
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }
                  >
                    {workerComplianceSummary.highestWasteClass}
                  </strong>
                  <span aria-hidden="true"> · </span>
                  <span>
                    {workerComplianceSummary.hazardousSampleCount}/{workerComplianceSummary.sampleCount}{' '}
                    farlige prøver
                  </span>
                </div>
                <button
                  type="button"
                  onClick={resetBuildingChecklist}
                  className="px-2.5 py-1.5 rounded bg-[#0B0F19] hover:bg-[#1E293B] border border-[#334155] text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Nulstil tjekliste ({completedCount}/{workerChecklistItems.length})</span>
                </button>
              </div>
            </div>

            {/* Materialefilter-faner */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#1E293B]">
              {(
                [
                  { id: 'ALL', label: 'Alle materialekrav' },
                  { id: 'ASBEST', label: 'Asbest (BEK 1328/2025)' },
                  { id: 'PCB_SCCP', label: 'PCB & SCCP (>2.500)' },
                  { id: 'BLY', label: 'Bly (0,03 mg/m³ 2026)' },
                  { id: 'MINERALULD', label: 'Mineraluld <1997' },
                  { id: 'SKIMMEL', label: 'Skimmel (Bygn. 1 & 2)' },
                  { id: 'KRYBEKAELDER', label: 'Blok 1 Krybekælder' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedMaterialFocus(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                    selectedMaterialFocus === tab.id
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'bg-[#0B0F19] border border-[#334155] text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* VENSTRE 7 KOLONNER: INTERAKTIV TJEKLISTE + PRØVER FRA RISKENGINE */}
            <div className="xl:col-span-7 space-y-4">
              <div className="bg-[#111827] border border-[#334155] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1E293B]">
                  <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Interaktiv sikkerhedstjekliste: {selectedWorkerBuilding.name}
                    </span>
                  </h2>
                  <span className="text-xs font-mono text-cyan-300 tabular-nums">
                    {completedCount}/{workerChecklistItems.length} kvitteret
                  </span>
                </div>

                {workerChecklistItems.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">
                    Ingen særlige lovpligtige punkter i den valgte materialekategori for denne bygning.
                  </p>
                ) : (
                  <div className="divide-y divide-[#1E293B]">
                    {workerChecklistItems.map((item) => {
                      const checked = Boolean(currentBuildingChecks[item.id]);
                      return (
                        <label
                          key={item.id}
                          className="flex items-start gap-3 py-3 cursor-pointer hover:bg-[#0B0F19]/40 px-2 rounded transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleChecklistItem(item.id)}
                            className="mt-1 w-4 h-4 accent-amber-400 cursor-pointer shrink-0"
                          />
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                              <span
                                className={
                                  item.critical
                                    ? 'text-rose-300 font-semibold'
                                    : 'text-amber-300 font-semibold'
                                }
                              >
                                {item.category}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{item.statutoryRef}</span>
                            </div>
                            <div
                              className={`text-xs font-semibold ${
                                checked ? 'line-through text-slate-400' : 'text-slate-100'
                              }`}
                            >
                              {item.titleDa}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {item.detailDa}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Materialeprøver på bygningen (beregnet i utils/riskEngine.ts) */}
              <div className="bg-[#111827] border border-[#334155] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
                  <h3 className="text-sm font-semibold text-slate-100">
                    Tilknyttede miljøprøver &amp; HP14-klassificering ({workerBuildingSamples.length})
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    Deterministisk riskEngine.ts
                  </span>
                </div>

                {workerBuildingSamples.length === 0 ? (
                  <div className="text-xs text-slate-400 flex items-center gap-2 py-2">
                    <Info className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>
                      Ingen individuelle laboratorieprøver tilknyttet denne adresse i datasættet.
                    </span>
                  </div>
                ) : (
                  <div className="divide-y divide-[#1E293B]">
                    {workerBuildingSamples.map(({ sample, classification }) => (
                      <div key={sample.id} className="py-2.5 space-y-1 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                          <span className="font-bold text-slate-100">
                            {sample.id} · {sample.reportSource} · {sample.locationDetail}
                          </span>
                          <span
                            className={
                              classification.wasteClass === 'Farligt affald'
                                ? 'text-rose-300 font-semibold'
                                : classification.wasteClass === 'Forurenet affald'
                                ? 'text-amber-300 font-semibold'
                                : 'text-emerald-300 font-semibold'
                            }
                          >
                            {classification.wasteClass} · EAK {classification.eakCode}
                          </span>
                        </div>
                        <div className="text-slate-300">{sample.material}</div>
                        <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                          HP14-sum: {classification.hp14SumMgKg.toLocaleString('da-DK')} mg/kg
                          {classification.upgradedByHp14 ? ' (Opklassificeret via HP14)' : ''} ·
                          Overskridelsesfaktor: {classification.exceedanceRatio.toLocaleString('da-DK')}x
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* HØJRE 5 KOLONNER: KORRIGERET & VERIFICERET BEREDSKABSKORT FOR KIERULFFSVEJ 12 */}
            <aside className="xl:col-span-5 bg-[#111827] border border-[#334155] rounded-lg p-4 space-y-4">
              <div className="pb-2.5 border-b border-[#1E293B] space-y-1">
                <div className="text-xs font-mono text-amber-300 font-semibold">
                  Korrigeret beredskabsoversigt (erstatter fejloverskrift i Bilag 7)
                </div>
                <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Beredskabskort: Kierulffsvej 12, 4200 Slagelse</span>
                </h2>
              </div>

              <div className="divide-y divide-[#1E293B]">
                {VERIFIED_KIERULFFSVEJ_12_CONTACTS.map((entry) => (
                  <div
                    key={entry.id}
                    className="py-2.5 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-semibold text-slate-100">
                        {entry.roleTitle}
                      </div>
                      <div className="text-slate-300">{entry.personOrOrg}</div>
                      <div className="text-[11px] text-slate-400">
                        {entry.addressOrBasis}
                        {entry.email ? ` · ${entry.email}` : ''}
                      </div>
                    </div>

                    <div className="text-right font-mono shrink-0 tabular-nums space-y-0.5">
                      <a
                        href={`tel:${entry.phonePrimary.replace(/\s+/g, '')}`}
                        className={`inline-block font-bold hover:underline ${
                          entry.priority === 'P1'
                            ? 'text-rose-300 text-sm'
                            : entry.priority === 'AMK'
                            ? 'text-amber-300'
                            : 'text-cyan-300'
                        }`}
                      >
                        {entry.phonePrimary}
                      </a>
                      {entry.phoneSecondary && (
                        <div>
                          <a
                            href={`tel:${entry.phoneSecondary.replace(/\s+/g, '')}`}
                            className="text-cyan-300 font-semibold hover:underline"
                          >
                            {entry.phoneSecondary}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      )}
    </section>
  );
};

export default RoleDashboard;
