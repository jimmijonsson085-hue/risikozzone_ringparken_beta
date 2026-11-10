import { SubstanceKey } from '../types/dispersion';
import { RINGPARKEN_MASTER_BUILDINGS } from './ringparkenData';

export interface BuildingSubstanceSampleDetail {
  substanceKey: SubstanceKey;
  substanceLabelDa: string;
  confirmedStatus: 'KONSTATERET_PRØVE' | 'FORUDSAT_FØR_1997' | 'RECEPTOR_EKSPONERING';
  exactBuildingComponents: string[];
  concentrationOrClassificationNote: string;
  toxicologicalAndPhysicalRiskDa: string;
  statutoryReferences: string[];
}

export interface DmaChecklistItem {
  id: string;
  code: string;
  titleDa: string;
  requirementDetailDa: string;
  sourceReference: string;
  mandatoryBeforePhase:
    | 'FØR_OPSTART'
    | 'UNDER_SANERING'
    | 'FØR_MEKANISK_NEDBRYDNING'
    | 'RENOVERING_ETAPE_1';
  defaultVerified: boolean;
}

export interface BuildingEnvironmentalProfile {
  buildingId: string;
  buildingCode: string;
  buildingName: string;
  department: string;
  address: string;
  profileGroupKey:
    | 'BLOK_1_DEMOLITION'
    | 'BYGNING_1_BOERNEHAVE'
    | 'BYGNING_2_BAZAR'
    | 'BYGNING_3_FRITIDSHJEM'
    | 'BLOK_2_20_SYSTEMIC'
    | 'SAB_AND_EXTERNAL';
  profileGroupLabelDa: string;
  reportIds: string[];
  primaryConsultants: string[];
  executiveSummaryDa: string;
  crawlspaceOrBasementNoteDa: string;
  dmaAndPssHeadlineRecommendationDa: string;
  encapsulationVsRemediationPolicyDa?: string;
  mandatoryCourseRequirement2025Da: string;
  substanceSamples: BuildingSubstanceSampleDetail[];
  statutoryReferences: string[];
  dmaChecklist: DmaChecklistItem[];
}

const COMMON_STATUTORY_REFS_2025_2026 = [
  'BEK nr. 613 af 29/06/2026 § 3, stk. 3 (Sumformlen S = Σ Ci/GVi & 2026-grænseværdier)',
  'BEK nr. 1328 af 19/11/2025 & BEK nr. 807/2023 (Asbest i arbejdsmiljøet)',
  'Skærpede AT-regler pr. 21. december 2025 (Lovpligtigt asbestkursusbevis for alle faggrupper)',
  'Autorisationskrav pr. 1. juli 2024 (Autoriseret asbestnedrivningsvirksomhed)',
  'BEK nr. 1399 af 25/06/2021 (Mineraluld <1997 klassificeret som farligt affald)',
  'Den gule PCB-vejledning (2019), Den blå Blyvejledning (2019) & Den grå Støv-vejledning (2019)',
  'AT-instruks IN-9-3 & AT-vejledning C.0.8 (Tungmetaller i malede overflader)',
  'Wissenberg PSS Sag W22085 (Plan for Sikkerhed og Sundhed, Ringparken)',
];

