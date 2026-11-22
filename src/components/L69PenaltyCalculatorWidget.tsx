import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Coins,
  FileWarning,
  Gavel,
  PlusCircle,
  Scale,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import { RingparkenBuildingUnit } from '../types/dispersion';
import {
  L69_BASE_FINES_DKK,
  L69ViolationKey,
  calculateL69TotalSanction,
} from '../services/l69PenaltyEngine';

export type CompanySizeBracket = '0_9' | '10_34' | '35_99' | '100_plus';

export interface L69ViolationRuleItem {
  id: string;
  engineKey?: L69ViolationKey;
  code: string;
  titleDa: string;
  statuteRefDa: string;
  descriptionDa: string;
  baseFineEnterpriseDkk: number;
  baseFinePrivateDkk?: number;
  isMaterial?: boolean;
  secondaryOptionLabelDa?: string;
  secondaryOptionFineDkk?: number;
}

export const L69_STATUTORY_VIOLATIONS: L69ViolationRuleItem[] = [
  {
    id: 'jfl_8_no_permit',
    engineKey: 'JFL_SEC_8_NO_PERMIT',
    code: L69_BASE_FINES_DKK.JFL_SEC_8_NO_PERMIT.statute,
    titleDa: L69_BASE_FINES_DKK.JFL_SEC_8_NO_PERMIT.label,
    statuteRefDa: 'Jordforureningslovens § 8, stk. 1 og 2, jf. § 88 (Lovforslag L 69 af 08.10.2026)',
    descriptionDa:
      'Påbegyndelse af grave-, bygge- eller nedrivningsarbejde i terræn/krybekælder på V1/V2-kortlagt eller forurenet areal uden forudgående § 8-tilladelse fra Slagelse Kommune.',
    baseFineEnterpriseDkk: L69_BASE_FINES_DKK.JFL_SEC_8_NO_PERMIT.businessMinDkk,
    baseFinePrivateDkk: L69_BASE_FINES_DKK.JFL_SEC_8_NO_PERMIT.privateMinDkk,
    isMaterial: L69_BASE_FINES_DKK.JFL_SEC_8_NO_PERMIT.isMaterial,
  },
  {
    id: 'mbl_33_or_jfl_50_2',
    engineKey: 'MBL_SEC_33_NO_APPROVAL',
    code: 'MBL § 33 / JFL § 50, stk. 2',
    titleDa: 'Oplag/knusning uden § 33-miljøgodkendelse eller flytning af forurenet jord uden anmeldelse',
    statuteRefDa: `${L69_BASE_FINES_DKK.MBL_SEC_33_NO_APPROVAL.statute} (100.000 kr.) / ${L69_BASE_FINES_DKK.JFL_SEC_50_UNNOTIFIED_SOIL.statute} (50.000 kr.)`,
    descriptionDa:
      'Etablering af mobilt knuseværk/midlertidigt oplag af forurenet nedrivningsmateriale uden § 33-godkendelse (100.000 kr.) eller flytning af forurenet jord uden lovpligtig anmeldelse (50.000 kr.).',
    baseFineEnterpriseDkk: L69_BASE_FINES_DKK.MBL_SEC_33_NO_APPROVAL.businessMinDkk,
    baseFinePrivateDkk: L69_BASE_FINES_DKK.MBL_SEC_33_NO_APPROVAL.privateMinDkk,
    isMaterial: L69_BASE_FINES_DKK.MBL_SEC_33_NO_APPROVAL.isMaterial,
    secondaryOptionLabelDa: 'Kun § 50, stk. 2 jordflytning uden anmeldelse (50.000 kr.)',
    secondaryOptionFineDkk: L69_BASE_FINES_DKK.JFL_SEC_50_UNNOTIFIED_SOIL.businessMinDkk,
  },
  {
    id: 'waste_screening_unnotified',
    engineKey: 'BYGGEAFFALD_UNSCREENED',
    code: L69_BASE_FINES_DKK.BYGGEAFFALD_UNSCREENED.statute,
    titleDa: L69_BASE_FINES_DKK.BYGGEAFFALD_UNSCREENED.label,
    statuteRefDa: 'Lovforslag L 69 pkt. 2.4 (Firdobling af bødeniveau ved >1 ton bygge- og anlægsaffald)',
    descriptionDa:
      'Undladelse af fyldestgørende miljøscreening og specifik kortlægning af asbest, PCB, bly og <1997 mineraluld før selektiv nedrivning over 1 ton affald.',
    baseFineEnterpriseDkk: L69_BASE_FINES_DKK.BYGGEAFFALD_UNSCREENED.businessMinDkk,
    baseFinePrivateDkk: L69_BASE_FINES_DKK.BYGGEAFFALD_UNSCREENED.privateMinDkk,
    isMaterial: L69_BASE_FINES_DKK.BYGGEAFFALD_UNSCREENED.isMaterial,
  },
  {
    id: 'mbl_43_hazardous_mix',
    engineKey: 'MBL_SEC_43_HAZARDOUS_MIX',
    code: L69_BASE_FINES_DKK.MBL_SEC_43_HAZARDOUS_MIX.statute,
    titleDa: L69_BASE_FINES_DKK.MBL_SEC_43_HAZARDOUS_MIX.label,
    statuteRefDa: 'Miljøbeskyttelsesloven § 43 & Affaldsbek. §§ 56, 63, 66 (Materiel overtrædelse)',
    descriptionDa:
      'Ulovlig sammenblanding eller manglende udsortering af asbest, PCB-kontamineret beton eller <1997 mineraluld med rene byggeaffaldsfraktioner.',
    baseFineEnterpriseDkk: L69_BASE_FINES_DKK.MBL_SEC_43_HAZARDOUS_MIX.businessMinDkk,
    baseFinePrivateDkk: L69_BASE_FINES_DKK.MBL_SEC_43_HAZARDOUS_MIX.privateMinDkk,
    isMaterial: L69_BASE_FINES_DKK.MBL_SEC_43_HAZARDOUS_MIX.isMaterial,
  },
  {
    id: 'jfl_50_5_four_week_soil',
    engineKey: 'JFL_SEC_50_STK5_4WEEKS',
    code: L69_BASE_FINES_DKK.JFL_SEC_50_STK5_4WEEKS.statute,
    titleDa: L69_BASE_FINES_DKK.JFL_SEC_50_STK5_4WEEKS.label,
    statuteRefDa: 'Jordforureningslovens § 50, stk. 5, jf. § 88, stk. 1, nr. 6',
    descriptionDa:
      'Opgravning og bortkørsel af jord omkring kloakstik og kælderydervægge (Blok 1, Bygning 1 & 2) før udløb af 4-ugers fristen eller uden kommunens skriftlige accept.',
    baseFineEnterpriseDkk: L69_BASE_FINES_DKK.JFL_SEC_50_STK5_4WEEKS.businessMinDkk,
    baseFinePrivateDkk: L69_BASE_FINES_DKK.JFL_SEC_50_STK5_4WEEKS.privateMinDkk,
    isMaterial: L69_BASE_FINES_DKK.JFL_SEC_50_STK5_4WEEKS.isMaterial,
  },
  {
    id: 'jfl_72_misleading_info',
    engineKey: 'JFL_SEC_72_MISLEADING_INFO',
    code: L69_BASE_FINES_DKK.JFL_SEC_72_MISLEADING_INFO.statute,
    titleDa: L69_BASE_FINES_DKK.JFL_SEC_72_MISLEADING_INFO.label,
    statuteRefDa: 'Jordforureningslovens § 72, jf. § 88, stk. 1, nr. 10 og Lovforslag L 69',
    descriptionDa:
      'Indsendelse af mangelfulde miljødata, udeladelse af sekundær PCB-diffusion i beton eller fejlagtig klassificering af farligt affald som ren fraktion.',
    baseFineEnterpriseDkk: L69_BASE_FINES_DKK.JFL_SEC_72_MISLEADING_INFO.businessMinDkk,
    baseFinePrivateDkk: L69_BASE_FINES_DKK.JFL_SEC_72_MISLEADING_INFO.privateMinDkk,
    isMaterial: L69_BASE_FINES_DKK.JFL_SEC_72_MISLEADING_INFO.isMaterial,
  },
  {
    id: 'jfl_12_70_4_tenant_notice',
    engineKey: 'JFL_SEC_12_70_TENANT_NOTICE',
    code: L69_BASE_FINES_DKK.JFL_SEC_12_70_TENANT_NOTICE.statute,
    titleDa: L69_BASE_FINES_DKK.JFL_SEC_12_70_TENANT_NOTICE.label,
    statuteRefDa: 'Jordforureningslovens § 12 og § 70, stk. 4, jf. § 88, stk. 1, nr. 13 (15.000 kr.)',
    descriptionDa:
      'Aktiveres automatisk, hvis en blok i kategori a. Beboet eller c. Under Renovering udsættes for jord-/støvforurening uden dokumenteret skriftligt lejerbrev inden 4 uger.',
    baseFineEnterpriseDkk: L69_BASE_FINES_DKK.JFL_SEC_12_70_TENANT_NOTICE.businessMinDkk,
    baseFinePrivateDkk: L69_BASE_FINES_DKK.JFL_SEC_12_70_TENANT_NOTICE.privateMinDkk,
    isMaterial: L69_BASE_FINES_DKK.JFL_SEC_12_70_TENANT_NOTICE.isMaterial,
  },
  {
    id: 'jfl_57_obstruction',
    code: 'JFL § 57',
    titleDa: 'Modvirkning af miljømyndighedernes adgang til ejendommen eller prøvetagning',
    statuteRefDa: 'Jordforureningslovens § 57, jf. § 88 og Lovforslag L 69',
    descriptionDa:
      'Hindring af tilsynsmyndighedens eller uvildige prøvetageres adgang til byggefelt, krybekælder eller oplagsplads.',
    baseFineEnterpriseDkk: 15000,
    baseFinePrivateDkk: 7500,
    isMaterial: false,
  },
];

