/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SubstanceKey } from '../types/dispersion';

/**
 * Resilient fetch with exponential backoff for scientific REST/GraphQL APIs
 * (Handles HTTP 429 rate-limits and 503 transient server errors)
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 3,
  backoffMs = 800
): Promise<Response> {
  const response = await fetch(url, options);
  if ((response.status === 429 || response.status === 503) && retries > 0) {
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    return fetchWithRetry(url, options, retries - 1, backoffMs * 2);
  }
  return response;
}

export interface AlphaFoldPredictionMeta {
  entryId: string;
  gene: string;
  uniprotAccession: string;
  uniprotId: string;
  uniprotDescription: string;
  organismScientificName: string;
  uniprotStart: number;
  uniprotEnd: number;
  uniprotSequence: string;
  cifUrl: string;
  pdbUrl: string;
  bcifUrl?: string;
  paeImageUrl?: string;
  paeDocUrl?: string;
}

export interface ResiduePlddtScore {
  residueNumber: number;
  residueName: string;
  oneLetterCode: string;
  chain: string;
  plddt: number;
  band: 'very_high' | 'confident' | 'low' | 'very_low';
}

export interface PlddtSummary {
  meanPlddt: number;
  residueCount: number;
  veryHighPct: number; // > 90 (#0053D6)
  confidentPct: number; // 70 - 90 (#65CBF3)
  lowPct: number; // 50 - 70 (#FFDB13)
  veryLowPct: number; // < 50 (#FF7D45)
  residues: ResiduePlddtScore[];
}

export interface UniProtFeatureItem {
  type: string;
  description: string;
  start: number;
  end: number;
  ligandName?: string;
}

export interface UniProtCrossRef {
  database: string;
  id: string;
  properties?: Record<string, string>;
}

export interface UniProtProteinProfile {
  accession: string;
  id: string;
  geneName: string;
  proteinName: string;
  organismName: string;
  sequenceLength: number;
  sequence: string;
  functionText: string;
  catalyticActivity: string[];
  subcellularLocations: string[];
  diseases: Array<{
    name: string;
    acronym?: string;
    description: string;
    mimId?: string;
  }>;
  features: UniProtFeatureItem[];
  pdbIds: string[];
  reactomePathways: Array<{ id: string; name: string }>;
}

export interface PubChemCompoundProfile {
  cid: number;
  name: string;
  iupacName: string;
  molecularFormula: string;
  molecularWeight: number;
  canonicalSmiles: string;
  inchikey: string;
  xlogp: number | null;
  tpsa: number;
  hBondDonorCount: number;
  hBondAcceptorCount: number;
  rotatableBondCount: number;
  complexity: number;
  image2dUrl: string;
  pubchemUrl: string;
  lipinskiViolations: number;
  lipinskiPass: boolean;
  veberPass: boolean;
  bbbPermeableLikely: boolean;
}

export interface EuropePmcArticle {
  id: string;
  source: string;
  pmid?: string;
  pmcid?: string;
  doi?: string;
  title: string;
  authorString: string;
  journalTitle: string;
  pubYear: string;
  citedByCount: number;
  isOpenAccess: boolean;
  abstractText?: string;
}

export interface RingparkenToxicologyPreset {
  id: string;
  substanceKey: SubstanceKey;
  shortLabel: string;
  danishTitle: string;
  contaminantName: string;
  uniprotAccession: string;
  geneSymbol: string;
  experimentalPdbId: string;
  pubchemCid: number;
  pubchemCompoundName: string;
  fallbackSmiles: string;
  literatureQuery: string;
  mechanisticSummary: string;
  bek613RegulatoryNote: string;
}

export const RINGPARKEN_TOXICOLOGY_PRESETS: RingparkenToxicologyPreset[] = [
  {
    id: 'asbestos-bap1',
    substanceKey: 'asbestos',
    shortLabel: 'Asbest → BAP1 / Mesotheliom',
    danishTitle: 'Asbestfibre (<1997 Eternit/Rørisolering) & BAP1 Tumor-Suppressor',
    contaminantName: 'Krysotil / Amfibol Asbest (Silikat-fiber) & PAH',
    uniprotAccession: 'Q92560',
    geneSymbol: 'BAP1',
    experimentalPdbId: '8H1T',
    pubchemCid: 24261,
    pubchemCompoundName: 'Silicon dioxide (Silikat-tetraeder)',
    fallbackSmiles: 'O=[Si]=O',
    literatureQuery: '"asbestos" AND ("BAP1" OR "mesothelioma") AND "pleural"',
    mechanisticSummary:
      'Inhalerede asbestfibre (<1997 brystningsplader i Blok 1–3) penetrerer lungevæv og pleura, genererer reaktive iltradikaler (ROS) ved frustreret fagocytose og inducerer somatiske tab-af-funktion mutationer i BAP1 (Ubiquitin carboxyl-terminal hydrolase BAP1), hvilket udløser malignt pleura-mesotheliom.',
    bek613RegulatoryNote:
      'BEK nr. 613/2026: Asbest-grænseværdi 0,003 fibre/cm³. Enhver overskridelse kræver øjeblikkelig standsning og indkapsling med undertryk.',
  },
  {
    id: 'asbestos-tp53',
    substanceKey: 'asbestos',
    shortLabel: 'Asbest / PAH → TP53 (p53)',
    danishTitle: 'Asbest & Tjære-PAH DNA-Skaderespons via TP53 (p53)',
    contaminantName: 'Benzo[a]pyren / Asbest-induceret oxidativt stress',
    uniprotAccession: 'P04637',
    geneSymbol: 'TP53',
    experimentalPdbId: '1TUP',
    pubchemCid: 2336,
    pubchemCompoundName: 'Benzo[a]pyrene',
    fallbackSmiles: 'C1=CC=C2C3=C4C(=CC2=C1)C=CC5=C4C(=CC=C5)C=C3',
    literatureQuery: '("asbestos" OR "benzo(a)pyrene") AND "TP53" AND "lung"',
    mechanisticSummary:
      'Polycykliske aromatiske kulbrinter (PAH som Benzo[a]pyren i gammel tagpap/asfalt) og asbestfibre danner DNA-addukter og dobbeltstrengsbrud i bronkialt epitel, hvor TP53 (p53) fungerer som genomets centrale vogter.',
    bek613RegulatoryNote:
      'Kræftbekendtgørelsen & BEK 613/2026 § 3, stk. 3: Additiv karcinogen effekt mellem asbestfibre og PAH indgår i Arbejdstilsynets sumformel.',
  },
  {
    id: 'pcb-ahr',
    substanceKey: 'pcb',
    shortLabel: 'PCB-153 → AHR Receptor',
    danishTitle: 'PCB i Elastiske Facadefuger (1964–1974) & Aryl Hydrocarbon Receptor (AHR)',
    contaminantName: "2,2',4,4',5,5'-Hexachlorobiphenyl (PCB-153)",
    uniprotAccession: 'P35869',
    geneSymbol: 'AHR',
    experimentalPdbId: '7ZUB',
    pubchemCid: 37034,
    pubchemCompoundName: "2,2',4,4',5,5'-Hexachlorobiphenyl (PCB-153)",
    fallbackSmiles: 'C1=C(C(=CC(=C1Cl)Cl)C2=CC(=C(C=C2Cl)Cl)Cl)Cl',
    literatureQuery: '"polychlorinated biphenyls" AND "AHR" AND ("toxicity" OR "exposure")',
    mechanisticSummary:
      'Ved mekanisk nedbrydning og varmepåvirkning (>18 °C) afgasser PCB-congenere fra Ringparkens betonelementfuger. Dioxinlignende og højtklorerede PCB-molekyler aktiverer Aryl Hydrocarbon Receptoren (AHR), translokerer til cellekernen og opregulerer CYP1A1 samt pro-inflammatoriske og endokrine forstyrrelser.',
    bek613RegulatoryNote:
      'BEK nr. 613/2026: Grænseværdi 0,01 mg/m³ (10.000 ng/m³ arbejdsmiljø) / Sundhedsstyrelsens aktionsværdi 300 ng/m³ for indendørs ophold i naboblokke.',
  },
  {
    id: 'lead-alad',
    substanceKey: 'heavyMetals',
    shortLabel: 'Bly (Pb) → ALAD Enzym',
    danishTitle: 'Tungmetaller (Blymønje / Blykromat) & ALAD Hæm-Biosyntese Hæmning',
    contaminantName: 'Bly(II)kromat (PbCrO4) / Blyholdigt nedrivningsstøv',
    uniprotAccession: 'P13716',
    geneSymbol: 'ALAD',
    experimentalPdbId: '1E51',
    pubchemCid: 24924,
    pubchemCompoundName: 'Lead chromate (PbCrO4)',
    fallbackSmiles: '[O-][Cr](=O)(=O)[O-].[Pb+2]',
    literatureQuery: '"lead" AND "ALAD" AND ("aminolevulinic acid dehydratase" OR "toxicity")',
    mechanisticSummary:
      'Respirabelt blystøv fra gammel industriel maling og opgravet jord fortrænger de katalytiske Zn²⁺-ioner i enzymet Delta-aminolevulinsyre-dehydratase (ALAD / Porphobilinogensyntase, UniProt P13716), hvilket blokerer hæm-syntesen og medfører akkumulering af neurotoksisk aminolevulinsyre (ALA).',
    bek613RegulatoryNote:
      'BEK nr. 613/2026: Uorganisk bly i støv har grænseværdi 0,05 mg/m³ og kræver biologisk eksponeringskontrol (blodbly) samt hjulvask ved jordkørsel.',
  },
  {
    id: 'silica-nlrp3',
    substanceKey: 'quartzWool',
    shortLabel: 'Kvarts (SiO2) → NLRP3 Inflammasom',
    danishTitle: 'Respirabelt Krystallinsk Kvartsstøv (Betonknusning) & NLRP3 Inflammasom',
    contaminantName: 'Krystallinsk Siliciumdioxid (α-Kvarts, SiO2)',
    uniprotAccession: 'Q96P20',
    geneSymbol: 'NLRP3',
    experimentalPdbId: '6NPY',
    pubchemCid: 24261,
    pubchemCompoundName: 'Silicon dioxide (Crystalline Quartz)',
    fallbackSmiles: 'O=[Si]=O',
    literatureQuery: '"crystalline silica" AND "NLRP3" AND ("inflammasome" OR "silicosis")',
    mechanisticSummary:
      'Når alveolære makrofager optager skarpe, respirable kvartskrystaller (<5 µm) fra betonnedbrydning i Blok 1–3, brister fagolysosomerne og aktiverer det intracellulære NLRP3-inflammasom (Q96P20). Dette frigiver IL-1β og IL-18 og driver kronisk lungefibrose (silikose) og lungekræft.',
    bek613RegulatoryNote:
      'BEK nr. 613/2026: Respirabelt krystallinsk kvarts har skærpet grænseværdi på 0,1 mg/m³ (kræftfremkaldende proces ved mekanisk bearbejdning).',
  },
  {
    id: 'mold-tlr4',
    substanceKey: 'moldSewer',
    shortLabel: 'Skimmel / Kloak → TLR4 Receptor',
    danishTitle: 'Skimmelsvamp-Mykotoksiner & Kloak-Endotoksiner via Toll-Like Receptor 4 (TLR4)',
    contaminantName: 'Sterigmatocystin (Aspergillus versicolor) & LPS Endotoksin',
    uniprotAccession: 'O00206',
    geneSymbol: 'TLR4',
    experimentalPdbId: '3FXI',
    pubchemCid: 5280389,
    pubchemCompoundName: 'Sterigmatocystin (Mycotoxin)',
    fallbackSmiles: 'COC1=C2C3=C(C=C1)OC4=CC=CC=C4C3=O.C1=COC2C1OC3=CC4=C(C(=C32)O)C(=O)C5=C(O4)C=CC=C5OC',
    literatureQuery: '("mycotoxin" OR "endotoxin" OR "Aspergillus") AND "TLR4" AND "airway"',
    mechanisticSummary:
      'Ved blotlægning af fugtskadede krybekældre og opgravning af kloaktracéer spredes bioaerosoler med Gram-negative endotoksiner (LPS) og skimmel-mykotoksiner (bl.a. Sterigmatocystin fra Aspergillus versicolor). TLR4 på luftvejsepitel og makrofager genkender disse ligander og udløser akut bronkokonstriktion og toksisk alveolitis (ODTS).',
    bek613RegulatoryNote:
      'Arbejdstilsynets vejledning om biologiske agenser & BEK 613/2026: Gælder ved nedrivning af fugtskadede bygningsdele og blotlagt kloakjord.',
  },
];

const THREE_TO_ONE_AA: Record<string, string> = {
  ALA: 'A',
  ARG: 'R',
  ASN: 'N',
  ASP: 'D',
  CYS: 'C',
  GLN: 'Q',
  GLU: 'E',
  GLY: 'G',
  HIS: 'H',
  ILE: 'I',
  LEU: 'L',
  LYS: 'K',
  MET: 'M',
  PHE: 'F',
  PRO: 'P',
  SER: 'S',
  THR: 'T',
  TRP: 'W',
  TYR: 'Y',
  VAL: 'V',
};

/**
 * Parse per-residue AlphaFold pLDDT confidence scores from mmCIF CA atoms
 */
