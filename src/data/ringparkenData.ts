import {
  BuildingCategoryMetadata,
  BuildingOperationalCategory,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  ReceptorZone,
  RingparkenBuildingUnit,
  SubstanceKey,
  SubstanceSpec,
} from '../types/dispersion';

export const RINGPARKEN_CENTER = {
  lat: 55.4128,
  lng: 11.3533,
};

export const SUBSTANCE_SPECS: Record<SubstanceKey, SubstanceSpec> = {
  asbestos: {
    key: 'asbestos',
    name: 'Asbestfibre (Krysotil/Amosit)',
    shortName: 'Asbest',
    limitValue2026: 0.003,
    unit: 'fibre/cm³',
    regulationRef: 'BEK nr. 613 af 29/06/2026 & Bek. 1328 af 19/11/2025',
    description:
      'Ekstremt lav faldhastighed. Spredningsfanen forlænges kraftigt ved tør vind (>4 m/s) og vindstød. Frost/tø øger kildestyrken pga. frostsprængning i brystnings- og vindspærreplader.',
    baseEmissionFactor: 0.0024,
  },
  pcb: {
    key: 'pcb',
    name: 'Polychlorerede Biphenyler (PCB)',
    shortName: 'PCB',
    limitValue2026: 3000,
    actionValue: 300,
    unit: 'ng/m³',
    regulationRef: 'Sundhedsstyrelsens Aktionsværdier (300 / 3000 ng/m³) & BEK 613/2026',
    description:
      'Semivolatil forbindelse i maling og fuger. Gasformig PCB-afgasning stiger eksponentielt med temperatur (>20°C) og direkte solindstråling (>300 W/m²). Spredes som partikelbundet støv i koldt blæsevejr.',
    baseEmissionFactor: 420,
  },
  heavyMetals: {
    key: 'heavyMetals',
    name: 'Tungmetaller (Bly, Cadmium, Hg, Arsen)',
    shortName: 'Tungmetaller / Bly',
    limitValue2026: 0.03,
    unit: 'mg/m³',
    regulationRef: 'BEK nr. 613 pr. 1. juli 2026 (Skærpet bly-grænseværdi: 0,03 mg/m³)',
    description:
      'Spredes som tungt nedrivningsstøv ved kraftige vindstød (>7 m/s). Ved nedbør (>2 mm/t) udvaskes bly og PAH i en hydrologisk afstrømningszone mod vejarealer og regnvandsbrønde.',
    baseEmissionFactor: 0.022,
  },
  quartzWool: {
    key: 'quartzWool',
    name: 'Respirabelt Kvartsstøv & Gl. Mineraluld (<1997)',
    shortName: 'Kvarts & Mineraluld',
    limitValue2026: 0.1,
    unit: 'mg/m³',
    regulationRef: 'BEK nr. 613/2026 Bilag 1 (Kræftfremkaldende respirabelt kvarts: 0,1 mg/m³)',
    description:
      'Frigives ved betonnedbrydning og fra tagrum (frigivelseshøjde H = 10-12 m), hvilket skaber en bredere tværvindsfane ved ustabil og neutral atmosfære.',
    baseEmissionFactor: 0.078,
  },
  moldSewer: {
    key: 'moldSewer',
    name: 'Skimmelsporer (Krybekælder) & Kloak/Jord',
    shortName: 'Skimmel & Kloak',
    limitValue2026: 500,
    unit: 'CFU/m³',
    regulationRef: 'PSS Sag W22085 pkt. 7 & 11.1 / Jordforureningslovens § 70, stk. 4',
    description:
      'Frigives akut fra kældre (Bygning 1 & 2) og blottet krybekælder i Blok 1 når overliggende dæk fjernes, samt ved opgravning af forurenet jord/kloak.',
    baseEmissionFactor: 380,
  },
};

export const INITIAL_DEMOLITION_SOURCES: DemolitionSourceNode[] = [
  {
    id: 'src-bygning-1',
    code: 'BYG-1',
    name: 'Bygning 1: Børnehave',
    address: 'Kierulffsvej 2, 4200 Slagelse',
    position: { lat: 55.4132, lng: 11.3541 },
    footprint: [
      { lat: 55.41334, lng: 11.35385 },
      { lat: 55.41334, lng: 11.35435 },
      { lat: 55.41306, lng: 11.35435 },
      { lat: 55.41306, lng: 11.35385 },
    ],
    releaseHeightMeters: 8,
    substances: ['asbestos', 'pcb', 'heavyMetals', 'quartzWool', 'moldSewer'],
    substanceDetails: {
      asbestos: 'Asbest i vægfliser og fliseklæb',
      pcb: 'PCB i indvendig/udvendig maling og elastiske fuger',
      heavyMetals: 'Bly, zink og tungmetaller i maling og glasurer',
      quartzWool: 'Gammel mineraluld (<1997) i tagrum (H = 8-10 m)',
      moldSewer: 'Kraftig skimmelvækst i kælderetage',
    },
    pssReference: 'PSS Sag W22085 - Bygning 1 (Kierulffsvej 2)',
    constructionYearRange: 'Opført ca. 1968 (<1997)',
    materialAgeCategory: '<1997 Asbest- & Gl. Mineraluldskonstruktion',
    asbestosBuildingParts: [
      'Vægfliser & asbestholdig fliseklæb',
      'Tagrum: Gammel mineraluld (<1997, H=8m)',
    ],
    fiberReleaseIndex: 0.78,
    healthRiskCorrelation:
      'Nedbrydning af <1997 fliseklæb og tagrums-mineraluld frigiver respirable fibre (GV: 0,003 fibre/cm³ jf. BEK 613/2026) mod Kierulffsvej Øst.',
    active: true,
  },
  {
    id: 'src-bygning-2',
    code: 'BYG-2',
    name: 'Bygning 2: Supermarked/Bazar',
    address: 'Kierulffsvej 12, 4200 Slagelse',
    position: { lat: 55.4125, lng: 11.3536 },
    footprint: [
      { lat: 55.41266, lng: 11.3533 },
      { lat: 55.41266, lng: 11.3539 },
      { lat: 55.41234, lng: 11.3539 },
      { lat: 55.41234, lng: 11.3533 },
    ],
    releaseHeightMeters: 9,
    substances: ['asbestos', 'pcb', 'heavyMetals', 'quartzWool', 'moldSewer'],
    substanceDetails: {
      asbestos: 'Asbest i ventilationskanaler og kældermembran',
      pcb: 'PCB i fugemasser omkring erhvervsvinduer og facader',
      heavyMetals: 'Bly og cadmium i overfladebehandlinger',
      quartzWool: 'Gammel mineraluld (<1997) i tagkonstruktion',
      moldSewer: 'Kraftig skimmel i både stueetage og kælder',
    },
    pssReference: 'PSS Sag W22085 - Bygning 2 (Kierulffsvej 12)',
    constructionYearRange: 'Opført ca. 1969 (<1997)',
    materialAgeCategory: '<1997 Asbestkanaler & Tagrums-Mineraluld',
    asbestosBuildingParts: [
      'Ventilationskanaler (asbestcement)',
      'Asbestholdig kældermembran',
      'Tagkonstruktion: Gl. mineraluld (<1997, H=9m)',
    ],
    fiberReleaseIndex: 0.84,
    healthRiskCorrelation:
      'Klipning/nedtagning af <1997 ventilationskanaler og tagkonstruktion skaber høj risiko for luftbåren fiberdeposition ved naboblokke og Rødtjørnevej 2.',
    active: true,
  },
  {
    id: 'src-bygning-3',
    code: 'BYG-3',
    name: 'Bygning 3: Fritidshjem',
    address: 'Valbyvej 58, 4200 Slagelse',
    position: { lat: 55.4114, lng: 11.3508 },
    footprint: [
      { lat: 55.41155, lng: 11.35052 },
      { lat: 55.41155, lng: 11.35108 },
      { lat: 55.41125, lng: 11.35108 },
      { lat: 55.41125, lng: 11.35052 },
    ],
    releaseHeightMeters: 8,
    substances: ['asbestos', 'pcb', 'heavyMetals', 'quartzWool'],
    substanceDetails: {
      asbestos: 'Asbest i brystningsplader, linoleum/klæb og vindspærreplade i facade',
      pcb: 'PCB i facadefuger og malede overflader',
      heavyMetals: 'Tungmetaller i bygningsdele og maling',
      quartzWool: 'Gammel mineraluld (<1997) i tagrum',
      moldSewer: 'Ingen primær krybekælder-kilde',
    },
    pssReference: 'PSS Sag W22085 - Bygning 3 (Valbyvej 58)',
    constructionYearRange: 'Opført ca. 1967 (<1997)',
    materialAgeCategory: '<1997 Facade-Vindspærreplader & Brystningsplader',
    asbestosBuildingParts: [
      'Vindspærreplader i facade (friabel asbest)',
      'Brystningsplader (<1986/1997)',
      'Linoleum & asbestklæb',
      'Tagrum: Gl. mineraluld (<1997, H=8m)',
    ],
    fiberReleaseIndex: 0.91,
    healthRiskCorrelation:
      'Udvendige <1997 vindspærreplader og brystningsplader er direkte eksponeret for vindstød og frost/tø-sprængning langs Valbyvej cykelsti.',
    active: true,
  },
  {
    id: 'src-blok-1',
    code: 'BLOK-1',
    name: 'Blok 1: Beboelsesblok',
    address: 'Kierulffsvej 14-22, 4200 Slagelse',
    position: { lat: 55.4129, lng: 11.3522 },
    footprint: [
      { lat: 55.41328, lng: 11.35195 },
      { lat: 55.41328, lng: 11.35245 },
      { lat: 55.41252, lng: 11.35245 },
      { lat: 55.41252, lng: 11.35195 },
    ],
    releaseHeightMeters: 12,
    substances: ['asbestos', 'pcb', 'heavyMetals', 'quartzWool', 'moldSewer'],
    substanceDetails: {
      asbestos: 'Asbest i brystningsplader, altanfuger og rørinstallationer',
      pcb: 'PCB i malede overflader og konstruktionsfuger',
      heavyMetals: 'Bly, cadmium, kviksølv og arsen i maling/installationer',
      quartzWool: 'Kræftfremkaldende kvartsstøv (betonnedbrydning) & gl. mineraluld (H=12m)',
      moldSewer: 'Akut skimmelfrigivelse fra krybekælder ved fjernelse af dæk + forurenet jord/kloak',
    },
    pssReference: 'PSS Sag W22085 - Blok 1 (Kierulffsvej 14-22)',
    constructionYearRange: 'Opført ca. 1966 (<1997)',
    materialAgeCategory: '<1997 Etageblok: Brystningsplader, Altanfuger & Tagrum (H=12m)',
    asbestosBuildingParts: [
      'Brystningsplader i alle etager (<1986)',
      'Asbestholdige altanfuger & rørinstallationer',
      'Tagrum: Gl. mineraluld (<1997, frigivelseshøjde H=12m)',
    ],
    fiberReleaseIndex: 0.97,
    healthRiskCorrelation:
      'Høj frigivelseshøjde (H=12m) fra tagrum (<1997) kombineret med friable brystningsplader og altanfuger giver langtrækkende fiberdeposition (mesotheliom/lungekræft-risiko jf. BEK 613/2026).',
    active: true,
  },
];