function buildProfileForBuilding(
  buildingId: string
): BuildingEnvironmentalProfile {
  const unit =
    RINGPARKEN_MASTER_BUILDINGS.find((b) => b.id === buildingId) ||
    RINGPARKEN_MASTER_BUILDINGS[0];

  // 1. BLOK 1 (Kierulffsvej 14-22)
  if (buildingId === 'BLOK-1') {
    return {
      buildingId: unit.id,
      buildingCode: unit.code,
      buildingName: unit.name,
      department: unit.department,
      address: unit.address,
      profileGroupKey: 'BLOK_1_DEMOLITION',
      profileGroupLabelDa:
        '1. Blok 1 (Kierulffsvej 14-22 · Aktiv Nedrivning Etape 2 del 1)',
      reportIds: [
        'RING_K18_C08.7_ZMiljørapport',
        'Tilstandsrapport for krybekælder (Blok 1)',
        'Wissenberg PSS Sag W22085 pkt. 7 ID 1.1',
      ],
      primaryConsultants: [
        'Wissenberg Rådgivende Ingeniører (PSS W22085)',
        'Dansk MiljøAnalyse (DMA)',
      ],
      executiveSummaryDa:
        'Komplet miljøkortlægning af Blok 1 (Kierulffsvej 14-22, 40 boliger, 4 etager) dokumenterer asbest i rørbøjninger/T-stykker, facade-/altanbrystningsplader og altanfuger, PCB i maling, fuger og gulvbelægninger, tungmetaller (Pb, Cd, Cr, Cu, Ni, Zn, Hg, As) i alle malede overflader, <1997 mineraluld omkring tekniske installationer samt krybekælder under hele blokken og forurenet jord ved opgravning af kloak/stikledninger.',
      crawlspaceOrBasementNoteDa:
        'Krybekælder under hele blokken; forurenet jord ved opgravning af kloak og stikledninger i terræn. Rydning af krybekælder må først foretages, efter overliggende dæk er fjernet (PSS pkt. 7 ID 1.1).',
      dmaAndPssHeadlineRecommendationDa:
        'Rydning af krybekælder må først foretages, efter overliggende dæk er fjernet (PSS pkt. 7 ID 1.1). Før mekanisk nedbrydning og knusning af beton skal PCB-holdige fuger, maling og grænsefladebeton bortrenses iht. Den gule PCB-vejledning (2019) og AT-instruks IN-9-3 for at forhindre sekundær PCB-kontaminering af knust beton.',
      encapsulationVsRemediationPolicyDa:
        'Total nedrivning (Etape 2 del 1 - 17,49 mio. kr.): Samtlige miljøfarlige bygningsdele (asbestbrystninger, altanfuger, rørbøjninger og PCB-grænsefladebeton) skal selektivt miljøsaneres før maskinel nedbrydning af råhuset.',
      mandatoryCourseRequirement2025Da:
        'Krav om autoriseret asbestnedrivningsvirksomhed (pr. 1. juli 2024) og lovpligtigt asbestkursusbevis for alt udførende mandskab jf. BEK 807/2023, BEK 1328/2025 og skærpede AT-regler pr. 21. december 2025.',
      substanceSamples: [
        {
          substanceKey: 'asbestos',
          substanceLabelDa: 'Asbest (Krysotil / Amfibol)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Rørbøjninger og T-stykker mv. i krybekælder og teknikskakte',
            'Brystningsplader på facader og altaner',
            'Fuger omkring altaner og facadeelementer',
          ],
          concentrationOrClassificationNote:
            'Stærkt støvende asbest i rørisolering/bøjninger samt asbestcement og asbestholdig fugemasse på facader/altaner (2026-GV: 0,003 fibre/cm³).',
          toxicologicalAndPhysicalRiskDa:
            'Høj risiko for luftbåren fiberfrigivelse ved mekanisk nedbrydning af altaner/brystninger og ved blotlæggelse af rør i krybekælder.',
          statutoryReferences: [
            'BEK nr. 1328 af 19/11/2025',
            'BEK nr. 613 af 29/06/2026 (0,003 fibre/cm³)',
            'RING_K18_C08.7_ZMiljørapport',
          ],
        },
        {
          substanceKey: 'pcb',
          substanceLabelDa: 'PCB (Polychlorerede Biphenyler)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Malede overflader (indvendigt og udvendigt)',
            'Enkelte elastiske fuger omkring elementer, vinduer og altaner',
            'Gulvbelægninger',
            'Sekundær indtrængning i grænsefladebeton',
          ],
          concentrationOrClassificationNote:
            'Konstateret i malede overflader, enkelte fuger og gulvbelægninger. Kræver bortrensning af grænsefladebeton før knusning.',
          toxicologicalAndPhysicalRiskDa:
            'Temperaturdrevet afgasning (Clausius-Clapeyron) og risiko for sekundær PCB-kontaminering af knust beton ved manglende for-sanering.',
          statutoryReferences: [
            'Den gule PCB-vejledning (2019)',
            'AT-instruks IN-9-3',
            'RING_K18_C08.7_ZMiljørapport',
          ],
        },
        {
          substanceKey: 'heavyMetals',
          substanceLabelDa: 'Tungmetaller (Pb, Cd, Cr, Cu, Ni, Zn, Hg, As)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Generelt i alle malede overflader (vægge, lofter, træværk, stål og betonelementer)',
            'Forurenet jord ved opgravning af kloak og stikledninger i terræn',
          ],
          concentrationOrClassificationNote:
            'Bly (Pb), cadmium (Cd), krom (Cr), kobber (Cu), nikkel (Ni), zink (Zn), kviksølv (Hg) og arsen (As) konstateret generelt i alle malede overflader (2026-GV Bly: 0,03 mg/m³).',
          toxicologicalAndPhysicalRiskDa:
            'Frigives som fint tungmetalholdigt støv ved mekanisk betonknusning samt ved opgravning af uforseglet jord omkring kloaktracé.',
          statutoryReferences: [
            'AT-vejledning C.0.8',
            'Den blå Blyvejledning (2019)',
            'BEK nr. 613 af 29/06/2026 (Bly GV 0,03 mg/m³)',
          ],
        },
        {
          substanceKey: 'quartzWool',
          substanceLabelDa: 'Mineraluld (<1997) & Respirabelt Kvarts (SiO₂)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Isolering omkring tekniske installationer og rør (<1997)',
            'Respirabelt krystallinsk kvartsstøv fra mekanisk nedbrydning af betondæk og bærende vægge',
          ],
          concentrationOrClassificationNote:
            'Gammel mineraluld (<1997) er klassificeret som farligt affald jf. BEK nr. 1399 af 25.06.2021 (Carc. 2, H351). Kvarts GV: 0,1 mg/m³.',
          toxicologicalAndPhysicalRiskDa:
            'Spredning af biopersistente mineralfibre og skarpe SiO₂-partikler (<4 µm) ved uafdækket nedbrydning.',
          statutoryReferences: [
            'BEK nr. 1399 af 25.06.2021',
            'Den grå Støv-vejledning (2019)',
            'BEK nr. 613 af 29/06/2026',
          ],
        },
        {
          substanceKey: 'moldSewer',
          substanceLabelDa: 'Krybekælder, Skimmel & Forurenet Kloakjord',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Krybekælder under hele Blok 1',
            'Opgravet kloaktracé og stikledninger i terræn omkring Blok 1',
          ],
          concentrationOrClassificationNote:
            'Tilstandsrapport for krybekælder dokumenterer fugt, bioaerosoler og rørisolering under hele blokken samt jordforurening ved kloak.',
          toxicologicalAndPhysicalRiskDa:
            'Akut spredning af skimmelsporer, endotoksiner og kloakaerosoler når overliggende betondæk fjernes over krybekælderen.',
          statutoryReferences: [
            'Wissenberg PSS Sag W22085 pkt. 7 ID 1.1',
            'Jordforureningslovens § 12 og § 70, stk. 4 (4-ugers lejerunderretning)',
          ],
        },
      ],
      statutoryReferences: [
        ...COMMON_STATUTORY_REFS_2025_2026,
        'Wissenberg PSS Sag W22085 pkt. 7 ID 1.1 (Rydning af krybekælder først efter dæk er fjernet)',
        'Jordforureningslovens § 70, stk. 4 (4-ugers underretningspligt ved arbejde i forurenet jord)',
      ],
      dmaChecklist: [
        {
          id: 'dma-blok1-1',
          code: 'PSS-7-ID-1.1',
          titleDa: 'Krybekælder ryddes først efter fjernelse af overliggende dæk',
          requirementDetailDa:
            'Jf. Wissenberg PSS pkt. 7 ID 1.1 og Tilstandsrapport for krybekælder må rydning og sanering i krybekælder under Blok 1 først udføres, når overliggende dæk er fjernet, så kollaps- og indespærringsfare elimineres.',
          sourceReference: 'Wissenberg PSS W22085 pkt. 7 ID 1.1',
          mandatoryBeforePhase: 'UNDER_SANERING',
          defaultVerified: true,
        },
        {
          id: 'dma-blok1-2',
          code: 'DMA-PCB-IN9-3',
          titleDa: 'Bortrensning af PCB-fuger, maling og grænsefladebeton før knusning',
          requirementDetailDa:
            'Før mekanisk nedbrydning og knusning af beton skal PCB-holdige fuger, maling, gulvbelægninger og grænsefladebeton bortrenses iht. Den gule PCB-vejledning (2019) og AT-instruks IN-9-3 for at forhindre sekundær PCB-kontaminering af knust beton.',
          sourceReference: 'Den gule PCB-vejledning (2019) & AT-instruks IN-9-3',
          mandatoryBeforePhase: 'FØR_MEKANISK_NEDBRYDNING',
          defaultVerified: true,
        },
        {
          id: 'dma-blok1-3',
          code: 'DMA-ASB-FACADE',
          titleDa: 'Selektiv demontering af asbest-brystningsplader, altanfuger og rørbøjninger',
          requirementDetailDa:
            'Rørbøjninger, T-stykker mv. i krybekælder samt brystningsplader og altanfuger på facader skal fjernes af autoriseret virksomhed før råhusnedbrydning.',
          sourceReference: 'RING_K18_C08.7_ZMiljørapport & BEK 1328/2025',
          mandatoryBeforePhase: 'FØR_MEKANISK_NEDBRYDNING',
          defaultVerified: true,
        },
        {
          id: 'dma-blok1-4',
          code: 'DMA-MIN-1399',
          titleDa: 'Separat udtagning af <1997 mineraluld som farligt affald',
          requirementDetailDa:
            'Isolering omkring tekniske installationer (<1997) udtages og emballeres støvtæt som farligt affald jf. BEK nr. 1399 af 25.06.2021.',
          sourceReference: 'BEK nr. 1399 af 25.06.2021',
          mandatoryBeforePhase: 'UNDER_SANERING',
          defaultVerified: true,
        },
      ],
    };
  }

  // 2. BYGNING 1 – BØRNEHAVE (Kierulffsvej 2)
  if (buildingId === 'BYG-1-BOERNEHAVE') {
    return {
      buildingId: unit.id,
      buildingCode: unit.code,
      buildingName: unit.name,
      department: unit.department,
      address: unit.address,
      profileGroupKey: 'BYGNING_1_BOERNEHAVE',
      profileGroupLabelDa:
        '2. Bygning 1 – Børnehave (Kierulffsvej 2 · Rapport 2021-2791)',
      reportIds: [
        '2021-2791 Kierulffsvej 2 - Bygning 1',
        'RING_C05_K18_Miljønotat - Bygning 1',
        'Wissenberg PSS Sag W22085 pkt. 6 ID 2.4',
      ],
      primaryConsultants: [
        'Dansk MiljøAnalyse (DMA · Rapport 2021-2791)',
        'Wissenberg Rådgivende Ingeniører (RING_C05_K18_Miljønotat)',
      ],
      executiveSummaryDa:
        'Miljøkortlægning af Bygning 1 – Børnehave (Kierulffsvej 2) påviser asbest i vægfliser (fliser og fliseklæb) samt i rørbøjninger og T-stykker mv., PCB i malede overflader, enkelte fuger og gulvbelægninger, tungmetaller (bly, cadmium, krom, kobber, nikkel, zink, kviksølv, arsen) i alle malede overflader, <1997 mineraluld i tagrum og tekniske installationer samt kraftig skimmelvækst i kælderen.',
      crawlspaceOrBasementNoteDa:
        'Kælder med registreret kraftig skimmelvækst. Ved arbejde i kælder kræves P3-åndedrætsværn og beskyttelsesdragt jf. PSS pkt. 6 ID 2.4.',
      dmaAndPssHeadlineRecommendationDa:
        'Sanering af asbestvægfliser skal udføres i støvtæt undertrykszone af autoriseret virksomhed (krav pr. 1. juli 2024) med uddannet personale (BEK 807/2023, BEK 1328/2025 og skærpede AT-regler pr. 21. december 2025). Ved arbejde i kælder med kraftig skimmelvækst skal anvendes P3-åndedrætsværn og beskyttelsesdragt (PSS pkt. 6 ID 2.4).',
      mandatoryCourseRequirement2025Da:
        'Indvendig nedrivning af asbestvægfliser/fliseklæb og rørbøjninger kræver autoriseret virksomhed (pr. 1. juli 2024) og lovpligtigt 4-dages asbestkursusbevis (BEK 807/2023, BEK 1328/2025 og skærpede AT-regler pr. 21. december 2025).',
      substanceSamples: [
        {
          substanceKey: 'asbestos',
          substanceLabelDa: 'Asbest (Fliseklæb & Rørisolering)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Vægfliser (både fliser og asbestholdig fliseklæb)',
            'Rørbøjninger og T-stykker mv. i kælder og teknikføringer',
          ],
          concentrationOrClassificationNote:
            'Asbest påvist i vægfliser/fliseklæb samt i rørbøjninger og T-stykker mv. (Rapport 2021-2791 Kierulffsvej 2 - Bygning 1).',
          toxicologicalAndPhysicalRiskDa:
            'Nedhugning af vægfliser med asbestklæb og rørskåle frigiver høje koncentrationer af respirable asbestfibre og kræver støvtæt undertrykstelt.',
          statutoryReferences: [
            'BEK nr. 807/2023 & BEK nr. 1328/2025',
            'Autorisationskrav pr. 1. juli 2024',
            'Skærpede AT-regler pr. 21. december 2025',
          ],
        },
        {
          substanceKey: 'pcb',
          substanceLabelDa: 'PCB (Polychlorerede Biphenyler)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Malede overflader',
            'Enkelte fuger',
            'Gulvbelægninger',
          ],
          concentrationOrClassificationNote:
            'PCB konstateret i malede overflader, enkelte fuger og gulvbelægninger jf. 2021-2791 Kierulffsvej 2 - Bygning 1.',
          toxicologicalAndPhysicalRiskDa:
            'Frigivelse af PCB-holdigt støv og dampe ved sanering og nedbrydning tæt på Rødtjørnevej 2.',
          statutoryReferences: [
            'Den gule PCB-vejledning (2019)',
            'AT-instruks IN-9-3',
          ],
        },
        {
          substanceKey: 'heavyMetals',
          substanceLabelDa: 'Tungmetaller (Pb, Cd, Cr, Cu, Ni, Zn, Hg, As)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Alle malede overflader i børnehaven (bly, cadmium, krom, kobber, nikkel, zink, kviksølv, arsen)',
          ],
          concentrationOrClassificationNote:
            'Alle 8 tungmetaller (Pb, Cd, Cr, Cu, Ni, Zn, Hg, As) påvist generelt i malede overflader.',
          toxicologicalAndPhysicalRiskDa:
            'Neurotoksisk bly- og tungmetalstøv ved afrensning og mekanisk nedbrydning.',
          statutoryReferences: [
            'AT-vejledning C.0.8',
            'Den blå Blyvejledning (2019)',
            'BEK nr. 613 af 29/06/2026',
          ],
        },
        {
          substanceKey: 'quartzWool',
          substanceLabelDa: 'Mineraluld (<1997) & Kvartsstøv',
          confirmedStatus: 'FORUDSAT_FØR_1997',
          exactBuildingComponents: [
            'Mineraluld i tagrum (<1997)',
            'Mineraluld omkring tekniske installationer (<1997)',
          ],
          concentrationOrClassificationNote:
            'Mineraluld i tagrum og omkring tekniske installationer forudsættes ældre end 1997 (farligt affald jf. BEK 1399/2021).',
          toxicologicalAndPhysicalRiskDa:
            'Frigivelse af <1997 mineralfibre ved nedtagning af tagkonstruktion og rør.',
          statutoryReferences: [
            'BEK nr. 1399 af 25.06.2021',
            'RING_C05_K18_Miljønotat - Bygning 1',
          ],
        },
        {
          substanceKey: 'moldSewer',
          substanceLabelDa: 'Kraftig Skimmelvækst i Kælder',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Kælderrum, kældervægge og lofter i Bygning 1 (Kierulffsvej 2)',
          ],
          concentrationOrClassificationNote:
            'Kraftig skimmelvækst registreret i kælder jf. RING_C05_K18_Miljønotat - Bygning 1 og PSS pkt. 6 ID 2.4.',
          toxicologicalAndPhysicalRiskDa:
            'Høj koncentration af mykotoksiner, β-glucaner og skimmelsporer (CFU/m³) ved adgang til eller åbning af kælder.',
          statutoryReferences: [
            'Wissenberg PSS Sag W22085 pkt. 6 ID 2.4',
            'AT-vejledning om skimmelsvamp ved nedrivning',
          ],
        },
      ],
      statutoryReferences: [
        ...COMMON_STATUTORY_REFS_2025_2026,
        'Wissenberg PSS Sag W22085 pkt. 6 ID 2.4 (P3-åndedrætsværn & beskyttelsesdragt ved skimmel i kælder)',
      ],
      dmaChecklist: [
        {
          id: 'dma-byg1-1',
          code: 'DMA-ASB-FLISER',
          titleDa: 'Støvtæt undertrykszone ved sanering af asbestvægfliser & rørbøjninger',
          requirementDetailDa:
            'Sanering af asbestvægfliser (fliser og fliseklæb) samt rørbøjninger/T-stykker skal udføres i støvtæt undertrykszone af autoriseret virksomhed (krav pr. 1. juli 2024) med uddannet personale (BEK 807/2023, BEK 1328/2025 og skærpede AT-regler pr. 21. december 2025).',
          sourceReference: '2021-2791 Kierulffsvej 2 - Bygning 1 & BEK 1328/2025',
          mandatoryBeforePhase: 'UNDER_SANERING',
          defaultVerified: true,
        },
        {
          id: 'dma-byg1-2',
          code: 'PSS-6-ID-2.4',
          titleDa: 'P3-åndedrætsværn og beskyttelsesdragt i kælder med kraftig skimmelvækst',
          requirementDetailDa:
            'Ved ethvert arbejde og miljøsanering i kælderen under Bygning 1 med kraftig skimmelvækst skal anvendes P3-åndedrætsværn og støvtæt beskyttelsesdragt jf. PSS pkt. 6 ID 2.4.',
          sourceReference: 'Wissenberg PSS Sag W22085 pkt. 6 ID 2.4',
          mandatoryBeforePhase: 'FØR_OPSTART',
          defaultVerified: true,
        },
        {
          id: 'dma-byg1-3',
          code: 'DMA-TAG-ULD',
          titleDa: 'Udtagning af <1997 mineraluld i tagrum som farligt affald',
          requirementDetailDa:
            'Mineraluld i tagrum og omkring tekniske installationer (<1997) udtages selektivt som farligt affald før maskinel nedrivning.',
          sourceReference: 'RING_C05_K18_Miljønotat - Bygning 1 & BEK 1399/2021',
          mandatoryBeforePhase: 'FØR_MEKANISK_NEDBRYDNING',
          defaultVerified: true,
        },
      ],
    };
  }

  // 3. BYGNING 2 – SUPERMARKED / BAZAR (Kierulffsvej 12)
  if (buildingId === 'BYG-2-BAZAR') {
    return {
      buildingId: unit.id,
      buildingCode: unit.code,
      buildingName: unit.name,
      department: unit.department,
      address: unit.address,
      profileGroupKey: 'BYGNING_2_BAZAR',
      profileGroupLabelDa:
        '3. Bygning 2 – Supermarked/Bazar (Kierulffsvej 12 · Rapport 2021-2791)',
      reportIds: [
        '2021-2791 Kierulffsvej 12 - Bygning 2',
        'RING_C05_K18_Miljønotat - Bygning 2',
        'Wissenberg PSS Sag W22085 pkt. 6 ID 1.1',
      ],
      primaryConsultants: [
        'Dansk MiljøAnalyse (DMA · Rapport 2021-2791)',
        'Wissenberg Rådgivende Ingeniører (RING_C05_K18_Miljønotat)',
      ],
      executiveSummaryDa:
        'Miljøkortlægning af Bygning 2 – Supermarked/Bazar (Kierulffsvej 12) dokumenterer asbest i isolering om ventilationskanaler, i membran på kælder samt i rørbøjninger og T-stykker mv., PCB i malede overflader, enkelte fuger og gulvbelægninger, tungmetaller (Pb, Cd, Cr, Cu, Ni, Zn, Hg, As) i alle malede overflader, <1997 mineraluld i tagrum/teknik samt kraftig skimmelvækst i både stueetage og kælder.',
      crawlspaceOrBasementNoteDa:
        'Kælder med asbestholdig membran på kælderydervægge samt kraftig skimmelvækst i både stueetage og kælder. Udgravning ved kælderydervæg kræver afstivning/gravekasse og rækværk 2 m fra kant (PSS pkt. 6 ID 1.1).',
      dmaAndPssHeadlineRecommendationDa:
        'Fjernelse af asbestholdig membran på kælderydervægge kræver udgravning sikret med afstivning/gravekasse og rækværk 2 m fra kant (PSS pkt. 6 ID 1.1) samt våd asbestsanering, så asbestmembran ikke sammenblandes med jord ved opgravning. Historisk støv skal støvsuges før nedrivning iht. Den grå Støv-vejledning (2019).',
      mandatoryCourseRequirement2025Da:
        'Fjernelse af asbestisolering om ventilationskanaler, rørbøjninger og asbestmembran på kælder kræver autoriseret virksomhed (1. juli 2024) og lovpligtigt asbestkursusbevis (pr. 21. december 2025).',
      substanceSamples: [
        {
          substanceKey: 'asbestos',
          substanceLabelDa: 'Asbest (Ventilationskanaler, Kældermembran & Rørbøjninger)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Isolering om ventilationskanaler',
            'Membran på kælder (asbestholdig fugt-/tjæremembran på kælderydervægge)',
            'Rørbøjninger og T-stykker mv.',
          ],
          concentrationOrClassificationNote:
            'Kritisk forekomst af asbest i ventilationskanalisolering, kældermembran og rørbøjninger (Rapport 2021-2791 Kierulffsvej 12 - Bygning 2).',
          toxicologicalAndPhysicalRiskDa:
            'Risiko for både luftbåren fiberspredning fra ventilationskanaler og sammenblanding af asbestmembran med opgravet jord ved kælderydervægge.',
          statutoryReferences: [
            '2021-2791 Kierulffsvej 12 - Bygning 2',
            'Wissenberg PSS Sag W22085 pkt. 6 ID 1.1',
            'BEK nr. 1328 af 19/11/2025 & BEK nr. 613 af 29/06/2026',
          ],
        },
        {
          substanceKey: 'pcb',
          substanceLabelDa: 'PCB (Polychlorerede Biphenyler)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Malede overflader',
            'Enkelte fuger',
            'Gulvbelægninger',
          ],
          concentrationOrClassificationNote:
            'PCB konstateret i malede overflader, enkelte fuger og gulvbelægninger i Bygning 2.',
          toxicologicalAndPhysicalRiskDa:
            'PCB-afgasning og støvspredning ved mekanisk opbrydning af gulve og vægge.',
          statutoryReferences: [
            'Den gule PCB-vejledning (2019)',
            'AT-instruks IN-9-3',
          ],
        },
        {
          substanceKey: 'heavyMetals',
          substanceLabelDa: 'Tungmetaller (Pb, Cd, Cr, Cu, Ni, Zn, Hg, As)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Alle malede overflader i Bygning 2 (stueetage og kælder)',
            'Historisk aflejret støv i tagrum og teknikrum',
          ],
          concentrationOrClassificationNote:
            'Tungmetaller konstateret i alle malede overflader; historisk støv skal H-klasse støvsuges før nedrivning iht. Den grå Støv-vejledning (2019).',
          toxicologicalAndPhysicalRiskDa:
            'Ophvirvling af historisk tungmetalstøv og malingflager ved nedbrydning.',
          statutoryReferences: [
            'Den grå Støv-vejledning (2019)',
            'Den blå Blyvejledning (2019)',
            'AT-vejledning C.0.8',
          ],
        },
        {
          substanceKey: 'quartzWool',
          substanceLabelDa: 'Mineraluld (<1997) & Betonkvartsstøv',
          confirmedStatus: 'FORUDSAT_FØR_1997',
          exactBuildingComponents: [
            'Tagrum (<1997 mineraluld)',
            'Tekniske installationer (<1997 mineraluld)',
            'Tunge betondæk og kældervægge (hydraulisk mejselhammer >85 dB(A))',
          ],
          concentrationOrClassificationNote:
            'Mineraluld i tagrum og tekniske installationer er <1997 (farligt affald jf. BEK 1399/2021).',
          toxicologicalAndPhysicalRiskDa:
            'Kombineret frigivelse af respirabelt kvartsstøv og <1997 mineralfibre samt impulsstøj ved opbrydning af kælder.',
          statutoryReferences: [
            'BEK nr. 1399 af 25.06.2021',
            'Den grå Støv-vejledning (2019)',
          ],
        },
        {
          substanceKey: 'moldSewer',
          substanceLabelDa: 'Kraftig Skimmelvækst i Stueetage & Kælder',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Stueetage (tidligere supermarked/bazar)',
            'Kælder under Bygning 2',
          ],
          concentrationOrClassificationNote:
            'Kraftig skimmelvækst registreret i BÅDE stueetage og kælder jf. RING_C05_K18_Miljønotat - Bygning 2.',
          toxicologicalAndPhysicalRiskDa:
            'Massiv bioaerosol- og endotoksinfrigivelse ved åbning af facader og mekanisk nedbrydning af stueetage og kælder.',
          statutoryReferences: [
            'RING_C05_K18_Miljønotat - Bygning 2',
            'Wissenberg PSS Sag W22085 pkt. 6 ID 2.4',
          ],
        },
      ],
      statutoryReferences: [
        ...COMMON_STATUTORY_REFS_2025_2026,
        'Wissenberg PSS Sag W22085 pkt. 6 ID 1.1 (Afstivning/gravekasse & rækværk 2 m fra udgravningskant)',
        'Den grå Støv-vejledning (2019) (Forudgående støvsugning af historisk støv)',
      ],
      dmaChecklist: [
        {
          id: 'dma-byg2-1',
          code: 'PSS-6-ID-1.1',
          titleDa: 'Sikret udgravning (afstivning/gravekasse & rækværk 2 m fra kant) ved asbest-kældermembran',
          requirementDetailDa:
            'Fjernelse af asbestholdig membran på kælderydervægge kræver udgravning sikret med afstivning/gravekasse og rækværk 2 m fra kant (PSS pkt. 6 ID 1.1) samt våd asbestsanering, så asbestmembran ikke sammenblandes med jord ved opgravning.',
          sourceReference: 'Wissenberg PSS W22085 pkt. 6 ID 1.1 & 2021-2791 Bygning 2',
          mandatoryBeforePhase: 'UNDER_SANERING',
          defaultVerified: true,
        },
        {
          id: 'dma-byg2-2',
          code: 'DMA-VENT-ASB',
          titleDa: 'Undertrykssanering af asbestisolering om ventilationskanaler og rørbøjninger',
          requirementDetailDa:
            'Asbestisolering omkring ventilationskanaler samt rørbøjninger/T-stykker fjernes i støvtæt indkapsling før mekanisk nedbrydning.',
          sourceReference: '2021-2791 Kierulffsvej 12 - Bygning 2',
          mandatoryBeforePhase: 'UNDER_SANERING',
          defaultVerified: true,
        },
        {
          id: 'dma-byg2-3',
          code: 'DMA-STOEV-2019',
          titleDa: 'H-klasse støvsugning af historisk støv før nedrivning',
          requirementDetailDa:
            'Historisk støv i tagrum, stueetage og kælder skal støvsuges med H-klasse støvsuger før nedrivning iht. Den grå Støv-vejledning (2019).',
          sourceReference: 'Den grå Støv-vejledning (2019)',
          mandatoryBeforePhase: 'FØR_OPSTART',
          defaultVerified: true,
        },
        {
          id: 'dma-byg2-4',
          code: 'DMA-SKIMMEL-STUE-KAELDER',
          titleDa: 'Værnemidler (P3 & dragt) mod kraftig skimmel i både stueetage og kælder',
          requirementDetailDa:
            'Grundet kraftig skimmelvækst i både stueetage og kælder skal mandskab bære P3-åndedrætsværn og støvtæt dragt, og støvspredning mod Rødtjørnevej 2 skal vandes ned.',
          sourceReference: 'RING_C05_K18_Miljønotat - Bygning 2 & PSS pkt. 6 ID 2.4',
          mandatoryBeforePhase: 'FØR_OPSTART',
          defaultVerified: true,
        },
      ],
    };
  }

  // 4. BYGNING 3 – FRITIDSHJEM (Valbyvej 58)
  if (buildingId === 'BYG-3-FRITIDSHJEM') {
    return {
      buildingId: unit.id,
      buildingCode: unit.code,
      buildingName: unit.name,
      department: unit.department,
      address: unit.address,
      profileGroupKey: 'BYGNING_3_FRITIDSHJEM',
      profileGroupLabelDa:
        '4. Bygning 3 – Fritidshjem (Valbyvej 58 · Rapport 2021-2791)',
      reportIds: [
        '2021-2791 Valbyvej 58 - Bygning 3',
        'RING_C05_K18_Miljønotat - Bygning 3',
        'Wissenberg PSS Sag W22085',
      ],
      primaryConsultants: [
        'Dansk MiljøAnalyse (DMA · Rapport 2021-2791)',
        'Wissenberg Rådgivende Ingeniører (RING_C05_K18_Miljønotat)',
      ],
      executiveSummaryDa:
        'Miljøkortlægning af Bygning 3 – Fritidshjem (Valbyvej 58) dokumenterer asbest i brystningsplader, linoleum og klæb på gulve, vindspærreplade i facade samt i rørbøjninger og T-stykker mv., PCB i malede overflader, fuger og gulvbelægninger, tungmetaller i alle malede overflader samt <1997 mineraluld i tagrum og tekniske installationer.',
      crawlspaceOrBasementNoteDa:
        'Direkte grænsende op til offentlig cykelsti og fortov langs Valbyvej 58 samt tæt på SAB Schackenborgvænge.',
      dmaAndPssHeadlineRecommendationDa:
        'Asbestholdige vindspærreplader i facaden og linoleum/klæb har høj risiko for fiberfrigivelse ved mekanisk brud. De skal demonteres intakt under lokal udsugning/indkapsling før maskinel nedrivning af råhuset.',
      mandatoryCourseRequirement2025Da:
        'Demontering af asbestholdige vindspærreplader, brystningsplader, linoleum/klæb og rørbøjninger kræver autoriseret virksomhed (1. juli 2024) og lovpligtigt asbestkursusbevis (pr. 21. december 2025).',
      substanceSamples: [
        {
          substanceKey: 'asbestos',
          substanceLabelDa:
            'Asbest (Brystningsplader, Linoleum & Klæb, Vindspærreplade i Facade & Rørbøjninger)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Brystningsplader i facade',
            'Linoleum og klæb på gulve',
            'Vindspærreplade i facade',
            'Rørbøjninger og T-stykker mv.',
          ],
          concentrationOrClassificationNote:
            '4 særskilte asbestfraktioner påvist i Rapport 2021-2791 Valbyvej 58 - Bygning 3: brystningsplader, linoleum/klæb, vindspærreplader og rørbøjninger.',
          toxicologicalAndPhysicalRiskDa:
            'Meget høj risiko for akut fiberfrigivelse ved mekanisk brud på vindspærreplader og brystningsplader samt ved opbrydning af linoleumsgulve og klæb.',
          statutoryReferences: [
            '2021-2791 Valbyvej 58 - Bygning 3',
            'RING_C05_K18_Miljønotat - Bygning 3',
            'BEK nr. 1328 af 19/11/2025 & BEK nr. 613 af 29/06/2026',
          ],
        },
        {
          substanceKey: 'pcb',
          substanceLabelDa: 'PCB (Polychlorerede Biphenyler)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Malede overflader',
            'Fuger omkring vinduer og facadeelementer',
            'Gulvbelægninger',
          ],
          concentrationOrClassificationNote:
            'PCB konstateret i malede overflader, fuger og gulvbelægninger i Bygning 3.',
          toxicologicalAndPhysicalRiskDa:
            'Spredning af PCB-holdigt støv mod Valbyvej og nærliggende boligblokke ved manglende selektiv udtagning.',
          statutoryReferences: [
            'Den gule PCB-vejledning (2019)',
            'AT-instruks IN-9-3',
          ],
        },
        {
          substanceKey: 'heavyMetals',
          substanceLabelDa: 'Tungmetaller (Pb, Cd, Cr, Cu, Ni, Zn, Hg, As)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Alle malede overflader i fritidshjemmet (indvendigt og udvendigt)',
          ],
          concentrationOrClassificationNote:
            'Tungmetaller (bly, cadmium, krom, kobber, nikkel, zink, kviksølv, arsen) konstateret i alle malede overflader.',
          toxicologicalAndPhysicalRiskDa:
            'Bly- og tungmetalstøv ved nedbrydning direkte op ad offentlig færdselsåre (Valbyvej 58).',
          statutoryReferences: [
            'AT-vejledning C.0.8',
            'Den blå Blyvejledning (2019)',
            'BEK nr. 613 af 29/06/2026',
          ],
        },
        {
          substanceKey: 'quartzWool',
          substanceLabelDa: 'Mineraluld (<1997) & Respirabelt Kvartsstøv',
          confirmedStatus: 'FORUDSAT_FØR_1997',
          exactBuildingComponents: [
            'Tagrum (<1997 mineraluld)',
            'Tekniske installationer (<1997 mineraluld)',
          ],
          concentrationOrClassificationNote:
            'Mineraluld i tagrum og tekniske installationer er ældre end 1997 (farligt affald jf. BEK 1399/2021).',
          toxicologicalAndPhysicalRiskDa:
            'Spredning af gamle mineralfibre og betonkvartsstøv ved tag- og facadenedtagning.',
          statutoryReferences: [
            'BEK nr. 1399 af 25.06.2021',
            'Den grå Støv-vejledning (2019)',
          ],
        },
      ],
      statutoryReferences: [
        ...COMMON_STATUTORY_REFS_2025_2026,
        '2021-2791 Valbyvej 58 - Bygning 3 & RING_C05_K18_Miljønotat - Bygning 3',
      ],
      dmaChecklist: [
        {
          id: 'dma-byg3-1',
          code: 'DMA-VINDSPAERRE-INTAKT',
          titleDa: 'Intakt demontering af asbestholdige vindspærreplader & brystningsplader i facade',
          requirementDetailDa:
            'Asbestholdige vindspærreplader og brystningsplader i facaden har høj risiko for fiberfrigivelse ved mekanisk brud og skal demonteres intakt under lokal udsugning/indkapsling før maskinel nedrivning af råhuset.',
          sourceReference: '2021-2791 Valbyvej 58 - Bygning 3 & DMA Anbefaling',
          mandatoryBeforePhase: 'FØR_MEKANISK_NEDBRYDNING',
          defaultVerified: true,
        },
        {
          id: 'dma-byg3-2',
          code: 'DMA-LINOLEUM-KLAEB',
          titleDa: 'Indkapslet fjernelse af asbestholdigt linoleum og klæb på gulve',
          requirementDetailDa:
            'Linoleum og asbestholdig gulvklæb skal fjernes i støvtæt undertrykszone af autoriseret asbestvirksomhed før råhusnedbrydning.',
          sourceReference: 'RING_C05_K18_Miljønotat - Bygning 3',
          mandatoryBeforePhase: 'UNDER_SANERING',
          defaultVerified: true,
        },
        {
          id: 'dma-byg3-3',
          code: 'DMA-BYG3-ROER',
          titleDa: 'Sanering af asbest i rørbøjninger og T-stykker mv. samt <1997 mineraluld',
          requirementDetailDa:
            'Alle rørbøjninger og T-stykker mv. med asbest samt <1997 mineraluld i tagrum og teknik udtages som farligt affald før maskinel nedbrydning.',
          sourceReference: '2021-2791 Valbyvej 58 - Bygning 3 & BEK 1399/2021',
          mandatoryBeforePhase: 'UNDER_SANERING',
          defaultVerified: true,
        },
      ],
    };
  }

  // 5. BLOK 2–20 (Afd. 23, 24, 26 og 32 - RING_K18_C08.7_ZMiljørapport (alle afdelinger))
  if (unit.id.startsWith('BLOK-') && !unit.id.includes('SAB')) {
    const isBlok9Or10 = unit.id === 'BLOK-9' || unit.id === 'BLOK-10';
    return {
      buildingId: unit.id,
      buildingCode: unit.code,
      buildingName: unit.name,
      department: unit.department,
      address: unit.address,
      profileGroupKey: 'BLOK_2_20_SYSTEMIC',
      profileGroupLabelDa: isBlok9Or10
        ? `5. ${unit.code} (${unit.department} · Etape 2 del 2 Planlagt Nedrivning - 33,68 mio. kr.)`
        : `5. ${unit.code} (${unit.department} · Etape 1 Helhedsplan Renovering - 587,59 mio. kr.)`,
      reportIds: [
        'RING_K18_C08.7_ZMiljørapport (alle afdelinger)',
        'DMA / COWI Sammenfatning for Blok 2-20 (Afd. 23, 24, 26 og 32)',
        'Wissenberg PSS Sag W22085',
      ],
      primaryConsultants: [
        'Dansk MiljøAnalyse (DMA) / COWI',
        'Wissenberg Rådgivende Ingeniører (PSS W22085)',
      ],
      executiveSummaryDa:
        `Systemisk miljøkortlægning af ${unit.name} (${unit.address}, ${unit.department}) i RING_K18_C08.7_ZMiljørapport (alle afdelinger) dokumenterer: Asbest i rørbøjninger/T-stykker, brystningsplader og altanfuger; PCB i udvendige og indvendige fuger samt maling (med sekundær diffusion ind i tilstødende beton); tungmetaller (Pb, Cd, Cr, Cu, Ni, Zn, Hg, As) i alle malede overflader (AT-vejledning C.0.8 og Den blå Blyvejledning 2019); samt <1997 mineraluld i rør- og tagisolering.`,
      crawlspaceOrBasementNoteDa:
        unit.hasCrawlspace
          ? 'Krybekælder/teknikføringer under blokken med asbestholdige rørbøjninger og T-stykker mv. samt udendørs kloak/LAR-opgravning i terræn.'
          : 'Kælder/teknikskakte med asbestholdige rørbøjninger og T-stykker mv.',
      dmaAndPssHeadlineRecommendationDa:
        'Forbud mod usikker indkapsling: Jf. DMA/COWI-analysen bør asbest og PCB i boliger og skakte, der berøres af renovering (udskiftning af faldstammer, badeværelser, el og udskæring af gavle til franske altaner), saneres fuldstændigt fremfor indkapsles, da beboere uden asbestviden risikerer utilsigtet brud på indkapslinger, og indkapsling blot udskyder udgiften (maks. 25 år). Kursuskrav pr. 21. december 2025: Enhver håndværker (VVS, tømrer, murer, elektriker), der udfører service eller renovering i områder med kendt asbest, skal fremvise gyldigt lovpligtigt asbestkursusbevis før opstart.',
      encapsulationVsRemediationPolicyDa: isBlok9Or10
        ? 'Etape 2 del 2 (Nedrivning Blok 9-10 - 33,68 mio. kr.): Fuld forudgående miljøsanering af asbest i rørbøjninger, brystningsplader og altanfuger samt bortrensning af PCB-fuger, maling og grænsefladebeton før mekanisk nedbrydning.'
        : 'Etape 1 (Renovering - 587,59 mio. kr.): Fuld sanering fremfor indkapsling i alle berørte boliger, badeværelser, faldstammer og gavle (udskæring til franske altaner), da indkapsling udgør en latent risiko for beboere og kun har maks. 25 års levetid.',
      mandatoryCourseRequirement2025Da:
        'Kursuskrav pr. 21. december 2025: Enhver håndværker (VVS, tømrer, murer, elektriker), der udfører service eller renovering i områder med kendt asbest, skal fremvise gyldigt lovpligtigt asbestkursusbevis før opstart.',
      substanceSamples: [
        {
          substanceKey: 'asbestos',
          substanceLabelDa: 'Asbest (Rørbøjninger/T-stykker, Brystningsplader & Altanfuger)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Rørbøjninger og T-stykker mv. i teknikskakte, kældre og krybekældre',
            'Brystningsplader på facader og altaner',
            'Altanfuger (udvendige elastiske fuger ved altaner)',
          ],
          concentrationOrClassificationNote:
            'Systemisk forekomst på tværs af Blok 2–20 (RING_K18_C08.7_ZMiljørapport alle afdelinger).',
          toxicologicalAndPhysicalRiskDa:
            'Risiko for spredning til beboede lejligheder ved udskiftning af faldstammer, badeværelsesrenovering og udskæring af lukkede gavle til franske altaner.',
          statutoryReferences: [
            'RING_K18_C08.7_ZMiljørapport (alle afdelinger)',
            'BEK nr. 1328 af 19/11/2025 & skærpede AT-regler pr. 21. december 2025',
            'BEK nr. 613 af 29/06/2026 (0,003 fibre/cm³)',
          ],
        },
        {
          substanceKey: 'pcb',
          substanceLabelDa: 'PCB (Udvendige/Indvendige Fuger, Maling & Sekundær Betondiffusion)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Udvendige og indvendige elastiske fuger',
            'Malede overflader',
            'Sekundær diffusion af PCB ind i tilstødende grænsefladebeton',
          ],
          concentrationOrClassificationNote:
            'Systemisk PCB i fuger og maling med dokumenteret sekundær diffusion ind i tilstødende beton.',
          toxicologicalAndPhysicalRiskDa:
            'Kontinuerlig afgasning til indeklimaet og spredning af PCB-holdigt betonstøv ved gavludskæring til franske altaner.',
          statutoryReferences: [
            'Den gule PCB-vejledning (2019)',
            'AT-instruks IN-9-3',
            'DMA/COWI Analyse (Fuld sanering fremfor indkapsling)',
          ],
        },
        {
          substanceKey: 'heavyMetals',
          substanceLabelDa: 'Tungmetaller i Malede Overflader (Pb, Cd, Cr, Cu, Ni, Zn, Hg, As)',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Alle malede overflader i boliger, opgange, facader og kældre',
          ],
          concentrationOrClassificationNote:
            'Systemisk forekomst af tungmetaller i malede overflader (AT-vejledning C.0.8 og Den blå Blyvejledning 2019).',
          toxicologicalAndPhysicalRiskDa:
            'Frigivelse af bly-, cadmium- og kromholdigt slibe-/bore- og skærestøv ved renovering af badeværelser, faldstammer og gavle.',
          statutoryReferences: [
            'AT-vejledning C.0.8',
            'Den blå Blyvejledning (2019)',
            'BEK nr. 613 af 29/06/2026',
          ],
        },
        {
          substanceKey: 'quartzWool',
          substanceLabelDa: '<1997 Mineraluld & Respirabelt Kvarts ved Gavludskæring',
          confirmedStatus: 'KONSTATERET_PRØVE',
          exactBuildingComponents: [
            'Rørisolering og tagisolering med gammel mineraluld (<1997)',
            'Betongavle (udskæring af lukkede gavle til franske altaner) og badeværelsesdæk',
          ],
          concentrationOrClassificationNote:
            '<1997 mineraluld klassificeret som farligt affald (BEK 1399/2021); respirabelt kvarts ved diamantskæring i gavle.',
          toxicologicalAndPhysicalRiskDa:
            'Høj emission i 8 meters frigivelseshøjde under gavludskæring og faldstammeudskiftning mens naboafdelinger er beboede.',
          statutoryReferences: [
            'BEK nr. 1399 af 25.06.2021',
            'Den grå Støv-vejledning (2019)',
          ],
        },
      ],
      statutoryReferences: [
        ...COMMON_STATUTORY_REFS_2025_2026,
        'DMA/COWI Analyse: Forbud mod usikker indkapsling i boliger og skakte (maks. 25 års holdbarhed)',
      ],
      dmaChecklist: [
        {
          id: `dma-${unit.id}-1`,
          code: 'DMA-INGEN-INDKAPSLING',
          titleDa: 'Fuld sanering fremfor usikker indkapsling i boliger, skakte og gavle',
          requirementDetailDa:
            'Jf. DMA/COWI-analysen skal asbest og PCB i boliger og skakte, der berøres af renovering (faldstammer, badeværelser, el og udskæring af gavle til franske altaner), saneres fuldstændigt fremfor indkapsles, da beboere uden asbestviden risikerer utilsigtet brud på indkapslinger, og indkapsling kun udskyder udgiften (maks. 25 år).',
          sourceReference: 'DMA/COWI Analyse & RING_K18_C08.7_ZMiljørapport',
          mandatoryBeforePhase: 'RENOVERING_ETAPE_1',
          defaultVerified: false,
        },
        {
          id: `dma-${unit.id}-2`,
          code: 'AT-2025-12-21-KURSUS',
          titleDa: 'Kontrol af lovpligtigt asbestkursusbevis (krav pr. 21. december 2025) for alle håndværkere',
          requirementDetailDa:
            'Enhver håndværker (VVS, tømrer, murer, elektriker), der udfører service eller renovering i områder med kendt asbest, skal fremvise gyldigt lovpligtigt asbestkursusbevis før opstart.',
          sourceReference: 'Skærpede AT-regler pr. 21. december 2025 & BEK 1328/2025',
          mandatoryBeforePhase: 'FØR_OPSTART',
          defaultVerified: true,
        },
        {
          id: `dma-${unit.id}-3`,
          code: 'DMA-BLY-C08',
          titleDa: 'Støvfri afrensning af tungmetal- og PCB-maling samt grænsefladebeton',
          requirementDetailDa:
            'Ved indgreb i malede overflader og fuger med sekundær PCB-diffusion i beton skal arbejdet udføres med H-klasse sug og personlige værnemidler iht. AT-vejledning C.0.8 og Den blå Blyvejledning (2019).',
          sourceReference: 'AT-vejledning C.0.8, Den blå Blyvejledning (2019) & Den gule PCB-vejledning (2019)',
          mandatoryBeforePhase: 'UNDER_SANERING',
          defaultVerified: true,
        },
      ],
    };
  }

  // 6. SAB SCHACKENBORGVÆNGE (Blok 21–24) & BYGNING 4–5 (Nordcentret & Daginstitution)
  return {
    buildingId: unit.id,
    buildingCode: unit.code,
    buildingName: unit.name,
    department: unit.department,
    address: unit.address,
    profileGroupKey: 'SAB_AND_EXTERNAL',
    profileGroupLabelDa: `6. ${unit.code} (${unit.department} · Receptor- & Nabomatrikel i Spredningsfeltet)`,
    reportIds: unit.environmentalReportIds,
    primaryConsultants: [
      'Wissenberg Rådgivende Ingeniører (PSS Sag W22085 Nabomatrikel-Vurdering)',
      'Dansk MiljøAnalyse (DMA)',
    ],
    executiveSummaryDa:
      `${unit.name} (${unit.address}) er opført i ${unit.constructionYear} og fungerer som kritisk naboreceptor i spredningsfanen fra nedrivningen af Blok 1 og Bygning 1–3 samt renoveringen af Blok 2–20. Bygningen er opført i perioden 1966–1972 og er derfor tillige omfattet af 21. december 2025-kursuskravet ved ethvert teknisk indgreb i oprindelige rør-, facade- og fugekonstruktioner.`,
    crawlspaceOrBasementNoteDa:
      'Sårbar receptor-matrikel med krav om lukkede friskluftindtag, våd rengøring af udearealer og kontrol af 4-ugers underretningspligt jf. Jordforureningslovens § 12 og § 70, stk. 4 ved S ≥ 0,45.',
    dmaAndPssHeadlineRecommendationDa:
      'Beskyttelse af omkringboende i henhold til Wissenberg PSS W22085 pkt. 11.1: Kontinuerlig overvågning af Sumformel-kvotient S = Σ(Ci/GVi), akkrediterede tredjeparts-aftryksprøver ved grænseoverskridelse samt håndhævelse af asbestkursuskravet pr. 21. december 2025 ved vedligehold i <1986 bygningsmasse.',
    mandatoryCourseRequirement2025Da:
      'Kursuskrav pr. 21. december 2025: Enhver håndværker (VVS, tømrer, murer, elektriker), der udfører service eller vedligehold i bygninger fra 1962–1972 med potentiel asbest, skal fremvise gyldigt lovpligtigt asbestkursusbevis før opstart.',
    substanceSamples: [
      {
        substanceKey: 'asbestos',
        substanceLabelDa: 'Asbest (Immissions-Receptor & <1972 Tekniske Installationer)',
        confirmedStatus: 'RECEPTOR_EKSPONERING',
        exactBuildingComponents: [
          'Udvendige facader, altaner, vindueskarme og friskluftventiler i nedvindsfanen',
          'Oprindelige rør- og facadekomponenter fra 1966–1972 ved intern drift/service',
        ],
        concentrationOrClassificationNote:
          'Overvåges mod skærpet 2026-grænseværdi på 0,003 fibre/cm³ (BEK 613/2026).',
        toxicologicalAndPhysicalRiskDa:
          'Indtrængning af respirable asbestfibre fra nedrivning af Blok 1 og Bygning 1–3 (særligt vindspærreplader i Bygning 3 og kældermembran i Bygning 2).',
        statutoryReferences: [
          'BEK nr. 613 af 29/06/2026 § 3, stk. 3',
          'Wissenberg PSS Sag W22085 pkt. 11.1',
        ],
      },
      {
        substanceKey: 'pcb',
        substanceLabelDa: 'PCB & Tungmetal-Deposition på Udearealer',
        confirmedStatus: 'RECEPTOR_EKSPONERING',
        exactBuildingComponents: [
          'Legepladser, opholdsarealer, altaner og ventilationsindtag',
        ],
        concentrationOrClassificationNote:
          'Kumulativ 24-timers støvdeposition (µg/m²) af bly, cadmium og PCB i nedvindsfanen.',
        toxicologicalAndPhysicalRiskDa:
          'Bioakkumulerende og neurotoksisk støvnedfald på børns opholdsarealer og ved boligindtag.',
        statutoryReferences: [
          'Jordforureningslovens § 12 og § 70, stk. 4',
          'Almenlejelovens §§ 14-19',
        ],
      },
    ],
    statutoryReferences: [
      ...COMMON_STATUTORY_REFS_2025_2026,
      'Wissenberg PSS Sag W22085 pkt. 11.1 (Beskyttelse af omkringboende og institutioner)',
      'Jordforureningslovens § 12 og § 70, stk. 4 (4-ugers lejerunderretning)',
    ],
    dmaChecklist: [
      {
        id: `dma-${unit.id}-1`,
        code: 'PSS-11.1-RECEPTOR',
        titleDa: 'Kontrol af immission (S < 1,00) og tredjeparts-asbestprøver på nabomatrikel',
        requirementDetailDa:
          'Ved Sumkvotient S ≥ 0,45 ved naboreceptoren kræves skærpet støvbekæmpelse, 4-ugers lejerunderretning jf. Jordforureningslovens § 70, stk. 4 og uafhængige tredjeparts-tape-/luftprøver.',
        sourceReference: 'Wissenberg PSS W22085 pkt. 11.1 & BEK 613/2026',
        mandatoryBeforePhase: 'UNDER_SANERING',
        defaultVerified: true,
      },
      {
        id: `dma-${unit.id}-2`,
        code: 'AT-2025-12-21-SERVICE',
        titleDa: 'Asbestkursusbevis (21. dec. 2025) ved service i 1966–1972 bygningsdele',
        requirementDetailDa:
          'Enhver håndværker, der udfører service eller vedligehold i bygningens oprindelige rør- og facadeinstallationer, skal fremvise gyldigt asbestkursusbevis før opstart.',
        sourceReference: 'Skærpede AT-regler pr. 21. december 2025',
        mandatoryBeforePhase: 'FØR_OPSTART',
        defaultVerified: true,
      },
    ],
  };
}

