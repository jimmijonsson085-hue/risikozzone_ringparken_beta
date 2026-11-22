import { GoogleGenAI, Type } from '@google/genai';
import { getSamplesForBuilding } from '../constants/ringparkenData';
import { RingparkenBuilding } from '../types';
import {
  WorkHoursComplianceResult,
  checkWorkHoursCompliance,
  classifyMaterialSample,
} from '../utils/riskEngine';

export const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
export const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash';

export type SiteObservationSeverity =
  | 'KRITISK'
  | 'HØJ'
  | 'MODERAT'
  | 'LAV'
  | 'UFULDSTÆNDIG_DOKUMENTATION';

export type SiteObservationAuthority =
  | 'Arbejdstilsynet (Tilsynscenter Øst)'
  | 'Slagelse Kommune (Teknik & Miljø)'
  | 'Naturstyrelsen (Flagermus § 29 a)'
  | 'Slagelse Politi / Beredskab 112';

export interface PotentiallyViolatedRule {
  lawOrPermitRef: string;
  explanation: string;
}

export interface SiteObservationAnalysisParams {
  description: string;
  selectedBuilding?: RingparkenBuilding;
  observedTimestamp: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface SiteObservationAnalysisResult {
  severity: SiteObservationSeverity;
  visualFindings: string[];
  potentiallyViolatedRules: PotentiallyViolatedRule[];
  immediateSafetyAdvice: string[];
  relevantAuthority: SiteObservationAuthority;
  formalInquiryDraft: string;
  usedModel: string;
  analyzedAtIso: string;
  workHoursCompliance: WorkHoursComplianceResult;
  buildingSampleSummary: string;
}

interface RawGeminiObservationPayload {
  severity: SiteObservationSeverity;
  visualFindings: string[];
  potentiallyViolatedRules: PotentiallyViolatedRule[];
  immediateSafetyAdvice: string[];
  relevantAuthority: SiteObservationAuthority;
  formalInquiryDraft: string;
}

const VALID_SEVERITIES: ReadonlySet<SiteObservationSeverity> = new Set([
  'KRITISK',
  'HØJ',
  'MODERAT',
  'LAV',
  'UFULDSTÆNDIG_DOKUMENTATION',
]);

const VALID_AUTHORITIES: ReadonlySet<SiteObservationAuthority> = new Set([
  'Arbejdstilsynet (Tilsynscenter Øst)',
  'Slagelse Kommune (Teknik & Miljø)',
  'Naturstyrelsen (Flagermus § 29 a)',
  'Slagelse Politi / Beredskab 112',
]);

function resolveClientApiKey(): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const key = process.env.API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') return undefined;
  return key;
}

function shouldUseBackendProxy(clientApiKey: string | undefined): boolean {
  const envProxy = import.meta.env.VITE_USE_BACKEND_PROXY === 'true';
  return envProxy || !clientApiKey;
}

function stripBase64DataUrlPrefix(rawBase64: string): {
  base64Data: string;
  detectedMimeType?: string;
} {
  const trimmed = rawBase64.trim();
  const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    return {
      detectedMimeType: dataUrlMatch[1],
      base64Data: dataUrlMatch[2],
    };
  }
  return { base64Data: trimmed };
}