export function parsePlddtFromCif(cifText: string): PlddtSummary {
  const lines = cifText.split('\n');
  const residuesMap = new Map<number, ResiduePlddtScore>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('ATOM ')) continue;
    const parts = line.split(/\s+/);
    // Standard AlphaFold mmCIF ATOM row:
    // 0:ATOM 1:id 2:type_symbol 3:label_atom_id(CA) 4:. 5:label_comp_id(ALA) 6:label_asym_id(A) 7:1 8:label_seq_id(resNum) ... 14:B_iso_or_equiv(pLDDT)
    if (parts.length < 15) continue;
    const atomId = parts[3];
    if (atomId !== 'CA') continue;

    const compId = parts[5];
    const chain = parts[6];
    const resNum = parseInt(parts[8], 10);
    // In AlphaFold mmCIF v4/v6, B_iso_or_equiv is typically index 14 (just before auth_seq_id or occupancy=1.00)
    // Let's find the floating point number after occupancy `1.00`
    let plddt = parseFloat(parts[14]);
    const occIdx = parts.findIndex((p, idx) => idx >= 11 && p === '1.00');
    if (occIdx !== -1 && occIdx + 1 < parts.length) {
      const candidate = parseFloat(parts[occIdx + 1]);
      if (!Number.isNaN(candidate)) {
        plddt = candidate;
      }
    }

    if (Number.isNaN(resNum) || Number.isNaN(plddt)) continue;

    const band: ResiduePlddtScore['band'] =
      plddt > 90
        ? 'very_high'
        : plddt > 70
        ? 'confident'
        : plddt > 50
        ? 'low'
        : 'very_low';

    residuesMap.set(resNum, {
      residueNumber: resNum,
      residueName: compId,
      oneLetterCode: THREE_TO_ONE_AA[compId] ?? 'X',
      chain,
      plddt,
      band,
    });
  }

  const residues = Array.from(residuesMap.values()).sort(
    (a, b) => a.residueNumber - b.residueNumber
  );
  const total = residues.length || 1;
  let sum = 0;
  let vh = 0;
  let conf = 0;
  let low = 0;
  let vl = 0;

  for (const r of residues) {
    sum += r.plddt;
    if (r.band === 'very_high') vh++;
    else if (r.band === 'confident') conf++;
    else if (r.band === 'low') low++;
    else vl++;
  }

  return {
    meanPlddt: Number((sum / total).toFixed(1)),
    residueCount: residues.length,
    veryHighPct: Number(((vh / total) * 100).toFixed(1)),
    confidentPct: Number(((conf / total) * 100).toFixed(1)),
    lowPct: Number(((low / total) * 100).toFixed(1)),
    veryLowPct: Number(((vl / total) * 100).toFixed(1)),
    residues,
  };
}