export const RINGPARKEN_ENVIRONMENTAL_PROFILES: BuildingEnvironmentalProfile[] =
  RINGPARKEN_MASTER_BUILDINGS.map((b) => buildProfileForBuilding(b.id));

export const ENVIRONMENTAL_PROFILE_BY_BUILDING_ID: Record<
  string,
  BuildingEnvironmentalProfile
> = Object.fromEntries(
  RINGPARKEN_ENVIRONMENTAL_PROFILES.map((p) => [p.buildingId, p])
);

export function getBuildingEnvironmentalProfile(
  buildingIdOrName?: string | null
): BuildingEnvironmentalProfile {
  if (!buildingIdOrName) {
    return ENVIRONMENTAL_PROFILE_BY_BUILDING_ID['BLOK-1'] || RINGPARKEN_ENVIRONMENTAL_PROFILES[0];
  }
  if (ENVIRONMENTAL_PROFILE_BY_BUILDING_ID[buildingIdOrName]) {
    return ENVIRONMENTAL_PROFILE_BY_BUILDING_ID[buildingIdOrName];
  }
  const normalized = buildingIdOrName.toLowerCase();
  if (normalized.includes('bygning 1') || normalized.includes('børnehave') || normalized.includes('kierulffsvej 2')) {
    return ENVIRONMENTAL_PROFILE_BY_BUILDING_ID['BYG-1-BOERNEHAVE'];
  }
  if (normalized.includes('bygning 2') || normalized.includes('bazar') || normalized.includes('supermarked') || normalized.includes('kierulffsvej 12')) {
    return ENVIRONMENTAL_PROFILE_BY_BUILDING_ID['BYG-2-BAZAR'];
  }
  if (normalized.includes('bygning 3') || normalized.includes('fritidshjem') || normalized.includes('valbyvej 58')) {
    return ENVIRONMENTAL_PROFILE_BY_BUILDING_ID['BYG-3-FRITIDSHJEM'];
  }
  if (normalized.includes('blok 1') || normalized.includes('kierulffsvej 14')) {
    return ENVIRONMENTAL_PROFILE_BY_BUILDING_ID['BLOK-1'];
  }
  const matched = RINGPARKEN_ENVIRONMENTAL_PROFILES.find(
    (p) =>
      p.buildingName.toLowerCase().includes(normalized) ||
      p.address.toLowerCase().includes(normalized) ||
      p.buildingCode.toLowerCase() === normalized
  );
  return matched || ENVIRONMENTAL_PROFILE_BY_BUILDING_ID['BLOK-1'] || RINGPARKEN_ENVIRONMENTAL_PROFILES[0];
}