export const INITIAL_RECEPTOR_ZONES: ReceptorZone[] = [
  {
    id: 'rec-afd-23',
    code: 'AFD-23',
    name: 'Ringparken Afd. 23 (Kierulffsvej Øst)',
    category: 'residential_block',
    department: 'Afd. 23',
    address: 'Kierulffsvej 24-38, 4200 Slagelse',
    center: { lat: 55.4134, lng: 11.3553 },
    polygon: [
      { lat: 55.41385, lng: 11.3549 },
      { lat: 55.41385, lng: 11.35575 },
      { lat: 55.41295, lng: 11.35575 },
      { lat: 55.41295, lng: 11.3549 },
    ],
    residentCountEstimate: 145,
    vulnerableGroupNote: 'Beboet boligblok under samtidig renovering — altaner og friskluftventiler mod vest',
  },
  {
    id: 'rec-afd-24',
    code: 'AFD-24',
    name: 'Ringparken Afd. 24 (Ndr. Ringgade / Kierulffsvej Nord)',
    category: 'residential_block',
    department: 'Afd. 24',
    address: 'Ndr. Ringgade 60-74 / Kierulffsvej, 4200 Slagelse',
    center: { lat: 55.4141, lng: 11.3532 },
    polygon: [
      { lat: 55.41445, lng: 11.3521 },
      { lat: 55.41445, lng: 11.3543 },
      { lat: 55.41375, lng: 11.3543 },
      { lat: 55.41375, lng: 11.3521 },
    ],
    residentCountEstimate: 190,
    vulnerableGroupNote: 'Beboede etageboliger langs Ndr. Ringgade umiddelbart nord for nedrivningsfeltet',
  },
  {
    id: 'rec-afd-26',
    code: 'AFD-26',
    name: 'Ringparken Afd. 26 (Albert Ibsensvej)',
    category: 'residential_block',
    department: 'Afd. 26',
    address: 'Albert Ibsensvej 2-18, 4200 Slagelse',
    center: { lat: 55.4122, lng: 11.3554 },
    polygon: [
      { lat: 55.41265, lng: 11.3548 },
      { lat: 55.41265, lng: 11.3561 },
      { lat: 55.41175, lng: 11.3561 },
      { lat: 55.41175, lng: 11.3548 },
    ],
    residentCountEstimate: 160,
    vulnerableGroupNote: 'Beboede boligblokke sydøst for Kierulffsvej 12 med direkte nedvinds-eksponering ved NV-vind',
  },
  {
    id: 'rec-afd-32',
    code: 'AFD-32',
    name: 'Ringparken Afd. 32 (Jaco Dampes Vej)',
    category: 'residential_block',
    department: 'Afd. 32',
    address: 'Jaco Dampes Vej 1-15, 4200 Slagelse',
    center: { lat: 55.4133, lng: 11.3506 },
    polygon: [
      { lat: 55.4138, lng: 11.3499 },
      { lat: 55.4138, lng: 11.3512 },
      { lat: 55.4128, lng: 11.3512 },
      { lat: 55.4128, lng: 11.3499 },
    ],
    residentCountEstimate: 130,
    vulnerableGroupNote: 'Beboede boligblokke vest for Blok 1 langs Jaco Dampes Vej',
  },
  {
    id: 'rec-kierulffsvej-corridor',
    code: 'VEJ-KIER',
    name: 'Kierulffsvej (Adgangsvej & Fortov)',
    category: 'public_road',
    address: 'Kierulffsvej 1-24, 4200 Slagelse',
    center: { lat: 55.41285, lng: 11.3534 },
    polygon: [
      { lat: 55.41305, lng: 11.3516 },
      { lat: 55.41305, lng: 11.3548 },
      { lat: 55.41265, lng: 11.3548 },
      { lat: 55.41265, lng: 11.3516 },
    ],
    vulnerableGroupNote: 'Offentlig vej, gående beboere, skolebørn og regnvandsbrønde i vejprofilet',
  },
  {
    id: 'rec-valbyvej-cykelsti',
    code: 'STI-VALB',
    name: 'Valbyvej Cykelsti & Fodgængerfelt',
    category: 'bike_path',
    address: 'Valbyvej 50-64, 4200 Slagelse',
    center: { lat: 55.41125, lng: 11.3515 },
    polygon: [
      { lat: 55.4115, lng: 11.3498 },
      { lat: 55.4115, lng: 11.3532 },
      { lat: 55.411, lng: 11.3532 },
      { lat: 55.411, lng: 11.3498 },
    ],
    vulnerableGroupNote: 'Hovedfærdselsåre og cykelsti klos op ad Bygning 3 (Fritidshjem, Valbyvej 58)',
  },
  {
    id: 'rec-roedtjoornevej-2',
    code: 'RØD-2',
    name: 'Rødtjørnevej 2 (C962+VV Slagelse)',
    category: 'residential_block',
    address: 'Rødtjørnevej 2, 4200 Slagelse · Plus Code: C962+VV Slagelse',
    center: { lat: 55.4122, lng: 11.3522 },
    polygon: [
      { lat: 55.41242, lng: 11.35175 },
      { lat: 55.41242, lng: 11.35265 },
      { lat: 55.41198, lng: 11.35265 },
      { lat: 55.41198, lng: 11.35175 },
    ],
    residentCountEstimate: 85,
    vulnerableGroupNote:
      'Matrikel og bebyggelse på Rødtjørnevej 2 (C962+VV Slagelse) umiddelbart syd for Blok 1 (Kierulffsvej 14-22) og vest for Kierulffsvej 12',
  },
  {
    id: 'rec-netto-ndr-ringgade-65',
    code: 'NETTO',
    name: 'NETTO',
    category: 'custom_receptor',
    address: 'Ndr. Ringgade 65, 4200 Slagelse',
    center: { lat: 55.41435, lng: 11.35115 },
    polygon: [
      { lat: 55.41455, lng: 11.35085 },
      { lat: 55.41455, lng: 11.35145 },
      { lat: 55.41415, lng: 11.35145 },
      { lat: 55.41415, lng: 11.35085 },
    ],
    residentCountEstimate: 120,
    vulnerableGroupNote:
      'Dagligvarebutik og kundeparkering på Ndr. Ringgade 65 umiddelbart nordvest for Ringparken — eksponeret ved sydøstlig vind',
  },
  {
    id: 'rec-lidl-ndr-ringgade-24',
    code: 'LIDL',
    name: 'Lidl',
    category: 'custom_receptor',
    address: 'Ndr. Ringgade 24, 4200 Slagelse',
    center: { lat: 55.41465, lng: 11.3624 },
    polygon: [
      { lat: 55.41485, lng: 11.36205 },
      { lat: 55.41485, lng: 11.36275 },
      { lat: 55.41445, lng: 11.36275 },
      { lat: 55.41445, lng: 11.36205 },
    ],
    residentCountEstimate: 150,
    vulnerableGroupNote:
      'Dagligvarebutik langs Ndr. Ringgade 24 øst for Ringparken — nedvindsreceptor ved vest-/sydvestlig vind',
  },
  {
    id: 'rec-coop365-valbyvej-65b',
    code: 'COOP365',
    name: 'COOP365',
    category: 'custom_receptor',
    address: 'Valbyvej 65B, 4200 Slagelse',
    center: { lat: 55.41165, lng: 11.34965 },
    polygon: [
      { lat: 55.41185, lng: 11.34935 },
      { lat: 55.41185, lng: 11.34995 },
      { lat: 55.41145, lng: 11.34995 },
      { lat: 55.41145, lng: 11.34935 },
    ],
    residentCountEstimate: 110,
    vulnerableGroupNote:
      'Dagligvarebutik på Valbyvej 65B tæt ved Bygning 3 (Fritidshjem, Valbyvej 58) — direkte eksponeret ved øst-/nordøstlig vind',
  },
  {
    id: 'rec-slagelse-station',
    code: 'SLAG-ST',
    name: 'Slagelse Station',
    category: 'custom_receptor',
    address: 'Nordre Stationsvej 13, 4200 Slagelse',
    center: { lat: 55.40795, lng: 11.35265 },
    polygon: [
      { lat: 55.40818, lng: 11.35215 },
      { lat: 55.40818, lng: 11.35315 },
      { lat: 55.40772, lng: 11.35315 },
      { lat: 55.40772, lng: 11.35215 },
    ],
    residentCountEstimate: 450,
    vulnerableGroupNote:
      'Trafikknudepunkt, perroner og busforplads syd for Ringparken (Nordre Stationsvej 13) — nedvindsreceptor ved nordlig vind',
  },
  {
    id: 'rec-nordskolen',
    code: 'NORDSK',
    name: 'Nordskolen',
    category: 'custom_receptor',
    address: 'Nørrevangstorvet 6B, 4200 Slagelse',
    center: { lat: 55.41585, lng: 11.3662 },
    polygon: [
      { lat: 55.41615, lng: 11.3657 },
      { lat: 55.41615, lng: 11.3667 },
      { lat: 55.41555, lng: 11.3667 },
      { lat: 55.41555, lng: 11.3657 },
    ],
    residentCountEstimate: 520,
    vulnerableGroupNote:
      'Folkeskole og udendørs skolegårdsarealer på Nørrevangstorvet 6B (særligt følsom børnegruppe i VSV-vindkorridor)',
  },
  {
    id: 'rec-vestsjaellandscentret',
    code: 'VS-CENT',
    name: 'Vestsjællandscentret',
    category: 'custom_receptor',
    address: 'Østerbro 4B, 4200 Slagelse',
    center: { lat: 55.40485, lng: 11.35965 },
    polygon: [
      { lat: 55.40525, lng: 11.35905 },
      { lat: 55.40525, lng: 11.36025 },
      { lat: 55.40445, lng: 11.36025 },
      { lat: 55.40445, lng: 11.35905 },
    ],
    residentCountEstimate: 680,
    vulnerableGroupNote:
      'Indkøbscenter med store ventilationsindtag og byrum på Østerbro 4B sydøst for Ringparken',
  },
  {
    id: 'rec-slagelse-raadhus',
    code: 'RAADHUS',
    name: 'Slagelse Rådhus',
    category: 'custom_receptor',
    address: 'Rådhuspladsen 11, 4200 Slagelse',
    center: { lat: 55.40385, lng: 11.35415 },
    polygon: [
      { lat: 55.4041, lng: 11.35375 },
      { lat: 55.4041, lng: 11.35455 },
      { lat: 55.4036, lng: 11.35455 },
      { lat: 55.4036, lng: 11.35375 },
    ],
    residentCountEstimate: 320,
    vulnerableGroupNote:
      'Kommunal myndighedsbygning og borgerservice på Rådhuspladsen 11 syd for Ringparken',
  },
  {
    id: 'rec-home-kierulffsvej-66',
    code: '$HOME',
    name: '$HOME',
    category: 'residential_block',
    address: 'Kierulffsvej 66, 4200 Slagelse',
    center: { lat: 55.41362, lng: 11.35415 },
    polygon: [
      { lat: 55.41378, lng: 11.35388 },
      { lat: 55.41378, lng: 11.35442 },
      { lat: 55.41346, lng: 11.35442 },
      { lat: 55.41346, lng: 11.35388 },
    ],
    residentCountEstimate: 4,
    vulnerableGroupNote:
      'Privat boligreceptor ($HOME) på Kierulffsvej 66 i Ringparken — direkte eksponeret i nærfeltet fra Bygning 1, Bygning 2 og Blok 1',
  },
];

