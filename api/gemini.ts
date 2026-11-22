import { GoogleGenAI, Type } from '@google/genai';

const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB maks. fotostørrelse
const MAX_REQUEST_BODY_BYTES = 12 * 1024 * 1024; // 12 MB total JSON-loftsgrænse (inkl. base64-overhead)

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

// Basal sliding/fixed-window rate-limiting pr. IP-adresse
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const MAX_RATE_LIMIT_BUCKETS = 2000;

interface RateLimitBucket {
  count: number;
  resetAtMs: number;
}

const ipRateLimitStore = new Map<string, RateLimitBucket>();

export const SITE_OBSERVATION_RESPONSE_SCHEMA = {
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
            description:
              'Kort, saglig begrundelse for hvorfor reglen kan være overtrådt.',
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

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(extraHeaders ?? {}),
    },
  });
}

function extractClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp =
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-client-ip');
  return realIp?.trim() || 'unknown';
}

function checkIpRateLimit(
  ip: string,
  nowMs = Date.now()
): { allowed: boolean; retryAfterSec: number } {
  if (ipRateLimitStore.size > MAX_RATE_LIMIT_BUCKETS) {
    for (const [key, bucket] of ipRateLimitStore.entries()) {
      if (bucket.resetAtMs <= nowMs) {
        ipRateLimitStore.delete(key);
      }
    }
    if (ipRateLimitStore.size > MAX_RATE_LIMIT_BUCKETS) {
      ipRateLimitStore.clear();
    }
  }

  const existing = ipRateLimitStore.get(ip);
  if (!existing || existing.resetAtMs <= nowMs) {
    ipRateLimitStore.set(ip, {
      count: 1,
      resetAtMs: nowMs + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((existing.resetAtMs - nowMs) / 1000)
    );
    return { allowed: false, retryAfterSec };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function resetRateLimiterForTests(): void {
  ipRateLimitStore.clear();
}

function resolveServerGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stripDataUrlPrefix(raw: string): {
  base64Data: string;
  detectedMimeType?: string;
} {
  const trimmed = raw.trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/i);
  if (match) {
    return {
      detectedMimeType: match[1].toLowerCase(),
      base64Data: match[2].replace(/\s+/g, ''),
    };
  }
  return { base64Data: trimmed.replace(/\s+/g, '') };
}

function computeDecodedBase64ByteLength(base64Data: string): number {
  const clean = base64Data.replace(/\s+/g, '');
  let padding = 0;
  if (clean.endsWith('==')) padding = 2;
  else if (clean.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function validateImageInlineData(
  rawData: unknown,
  rawMimeType: unknown
): { ok: true; data: string; mimeType: string } | { ok: false; status: number; error: string } {
  if (typeof rawData !== 'string' || !rawData.trim()) {
    return {
      ok: false,
      status: 400,
      error: 'Vedhæftet billeddata mangler eller er ugyldig.',
    };
  }

  const { base64Data, detectedMimeType } = stripDataUrlPrefix(rawData);
  const effectiveMime =
    typeof rawMimeType === 'string' && rawMimeType.trim()
      ? rawMimeType.trim().toLowerCase()
      : detectedMimeType || '';

  if (!ALLOWED_IMAGE_MIME_TYPES.has(effectiveMime)) {
    return {
      ok: false,
      status: 415,
      error:
        'Ikke-understøttet billedformat. Kun image/jpeg, image/png og image/webp er tilladt.',
    };
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data)) {
    return {
      ok: false,
      status: 400,
      error: 'Ugyldig base64-kodning i vedhæftet foto.',
    };
  }

  const byteLength = computeDecodedBase64ByteLength(base64Data);
  if (byteLength <= 0) {
    return {
      ok: false,
      status: 400,
      error: 'Det vedhæftede foto er tomt.',
    };
  }
  if (byteLength > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      status: 413,
      error: 'Det vedhæftede foto overstiger den maksimale grænse på 8 MB.',
    };
  }

  return {
    ok: true,
    data: base64Data,
    mimeType: effectiveMime,
  };
}

interface ParsedRequestPayload {
  contents?: Array<{
    role?: string;
    parts?: Array<{
      text?: string;
      inlineData?: { data?: unknown; mimeType?: unknown };
    }>;
  }>;
  description?: unknown;
  observedTimestamp?: unknown;
  buildingContext?: unknown;
  imageBase64?: unknown;
  imageMimeType?: unknown;
  config?: {
    systemInstruction?: unknown;
    temperature?: unknown;
  };
}

export async function POST(request: Request): Promise<Response> {
  const clientIp = extractClientIp(request);
  const rateCheck = checkIpRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return jsonResponse(
      429,
      {
        error:
          'For mange forespørgsler fra denne IP-adresse. Vent venligst et øjeblik og prøv igen.',
      },
      { 'Retry-After': String(rateCheck.retryAfterSec) }
    );
  }

  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const parsedLength = Number(contentLengthHeader);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_REQUEST_BODY_BYTES) {
      return jsonResponse(413, {
        error: 'Forespørgslen overstiger den maksimale payload-grænse (maks. 8 MB foto).',
      });
    }
  }

  let rawTextBody = '';
  try {
    rawTextBody = await request.text();
  } catch {
    return jsonResponse(400, {
      error: 'Kunne ikke læse forespørgselsdata.',
    });
  }

  if (Buffer.byteLength(rawTextBody, 'utf8') > MAX_REQUEST_BODY_BYTES) {
    return jsonResponse(413, {
      error: 'Forespørgslen overstiger den maksimale payload-grænse (maks. 8 MB foto).',
    });
  }

  let body: ParsedRequestPayload;
  try {
    body = JSON.parse(rawTextBody) as ParsedRequestPayload;
  } catch {
    return jsonResponse(400, {
      error: 'Ugyldig JSON-payload.',
    });
  }

  if (!body || typeof body !== 'object') {
    return jsonResponse(400, {
      error: 'Manglende eller ugyldig forespørgselsobjekt.',
    });
  }

  // Valider enten contents-array eller direkte felt-payload
  const sanitizedParts: Array<
    { inlineData: { data: string; mimeType: string } } | { text: string }
  > = [];

  if (Array.isArray(body.contents) && body.contents.length > 0) {
    const firstTurn = body.contents[0];
    const parts = Array.isArray(firstTurn?.parts) ? firstTurn.parts : [];
    if (parts.length === 0) {
      return jsonResponse(400, {
        error: 'Forespørgslen indeholder ingen indholdsdele.',
      });
    }

    const imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
    const textParts: Array<{ text: string }> = [];

    for (const part of parts) {
      if (part && typeof part === 'object' && part.inlineData) {
        if (imageParts.length >= 1) {
          return jsonResponse(400, {
            error: 'Der kan maksimalt vedhæftes ét foto pr. observation.',
          });
        }
        const validated = validateImageInlineData(
          part.inlineData.data,
          part.inlineData.mimeType
        );
        if (validated.ok === false) {
          return jsonResponse(validated.status, { error: validated.error });
        }
        imageParts.push({
          inlineData: { data: validated.data, mimeType: validated.mimeType },
        });
      } else if (part && typeof part === 'object' && typeof part.text === 'string') {
        const trimmedText = part.text.trim();
        if (trimmedText.length > 40_000) {
          return jsonResponse(413, {
            error: 'Tekstbeskrivelsen er for lang.',
          });
        }
        if (trimmedText) {
          textParts.push({ text: trimmedText });
        }
      }
    }

    if (imageParts.length === 0 && textParts.length === 0) {
      return jsonResponse(400, {
        error: 'Angiv en observationsbeskrivelse eller vedhæft et foto.',
      });
    }

    // Placer billed-part FØR tekst-part (krav til multimodal analyse)
    sanitizedParts.push(...imageParts, ...textParts);
  } else {
    const desc =
      typeof body.description === 'string' ? body.description.trim() : '';
    const hasImage =
      typeof body.imageBase64 === 'string' && body.imageBase64.trim().length > 0;

    if (!desc && !hasImage) {
      return jsonResponse(400, {
        error: 'Manglende observationsbeskrivelse eller foto i forespørgslen.',
      });
    }

    if (hasImage) {
      const validated = validateImageInlineData(
        body.imageBase64,
        body.imageMimeType
      );
      if (validated.ok === false) {
        return jsonResponse(validated.status, { error: validated.error });
      }
      sanitizedParts.push({
        inlineData: { data: validated.data, mimeType: validated.mimeType },
      });
    }

    const timestampStr =
      typeof body.observedTimestamp === 'string' && body.observedTimestamp.trim()
        ? body.observedTimestamp.trim()
        : new Date().toISOString();
    const contextStr =
      typeof body.buildingContext === 'string' ? body.buildingContext.trim() : '';

    const combinedText = [
      `Observationstidspunkt: ${timestampStr}`,
      contextStr ? `Kontekst: ${contextStr}` : '',
      `Observation: ${desc || '(Ingen tekst — analysér vedhæftede foto)'}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    sanitizedParts.push({ text: combinedText });
  }

  const apiKey = resolveServerGeminiApiKey();
  if (!apiKey) {
    return jsonResponse(503, {
      error:
        'GEMINI_API_KEY er ikke konfigureret på serveren. Tilføj nøglen som ren server-secret i produktionsmiljøet.',
    });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemInstruction =
    typeof body.config?.systemInstruction === 'string' &&
    body.config.systemInstruction.trim()
      ? body.config.systemInstruction.trim().slice(0, 4000)
      : 'Du er specialist i dansk miljøret, arbejdsmiljø (BEK 1328/2025, BEK 613/2026), selektiv nedrivning (BEK 496/2024) og hydrogeologi for Ringparken i Slagelse. Svar UDELUKKENDE med gyldig JSON, der følger det angivne schema. Vær nøgtern og gennemsigtig ved uklare eller slørede fotos.';

  const temperature =
    typeof body.config?.temperature === 'number' &&
    body.config.temperature >= 0 &&
    body.config.temperature <= 1
      ? body.config.temperature
      : 0.2;

  const requestConfig = {
    responseMimeType: 'application/json',
    temperature,
    systemInstruction,
    responseSchema: SITE_OBSERVATION_RESPONSE_SCHEMA,
  };

  try {
    let usedModel = PRIMARY_GEMINI_MODEL;
    let responseText = '';

    try {
      const response = await ai.models.generateContent({
        model: PRIMARY_GEMINI_MODEL,
        contents: [{ role: 'user', parts: sanitizedParts }],
        config: requestConfig,
      });
      responseText = response.text ?? '';
    } catch {
      usedModel = FALLBACK_GEMINI_MODEL;
      const fallbackResponse = await ai.models.generateContent({
        model: FALLBACK_GEMINI_MODEL,
        contents: [{ role: 'user', parts: sanitizedParts }],
        config: requestConfig,
      });
      responseText = fallbackResponse.text ?? '';
    }

    if (!responseText.trim()) {
      return jsonResponse(502, {
        error: 'Analysemodellen returnerede et tomt svar.',
      });
    }

    return jsonResponse(200, {
      text: responseText,
      usedModel,
    });
  } catch (err: unknown) {
    // Log kun fejlmeddelelse internt uden at lække stacktraces til klienten
    const internalMessage = err instanceof Error ? err.message : 'Ukendt API-fejl';
    console.error('[api/gemini] Upstream fejl:', internalMessage);
    return jsonResponse(502, {
      error:
        'Der opstod en fejl under kommunikation med analysetjenesten. Prøv igen senere.',
    });
  }
}