/**
 * Generates a structured, authoritative grounding text block containing all specific sample findings
 * (Wissenberg PSS W22085 / Miljørapporter 2021-2791 & RING_K18_C08.7) and Dansk MiljøAnalyse (DMA)
 * recommendations across all building groups for injection into AI system prompts.
 */
export function formatEnvironmentalProfilesForAiSystemPrompt(
  focusedBuildingIdOrName?: string | null
): string {
  const focused = getBuildingEnvironmentalProfile(focusedBuildingIdOrName);

  return `RAPPORTVERIFICEREDE MILJØPRØVERESULTATER (WISSENBERG PSS W22085 / MILJØRAPPORTER 2021-2791 & RING_K18_C08.7) SAMT DANSK MILJØANALYSE (DMA) ANBEFALINGER PR. BYGNING I RINGPARKEN:

1. Blok 1 (Kierulffsvej 14-22, Rapport RING_K18_C08.7_ZMiljørapport & Tilstandsrapport for krybekælder):
   - Asbest: Rørbøjninger, T-stykker mv., brystningsplader på facader/altaner, samt fuger på altaner.
   - PCB: Konstateret i malede overflader, enkelte fuger og gulvbelægninger.
   - Tungmetaller (Pb, Cd, Cr, Cu, Ni, Zn, Hg, As): Konstateret generelt i alle malede overflader.
   - Mineraluld (<1997): Isolering omkring tekniske installationer (klassificeret som farligt affald jf. BEK nr. 1399 af 25.06.2021).
   - Krybekælder & Jord: Krybekælder under hele blokken; forurenet jord ved opgravning af kloak og stikledninger i terræn.
   - DMA & PSS Anbefaling: Rydning af krybekælder må FØRST foretages, efter overliggende dæk er fjernet (PSS pkt. 7 ID 1.1). Før mekanisk nedbrydning og knusning af beton skal PCB-holdige fuger, maling og grænsefladebeton bortrenses iht. Den gule PCB-vejledning (2019) og AT-instruks IN-9-3 for at forhindre sekundær PCB-kontaminering af knust beton.

2. Bygning 1 – Børnehave (Kierulffsvej 2, Rapport 2021-2791 Kierulffsvej 2 - Bygning 1 & RING_C05_K18_Miljønotat - Bygning 1):
   - Asbest: Vægfliser (fliser og fliseklæb) samt rørbøjninger og T-stykker mv.
   - PCB & Tungmetaller: PCB i malede overflader, enkelte fuger og gulvbelægninger; tungmetaller (bly, cadmium, krom, kobber, nikkel, zink, kviksølv, arsen) i alle malede overflader.
   - Mineraluld (<1997): Mineraluld i tagrum og omkring tekniske installationer forudsættes ældre end 1997 (farligt affald).
   - Skimmel: Kraftig skimmelvækst registreret i kælder.
   - DMA & PSS Anbefaling: Sanering af asbestvægfliser skal udføres i støvtæt undertrykszone af autoriseret virksomhed (krav pr. 1. juli 2024) med uddannet personale (BEK 807/2023, BEK 1328/2025 og skærpede AT-regler pr. 21. december 2025). Ved arbejde i kælder med kraftig skimmelvækst skal anvendes P3-åndedrætsværn og beskyttelsesdragt (PSS pkt. 6 ID 2.4).

3. Bygning 2 – Supermarked/Bazar (Kierulffsvej 12, Rapport 2021-2791 Kierulffsvej 12 - Bygning 2 & RING_C05_K18_Miljønotat - Bygning 2):
   - Asbest: Isolering om ventilationskanaler, MEMBRAN PÅ KÆLDER, samt rørbøjninger og T-stykker mv.
   - PCB & Tungmetaller: PCB i malede overflader, enkelte fuger og gulvbelægninger; tungmetaller i alle malede overflader.
   - Mineraluld (<1997): Tagrum og tekniske installationer (<1997).
   - Skimmel: Kraftig skimmelvækst registreret i BÅDE stueetage og kælder.
   - DMA & PSS Anbefaling: Fjernelse af asbestholdig membran på kælderydervægge kræver udgravning sikret med afstivning/gravekasse og rækværk 2 m fra kant (PSS pkt. 6 ID 1.1) samt våd asbestsanering, så asbestmembran ikke sammenblandes med jord ved opgravning. Historisk støv skal støvsuges før nedrivning iht. Den grå Støv-vejledning (2019).

4. Bygning 3 – Fritidshjem (Valbyvej 58, Rapport 2021-2791 Valbyvej 58 - Bygning 3 & RING_C05_K18_Miljønotat - Bygning 3):
   - Asbest: Brystningsplader, LINOLEUM OG KLÆB på gulve, VINDSPÆRREPLADE I FACADE, samt rørbøjninger og T-stykker mv.
   - PCB & Tungmetaller: PCB i malede overflader, fuger og gulvbelægninger; tungmetaller i alle malede overflader.
   - Mineraluld (<1997): Tagrum og tekniske installationer (<1997).
   - DMA & PSS Anbefaling: Asbestholdige vindspærreplader i facaden og linoleum/klæb har høj risiko for fiberfrigivelse ved mekanisk brud. De skal demonteres intakt under lokal udsugning/indkapsling før maskinel nedrivning af råhuset.

5. Blok 2–20 (Afd. 23, 24, 26 og 32, Rapport RING_K18_C08.7_ZMiljørapport (alle afdelinger)):
   - Fund: Systemiske forekomster af asbest i rørbøjninger/T-stykker, brystningsplader og altanfuger; PCB i udvendige og indvendige fuger samt maling (med sekundær diffusion ind i tilstødende beton); tungmetaller i alle malede overflader (AT-vejledning C.0.8 og Den blå Blyvejledning 2019); <1997 mineraluld i rør- og tagisolering.
   - DMA Anbefaling ved Renovering (Etape 1) vs. Nedrivning (Etape 2 del 2 - Blok 9 & 10):
     * Forbud mod usikker indkapsling: Jf. DMA/COWI-analysen bør asbest og PCB i boliger og skakte, der berøres af renovering (udskiftning af faldstammer, badeværelser, el og udskæring af gavle til franske altaner), SANERES FULDSTÆNDIGT FREMFOR INDKAPSLES, da beboere uden asbestviden risikerer utilsigtet brud på indkapslinger, og indkapsling blot udskyder udgiften (maks. 25 år).
     * Kursuskrav pr. 21. december 2025: Enhver håndværker (VVS, tømrer, murer, elektriker), der udfører service eller renovering i områder med kendt asbest, skal fremvise gyldigt lovpligtigt asbestkursusbevis før opstart.

AKTUELT VALGT BYGNINGSPROFIL I UI: ${focused.buildingCode} (${focused.buildingName}, ${focused.address}) — Rapporter: ${focused.reportIds.join(', ')} — DMA Fokus: ${focused.dmaAndPssHeadlineRecommendationDa}`;
}