export interface CriticalScenarioPreset {
  id: string;
  title: string;
  shortLabel: string;
  description: string;
  badgeText: string;
  generate24Hours: (dateIso: string) => HourlyWeatherPoint[];
  defaultFocusHour: number;
}

export const CRITICAL_WEATHER_SCENARIOS: CriticalScenarioPreset[] = [
  {
    id: 'dry-storm-dust',
    title: 'Tør Stormstøvs-hændelse',
    shortLabel: 'Tør Stormstøv',
    description:
      'Kraftig tør vestenvind (8,5–11,4 m/s, vindstød op til 16,8 m/s) efter nattefrost (-1,5°C). Udløser ekstrem asbest- og blystøvs-spredning hen over Kierulffsvej og Afd. 23/26.',
    badgeText: 'Asbest + Bly + Kvarts Kritisk',
    defaultFocusHour: 13,
    generate24Hours: (dateIso: string) =>
      Array.from({ length: 24 }, (_, h) => {
        const isAfternoon = h >= 10 && h <= 17;
        const isHighWindPeakWindow = h >= 11 && h <= 15;
        const temp = h < 7 ? -1.4 + h * 0.2 : 2.5 + Math.sin(((h - 7) / 12) * Math.PI) * 6.5;
        const windSpeed = isHighWindPeakWindow
          ? 10.3 + (h === 13 ? 1.1 : (h % 3) * 0.4)
          : isAfternoon
          ? 9.2
          : 5.4 + (h % 3) * 0.6;
        const gusts = windSpeed * 1.52;
        const dir = 252 + Math.round(Math.sin(h * 0.35) * 14); // WSW -> ENE over Kierulffsvej & Afd 23
        return {
          isoTime: `${dateIso}T${String(h).padStart(2, '0')}:00`,
          hourIndex: h,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          temperature2m: Number(temp.toFixed(1)),
          relativeHumidity2m: isAfternoon ? 38 : 54,
          precipitation: 0,
          cloudCover: 25,
          windSpeed10m: Number(windSpeed.toFixed(1)),
          windDirection10m: dir,
          windGusts10m: Number(gusts.toFixed(1)),
          soilMoisture0To7cm: 0.11,
          directRadiation: isAfternoon ? 420 : 40,
          weatherCode: 1,
          pasquillClass: isAfternoon ? 'C' : 'D',
          hadRecentFreezeThaw: true,
        };
      }),
  },
  {
    id: 'heatwave-pcb',
    title: 'Hedebølge PCB-Afgasning',
    shortLabel: 'Hedebølge PCB',
    description:
      'Høj sommervarme (27,5°C) og intens direkte solindstråling (740 W/m²) kombineret med ustabil atmosfære (Pasquill Klasse A/B). Eksponentiel gasformig PCB-afgasning (>3000 ng/m³).',
    badgeText: 'PCB Gas-Afgasning >3000 ng/m³',
    defaultFocusHour: 14,
    generate24Hours: (dateIso: string) =>
      Array.from({ length: 24 }, (_, h) => {
        const sunCurve = Math.max(0, Math.sin(((h - 5) / 15) * Math.PI));
        const temp = 16.5 + sunCurve * 11.4;
        const rad = Math.round(sunCurve * 760);
        const windSpeed = 2.6 + sunCurve * 1.9;
        const dir = 195 + Math.round(Math.cos(h * 0.3) * 18); // SSW -> NNE toward Kierulffsvej & Afd 24
        return {
          isoTime: `${dateIso}T${String(h).padStart(2, '0')}:00`,
          hourIndex: h,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          temperature2m: Number(temp.toFixed(1)),
          relativeHumidity2m: Math.round(62 - sunCurve * 26),
          precipitation: 0,
          cloudCover: 10,
          windSpeed10m: Number(windSpeed.toFixed(1)),
          windDirection10m: dir,
          windGusts10m: Number((windSpeed * 1.35).toFixed(1)),
          soilMoisture0To7cm: 0.09,
          directRadiation: rad,
          weatherCode: 0,
          pasquillClass: rad > 550 ? 'A' : rad > 250 ? 'B' : 'E',
          hadRecentFreezeThaw: false,
        };
      }),
  },
  {
    id: 'cloudburst-leaching',
    title: 'Skybrud & Jordudvaskning',
    shortLabel: 'Skybrud & Udvaskning',
    description:
      'Kraftigt regnvejr og skybrud (14,6 mm/t) med vindstød. Luftfanen dæmpes delvist, men aktiverer Blå/Lilla Hydrologisk Udvaskningszone med bly, PAH og asbestslam mod vejbrønde og cykelsti.',
    badgeText: 'Hydrologisk Afstrømning Aktiv',
    defaultFocusHour: 16,
    generate24Hours: (dateIso: string) =>
      Array.from({ length: 24 }, (_, h) => {
        const isCloudburst = h >= 14 && h <= 19;
        const precip = isCloudburst ? (h === 16 ? 14.6 : 6.8) : h >= 11 && h <= 21 ? 2.4 : 0.2;
        const windSpeed = isCloudburst ? 7.4 : 4.8;
        const gusts = isCloudburst ? 13.2 : 7.5;
        const dir = 310 + Math.round(Math.sin(h * 0.25) * 12); // NW -> SE toward Kierulffsvej, Afd 26 & Valbyvej
        return {
          isoTime: `${dateIso}T${String(h).padStart(2, '0')}:00`,
          hourIndex: h,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          temperature2m: 14.2,
          relativeHumidity2m: 94,
          precipitation: precip,
          cloudCover: 98,
          windSpeed10m: windSpeed,
          windDirection10m: dir,
          windGusts10m: gusts,
          soilMoisture0To7cm: 0.44,
          directRadiation: 35,
          weatherCode: isCloudburst ? 95 : 63,
          pasquillClass: 'D',
          hadRecentFreezeThaw: false,
        };
      }),
  },
  {
    id: 'nocturnal-inversion',
    title: 'Natlig Inversion (Stabil Atmosfære Klasse F)',
    shortLabel: 'Natlig Inversion',
    description:
      'Klar nat med svag vind (1,8 m/s) og stærk termisk inversion (Pasquill-Gifford Klasse F). Forurening og skimmelsporer fra blottet krybekælder i Blok 1 låses i indåndingshøjde langs boligblokkene.',
    badgeText: 'Pasquill Klasse F — Låst Fane',
    defaultFocusHour: 4,
    generate24Hours: (dateIso: string) =>
      Array.from({ length: 24 }, (_, h) => {
        const isNight = h <= 7 || h >= 20;
        const windSpeed = isNight ? 1.8 : 3.4;
        const dir = 275 + Math.round(Math.cos(h * 0.2) * 8); // W -> E directly along Kierulffsvej
        return {
          isoTime: `${dateIso}T${String(h).padStart(2, '0')}:00`,
          hourIndex: h,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          temperature2m: isNight ? 1.2 : 7.8,
          relativeHumidity2m: isNight ? 89 : 72,
          precipitation: 0,
          cloudCover: isNight ? 12 : 45,
          windSpeed10m: windSpeed,
          windDirection10m: dir,
          windGusts10m: Number((windSpeed * 1.4).toFixed(1)),
          soilMoisture0To7cm: 0.26,
          directRadiation: isNight ? 0 : 190,
          weatherCode: 2,
          pasquillClass: isNight ? 'F' : 'D',
          hadRecentFreezeThaw: true,
        };
      }),
  },
];