function summarizeBuildingSamples(building?: RingparkenBuilding): string {
  if (!building) {
    return 'Ingen specifik bygning valgt — vurdering dækker samlet byggeplads i Ringparken, 4200 Slagelse (Sager: 25-019352, 25-019350, 25-019157, 25-019354).';
  }

  const samples = getSamplesForBuilding(building.id);
  const blockMismatch =
    building.fobBlockNumber !== null &&
    building.dmaBlockNumber !== null &&
    building.fobBlockNumber !== building.dmaBlockNumber
      ? ` BEMÆRK BLOK-NUMMERAFVIGELSE: FOB Blok ${building.fobBlockNumber} svarer til DMA Blok ${building.dmaBlockNumber}.`
      : '';

  const sampleLines =
    samples.length === 0
      ? [
          'Ingen direkte materialeprøver knyttet til denne matrikel i registeret; vurder generelle naboforhold og vindspredning.',
        ]
      : samples.map((s) => {
          const classified = classifyMaterialSample(s);
          const c = s.concentrationsMgKg;
          const measurements: string[] = [];
          if (s.asbestosDetected) {
            measurements.push(
              `Asbest (${s.asbestosTypes.join('/') || 'ukendt'}, støv=${s.dustIntensity})`
            );
          }
          if (c.PCB !== undefined) measurements.push(`PCB=${c.PCB} mg/kg`);
          if (c.PB !== undefined) measurements.push(`Bly=${c.PB} mg/kg`);
          if (c.SCCP_MCCP !== undefined) {
            measurements.push(`SCCP/MCCP=${c.SCCP_MCCP} mg/kg`);
          }
          if (c.PAH !== undefined) measurements.push(`PAH=${c.PAH} mg/kg`);
          if (c.ZN !== undefined) measurements.push(`Zink=${c.ZN} mg/kg`);
          if (classified.hp14SumMgKg > 0) {
            measurements.push(`HP14-sum=${classified.hp14SumMgKg} mg/kg`);
          }
          return `- [${s.id} · ${s.reportSource}] ${s.locationDetail} (${s.material}): ${classified.wasteClass} (EAK ${classified.eakCode}) · ${measurements.join(', ') || 'Øvrige parametre'}`;
        });

  return [
    `Bygning: ${building.name}`,
    `Adresser: ${building.canonicalAddresses.join('; ')}${blockMismatch}`,
    `Projektetape: ${building.stage} · Areal: ${building.areaM2 ?? 'Ikke oplyst'} m² · BEK 496/2024 selektiv nedrivningsplan påkrævet: ${building.requiresSelectiveDemolitionPlan ? 'JA' : 'NEJ'}`,
    `Sag / Tilladelse: ${building.permitCaseNumber ?? 'Ingen selvstændig nedrivningstilladelse (nabo/etape)'}`,
    `Kælder & Bygningsfysik: ${building.basementType}, asbeststøv i kælder=${building.hasBasementAsbestosDust ? 'JA' : 'NEJ'}, COWI fugesvigt=${building.cowiJointFailurePct} %, CAV-undertryk uden tilluft=${building.hasCavNegativePressure ? 'JA' : 'NEJ'}`,
    `Hydrologi & jordbund: ${building.hydrologyNote ?? 'Moræneler med terrænnært vintergrundvand (0,8–2,1 m) og Lokalplan 1269 krav om maks. 2,0 l/s/ha regnvandsafledning.'}`,
    `Verificerede laboratorieprøver (${samples.length} stk.):`,
    ...sampleLines,
  ].join('\n');
}

const OBSERVATION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    severity: {
      type: Type.STRING,
      enum: [
        'KRITISK',
        'HØJ',
        'MODERAT',
        'LAV',
        'UFULDSTÆNDIG_DOKUMENTATION',
      ],
      description:
        'Samlet risikovurdering. Brug UFULDSTÆNDIG_DOKUMENTATION hvis tekst eller foto er uklart/utydeligt til sikker klassificering.',
    },
    visualFindings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Konkrete observationer fra foto og beskrivelse på dansk. Hvis fotoet er sløret, mørkt eller tvetydigt, skal dette oplyses ærligt uden gæt.',
    },
    potentiallyViolatedRules: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          lawOrPermitRef: {
            type: Type.STRING,
            description:
              'Præcis lov-, bekendtgørelses- eller vilkårsreference, fx BEK 1328/2025 § 14-15, BEK 496/2024 selektiv nedrivning, Nedrivningstilladelse 25-019352 støvvilkår, Naturbeskyttelseslovens § 29 a, Jordforureningslovens § 71 eller PSS fast hegn > 2 m / 80 dB.',
          },
          explanation: {
            type: Type.STRING,
            description: 'Kort, saglig begrundelse for hvorfor reglen kan være overtrådt.',
          },
        },
        required: ['lawOrPermitRef', 'explanation'],
      },
    },
    immediateSafetyAdvice: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Konkrete afstands-, luknings- eller eksponeringsråd til beboere/forbipasserende på stedet (uden at stille medicinske diagnoser).',
    },
    relevantAuthority: {
      type: Type.STRING,
      enum: [
        'Arbejdstilsynet (Tilsynscenter Øst)',
        'Slagelse Kommune (Teknik & Miljø)',
        'Naturstyrelsen (Flagermus § 29 a)',
        'Slagelse Politi / Beredskab 112',
      ],
      description: 'Primær kompetent tilsyns- eller beredskabsmyndighed.',
    },
    formalInquiryDraft: {
      type: Type.STRING,
      description:
        'Kopiérbart, sagligt henvendelses- eller aktindsigtsudkast på dansk med dato/tidspunkt, adresse, sagsnummer, observerede forhold og præcise spørgsmål til myndigheden.',
    },
  },
  required: [
    'severity',
    'visualFindings',
    'potentiallyViolatedRules',
    'immediateSafetyAdvice',
    'relevantAuthority',
    'formalInquiryDraft',
  ],
};