/**
 * Resolve a gene symbol (e.g., TP53, BAP1, AHR) or UniProt accession to a canonical human UniProt accession
 */
export async function resolveToUniProtAccession(query: string): Promise<string> {
  const cleaned = query.trim().toUpperCase();
  // Standard UniProt accession pattern (6 or 10 alphanumeric chars starting with OPQ or A-N,R-Z)
  if (/^[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$/.test(cleaned)) {
    return cleaned;
  }

  const searchUrl = `https://rest.uniprot.org/uniprotkb/search?query=gene_exact:${encodeURIComponent(
    cleaned
  )}+AND+organism_id:9606+AND+reviewed:true&format=json&size=1`;
  const res = await fetchWithRetry(searchUrl);
  if (res.ok) {
    const data = await res.json();
    if (data?.results?.[0]?.primaryAccession) {
      return data.results[0].primaryAccession;
    }
  }

  // Fallback broader search in human reviewed proteins
  const broadUrl = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(
    cleaned
  )}+AND+organism_id:9606+AND+reviewed:true&format=json&size=1`;
  const broadRes = await fetchWithRetry(broadUrl);
  if (broadRes.ok) {
    const broadData = await broadRes.json();
    if (broadData?.results?.[0]?.primaryAccession) {
      return broadData.results[0].primaryAccession;
    }
  }

  throw new Error(`Kunne ikke finde et verificeret humant UniProtKB-opslag for "${query}".`);
}

/**
 * Fetch AlphaFold DB v6 metadata and mmCIF coordinate file dynamically
 */
export async function fetchAlphaFoldStructureAndMeta(uniprotAccession: string): Promise<{
  meta: AlphaFoldPredictionMeta;
  cifText: string;
  plddtSummary: PlddtSummary;
}> {
  const cleanId = uniprotAccession.trim().toUpperCase();
  const metaRes = await fetchWithRetry(`https://alphafold.ebi.ac.uk/api/prediction/${cleanId}`);
  if (!metaRes.ok) {
    throw new Error(`AlphaFold DB API returnerede HTTP ${metaRes.status} for ${cleanId}`);
  }
  const metaArray = await metaRes.json();
  if (!Array.isArray(metaArray) || metaArray.length === 0) {
    throw new Error(`Ingen AlphaFold 3D-struktur fundet for UniProt ${cleanId}`);
  }

  const first = metaArray[0];
  const cifUrl: string =
    first.cifUrl ?? `https://alphafold.ebi.ac.uk/files/AF-${cleanId}-F1-model_v6.cif`;

  const cifRes = await fetchWithRetry(cifUrl);
  if (!cifRes.ok) {
    throw new Error(`Kunne ikke hente AlphaFold mmCIF koordinater (${cifRes.status})`);
  }
  const cifText = await cifRes.text();
  const plddtSummary = parsePlddtFromCif(cifText);

  const meta: AlphaFoldPredictionMeta = {
    entryId: first.entryId ?? `AF-${cleanId}-F1`,
    gene: first.gene ?? cleanId,
    uniprotAccession: first.uniprotAccession ?? cleanId,
    uniprotId: first.uniprotId ?? cleanId,
    uniprotDescription: first.uniprotDescription ?? '',
    organismScientificName: first.organismScientificName ?? 'Homo sapiens',
    uniprotStart: first.uniprotStart ?? 1,
    uniprotEnd: first.uniprotEnd ?? plddtSummary.residueCount,
    uniprotSequence: first.uniprotSequence ?? '',
    cifUrl,
    pdbUrl: first.pdbUrl ?? `https://alphafold.ebi.ac.uk/files/AF-${cleanId}-F1-model_v6.pdb`,
    bcifUrl: first.bcifUrl,
    paeImageUrl: first.paeImageUrl,
    paeDocUrl: first.paeDocUrl,
  };

  return { meta, cifText, plddtSummary };
}