export const BUILDING_CATEGORY_METADATA: Record<
  BuildingOperationalCategory,
  BuildingCategoryMetadata
> = {
  a_inhabited: {
    code: 'a_inhabited',
    labelDa: 'a. Beboet',
    colorHex: '#10B981',
    actsAsSource: false,
    sourceEmissionFactor: 0.0,
    actsAsReceptor: true,
    defaultReleaseHeightMeters: 0,
    buildingHeight3DMeters: 12.5,
  },
  b_vacant: {
    code: 'b_vacant',
    labelDa: 'b. Tom',
    colorHex: '#94A3B8',
    actsAsSource: true,
    sourceEmissionFactor: 0.05,
    actsAsReceptor: false,
    defaultReleaseHeightMeters: 2,
    buildingHeight3DMeters: 12.5,
  },
  c_under_renovation: {
    code: 'c_under_renovation',
    labelDa: 'c. Under Renovering',
    colorHex: '#0284C7',
    actsAsSource: true,
    sourceEmissionFactor: 0.45,
    actsAsReceptor: true,
    defaultReleaseHeightMeters: 8,
    buildingHeight3DMeters: 12.5,
  },
  d_under_demolition: {
    code: 'd_under_demolition',
    labelDa: 'd. Under nedrivning',
    colorHex: '#EF4444',
    actsAsSource: true,
    sourceEmissionFactor: 1.0,
    actsAsReceptor: false,
    defaultReleaseHeightMeters: 10,
    buildingHeight3DMeters: 6.0,
  },
  e_demolished_unsecured: {
    code: 'e_demolished_unsecured',
    labelDa: 'e. Nedrevet, ikke sikret',
    colorHex: '#F59E0B',
    actsAsSource: true,
    sourceEmissionFactor: 0.65,
    actsAsReceptor: false,
    defaultReleaseHeightMeters: 1.0,
    buildingHeight3DMeters: 0.0,
  },
};