function sanitizeObservationResult(
  raw: Partial<RawGeminiObservationPayload>
): RawGeminiObservationPayload {
  const severity: SiteObservationSeverity = VALID_SEVERITIES.has(
    raw.severity as SiteObservationSeverity
  )
    ? (raw.severity as SiteObservationSeverity)
    : 'UFULDSTÆNDIG_DOKUMENTATION';

  const relevantAuthority: SiteObservationAuthority = VALID_AUTHORITIES.has(
    raw.relevantAuthority as SiteObservationAuthority
  )
    ? (raw.relevantAuthority as SiteObservationAuthority)
    : 'Slagelse Kommune (Teknik & Miljø)';

  const visualFindings = Array.isArray(raw.visualFindings)
    ? raw.visualFindings.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const potentiallyViolatedRules = Array.isArray(raw.potentiallyViolatedRules)
    ? raw.potentiallyViolatedRules
        .filter((r) => r && (r.lawOrPermitRef || r.explanation))
        .map((r) => ({
          lawOrPermitRef: String(r.lawOrPermitRef || 'Generelt myndighedsvilkår').trim(),
          explanation: String(r.explanation || '').trim(),
        }))
    : [];

  const immediateSafetyAdvice = Array.isArray(raw.immediateSafetyAdvice)
    ? raw.immediateSafetyAdvice.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const formalInquiryDraft =
    typeof raw.formalInquiryDraft === 'string' && raw.formalInquiryDraft.trim()
      ? raw.formalInquiryDraft.trim()
      : 'Udkast kunne ikke dannes fuldstændigt fra den modtagne analyse.';

  return {
    severity,
    visualFindings:
      visualFindings.length > 0
        ? visualFindings
        : ['Dokumentationen indeholder ikke entydige visuelle detaljer.'],
    potentiallyViolatedRules,
    immediateSafetyAdvice:
      immediateSafetyAdvice.length > 0
        ? immediateSafetyAdvice
        : [
            'Hold sikkerhedsafstand uden for afspærringen og undgå ophold i direkte støv- eller vindretning.',
          ],
    relevantAuthority,
    formalInquiryDraft,
  };
}