/**
 * Fetch comprehensive UniProtKB functional annotations, domains, active/binding sites, and variants
 */
export async function fetchUniProtProfile(uniprotAccession: string): Promise<UniProtProteinProfile> {
  const cleanId = uniprotAccession.trim().toUpperCase();
  const res = await fetchWithRetry(`https://rest.uniprot.org/uniprotkb/${cleanId}.json`);
  if (!res.ok) {
    throw new Error(`UniProtKB API returnerede HTTP ${res.status} for ${cleanId}`);
  }
  const data = await res.json();

  const geneName =
    data.genes?.[0]?.geneName?.value ??
    data.uniProtkbId?.split('_')[0] ??
    cleanId;

  const proteinName =
    data.proteinDescription?.recommendedName?.fullName?.value ??
    data.proteinDescription?.submissionNames?.[0]?.fullName?.value ??
    cleanId;

  const organismName = data.organism?.scientificName ?? 'Homo sapiens';
  const sequenceLength = data.sequence?.length ?? 0;
  const sequence = data.sequence?.value ?? '';

  let functionText = '';
  const catalyticActivity: string[] = [];
  const subcellularLocations: string[] = [];
  const diseases: UniProtProteinProfile['diseases'] = [];

  if (Array.isArray(data.comments)) {
    for (const c of data.comments) {
      if (c.commentType === 'FUNCTION' && c.texts?.[0]?.value && !functionText) {
        functionText = c.texts[0].value;
      } else if (c.commentType === 'CATALYTIC ACTIVITY' && c.reaction?.name) {
        catalyticActivity.push(c.reaction.name);
      } else if (c.commentType === 'SUBCELLULAR LOCATION' && Array.isArray(c.subcellularLocations)) {
        for (const loc of c.subcellularLocations) {
          if (loc.location?.value) {
            subcellularLocations.push(loc.location.value);
          }
        }
      } else if (c.commentType === 'DISEASE' && c.disease) {
        diseases.push({
          name: c.disease.diseaseId ?? 'Klinisk fænotype',
          acronym: c.disease.acronym,
          description: c.disease.description ?? c.texts?.[0]?.value ?? '',
          mimId: c.disease.diseaseCrossReference?.id,
        });
      }
    }
  }

  const wantedFeatureTypes = new Set([
    'Domain',
    'Active site',
    'Binding site',
    'Region',
    'DNA binding',
    'Zinc finger',
    'Mutagenesis',
    'Natural variant',
  ]);

  const features: UniProtFeatureItem[] = [];
  if (Array.isArray(data.features)) {
    for (const f of data.features) {
      if (!wantedFeatureTypes.has(f.type)) continue;
      const start = f.location?.start?.value;
      const end = f.location?.end?.value ?? start;
      if (typeof start !== 'number') continue;
      features.push({
        type: f.type,
        description: f.description || f.ligand?.name || f.type,
        start,
        end: typeof end === 'number' ? end : start,
        ligandName: f.ligand?.name,
      });
    }
  }

  const pdbIds: string[] = [];
  const reactomePathways: Array<{ id: string; name: string }> = [];
  if (Array.isArray(data.uniProtKBCrossReferences)) {
    for (const xref of data.uniProtKBCrossReferences) {
      if (xref.database === 'PDB' && xref.id && pdbIds.length < 12) {
        pdbIds.push(xref.id);
      } else if (xref.database === 'Reactome' && xref.id) {
        const pathwayName =
          xref.properties?.find((p: any) => p.key === 'PathwayName')?.value ?? xref.id;
        reactomePathways.push({ id: xref.id, name: pathwayName });
      }
    }
  }

  return {
    accession: data.primaryAccession ?? cleanId,
    id: data.uniProtkbId ?? cleanId,
    geneName,
    proteinName,
    organismName,
    sequenceLength,
    sequence,
    functionText,
    catalyticActivity,
    subcellularLocations: Array.from(new Set(subcellularLocations)).slice(0, 6),
    diseases,
    features: features.slice(0, 28),
    pdbIds,
    reactomePathways: reactomePathways.slice(0, 10),
  };
}