function makeBuildingFootprint(
  lat: number,
  lng: number,
  halfLat = 0.00011,
  halfLng = 0.00028,
  skewLat = 0.00004
): LatLngPoint[] {
  return [
    { lat: Number((lat + halfLat + skewLat).toFixed(6)), lng: Number((lng - halfLng).toFixed(6)) },
    { lat: Number((lat + halfLat - skewLat).toFixed(6)), lng: Number((lng + halfLng).toFixed(6)) },
    { lat: Number((lat - halfLat - skewLat).toFixed(6)), lng: Number((lng + halfLng).toFixed(6)) },
    { lat: Number((lat - halfLat + skewLat).toFixed(6)), lng: Number((lng - halfLng).toFixed(6)) },
  ];
}

export const RINGPARKEN_MASTER_BUILDINGS: RingparkenBuildingUnit[] = [
  // ============================================================================
  // FOB Afdeling 23 (Grøn zone, 6 blokke, 240 boliger, Kierulffsvej 14-72)
  // ============================================================================
  {
    id: 'BLOK-1',
    code: 'BLOK-1',
    name: 'Blok 1 (Kierulffsvej 14-22)',
    department: 'FOB Afd. 23',
    address: 'Kierulffsvej 14-22, 4200 Slagelse',
    dwellingsCount: 40,
    floors: 4,
    constructionYear: 1965,
    category: 'd_under_demolition',
    helhedsplanEtape: 'Etape 2 del 1 (Nedrivning Blok 1 - 17,49 mio. kr.)',
    center: { lat: 55.41295, lng: 11.35365 },
    footprint: [
      { lat: 55.41304, lng: 11.35325 },
      { lat: 55.4131, lng: 11.35402 },
      { lat: 55.41286, lng: 11.35405 },
      { lat: 55.4128, lng: 11.35328 },
    ],
    fiberReleaseIndex: 0.96,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: true,
    environmentalReportIds: ['PSS-W22085-BLOK1', 'AT-PABUD-2026-BLOK1'],
  },
  {
    id: 'BLOK-2',
    code: 'BLOK-2',
    name: 'Blok 2 (Kierulffsvej 24-32)',
    department: 'FOB Afd. 23',
    address: 'Kierulffsvej 24-32, 4200 Slagelse',
    dwellingsCount: 40,
    floors: 4,
    constructionYear: 1965,
    category: 'c_under_renovation',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.41318, lng: 11.3541 },
    footprint: makeBuildingFootprint(55.41318, 11.3541),
    fiberReleaseIndex: 0.72,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD23-B2'],
  },
  {
    id: 'BLOK-3',
    code: 'BLOK-3',
    name: 'Blok 3 (Kierulffsvej 34-42)',
    department: 'FOB Afd. 23',
    address: 'Kierulffsvej 34-42, 4200 Slagelse',
    dwellingsCount: 40,
    floors: 4,
    constructionYear: 1966,
    category: 'a_inhabited',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.41342, lng: 11.35465 },
    footprint: makeBuildingFootprint(55.41342, 11.35465),
    fiberReleaseIndex: 0.58,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD23-B3'],
  },
  {
    id: 'BLOK-4',
    code: 'BLOK-4',
    name: 'Blok 4 (Kierulffsvej 44-52)',
    department: 'FOB Afd. 23',
    address: 'Kierulffsvej 44-52, 4200 Slagelse',
    dwellingsCount: 40,
    floors: 4,
    constructionYear: 1966,
    category: 'a_inhabited',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.41368, lng: 11.35515 },
    footprint: makeBuildingFootprint(55.41368, 11.35515),
    fiberReleaseIndex: 0.56,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD23-B4'],
  },
  {
    id: 'BLOK-5',
    code: 'BLOK-5',
    name: 'Blok 5 (Kierulffsvej 54-62)',
    department: 'FOB Afd. 23',
    address: 'Kierulffsvej 54-62, 4200 Slagelse',
    dwellingsCount: 40,
    floors: 4,
    constructionYear: 1967,
    category: 'a_inhabited',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.41392, lng: 11.35565 },
    footprint: makeBuildingFootprint(55.41392, 11.35565),
    fiberReleaseIndex: 0.54,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD23-B5'],
  },
  {
    id: 'BLOK-6',
    code: 'BLOK-6',
    name: 'Blok 6 (Kierulffsvej 64-72)',
    department: 'FOB Afd. 23',
    address: 'Kierulffsvej 64-72, 4200 Slagelse',
    dwellingsCount: 40,
    floors: 4,
    constructionYear: 1967,
    category: 'a_inhabited',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.41415, lng: 11.35615 },
    footprint: makeBuildingFootprint(55.41415, 11.35615),
    fiberReleaseIndex: 0.54,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD23-B6'],
  },

  // ============================================================================
  // FOB Afdeling 24 (Blå zone, 4 blokke, 160 boliger, Kierulffsvej 74-104)
  // ============================================================================
  {
    id: 'BLOK-7',
    code: 'BLOK-7',
    name: 'Blok 7 (Kierulffsvej 74-80)',
    department: 'FOB Afd. 24',
    address: 'Kierulffsvej 74-80, 4200 Slagelse',
    dwellingsCount: 40,
    floors: 4,
    constructionYear: 1968,
    category: 'c_under_renovation',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.41445, lng: 11.3566 },
    footprint: makeBuildingFootprint(55.41445, 11.3566),
    fiberReleaseIndex: 0.74,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD24-B7'],
  },
  {
    id: 'BLOK-8',
    code: 'BLOK-8',
    name: 'Blok 8 (Kierulffsvej 82-88)',
    department: 'FOB Afd. 24',
    address: 'Kierulffsvej 82-88, 4200 Slagelse',
    dwellingsCount: 40,
    floors: 4,
    constructionYear: 1968,
    category: 'c_under_renovation',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.41472, lng: 11.35705 },
    footprint: makeBuildingFootprint(55.41472, 11.35705),
    fiberReleaseIndex: 0.73,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD24-B8'],
  },
  {
    id: 'BLOK-9',
    code: 'BLOK-9',
    name: 'Blok 9 (Kierulffsvej 90-96)',
    department: 'FOB Afd. 24',
    address: 'Kierulffsvej 90-96, 4200 Slagelse',
    dwellingsCount: 40,
    floors: 4,
    constructionYear: 1969,
    category: 'b_vacant',
    helhedsplanEtape: 'Etape 2 del 2 (Nedrivning Blok 9-10 - 33,68 mio. kr.)',
    center: { lat: 55.41502, lng: 11.3575 },
    footprint: makeBuildingFootprint(55.41502, 11.3575),
    fiberReleaseIndex: 0.88,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: true,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE2-2-BLOK9'],
  },
  {
    id: 'BLOK-10',
    code: 'BLOK-10',
    name: 'Blok 10 (Kierulffsvej 98-104)',
    department: 'FOB Afd. 24',
    address: 'Kierulffsvej 98-104, 4200 Slagelse',
    dwellingsCount: 40,
    floors: 4,
    constructionYear: 1969,
    category: 'b_vacant',
    helhedsplanEtape: 'Etape 2 del 2 (Nedrivning Blok 9-10 - 33,68 mio. kr.)',
    center: { lat: 55.4153, lng: 11.35795 },
    footprint: makeBuildingFootprint(55.4153, 11.35795),
    fiberReleaseIndex: 0.89,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: true,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE2-2-BLOK10'],
  },

  // ============================================================================
  // FOB Afdeling 26 (Gul zone, 4 blokke, 136 boliger, Albert Ibsensvej 2-22)
  // ============================================================================
  {
    id: 'BLOK-11',
    code: 'BLOK-11',
    name: 'Blok 11 (Albert Ibsensvej 2-6)',
    department: 'FOB Afd. 26',
    address: 'Albert Ibsensvej 2-6, 4200 Slagelse',
    dwellingsCount: 34,
    floors: 4,
    constructionYear: 1969,
    category: 'c_under_renovation',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.4136, lng: 11.3528 },
    footprint: makeBuildingFootprint(55.4136, 11.3528),
    fiberReleaseIndex: 0.71,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD26-B11'],
  },
  {
    id: 'BLOK-12',
    code: 'BLOK-12',
    name: 'Blok 12 (Albert Ibsensvej 8-12)',
    department: 'FOB Afd. 26',
    address: 'Albert Ibsensvej 8-12, 4200 Slagelse',
    dwellingsCount: 34,
    floors: 4,
    constructionYear: 1969,
    category: 'c_under_renovation',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.41388, lng: 11.35325 },
    footprint: makeBuildingFootprint(55.41388, 11.35325),
    fiberReleaseIndex: 0.7,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD26-B12'],
  },
  {
    id: 'BLOK-13',
    code: 'BLOK-13',
    name: 'Blok 13 (Albert Ibsensvej 14-18)',
    department: 'FOB Afd. 26',
    address: 'Albert Ibsensvej 14-18, 4200 Slagelse',
    dwellingsCount: 34,
    floors: 4,
    constructionYear: 1970,
    category: 'a_inhabited',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.41415, lng: 11.3537 },
    footprint: makeBuildingFootprint(55.41415, 11.3537),
    fiberReleaseIndex: 0.55,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD26-B13'],
  },
  {
    id: 'BLOK-14',
    code: 'BLOK-14',
    name: 'Blok 14 (Albert Ibsensvej 20-22)',
    department: 'FOB Afd. 26',
    address: 'Albert Ibsensvej 20-22, 4200 Slagelse',
    dwellingsCount: 34,
    floors: 4,
    constructionYear: 1970,
    category: 'a_inhabited',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.41442, lng: 11.35415 },
    footprint: makeBuildingFootprint(55.41442, 11.35415),
    fiberReleaseIndex: 0.55,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD26-B14'],
  },

  // ============================================================================
  // FOB Afdeling 32 (Rød zone, 6 blokke, 196 boliger: 20x1v, 68x2v, 20x3v, 88x4v)
  // ============================================================================
  {
    id: 'BLOK-15',
    code: 'BLOK-15',
    name: 'Blok 15 (Arnskovsvej 1-5)',
    department: 'FOB Afd. 32',
    address: 'Arnskovsvej 1-5, 4200 Slagelse',
    dwellingsCount: 32,
    floors: 4,
    constructionYear: 1970,
    category: 'c_under_renovation',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.4147, lng: 11.3545 },
    footprint: makeBuildingFootprint(55.4147, 11.3545),
    fiberReleaseIndex: 0.72,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD32-B15'],
  },
  {
    id: 'BLOK-16',
    code: 'BLOK-16',
    name: 'Blok 16 (Jacob Dampesvej 2-8)',
    department: 'FOB Afd. 32',
    address: 'Jacob Dampesvej 2-8, 4200 Slagelse',
    dwellingsCount: 32,
    floors: 4,
    constructionYear: 1971,
    category: 'c_under_renovation',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.41495, lng: 11.35495 },
    footprint: makeBuildingFootprint(55.41495, 11.35495),
    fiberReleaseIndex: 0.71,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD32-B16'],
  },
  {
    id: 'BLOK-17',
    code: 'BLOK-17',
    name: 'Blok 17 (Jacob Dampesvej 10-14)',
    department: 'FOB Afd. 32',
    address: 'Jacob Dampesvej 10-14, 4200 Slagelse',
    dwellingsCount: 32,
    floors: 4,
    constructionYear: 1971,
    category: 'a_inhabited',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.4152, lng: 11.3554 },
    footprint: makeBuildingFootprint(55.4152, 11.3554),
    fiberReleaseIndex: 0.52,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD32-B17'],
  },
  {
    id: 'BLOK-18',
    code: 'BLOK-18',
    name: 'Blok 18 (Albert Ibsensvej 24-34)',
    department: 'FOB Afd. 32',
    address: 'Albert Ibsensvej 24-34, 4200 Slagelse',
    dwellingsCount: 34,
    floors: 4,
    constructionYear: 1971,
    category: 'a_inhabited',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.4154, lng: 11.3559 },
    footprint: makeBuildingFootprint(55.4154, 11.3559),
    fiberReleaseIndex: 0.52,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD32-B18'],
  },
  {
    id: 'BLOK-19',
    code: 'BLOK-19',
    name: 'Blok 19 (Albert Ibsensvej 36-46)',
    department: 'FOB Afd. 32',
    address: 'Albert Ibsensvej 36-46, 4200 Slagelse',
    dwellingsCount: 33,
    floors: 4,
    constructionYear: 1972,
    category: 'a_inhabited',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.4156, lng: 11.35635 },
    footprint: makeBuildingFootprint(55.4156, 11.35635),
    fiberReleaseIndex: 0.51,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD32-B19'],
  },
  {
    id: 'BLOK-20',
    code: 'BLOK-20',
    name: 'Blok 20 (Albert Ibsensvej 48-58)',
    department: 'FOB Afd. 32',
    address: 'Albert Ibsensvej 48-58, 4200 Slagelse',
    dwellingsCount: 33,
    floors: 4,
    constructionYear: 1972,
    category: 'a_inhabited',
    helhedsplanEtape: 'Etape 1 (Renovering - 587,59 mio. kr.)',
    center: { lat: 55.4158, lng: 11.3568 },
    footprint: makeBuildingFootprint(55.4158, 11.3568),
    fiberReleaseIndex: 0.51,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE1-AFD32-B20'],
  },

  // ============================================================================
  // SAB Schackenborgvænge (4 blokke, BLOK-21-SAB-A til BLOK-24-SAB-D)
  // ============================================================================
  {
    id: 'BLOK-21-SAB-A',
    code: 'SAB-A',
    name: 'SAB Blok A (Rødtjørnevej 8-14)',
    department: 'SAB Schackenborgvænge',
    address: 'Rødtjørnevej 8-14, 4200 Slagelse',
    dwellingsCount: 36,
    floors: 4,
    constructionYear: 1964,
    category: 'a_inhabited',
    helhedsplanEtape: 'Frasolgt / Ekstern',
    center: { lat: 55.41265, lng: 11.3519 },
    footprint: makeBuildingFootprint(55.41265, 11.3519),
    fiberReleaseIndex: 0.45,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['SAB-ENV-SCHACKENBORG-A'],
  },
  {
    id: 'BLOK-22-SAB-B',
    code: 'SAB-B',
    name: 'SAB Blok B (Rødtjørnevej 4-6)',
    department: 'SAB Schackenborgvænge',
    address: 'Rødtjørnevej 4-6, 4200 Slagelse',
    dwellingsCount: 32,
    floors: 4,
    constructionYear: 1964,
    category: 'a_inhabited',
    helhedsplanEtape: 'Frasolgt / Ekstern',
    center: { lat: 55.41252, lng: 11.35235 },
    footprint: makeBuildingFootprint(55.41252, 11.35235),
    fiberReleaseIndex: 0.45,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['SAB-ENV-SCHACKENBORG-B'],
  },
  {
    id: 'BLOK-23-SAB-C',
    code: 'SAB-C',
    name: 'SAB Blok C (Schackenborgvænge 2-12)',
    department: 'SAB Schackenborgvænge',
    address: 'Schackenborgvænge 2-12, 4200 Slagelse',
    dwellingsCount: 36,
    floors: 4,
    constructionYear: 1965,
    category: 'a_inhabited',
    helhedsplanEtape: 'Frasolgt / Ekstern',
    center: { lat: 55.41238, lng: 11.35275 },
    footprint: makeBuildingFootprint(55.41238, 11.35275),
    fiberReleaseIndex: 0.45,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['SAB-ENV-SCHACKENBORG-C'],
  },
  {
    id: 'BLOK-24-SAB-D',
    code: 'REC-ROED-2',
    name: 'SAB Blok D (Rødtjørnevej 2)',
    department: 'SAB Schackenborgvænge',
    address: 'Rødtjørnevej 2, 4200 Slagelse',
    dwellingsCount: 32,
    floors: 4,
    constructionYear: 1965,
    category: 'a_inhabited',
    helhedsplanEtape: 'Frasolgt / Ekstern',
    center: { lat: 55.4122, lng: 11.3522 },
    footprint: [
      { lat: 55.41242, lng: 11.35175 },
      { lat: 55.41242, lng: 11.35265 },
      { lat: 55.41198, lng: 11.35265 },
      { lat: 55.41198, lng: 11.35175 },
    ],
    fiberReleaseIndex: 0.48,
    hasCrawlspace: true,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['SAB-ENV-SCHACKENBORG-D'],
  },

  // ============================================================================
  // Erhverv & Institutioner (5 bygninger)
  // ============================================================================
  {
    id: 'BYG-1-BOERNEHAVE',
    code: 'BYG-1',
    name: 'Bygning 1: Børnehave',
    department: 'Erhverv & Institutioner',
    address: 'Kierulffsvej 2, 4200 Slagelse',
    dwellingsCount: 0,
    floors: 1,
    constructionYear: 1968,
    category: 'd_under_demolition',
    helhedsplanEtape: 'Etape 4 (Beboerhus - 10,15 mio. kr.)',
    center: { lat: 55.4132, lng: 11.3541 },
    footprint: [
      { lat: 55.41334, lng: 11.35385 },
      { lat: 55.41334, lng: 11.35435 },
      { lat: 55.41306, lng: 11.35435 },
      { lat: 55.41306, lng: 11.35385 },
    ],
    fiberReleaseIndex: 0.91,
    hasCrawlspace: false,
    hasUnsealedBasementOrSoil: true,
    environmentalReportIds: ['PSS-W22085-BYG1'],
  },
  {
    id: 'BYG-2-BAZAR',
    code: 'BYG-2',
    name: 'Bygning 2: Bazar / Supermarked',
    department: 'Erhverv & Institutioner',
    address: 'Kierulffsvej 12 / Ndr. Ringgade 67B-67F, 4200 Slagelse',
    dwellingsCount: 0,
    floors: 1,
    constructionYear: 1968,
    category: 'd_under_demolition',
    helhedsplanEtape: 'Etape 4 (Beboerhus - 10,15 mio. kr.)',
    center: { lat: 55.4135, lng: 11.3535 },
    footprint: [
      { lat: 55.41366, lng: 11.35318 },
      { lat: 55.41366, lng: 11.35382 },
      { lat: 55.41334, lng: 11.35382 },
      { lat: 55.41334, lng: 11.35318 },
    ],
    fiberReleaseIndex: 0.78,
    hasCrawlspace: false,
    hasUnsealedBasementOrSoil: true,
    environmentalReportIds: ['PSS-W22085-BYG2'],
  },
  {
    id: 'BYG-3-FRITIDSHJEM',
    code: 'BYG-3',
    name: 'Bygning 3: Fritidshjem',
    department: 'Erhverv & Institutioner',
    address: 'Valbyvej 58, 4200 Slagelse',
    dwellingsCount: 0,
    floors: 1,
    constructionYear: 1968,
    category: 'd_under_demolition',
    helhedsplanEtape: 'Etape 4 (Beboerhus - 10,15 mio. kr.)',
    center: { lat: 55.4129, lng: 11.3545 },
    footprint: [
      { lat: 55.41304, lng: 11.35422 },
      { lat: 55.41304, lng: 11.35478 },
      { lat: 55.41276, lng: 11.35478 },
      { lat: 55.41276, lng: 11.35422 },
    ],
    fiberReleaseIndex: 0.74,
    hasCrawlspace: false,
    hasUnsealedBasementOrSoil: true,
    environmentalReportIds: ['PSS-W22085-BYG3'],
  },
  {
    id: 'BYG-4-NORDCENTRET',
    code: 'BYG-4',
    name: 'Bygning 4: Nordcentret / Erhverv',
    department: 'Erhverv & Institutioner',
    address: 'Kierulffsvej 10 / Ndr. Ringgade 65-67A, 4200 Slagelse',
    dwellingsCount: 0,
    floors: 1,
    constructionYear: 1966,
    category: 'b_vacant',
    helhedsplanEtape: 'Frasolgt / Ekstern',
    center: { lat: 55.41382, lng: 11.35215 },
    footprint: makeBuildingFootprint(55.41382, 11.35215, 0.00014, 0.00032, 0),
    fiberReleaseIndex: 0.38,
    hasCrawlspace: false,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['KOMMUNE-ENV-NORDCENTRET'],
  },
  {
    id: 'BYG-5-DAGINST',
    code: 'BYG-5',
    name: 'Bygning 5: Daginstitution & Kvarterhus',
    department: 'Erhverv & Institutioner',
    address: 'Kierulffsvej 4, 4200 Slagelse',
    dwellingsCount: 0,
    floors: 1,
    constructionYear: 1970,
    category: 'a_inhabited',
    helhedsplanEtape: 'Etape 3 (Udearealer - 72,71 mio. kr.)',
    center: { lat: 55.41278, lng: 11.35495 },
    footprint: makeBuildingFootprint(55.41278, 11.35495, 0.00012, 0.00026, 0),
    fiberReleaseIndex: 0.32,
    hasCrawlspace: false,
    hasUnsealedBasementOrSoil: false,
    environmentalReportIds: ['HELHEDSPLAN-ETAPE3-DAGINST'],
  },
];