export const COMPANY_SIZE_METADATA: Record<
  CompanySizeBracket,
  {
    labelDa: string;
    surchargePct: number;
    multiplier: number;
    employeesCount: number;
    noteDa: string;
  }
> = {
  '0_9': {
    labelDa: '0–9 ansatte (Mikrovirksomhed)',
    surchargePct: 0,
    multiplier: 1.0,
    employeesCount: 5,
    noteDa: 'Normalbøde (+0%)',
  },
  '10_34': {
    labelDa: '10–34 ansatte (Mindre virksomhed)',
    surchargePct: 50,
    multiplier: 1.5,
    employeesCount: 20,
    noteDa: '+50% forhøjelse af materielle bøder',
  },
  '35_99': {
    labelDa: '35–99 ansatte (Mellemstor virksomhed)',
    surchargePct: 75,
    multiplier: 1.75,
    employeesCount: 50,
    noteDa: '+75% forhøjelse af materielle bøder',
  },
  '100_plus': {
    labelDa: '100+ ansatte (Stor virksomhed / Koncernforbundne selskaber)',
    surchargePct: 100,
    multiplier: 2.0,
    employeesCount: 120,
    noteDa: '+100% (fordobling) af materielle bøder jf. L 69',
  },
};

export interface EconomicSavingPreset {
  id: string;
  labelDa: string;
  amountDkk: number;
  explanationDa: string;
}

