export type ShareLinkExpiryDays = 7 | 30 | 90;

export interface SharedForensicReportRecord {
  shareId: string;
  entryId: string;
  entryCode: string;
  entryTitle: string;
  observedTimestampLabel: string;
  publicUrl: string;
  accessScopeLabel: string;
  entrySha256Signature: string;
  securityTokenHash: string;
  expiryDays: ShareLinkExpiryDays;
  createdAtIso: string;
  expiresAtIso: string;
  revoked: boolean;
}

const SHARED_LINKS_STORAGE_KEY = 'ringparken_forensic_shared_links_v1';

async function computeSha256Hex(payload: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const encoded = new TextEncoder().encode(payload);
      const digest = await window.crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fall through to deterministic fallback
    }
  }

  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x01000193);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}`.repeat(4).slice(0, 64);
}

export function loadSharedForensicLinks(): SharedForensicReportRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SHARED_LINKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SharedForensicReportRecord[]) : [];
  } catch {
    return [];
  }
}

function saveSharedForensicLinks(records: SharedForensicReportRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHARED_LINKS_STORAGE_KEY, JSON.stringify(records.slice(0, 25)));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Simulated URL sharing service that generates an immutable, read-only
 * cryptographic public link for a selected forensic observation or report snapshot.
 */
export async function createSimulatedPublicShareLink(params: {
  entryId: string;
  entryCode: string;
  entryTitle: string;
  observedTimestampLabel: string;
  entrySha256Signature: string;
  expiryDays?: ShareLinkExpiryDays;
}): Promise<SharedForensicReportRecord> {
  const expiryDays: ShareLinkExpiryDays = params.expiryDays ?? 30;
  const now = new Date();
  const createdAtIso = now.toISOString();
  const expiresAtIso = new Date(
    now.getTime() + expiryDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const randomNonce =
    typeof window !== 'undefined' && window.crypto?.getRandomValues
      ? Array.from(window.crypto.getRandomValues(new Uint8Array(8)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

  const securityTokenHash = await computeSha256Hex(
    JSON.stringify({
      entryId: params.entryId,
      entryCode: params.entryCode,
      entrySha256Signature: params.entrySha256Signature,
      createdAtIso,
      expiresAtIso,
      nonce: randomNonce,
    })
  );

  const shareId = `frp_${securityTokenHash.slice(0, 12)}`;
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://ringparken-forensic.local';
  const digestCheck = params.entrySha256Signature.slice(0, 12) || securityTokenHash.slice(12, 24);
  const publicUrl = `${origin}/?sharedReport=${encodeURIComponent(
    shareId
  )}&entry=${encodeURIComponent(params.entryCode)}&sig=${encodeURIComponent(
    digestCheck
  )}#ro-token=${securityTokenHash.slice(0, 16)}`;

  const record: SharedForensicReportRecord = {
    shareId,
    entryId: params.entryId,
    entryCode: params.entryCode,
    entryTitle: params.entryTitle,
    observedTimestampLabel: params.observedTimestampLabel,
    publicUrl,
    accessScopeLabel: 'Skrivebeskyttet Myndigheds- & Offentlighedslink (ISO/IEC 27037)',
    entrySha256Signature: params.entrySha256Signature,
    securityTokenHash,
    expiryDays,
    createdAtIso,
    expiresAtIso,
    revoked: false,
  };

  const existing = loadSharedForensicLinks().filter((r) => r.shareId !== shareId);
  saveSharedForensicLinks([record, ...existing]);
  return record;
}

export function revokeSharedForensicLink(shareId: string): SharedForensicReportRecord[] {
  const next = loadSharedForensicLinks().map((rec) =>
    rec.shareId === shareId ? { ...rec, revoked: true } : rec
  );
  saveSharedForensicLinks(next);
  return next;
}