const LEGACY_SOURCE_ID_BY_BUILDING_ID: Record<string, string> = {
  'BYG-1-BOERNEHAVE': 'src-bygning-1',
  'BYG-2-BAZAR': 'src-bygning-2',
  'BYG-3-FRITIDSHJEM': 'src-bygning-3',
  'BLOK-1': 'src-blok-1',
};

const LEGACY_RECEPTOR_ID_BY_BUILDING_ID: Record<string, string> = {
  'BLOK-24-SAB-D': 'rec-roedtjoornevej-2',
};

export interface SourceNodeOverride {
  active?: boolean;
  releaseHeightMeters?: number;
  fiberReleaseIndex?: number;
  substances?: SubstanceKey[];
}

export function getSourceIdForBuilding(buildingId: string): string {
  return LEGACY_SOURCE_ID_BY_BUILDING_ID[buildingId] || `src-${buildingId.toLowerCase()}`;
}

export function getReceptorIdForBuilding(buildingId: string): string {
  return LEGACY_RECEPTOR_ID_BY_BUILDING_ID[buildingId] || `rec-${buildingId.toLowerCase()}`;
}

export function deriveSourcesFromBuildings(
  buildings: RingparkenBuildingUnit[],
  overrides: Record<string, SourceNodeOverride> = {},
  customSources: DemolitionSourceNode[] = []
): DemolitionSourceNode[] {
  const legacyMap = new Map<string, DemolitionSourceNode>(
    INITIAL_DEMOLITION_SOURCES.map((s) => [s.id, s])
  );

  const derived: DemolitionSourceNode[] = [];

  for (const b of buildings) {
    const meta = BUILDING_CATEGORY_METADATA[b.category];
    if (!meta.actsAsSource) continue;

    const srcId = getSourceIdForBuilding(b.id);
    const legacy = legacyMap.get(srcId);
    const ov = overrides[srcId];

    const defaultSubstances: SubstanceKey[] =
      legacy?.substances ||
      (b.hasCrawlspace || b.hasUnsealedBasementOrSoil
        ? ['asbestos', 'pcb', 'heavyMetals', 'quartzWool', 'moldSewer']
        : ['asbestos', 'pcb', 'heavyMetals', 'quartzWool']);

    const defaultDetails: Record<SubstanceKey, string> = legacy?.substanceDetails || {
      asbestos: `Asbestholdige brystningsplader, fliseklæb og rørisolering (${b.address})`,
      pcb: `PCB i elastiske fuger og maling (${b.constructionYear})`,
      heavyMetals: `Bly og tungmetaller i maling/overflader (${b.code})`,
      quartzWool: `Respirabelt kvartsstøv og gl. mineraluld (<1997) ved indgreb (${b.floors} etg.)`,
      moldSewer: b.hasCrawlspace
        ? 'Skimmelsporer fra krybekælder og blotlagt terræn'
        : 'Kloak- og jordbakterier ved bundopgravning',
    };

    const height3D =
      b.category === 'e_demolished_unsecured'
        ? 0.0
        : b.floors === 1
        ? b.category === 'd_under_demolition'
          ? 4.5
          : 5.5
        : meta.buildingHeight3DMeters;

    derived.push({
      id: srcId,
      code: b.code,
      name: legacy?.name || `${b.name} [${meta.labelDa}]`,
      address: b.address,
      position: b.center,
      footprint: b.footprint,
      releaseHeightMeters: ov?.releaseHeightMeters ?? meta.defaultReleaseHeightMeters,
      substances: ov?.substances ?? defaultSubstances,
      substanceDetails: defaultDetails,
      pssReference:
        legacy?.pssReference ||
        `${b.helhedsplanEtape} (${b.environmentalReportIds.join(', ')})`,
      constructionYearRange:
        legacy?.constructionYearRange || `Opført ${b.constructionYear} (<1997)`,
      materialAgeCategory:
        legacy?.materialAgeCategory ||
        `<1997 Montagebyggeri (${meta.labelDa} — faktor ${meta.sourceEmissionFactor.toFixed(2)})`,
      asbestosBuildingParts: legacy?.asbestosBuildingParts || [
        'Brystnings- og vindspærreplader (<1997)',
        'Fliseklæb i vådrum og faldstammer',
        b.hasCrawlspace ? 'Krybekælder-rørisolering' : 'Tagrum: Gl. mineraluld (<1997)',
      ],
      fiberReleaseIndex: ov?.fiberReleaseIndex ?? b.fiberReleaseIndex,
      healthRiskCorrelation:
        legacy?.healthRiskCorrelation ||
        `Kategori ${meta.labelDa}: Kilde-emissionsfaktor ${meta.sourceEmissionFactor.toFixed(2)} (Jf. BEK 613/2026).`,
      buildingUnitId: b.id,
      buildingCategory: b.category,
      sourceEmissionFactor: meta.sourceEmissionFactor,
      buildingHeight3DMeters: height3D,
      isCustom: false,
      active: ov?.active ?? true,
    });
  }

  return [...derived, ...customSources];
}