export async function analyzeSiteObservation(
  params: SiteObservationAnalysisParams
): Promise<SiteObservationAnalysisResult> {
  const description = params.description.trim();
  if (!description && !params.imageBase64) {
    throw new Error(
      'Indtast en beskrivelse af observationen eller vedhæft et foto fra pladsen.'
    );
  }

  const parsedObservedDate = new Date(params.observedTimestamp);
  const validDate = Number.isNaN(parsedObservedDate.getTime())
    ? new Date()
    : parsedObservedDate;

  const workHoursCompliance = checkWorkHoursCompliance(validDate, {
    timeZone: 'Europe/Copenhagen',
  });

  const buildingSampleSummary = summarizeBuildingSamples(params.selectedBuilding);
  const observedTimeFormatted = validDate.toLocaleString('da-DK', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Copenhagen',
  });

  const promptText = [
    'OPGAVE: Foretag en saglig, evidensbaseret dansk miljø-, arbejdsmiljø- og byggeplads-complianceanalyse af følgende observation fra Ringparken, 4200 Slagelse.',
    '',
    '1. OBSERVATIONSTIDSPUNKT & ARBEJDSTIDSVURDERING:',
    `- Tidspunkt: ${observedTimeFormatted} (ISO: ${validDate.toISOString()})`,
    `- Arbejdstidsstatus jf. Slagelse Kommunes forskrift (Ma-Fr 07-18 / maks 70 dB(A), Lø 07-14 / maks 64 dB(A), Søn- og helligdage forbudt): ${workHoursCompliance.statusLabelDa}`,
    `- Direktiv: ${workHoursCompliance.directiveDa}`,
    '',
    '2. AKTIVE SLAGELSE KOMMUNE SAGSNUMRE & RELEVANTE REGLER:',
    '- Nedrivningssager: 25-019352 (Kierulffsvej 12 / Bygning 2), 25-019350 (Blok 1 / Kierulffsvej 14-22), 25-019157 (Kierulffsvej 2 / Bygning 1), 25-019354 (Valbyvej 58 / Bygning 3).',
    '- Gældende regler: BEK nr. 1328/2025 (autoriseret asbestarbejde, luftgrænse 0,003 fibre/cm³, 3-kammer sluse, undertryk, forbud mod højtryksspuling pr. 01.07.2026), BEK nr. 613/2026 (skærpet blygrænse 0,03 mg Pb/m³ pr. 01.07.2026), BEK nr. 1399/2021 (mineraluld <1997 som farligt affald), BEK nr. 496/2024 (obligatorisk selektiv nedrivning & standardiseret nedrivningsplan > 250 m²), Naturbeskyttelseslovens § 29 a (flagermus/Bilag IV), Lokalplan 1269 (bevaringsværdige træer & maks. 2,0 l/s/ha regnvandsafledning), Jordforureningslovens § 71, samt PSS W22085 (fast hegn ved udgravning > 2 m, 80 dB intern støjgrænse).',
    '',
    '3. BYGNINGS- & PRØVEKONTEKST:',
    buildingSampleSummary,
    '',
    '4. BORGERENS / TILSYNSOBSERVATIONENS BESKRIVELSE:',
    description || '(Ingen supplerende tekst — analysér udelukkende vedhæftede billede og kontekst.)',
    '',
    '5. SÆRLIGE VURDERINGSKRAV (SKAL ALTID VURDERES):',
    'a) ÆRLIG BILLEDVURDERING: Hvis der er vedhæftet et foto, og billedet er sløret, mørkt, taget på lang afstand eller tvetydigt, SKAL du oplyse dette åbent i visualFindings og ikke gætte på skjulte detaljer. Brug severity="UFULDSTÆNDIG_DOKUMENTATION", hvis grundlaget er utilstrækkeligt.',
    'b) SPREDNING AF USANERET AFFALD (BEK 496/2024): Vurder risikoen for spredning af usaneret farligt byggeaffald (asbest, PCB, bly, <1997 mineraluld) under selektiv nedrivning.',
    'c) REGNVANDS- & GRUNDVANDSUDVASKNING: Vurder risikoen for udvaskning/perkolation til regnvandsafledning og terrænnært grundvand (moræneler, vintergrundvand 0,8-2,1 m, lavning ved Kierulffsvej 12, Lokalplan 1269 maks. 2,0 l/s/ha) fra uafdækkede affaldsoplag eller åbne udgravninger i regnvejr.',
    'd) SIKKERHEDSRÅD UDEN DIAGNOSE: Giv konkrete afstands-, opholds- og lukningsråd uden at stille medicinske diagnoser.',
    'e) HENVENDELSESUDKAST: Skriv et præcist, høfligt men fast dansk tilsyns-/aktindsigtsudkast i formalInquiryDraft med dato, adresse, relevante sagsnumre og konkrete kontrolspørgsmål.',
  ].join('\n');

  const parts: Array<
    | { inlineData: { data: string; mimeType: string } }
    | { text: string }
  > = [];

  if (params.imageBase64) {
    const { base64Data, detectedMimeType } = stripBase64DataUrlPrefix(
      params.imageBase64
    );
    if (base64Data) {
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: params.imageMimeType || detectedMimeType || 'image/jpeg',
        },
      });
    }
  }
  parts.push({ text: promptText });

  const contents = [{ role: 'user', parts }];
  const config = {
    responseMimeType: 'application/json',
    temperature: 0.2,
    systemInstruction:
      'Du er specialist i dansk miljøret, arbejdsmiljø (BEK 1328/2025, BEK 613/2026), selektiv nedrivning (BEK 496/2024) og hydrogeologi. Svar UDELUKKENDE med gyldig JSON, der følger det angivne schema. Vær nøgtern, faktuel og gennemsigtig om enhver usikkerhed i fotodokumentationen.',
    responseSchema: OBSERVATION_RESPONSE_SCHEMA,
  };

  let rawText = '';
  let usedModel = PRIMARY_GEMINI_MODEL;

  const clientApiKey = resolveClientApiKey();

  try {
    if (shouldUseBackendProxy(clientApiKey)) {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: PRIMARY_GEMINI_MODEL,
          contents,
          config,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : `Serveren returnerede HTTP ${response.status} under Gemini-analyse.`
        );
      }
      rawText = typeof payload?.text === 'string' ? payload.text : '';
      usedModel =
        typeof payload?.usedModel === 'string'
          ? payload.usedModel
          : PRIMARY_GEMINI_MODEL;
    } else {
      const ai = new GoogleGenAI({ apiKey: clientApiKey! });
      try {
        const res = await ai.models.generateContent({
          model: PRIMARY_GEMINI_MODEL,
          contents,
          config,
        });
        rawText = res.text ?? '';
        usedModel = PRIMARY_GEMINI_MODEL;
      } catch (_primaryErr) {
        const fallbackRes = await ai.models.generateContent({
          model: FALLBACK_GEMINI_MODEL,
          contents,
          config,
        });
        rawText = fallbackRes.text ?? '';
        usedModel = FALLBACK_GEMINI_MODEL;
      }
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Ukendt netværks- eller API-fejl.';
    throw new Error(`Kunne ikke gennemføre observationanalyse: ${message}`);
  }

  if (!rawText.trim()) {
    throw new Error('Gemini returnerede et tomt svar uden JSON-analyse.');
  }

  let parsedJson: Partial<RawGeminiObservationPayload>;
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    parsedJson = JSON.parse(cleaned) as Partial<RawGeminiObservationPayload>;
  } catch (_parseErr) {
    throw new Error(
      'Svaret fra analysemodellen kunne ikke fortolkes som gyldig JSON.'
    );
  }

  const sanitized = sanitizeObservationResult(parsedJson);

  return {
    ...sanitized,
    usedModel,
    analyzedAtIso: new Date().toISOString(),
    workHoursCompliance,
    buildingSampleSummary,
  };
}
