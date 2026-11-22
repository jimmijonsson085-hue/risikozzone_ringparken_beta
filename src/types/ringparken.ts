/**
 * @file src/types/ringparken.ts
 * @description Canonical Ringparken domain model types (Slagelse miljøkortlægning).
 */
export type SubstanceCode =
  | 'ASBESTOS'
  | 'PCB'
  | 'PB'
  | 'ZN'
  | 'CD'
  | 'CR'
  | 'CU'
  | 'HG'
  | 'NI'
  | 'AS'
  | 'SCCP_MCCP'
  | 'PAH'
  | 'THC';

export type AsbestosType =
  | 'Chrysotil'
  | 'Amosit'
  | 'Crocidolit'
  | 'Anthophyllit'
  | 'Tremolit'
  | 'Ukendt';

export type WasteClass =
  | 'Uforurenet affald'
  | 'Forurenet affald'
  | 'Farligt affald';

export type ProjectStage =
  | 'Aktiv nedrivning (2026)'
  | 'Planlagt nedrivning (Etape 2/3)'
  | 'Beboet / Renoveres'
  | 'Ekstern nabo / Institution';

export interface MaterialSample {
  id: string;
  reportSource:
    | 'DMR Okt 2021'
    | 'DMA Maj 2025'
    | 'Wissenberg Jan 2026'
    | 'COWI Feb 2021';
  buildingId: string;
  addressLabel: string;
  locationDetail: string;
  material: string;
  asbestosDetected: boolean;
  asbestosTypes: AsbestosType[];
  dustIntensity: 'Ingen' | '+' | '++' | '+++';
  concentrationsMgKg: Partial<Record<SubstanceCode, number>>;
  reportedHp14SumMgKg: number | null;
  wholeElementDowngradedNote: string | null;
}

export interface RingparkenBuildingCoordinates {
  lat: number;
  lng: number;
  isApproximateCentroid?: boolean;
  referencePoints?: Array<{
    label: string;
    lat: number;
    lng: number;
  }>;
}

export interface RingparkenBuilding {
  id: string;
  name: string;
  fobDepartment:
    | 'Afd. 023'
    | 'Afd. 024'
    | 'Afd. 026'
    | 'Afd. 032'
    | 'Erhverv/Institution'
    | 'Nabo';
  fobBlockNumber: number | null;
  dmaBlockNumber: number | null;
  canonicalAddresses: string[];
  coordinates: RingparkenBuildingCoordinates;
  stage: ProjectStage;
  permitCaseNumber: string | null;
  areaM2: number | null;
  requiresSelectiveDemolitionPlan: boolean;
  basementType: 'Fuld kælder' | 'Delvis krybekælder' | 'Ingen/Ukendt';
  cowiJointFailurePct: number;
  hasCavNegativePressure: boolean;
  hasBasementAsbestosDust: boolean;
  shelterCapacityPersons: number | null;
  hydrologyNote: string | null;
}

export interface ProtectedFeature {
  id: string;
  category:
    | 'Bevaringsværdige træer'
    | 'Bevaringsværdig trærække'
    | 'Flagermus-screeningzone';
  title: string;
  locationDescription: string;
  coordinates: {
    lat: number;
    lng: number;
    isApproximateCentroid?: boolean;
  };
  treeCount?: number;
  statutoryBasis: string;
  protectionDirectiveDa: string;
  restrictionStatus:
    | 'Totalfredet mod fældning / rodzonebeskyttet'
    | 'Afspærret sti / bevaringskrav'
    | 'Obligatorisk § 29 a flagermus-screening før nedrivning';
}