export function deriveReceptorsFromBuildings(
  buildings: RingparkenBuildingUnit[],
  customReceptors: ReceptorZone[] = []
): ReceptorZone[] {
  const derivedBuildingReceptors: ReceptorZone[] = [];

  for (const b of buildings) {
    const meta = BUILDING_CATEGORY_METADATA[b.category];
    if (!meta.actsAsReceptor) continue;

    const recId = getReceptorIdForBuilding(b.id);
    const residentEstimate =
      b.dwellingsCount > 0 ? Math.max(10, Math.round(b.dwellingsCount * 2.2)) : 35;

    const vulnerableNote =
      b.category === 'c_under_renovation'
        ? `Arbejdsmiljøzone & delvis genhusning/beboelse under aktiv renovering (${b.helhedsplanEtape}).`
        : b.department === 'Erhverv & Institutioner'
        ? `Institution/erhverv i aktiv drift (${b.address}). Skærpet beskyttelseskrav.`
        : `Beboet boligblok i ${b.department} (${b.dwellingsCount} boliger, ${b.floors} etager).`;

    derivedBuildingReceptors.push({
      id: recId,
      code: b.code,
      name:
        b.id === 'BLOK-24-SAB-D'
          ? 'Rødtjørnevej 2 (Nabo-boligblok vest for Blok 1)'
          : `${b.name} (${b.department})`,
      category: 'residential_block',
      department: b.department,
      address: b.address,
      center: b.center,
      polygon: b.footprint,
      residentCountEstimate: residentEstimate,
      vulnerableGroupNote: vulnerableNote,
      buildingUnitId: b.id,
      buildingCategory: b.category,
      buildingHeight3DMeters: meta.buildingHeight3DMeters,
      isCustom: false,
    });
  }

  // Keep non-building infrastructure/urban receptors from INITIAL_RECEPTOR_ZONES (roads, bike paths, schools, supermarkets)
  const nonBuildingStaticReceptors = INITIAL_RECEPTOR_ZONES.filter(
    (r) =>
      r.id === 'rec-kierulffsvej-corridor' ||
      r.id === 'rec-valbyvej-cykelsti' ||
      r.id === 'rec-netto-ndr-ringgade-65' ||
      r.id === 'rec-lidl-ndr-ringgade-24' ||
      r.id === 'rec-coop365-valbyvej-65b' ||
      r.id === 'rec-slagelse-station' ||
      r.id === 'rec-nordskolen' ||
      r.id === 'rec-vestsjaellandscentret' ||
      r.id === 'rec-slagelse-raadhus' ||
      r.id === 'rec-home-kierulffsvej-66'
  );

  return [...derivedBuildingReceptors, ...nonBuildingStaticReceptors, ...customReceptors];
}