/**
 * Fetch physicochemical properties and Lipinski/Veber toxicokinetic metrics from PubChem PUG REST
 */
export async function fetchPubChemCompound(
  cidOrName: number | string,
  displayNameOverride?: string
): Promise<PubChemCompoundProfile> {
  let cid: number;
  if (typeof cidOrName === 'number' || /^\d+$/.test(String(cidOrName).trim())) {
    cid = Number(String(cidOrName).trim());
  } else {
    const nameQuery = String(cidOrName).trim();
    const cidRes = await fetchWithRetry(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(
        nameQuery
      )}/cids/JSON`
    );
    if (!cidRes.ok) {
      throw new Error(`PubChem kunne ikke finde forbindelse for "${nameQuery}"`);
    }
    const cidJson = await cidRes.json();
    const resolvedCid = cidJson?.IdentifierList?.CID?.[0];
    if (!resolvedCid) {
      throw new Error(`Ingen PubChem CID fundet for "${nameQuery}"`);
    }
    cid = Number(resolvedCid);
  }

  const propUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,CanonicalSMILES,IsomericSMILES,IUPACName,InChIKey,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,Complexity/JSON`;
  const propRes = await fetchWithRetry(propUrl);
  if (!propRes.ok) {
    throw new Error(`PubChem PUG REST fejl (HTTP ${propRes.status}) for CID ${cid}`);
  }
  const propData = await propRes.json();
  const prop = propData?.PropertyTable?.Properties?.[0];
  if (!prop) {
    throw new Error(`Ingen PubChem egenskaber returneret for CID ${cid}`);
  }

  const mw = parseFloat(prop.MolecularWeight ?? '0');
  const xlogp = typeof prop.XLogP === 'number' ? prop.XLogP : null;
  const tpsa = typeof prop.TPSA === 'number' ? prop.TPSA : 0;
  const hbd = Number(prop.HBondDonorCount ?? 0);
  const hba = Number(prop.HBondAcceptorCount ?? 0);
  const rotBonds = Number(prop.RotatableBondCount ?? 0);

  // Lipinski's Rule of Five evaluation
  let violations = 0;
  if (mw > 500) violations++;
  if (xlogp !== null && xlogp > 5) violations++;
  if (hbd > 5) violations++;
  if (hba > 10) violations++;

  const lipinskiPass = violations <= 1;
  const veberPass = rotBonds <= 10 && tpsa <= 140;
  const bbbPermeableLikely = tpsa < 90 && mw < 450;

  return {
    cid,
    name: displayNameOverride || prop.IUPACName || `CID ${cid}`,
    iupacName: prop.IUPACName ?? `PubChem CID ${cid}`,
    molecularFormula: prop.MolecularFormula ?? '-',
    molecularWeight: Number.isNaN(mw) ? 0 : mw,
    canonicalSmiles:
      prop.CanonicalSMILES ||
      prop.IsomericSMILES ||
      prop.ConnectivitySMILES ||
      '',
    inchikey: prop.InChIKey ?? '-',
    xlogp,
    tpsa,
    hBondDonorCount: hbd,
    hBondAcceptorCount: hba,
    rotatableBondCount: rotBonds,
    complexity: Number(prop.Complexity ?? 0),
    image2dUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=300x300`,
    pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
    lipinskiViolations: violations,
    lipinskiPass,
    veberPass,
    bbbPermeableLikely,
  };
}

/**
 * Search peer-reviewed biomedical literature via Europe PMC REST API
 */
export async function fetchEuropePmcLiterature(
  query: string,
  pageSize = 6
): Promise<{ hitCount: number; articles: EuropePmcArticle[] }> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(
    query
  )}&format=json&pageSize=${pageSize}&resultType=core`;
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new Error(`Europe PMC REST API fejl: HTTP ${res.status}`);
  }
  const data = await res.json();
  const hitCount = Number(data?.hitCount ?? 0);
  const rawList = data?.resultList?.result ?? [];

  const articles: EuropePmcArticle[] = rawList.map((item: any) => ({
    id: item.id ?? '',
    source: item.source ?? 'MED',
    pmid: item.pmid,
    pmcid: item.pmcid,
    doi: item.doi,
    title: item.title ?? 'Uden titel',
    authorString: item.authorString ?? 'Ukendte forfattere',
    journalTitle: item.journalInfo?.journal?.title ?? item.journalTitle ?? item.bookOrReportDetails?.publisher ?? 'Tidsskrift',
    pubYear: String(item.pubYear ?? ''),
    citedByCount: Number(item.citedByCount ?? 0),
    isOpenAccess: item.isOpenAccess === 'Y',
    abstractText: item.abstractText
      ? String(item.abstractText).replace(/<[^>]+>/g, '')
      : undefined,
  }));

  return { hitCount, articles };
}