const ECONOMIC_SAVING_PRESETS: EconomicSavingPreset[] = [
  {
    id: 'pcb_concrete_crushing',
    labelDa: 'Undladt PCB-grænsefladerensning før betonknusning (Blok 1)',
    amountDkk: 480000,
    explanationDa:
      'Besparelse ved direkte mekanisk nedknusning af PCB-kontamineret beton fremfor bortrensning og deponering iht. Den gule PCB-vejledning (2019).',
  },
  {
    id: 'basement_membrane_excavation',
    labelDa: 'Manglende gravekasse/våd sanering af asbest-kældermembran (Bygning 2)',
    amountDkk: 320000,
    explanationDa:
      'Besparelse ved maskinel opgravning af kælderydervægge uden forudgående afstivning og selektiv våd fjernelse af asbestmembran (PSS pkt. 6 ID 1.1).',
  },
  {
    id: 'encapsulation_instead_of_remediation',
    labelDa: 'Ulovlig indkapsling fremfor fuld asbest/PCB-sanering (Etape 1 renovering)',
    amountDkk: 850000,
    explanationDa:
      'Tilsigtet besparelse ved at indkapsle asbest/PCB i skakte og faldstammer i Blok 2–20 i strid med DMA-anbefaling.',
  },
];

export interface L69PenaltyCalculatorWidgetProps {
  buildings: RingparkenBuildingUnit[];
  maxSiteSumQuotient: number;
  onLogAlgedonicEvent?: (title: string, details: string) => void;
  onSendToLegalAi?: (promptText: string) => void;
}

