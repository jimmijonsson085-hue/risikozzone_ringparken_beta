export const L69_BASE_FINES_DKK = {
  JFL_SEC_8_NO_PERMIT: {
    statute: 'Jordforureningsloven § 8, stk. 1-2, jf. § 88',
    label: 'Bygge-/anlægsarbejde på kortlagt areal uden § 8-tilladelse',
    businessMinDkk: 100000,
    privateMinDkk: 50000,
    isMaterial: true,
  },
  MBL_SEC_33_NO_APPROVAL: {
    statute: 'Miljøbeskyttelsesloven § 33, jf. § 110',
    label: 'Oplag/knusning af affald eller jord uden § 33-miljøgodkendelse',
    businessMinDkk: 100000,
    privateMinDkk: 50000,
    isMaterial: true,
  },
  JFL_SEC_50_UNNOTIFIED_SOIL: {
    statute: 'Jordforureningsloven § 50, stk. 2 & Jordflytningsbek. § 4',
    label: 'Flytning af forurenet/kortlagt jord uden anmeldelse',
    businessMinDkk: 50000,
    privateMinDkk: 25000,
    isMaterial: true,
  },
  BYGGEAFFALD_UNSCREENED: {
    statute: 'Byggeaffaldsbek. §§ 3, 4 og 8 (4x skærpelse i L 69)',
    label: 'Manglende anmeldelse, miljøscreening eller kortlægning (>1 ton)',
    businessMinDkk: 40000,
    privateMinDkk: 20000,
    isMaterial: false,
  },
  MBL_SEC_43_HAZARDOUS_MIX: {
    statute: 'Miljøbeskyttelsesloven § 43 & Affaldsbek. §§ 56, 63, 66',
    label: 'Ulovlig håndtering/sammenblanding af asbest, PCB eller farligt affald',
    businessMinDkk: 40000,
    privateMinDkk: 40000,
    isMaterial: true,
  },
  JFL_SEC_50_STK5_4WEEKS: {
    statute: 'Jordforureningsloven § 50, stk. 5, jf. § 88, stk. 1, nr. 6',
    label: 'Overtrædelse af 4-ugers reglen før opgravning/flytning af jord',
    businessMinDkk: 25000,
    privateMinDkk: 12500,
    isMaterial: false,
  },
  JFL_SEC_72_MISLEADING_INFO: {
    statute: 'Jordforureningsloven § 72, jf. § 88, stk. 1, nr. 10',
    label: 'Afgivelse af urigtige eller vildledende oplysninger til myndighed',
    businessMinDkk: 25000,
    privateMinDkk: 12500,
    isMaterial: false,
  },
  JFL_SEC_12_70_TENANT_NOTICE: {
    statute: 'Jordforureningsloven § 12 & § 70, stk. 4, jf. § 88, stk. 1, nr. 13',
    label: 'Manglende skriftlig underretning af lejere inden 4 uger',
    businessMinDkk: 15000,
    privateMinDkk: 7500,
    isMaterial: false,
  },
};

export type L69ViolationKey = keyof typeof L69_BASE_FINES_DKK;

export function calculateL69TotalSanction(params: {
  violationKeys: Array<keyof typeof L69_BASE_FINES_DKK>;
  companyEmployeesCount: number;
  estimatedSavedCostDkk: number;
  canConfiscateProceeds: boolean;
  isRepeatOffense: boolean;
}) {
  const sizeMultiplier =
    params.companyEmployeesCount >= 100
      ? 2.0
      : params.companyEmployeesCount >= 35
      ? 1.75
      : params.companyEmployeesCount >= 10
      ? 1.5
      : 1.0;

  const baseFineSum = params.violationKeys.reduce((sum, key) => {
    const spec = L69_BASE_FINES_DKK[key];
    const scaled = spec.isMaterial ? spec.businessMinDkk * sizeMultiplier : spec.businessMinDkk;
    return sum + (params.isRepeatOffense ? scaled * 2 : scaled);
  }, 0);

  // L 69 (pkt. 2.3.3.4 & 2.3.3.5): Bøden forhøjes med 2x opnået/tilsigtet besparelse (+ 1x ekstra hvis konfiskation ikke kan ske = 3x)
  const savingsFineAddition =
    params.estimatedSavedCostDkk * (params.canConfiscateProceeds ? 2.0 : 3.0);
  const confiscationAmount = params.canConfiscateProceeds ? params.estimatedSavedCostDkk : 0;

  return {
    baseFineSum,
    sizeMultiplier,
    savingsFineAddition,
    confiscationAmount,
    totalFinancialLiabilityDkk: baseFineSum + savingsFineAddition + confiscationAmount,
  };
}