export const L69PenaltyCalculatorWidget: React.FC<L69PenaltyCalculatorWidgetProps> = ({
  buildings,
  maxSiteSumQuotient,
  onLogAlgedonicEvent,
  onSendToLegalAi,
}) => {
  // Determine inhabited (a) and under-renovation (c) buildings exposed to soil/dust contamination
  const exposedTenantBuildings = useMemo(
    () =>
      buildings.filter(
        (b) => b.category === 'a_inhabited' || b.category === 'c_under_renovation'
      ),
    [buildings]
  );

  const [tenantNoticeLogged, setTenantNoticeLogged] = useState<boolean>(false);
  const [selectedViolationIds, setSelectedViolationIds] = useState<string[]>([
    'jfl_8_no_permit',
    'waste_screening_unnotified',
    'mbl_43_hazardous_mix',
    'jfl_50_5_four_week_soil',
    'jfl_12_70_4_tenant_notice',
  ]);
  const [useSecondarySoilMove50k, setUseSecondarySoilMove50k] = useState<boolean>(false);
  const [actorType, setActorType] = useState<'enterprise' | 'private'>('enterprise');
  const [companySize, setCompanySize] = useState<CompanySizeBracket>('100_plus');
  const [economicSavingDkk, setEconomicSavingDkk] = useState<number>(480000);
  const [confiscationPossible, setConfiscationPossible] = useState<boolean>(true);
  const [offenseCount, setOffenseCount] = useState<number>(2);
  const [loggedConfirmation, setLoggedConfirmation] = useState<boolean>(false);

  // Automatic activation of JFL § 12 & § 70, stk. 4 if a/c buildings exist and no tenant letter is logged
  const isTenantNoticeAutoTriggered =
    exposedTenantBuildings.length > 0 && !tenantNoticeLogged;

  const effectiveSelectedIds = useMemo(() => {
    const set = new Set(selectedViolationIds);
    if (isTenantNoticeAutoTriggered) {
      set.add('jfl_12_70_4_tenant_notice');
    }
    return Array.from(set);
  }, [selectedViolationIds, isTenantNoticeAutoTriggered]);

  const toggleViolation = (id: string) => {
    if (id === 'jfl_12_70_4_tenant_notice' && isTenantNoticeAutoTriggered) {
      // Controlled by tenantNoticeLogged state when auto-triggered
      return;
    }
    setSelectedViolationIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const calculation = useMemo(() => {
    const sizeMeta = COMPANY_SIZE_METADATA[companySize];
    const isRepeatOffense = offenseCount >= 2;
    const repeatMultiplier = isRepeatOffense ? 2.0 : 1.0;

    // Map selected UI items to canonical L69ViolationKey array for calculateL69TotalSanction
    const violationKeys: L69ViolationKey[] = [];
    for (const v of L69_STATUTORY_VIOLATIONS) {
      if (!effectiveSelectedIds.includes(v.id)) continue;
      if (v.id === 'mbl_33_or_jfl_50_2') {
        violationKeys.push(
          useSecondarySoilMove50k ? 'JFL_SEC_50_UNNOTIFIED_SOIL' : 'MBL_SEC_33_NO_APPROVAL'
        );
      } else if (v.engineKey) {
        violationKeys.push(v.engineKey);
      }
    }

    const engineSanction = calculateL69TotalSanction({
      violationKeys,
      companyEmployeesCount: actorType === 'enterprise' ? sizeMeta.employeesCount : 0,
      estimatedSavedCostDkk: economicSavingDkk,
      canConfiscateProceeds: confiscationPossible,
      isRepeatOffense,
    });

    const sizeMultiplier = engineSanction.sizeMultiplier;

    const lineItems = L69_STATUTORY_VIOLATIONS.filter((v) =>
      effectiveSelectedIds.includes(v.id)
    ).map((v) => {
      let baseDkk = v.baseFineEnterpriseDkk;
      if (actorType === 'private' && v.baseFinePrivateDkk !== undefined) {
        baseDkk = v.baseFinePrivateDkk;
      } else if (v.id === 'mbl_33_or_jfl_50_2' && useSecondarySoilMove50k) {
        baseDkk =
          actorType === 'private'
            ? L69_BASE_FINES_DKK.JFL_SEC_50_UNNOTIFIED_SOIL.privateMinDkk
            : v.secondaryOptionFineDkk || 50000;
      }
      const materialScaled =
        actorType === 'enterprise' && v.isMaterial ? baseDkk * sizeMultiplier : baseDkk;
      const adjustedFineDkk = Math.round(materialScaled * repeatMultiplier);
      return {
        ...v,
        baseDkk,
        adjustedFineDkk,
      };
    });

    const cumulativeStatutoryBaseDkk = lineItems.reduce((acc, item) => acc + item.baseDkk, 0);
    const cumulativeSizeAdjustedFineDkk =
      actorType === 'enterprise' && !effectiveSelectedIds.includes('jfl_57_obstruction')
        ? Math.round(engineSanction.baseFineSum)
        : lineItems.reduce((acc, item) => acc + item.adjustedFineDkk, 0);

    const savingFineMultiplier = confiscationPossible ? 2.0 : 3.0;
    const savingFineSurchargeDkk = Math.round(engineSanction.savingsFineAddition);
    const confiscationAmountDkk = Math.round(engineSanction.confiscationAmount);

    const totalCriminalFineDkk = cumulativeSizeAdjustedFineDkk + savingFineSurchargeDkk;
    const totalFinancialLiabilityDkk = totalCriminalFineDkk + confiscationAmountDkk;

    const mbl40bRevocationRisk =
      isRepeatOffense ||
      (effectiveSelectedIds.includes('mbl_33_or_jfl_50_2') && economicSavingDkk >= 250000);

    return {
      lineItems,
      sizeMeta,
      sizeMultiplier,
      cumulativeStatutoryBaseDkk,
      cumulativeSizeAdjustedFineDkk,
      savingFineMultiplier,
      savingFineSurchargeDkk,
      confiscationAmountDkk,
      totalCriminalFineDkk,
      totalFinancialLiabilityDkk,
      mbl40bRevocationRisk,
    };
  }, [
    companySize,
    actorType,
    effectiveSelectedIds,
    useSecondarySoilMove50k,
    economicSavingDkk,
    confiscationPossible,
    offenseCount,
  ]);

  const formatDkk = (val: number) =>
    new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      maximumFractionDigits: 0,
    }).format(val);

  const handleLogToAlgedonic = () => {
    if (!onLogAlgedonicEvent) return;
    const summaryTitle = `[L 69 STRAFFESATS-BEREGNING] Samlet krav: ${formatDkk(
      calculation.totalFinancialLiabilityDkk
    )} (${calculation.lineItems.length} kumulerede lovbrud)`;
    const details =
      `Lovforslag L 69 (08.10.2026) straffe- og konfiskationsberegning for Ringparken: ` +
      `Virksomhedsstørrelse: ${calculation.sizeMeta.labelDa} (faktor ${calculation.sizeMultiplier}x). ` +
      `Kumulerede normalbøder: ${formatDkk(calculation.cumulativeSizeAdjustedFineDkk)}. ` +
      `Økonomisk besparelse ΔE = ${formatDkk(economicSavingDkk)} -> Bødetillæg (${
        calculation.savingFineMultiplier
      }x) = ${formatDkk(calculation.savingFineSurchargeDkk)} + Konfiskation = ${formatDkk(
        calculation.confiscationAmountDkk
      )}. ` +
      `MBL § 40 b frakendelsesrisiko: ${calculation.mbl40bRevocationRisk ? 'AKTIV' : 'OVERvÅGES'}.`;
    onLogAlgedonicEvent(summaryTitle, details);
    setLoggedConfirmation(true);
    window.setTimeout(() => setLoggedConfirmation(false), 3000);
  };

  return (
    <div className="p-4 rounded-md bg-[var(--surface-panel)] border border-[var(--border-subtle)] border-l-4 border-l-rose-500 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-rose-400 shrink-0" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-extrabold text-white">
              Lovforslag L 69 (08. oktober 2026) · Straffesats-, Kumulations- &amp; Konfiskationsberegner
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Miljøministeriets skærpede strafniveauer i{' '}
            <strong className="text-white">Miljøbeskyttelsesloven (MBL)</strong> og{' '}
            <strong className="text-white">Jordforureningsloven (JFL)</strong> med ansatte-skala,{' '}
            <span className="font-mono text-amber-300">2,0x / 3,0x ΔE_besparelse</span> bødetillæg,
            absolut kumulation og frakendelse af transportør-/modtagerret efter{' '}
            <strong className="text-rose-300">MBL § 40 b</strong>.
          </p>
        </div>

        <div className="text-right font-mono">
          <div className="text-[11px] uppercase text-slate-400">
            Samlet Økonomisk Straf &amp; Konfiskation
          </div>
          <div className="text-lg font-extrabold text-rose-400 tabular-nums">
            {formatDkk(calculation.totalFinancialLiabilityDkk)}
          </div>
          <div className="text-[11px] text-slate-400">
            Heraf bøde: {formatDkk(calculation.totalCriminalFineDkk)} · Konfiskation:{' '}
            {formatDkk(calculation.confiscationAmountDkk)}
          </div>
        </div>
      </div>

      {/* Auto-Triggered Tenant Notification Banner (JFL § 12 & § 70, stk. 4) */}
      <div
        className={`p-3 rounded border flex flex-wrap items-center justify-between gap-3 ${
          isTenantNoticeAutoTriggered
            ? 'bg-rose-950/60 border-rose-500/70 text-rose-100'
            : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100'
        }`}
      >
        <div className="space-y-0.5 flex-1 min-w-[260px]">
          <div className="text-xs font-bold flex items-center gap-1.5">
            {isTenantNoticeAutoTriggered ? (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>
              Automatisk 4-Ugers Lejerunderretnings-Lås (JFL § 12 og § 70, stk. 4, jf. § 88, stk. 1, nr. 13)
            </span>
          </div>
          <p className="text-[11px] text-slate-200 leading-relaxed">
            Der er aktuelt <strong className="text-white">{exposedTenantBuildings.length}</strong>{' '}
            bygningsenheder i kategori <span className="font-mono text-emerald-300">a. Beboet</span> eller{' '}
            <span className="font-mono text-sky-300">c. Under Renovering</span> (aktuel spids-sumkvotient{' '}
            <span className="font-mono font-bold text-amber-300">
              S = {maxSiteSumQuotient.toFixed(2)}
            </span>
            ).{' '}
            {isTenantNoticeAutoTriggered
              ? 'Da skriftligt 4-ugers lejerbrev om konstateret jordforurening ikke er logget, pålægges automatisk minimumsbøde på 15.000 kr. (før størrelsestillæg).'
              : 'Skriftligt lejerbrev inden 4-ugers fristen er markeret som dokumenteret i sagen.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTenantNoticeLogged((prev) => !prev)}
          className={`px-3 py-1.5 rounded text-xs font-mono font-bold border transition-colors cursor-pointer shrink-0 ${
            tenantNoticeLogged
              ? 'bg-slate-900 border-emerald-500/50 text-emerald-300 hover:bg-slate-800'
              : 'bg-rose-500 hover:bg-rose-400 text-slate-950 border-rose-300'
          }`}
        >
          {tenantNoticeLogged
            ? '✓ 4-ugers lejerbrev logget (Klik for at nulstille)'
            : 'Simulér Logget Lejerbrev (§ 70, stk. 4)'}
        </button>
      </div>

      {/* Main Grid: Left = Statutory Minimum Fines, Right = Company Size, Economic Saving & § 40 b */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: 7 Statutory Offenses */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-300">
            <span className="font-bold uppercase tracking-wider text-rose-300">
              1. Vejledende Minimumsbøder (1. gangstilfælde · Kumulation)
            </span>
            <span className="text-slate-400">
              {effectiveSelectedIds.length} af {L69_STATUTORY_VIOLATIONS.length} aktiveret
            </span>
          </div>

          <div className="space-y-1.5">
            {L69_STATUTORY_VIOLATIONS.map((item) => {
              const isChecked = effectiveSelectedIds.includes(item.id);
              const isAutoLocked =
                item.id === 'jfl_12_70_4_tenant_notice' && isTenantNoticeAutoTriggered;
              const matchedLine = calculation.lineItems.find((li) => li.id === item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleViolation(item.id)}
                  className={`p-2.5 rounded border transition-colors cursor-pointer ${
                    isChecked
                      ? 'bg-rose-950/35 border-rose-500/60'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isAutoLocked}
                        onChange={() => {}}
                        className="mt-0.5 accent-rose-500 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white leading-snug">
                          {item.titleDa}
                        </div>
                        <div className="text-[11px] font-mono text-amber-300">
                          {item.statuteRefDa}
                          {isAutoLocked ? ' · [AUTO-AKTIVERET AF BYGNINGSKATEGORI a/c]' : ''}
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {item.descriptionDa}
                        </p>

                        {item.id === 'mbl_33_or_jfl_50_2' && isChecked && (
                          <div
                            className="pt-1 flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => setUseSecondarySoilMove50k(false)}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono border cursor-pointer ${
                                !useSecondarySoilMove50k
                                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                                  : 'bg-slate-900 text-slate-300 border-slate-700'
                              }`}
                            >
                              MBL § 33 Ulovlig drift/oplag (100.000 kr.)
                            </button>
                            <button
                              type="button"
                              onClick={() => setUseSecondarySoilMove50k(true)}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono border cursor-pointer ${
                                useSecondarySoilMove50k
                                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                                  : 'bg-slate-900 text-slate-300 border-slate-700'
                              }`}
                            >
                              JFL § 50, stk. 2 Jordflytning (50.000 kr.)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right font-mono shrink-0">
                      <div className="text-xs font-bold text-rose-300 tabular-nums">
                        {matchedLine
                          ? formatDkk(matchedLine.adjustedFineDkk)
                          : formatDkk(item.baseFineEnterpriseDkk)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Basis: {formatDkk(matchedLine ? matchedLine.baseDkk : item.baseFineEnterpriseDkk)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Company Size Scale + Economic Saving Multiplier + MBL § 40 b */}
        <div className="lg:col-span-5 space-y-3">
          {/* Actor & Company Size Differentiation */}
          <div className="p-3 rounded bg-slate-900/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>2. Virksomhedsstørrelse (L 69 Ansatte-Skala)</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActorType('enterprise')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer ${
                    actorType === 'enterprise'
                      ? 'bg-cyan-400 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  Erhverv
                </button>
                <button
                  type="button"
                  onClick={() => setActorType('private')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer ${
                    actorType === 'private'
                      ? 'bg-cyan-400 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  Privat
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(COMPANY_SIZE_METADATA) as CompanySizeBracket[]).map((key) => {
                const meta = COMPANY_SIZE_METADATA[key];
                const active = companySize === key && actorType === 'enterprise';
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={actorType === 'private'}
                    onClick={() => setCompanySize(key)}
                    className={`p-2 rounded border text-left transition-colors cursor-pointer disabled:opacity-40 ${
                      active
                        ? 'bg-cyan-950/70 border-cyan-400 text-white'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-[11px] font-bold">{meta.labelDa}</div>
                    <div className="text-[11px] font-mono text-cyan-300">{meta.noteDa}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Economic Advantage / Saving Multiplier */}
          <div className="p-3 rounded bg-slate-900/90 border border-amber-500/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider font-bold text-amber-300 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" />
                <span>3. Økonomisk Besparelse (ΔE_besparelse)</span>
              </span>
              <span className="text-[11px] font-mono font-bold text-amber-200">
                {formatDkk(economicSavingDkk)}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400 block">
                Tilsigtet eller opnået besparelse ved manglende miljøsanering / ulovlig knusning (DKK):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={2500000}
                  step={10000}
                  value={economicSavingDkk}
                  onChange={(e) => setEconomicSavingDkk(Number(e.target.value))}
                  className="flex-1 accent-amber-400 cursor-pointer"
                />
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={economicSavingDkk}
                  onChange={(e) => setEconomicSavingDkk(Math.max(0, Number(e.target.value) || 0))}
                  className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white text-right"
                />
              </div>
            </div>

            {/* Ringparken Quick Presets */}
            <div className="space-y-1">
              <div className="text-[11px] font-mono text-slate-400">
                Hurtigvalg (Dokumenterede Ringparken-besparelsesscenarier):
              </div>
              <div className="space-y-1">
                {ECONOMIC_SAVING_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setEconomicSavingDkk(preset.amountDkk)}
                    className={`w-full text-left p-1.5 rounded border text-[11px] transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      economicSavingDkk === preset.amountDkk
                        ? 'bg-amber-950/60 border-amber-400/70 text-amber-100 font-semibold'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="truncate">{preset.labelDa}</span>
                    <span className="font-mono text-amber-300 shrink-0">
                      {formatDkk(preset.amountDkk)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Confiscation vs Non-confiscation (2.0x + 1.0x vs 3.0x) */}
            <div className="pt-1 border-t border-slate-800 space-y-1.5">
              <div className="text-[11px] font-mono text-slate-400">
                Konfiskationsregime jf. Lovforslag L 69:
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfiscationPossible(true)}
                  className={`p-2 rounded border text-left text-[11px] font-mono cursor-pointer ${
                    confiscationPossible
                      ? 'bg-amber-500/20 border-amber-400 text-amber-100 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Normalregel: Bødeforhøjelse = 2,0x ΔE ({formatDkk(economicSavingDkk * 2)}) + Konfiskation = 1,0x ΔE ({formatDkk(economicSavingDkk)})
                </button>
                <button
                  type="button"
                  onClick={() => setConfiscationPossible(false)}
                  className={`p-2 rounded border text-left text-[11px] font-mono cursor-pointer ${
                    !confiscationPossible
                      ? 'bg-rose-500/20 border-rose-400 text-rose-100 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Manglende konfiskation: Skærpet bøde = 3,0x ΔE ({formatDkk(economicSavingDkk * 3)}) uden særskilt konfiskation
                </button>
              </div>
            </div>
          </div>

          {/* MBL § 40 b Carrier/Receiver Right Revocation Indicator */}
          <div
            className={`p-3 rounded border space-y-2 ${
              calculation.mbl40bRevocationRisk
                ? 'bg-rose-950/60 border-rose-500/70'
                : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                <FileWarning className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Miljøbeskyttelseslovens § 40 b · Frakendelse af Transportør-/Modtagerret</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOffenseCount(1)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer ${
                    offenseCount === 1
                      ? 'bg-slate-200 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  1. gang
                </button>
                <button
                  type="button"
                  onClick={() => setOffenseCount(2)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer ${
                    offenseCount >= 2
                      ? 'bg-rose-500 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  Gentaget (≥2)
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-200 leading-relaxed">
              {calculation.mbl40bRevocationRisk
                ? 'KRITISK INDIKATOR (MBL § 40 b AKTIV): Ved gentagne overtrædelser eller grov tilsidesættelse af affalds- og jordflytningsreglerne kan retten til at være registreret transportør, indsamler eller modtageranlæg frakendes.'
                : '1. gangstilfælde registreret. Ved gentagne overtrædelser udløses frakendelse af registrering som affaldstransportør/modtager jf. MBL § 40 b.'}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Action Bar */}
      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-mono text-slate-300">
          Kumuleret normalbøde ({calculation.sizeMultiplier}x):{' '}
          <strong className="text-white">
            {formatDkk(calculation.cumulativeSizeAdjustedFineDkk)}
          </strong>{' '}
          · Besparelsestillæg ({calculation.savingFineMultiplier}x):{' '}
          <strong className="text-amber-300">
            {formatDkk(calculation.savingFineSurchargeDkk)}
          </strong>{' '}
          · Konfiskation:{' '}
          <strong className="text-cyan-300">{formatDkk(calculation.confiscationAmountDkk)}</strong>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onLogAlgedonicEvent && (
            <button
              type="button"
              onClick={handleLogToAlgedonic}
              className="px-3 py-1.5 rounded bg-rose-500 hover:bg-rose-400 text-slate-950 font-mono text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>
                {loggedConfirmation
                  ? '✓ Logget i Algedonisk Log'
                  : 'Bogfør L 69 Bødeberegning i Algedonisk Log'}
              </span>
            </button>
          )}
          {onSendToLegalAi && (
            <button
              type="button"
              onClick={() =>
                onSendToLegalAi(
                  `Udarbejd en skarp juridisk straffepåstand efter Lovforslag L 69 (8. oktober 2026) for Ringparken: ${
                    calculation.lineItems.length
                  } kumulerede lovbrud, virksomhedsstørrelse ${
                    calculation.sizeMeta.labelDa
                  }, økonomisk besparelse ΔE = ${formatDkk(
                    economicSavingDkk
                  )}, samlet bøde- og konfiskationskrav = ${formatDkk(
                    calculation.totalFinancialLiabilityDkk
                  )} samt påstand om frakendelse efter Miljøbeskyttelseslovens § 40 b.`
                )
              }
              className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Send L 69 Beregning til Gemini Jurist</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
