import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Camera,
  Check,
  Clock,
  Download,
  Eye,
  FileJson,
  FileSpreadsheet,
  FileText,
  Filter,
  FlaskConical,
  FolderArchive,
  MapPin,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { SUBSTANCE_SPECS } from '../../data/ringparkenData';
import { validateObservationPhotoEvidenceBinary } from '../../services/pdfExportService';
import { shiftDateIsoByDays } from '../../services/weatherService';
import { RangeSimulationSummary } from '../../services/rangeSimulationService';
import {
  AlgedonicObservation,
  ExportFilterCriteria,
  ReceptorZone,
  SubstanceKey,
} from '../../types/dispersion';

export interface ExportHubPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  dateIso: string;
  hourLabel: string;
  sha256Hash: string;
  merkleRootSignature: string;
  observationsCount: number;
  observations?: AlgedonicObservation[];
  validatePhotoEvidenceBinary?: boolean;
  onToggleValidatePhotoEvidenceBinary?: () => void;
  legalViolationsCount: number;
  receptors: ReceptorZone[];
  exportFilter: ExportFilterCriteria;
  onChangeExportFilter: (next: ExportFilterCriteria) => void;
  completedRangeSimulation: RangeSimulationSummary | null;
  onOpenRangeSimDrawer: () => void;
  isBulkDownloading: boolean;
  // Category A: 10 PDF Reports
  onDownloadForensicPdf: () => void;
  onOpenForensicReportModal: () => void;
  onExportChronologicalEvidencePdf: () => void;
  onExportChainOfCustodyPdf: () => void;
  onDownloadPercolationPdf: () => void;
  onExportAcousticDiagramPdf: () => void;
  onDownload29BuildingRegistryPdf: () => void;
  onDownloadFormalSlagelseComplaintPdf: () => void;
  onDownloadFull168hDbaCatalogPdf: () => void;
  onDownloadRangeSupervisionPdf: (summary: RangeSimulationSummary) => void;
  onDownloadRangePercolationPdf: (summary: RangeSimulationSummary) => void;
  // Category B: 5 ESDH / SBSYS CSV Tables
  onExportSelectedHourCsv: () => void;
  onExportSlagelseViolationsCsv: (delimiter: ';' | ',') => void;
  onExportPdfWidgetStatsCsv: () => void;
  onExportDbaVsRealtimeCsv: () => void;
  onDownloadRangeCsv: (summary: RangeSimulationSummary) => void;
  // Category C: 8 JSON, TXT, Print & Bulk Package Flows
  onExportForensicAuditLogJson: () => void;
  onDownloadForensicJsonReport: () => void;
  onExportSelectedDayWeatherJson: () => void;
  onExportMachineWindNoiseJson: () => void;
  onDownloadRangeJson: (summary: RangeSimulationSummary) => void;
  onDownloadLegalComplaintTxt: () => void;
  onPrintPdfWidgetAppendix: () => void;
  onAddAllAndBulkDownload: () => void;
}

type CategoryFilterKey = 'all' | 'cat_a_pdf' | 'cat_b_csv' | 'cat_c_raw';

interface ExportItemSpec {
  id: string;
  category: 'cat_a_pdf' | 'cat_b_csv' | 'cat_c_raw';
  indexLabel: string;
  title: string;
  subtitle: string;
  formatTag: string;
  requiresRangeSim?: boolean;
  onTrigger: () => void;
  secondaryAction?: {
    label: string;
    onTrigger: () => void;
    icon?: 'preview' | 'csv';
  };
}

export const ExportHubPopover: React.FC<ExportHubPopoverProps> = ({
  isOpen,
  onClose,
  dateIso,
  hourLabel,
  sha256Hash,
  merkleRootSignature,
  observationsCount,
  observations = [],
  validatePhotoEvidenceBinary: externalValidatePhotoEvidenceBinary,
  onToggleValidatePhotoEvidenceBinary,
  legalViolationsCount,
  receptors,
  exportFilter,
  onChangeExportFilter,
  completedRangeSimulation,
  onOpenRangeSimDrawer,
  isBulkDownloading,
  onDownloadForensicPdf,
  onOpenForensicReportModal,
  onExportChronologicalEvidencePdf,
  onExportChainOfCustodyPdf,
  onDownloadPercolationPdf,
  onExportAcousticDiagramPdf,
  onDownload29BuildingRegistryPdf,
  onDownloadFormalSlagelseComplaintPdf,
  onDownloadFull168hDbaCatalogPdf,
  onDownloadRangeSupervisionPdf,
  onDownloadRangePercolationPdf,
  onExportSelectedHourCsv,
  onExportSlagelseViolationsCsv,
  onExportPdfWidgetStatsCsv,
  onExportDbaVsRealtimeCsv,
  onDownloadRangeCsv,
  onExportForensicAuditLogJson,
  onDownloadForensicJsonReport,
  onExportSelectedDayWeatherJson,
  onExportMachineWindNoiseJson,
  onDownloadRangeJson,
  onDownloadLegalComplaintTxt,
  onPrintPdfWidgetAppendix,
  onAddAllAndBulkDownload,
}) => {
  const [activeFilter, setActiveFilter] = useState<CategoryFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentExportIds, setRecentExportIds] = useState<Record<string, boolean>>({});
  const [isExportFilterDialogOpen, setIsExportFilterDialogOpen] = useState(false);
  const [receptorSearchQuery, setReceptorSearchQuery] = useState('');
  const [draftFilter, setDraftFilter] = useState<ExportFilterCriteria>(exportFilter);
  const [internalValidatePhotoBinary, setInternalValidatePhotoBinary] = useState<boolean>(true);
  const effectiveValidatePhotoBinary =
    externalValidatePhotoEvidenceBinary !== undefined
      ? externalValidatePhotoEvidenceBinary
      : internalValidatePhotoBinary;
  const handleToggleValidatePhotoBinary = () => {
    if (onToggleValidatePhotoEvidenceBinary) {
      onToggleValidatePhotoEvidenceBinary();
    } else {
      setInternalValidatePhotoBinary((v) => !v);
    }
  };

  const photoBinaryAudit = useMemo(() => {
    const inspected = observations.map((obs) => ({
      obs,
      check: validateObservationPhotoEvidenceBinary(obs),
    }));
    const validCount = inspected.filter((item) => item.check.isValid).length;
    const missingEntries = inspected.filter((item) => !item.check.isValid);
    return {
      total: observations.length,
      validCount,
      missingCount: missingEntries.length,
      missingEntries,
    };
  }, [observations]);

  useEffect(() => {
    if (isExportFilterDialogOpen) {
      setDraftFilter({
        ...exportFilter,
        receptorIds:
          exportFilter.receptorIds.length > 0
            ? exportFilter.receptorIds
            : receptors.map((r) => r.id),
      });
      setReceptorSearchQuery('');
    }
  }, [isExportFilterDialogOpen, exportFilter, receptors]);

  useEffect(() => {
    if (!isOpen) {
      setIsExportFilterDialogOpen(false);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (isExportFilterDialogOpen) {
          setIsExportFilterDialogOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExportFilterDialogOpen, onClose]);

  const markTriggered = (id: string, fn: () => void) => {
    fn();
    setRecentExportIds((prev) => ({ ...prev, [id]: true }));
    window.setTimeout(() => {
      setRecentExportIds((prev) => ({ ...prev, [id]: false }));
    }, 3200);
  };

  const items = useMemo<ExportItemSpec[]>(
    () => [
      // KATEGORI A — 10 PDF-FLOWS
      {
        id: 'a1-forensic-pdf',
        category: 'cat_a_pdf',
        indexLabel: 'A1',
        title: 'Samlet Retsmedicinsk Bevis-Rapport',
        subtitle: `A4 hovedrapport med Gaussisk spredning, aktive kilder, receptorer og ${observationsCount} SHA-256 beviser.`,
        formatTag: 'PDF · A4',
        onTrigger: onDownloadForensicPdf,
        secondaryAction: {
          label: 'Forhåndsvisning',
          icon: 'preview',
          onTrigger: () => {
            onClose();
            onOpenForensicReportModal();
          },
        },
      },
      {
        id: 'a2-chronological-pdf',
        category: 'cat_a_pdf',
        indexLabel: 'A2',
        title: 'Kronologisk Bevis-Bilag med Fotos, PDF & Signaler',
        subtitle: 'Tidslinjebilag med indlejrede fotobeviser, felt-notater og individuelle SHA-256 signaturer.',
        formatTag: 'PDF · Bilag',
        onTrigger: onExportChronologicalEvidencePdf,
      },
      {
        id: 'a3-chain-of-custody-pdf',
        category: 'cat_a_pdf',
        indexLabel: 'A3',
        title: 'Chain-of-Custody SHA-256 & Merkle-Root Log',
        subtitle: 'Kryptografisk uforanderlighedsbevis jf. ISO/IEC 27037 med komplet Merkle-træ verifikation.',
        formatTag: 'PDF · ISO 27037',
        onTrigger: onExportChainOfCustodyPdf,
      },
      {
        id: 'a4-percolation-pdf',
        category: 'cat_a_pdf',
        indexLabel: 'A4',
        title: 'Hydrogeologisk Perkolationsrapport',
        subtitle: 'Darcy-strømning, retardationsfaktor og grundvandsudvaskning af tungmetaller og PCB.',
        formatTag: 'PDF · Darcy',
        onTrigger: onDownloadPercolationPdf,
      },
      {
        id: 'a5-acoustic-diagram-pdf',
        category: 'cat_a_pdf',
        indexLabel: 'A5',
        title: 'Lydbølgebøjnings-Diagram & Receptor dB-Rapport',
        subtitle: 'Nord2000 / ISO 9613-2 akustisk refraktionsdiagram, strålekrumning og korrigerede LAeq/LAFmax dB.',
        formatTag: 'PDF · Nord2000',
        onTrigger: onExportAcousticDiagramPdf,
      },
      {
        id: 'a6-building-registry-pdf',
        category: 'cat_a_pdf',
        indexLabel: 'A6',
        title: '29-Enheder Bygnings- & Inspektionsregister',
        subtitle: 'Komplet tilstandsrapport for alle 24 boligblokke og 5 erhvervs-/institutionsbygninger (Kat. A–E).',
        formatTag: 'PDF · 29 Enheder',
        onTrigger: onDownload29BuildingRegistryPdf,
      },
      {
        id: 'a7-slagelse-complaint-pdf',
        category: 'cat_a_pdf',
        indexLabel: 'A7',
        title: 'Formel Juridisk Klage til Slagelse Kommune',
        subtitle: `Myndighedsklage til Center for Miljø, Plan og Teknik (MBL § 42, BEK 613/2026 · ${legalViolationsCount} forhold).`,
        formatTag: 'PDF · Juridisk',
        onTrigger: onDownloadFormalSlagelseComplaintPdf,
      },
      {
        id: 'a8-dba-168h-pdf',
        category: 'cat_a_pdf',
        indexLabel: 'A8',
        title: 'Fuld 168-Timers DBA Impuls-Katalog Rapport',
        subtitle: '7-døgns (168t) sammenholdelse af vindkompenserede Klasse-1 .DBA-logfiler og naboklager.',
        formatTag: 'PDF · 168t DBA',
        onTrigger: onDownloadFull168hDbaCatalogPdf,
      },
      {
        id: 'a9-range-supervision-pdf',
        category: 'cat_a_pdf',
        indexLabel: 'A9',
        title: 'Interval-Simulering: Samlet Tilsynsrapport',
        subtitle: completedRangeSimulation
          ? `Klar for intervallet ${completedRangeSimulation.fromLabel} – ${completedRangeSimulation.toLabel}.`
          : 'Kør først en Fra–Til fler-timers simulering for at generere samlet tilsynsrapport.',
        formatTag: 'PDF · Interval',
        requiresRangeSim: true,
        onTrigger: () => {
          if (completedRangeSimulation) {
            onDownloadRangeSupervisionPdf(completedRangeSimulation);
          } else {
            onClose();
            onOpenRangeSimDrawer();
          }
        },
      },
      {
        id: 'a10-range-percolation-pdf',
        category: 'cat_a_pdf',
        indexLabel: 'A10',
        title: 'Interval-Simulering: Samlet Perkulationsrapport',
        subtitle: completedRangeSimulation
          ? `Kumulativ nedbørs- og nedsivningsrapport over ${completedRangeSimulation.totalHoursSimulated} simulerede timer.`
          : 'Kør først en Fra–Til fler-timers simulering for at generere kumulativ perkulationsrapport.',
        formatTag: 'PDF · Interval',
        requiresRangeSim: true,
        onTrigger: () => {
          if (completedRangeSimulation) {
            onDownloadRangePercolationPdf(completedRangeSimulation);
          } else {
            onClose();
            onOpenRangeSimDrawer();
          }
        },
      },

      // KATEGORI B — 5 CSV-FLOWS (ESDH / SBSYS)
      {
        id: 'b1-selected-hour-csv',
        category: 'cat_b_csv',
        indexLabel: 'B1',
        title: 'Valgte Time: Rå Vejrdata & Alle Receptor-Sumkvotienter',
        subtitle: `Komplet regnearksudtræk for ${dateIso} kl. ${hourLabel} inkl. stofbidrag C_i/GV_i pr. receptor.`,
        formatTag: 'CSV · UTF-8',
        onTrigger: onExportSelectedHourCsv,
      },
      {
        id: 'b2-slagelse-esdh-csv',
        category: 'cat_b_csv',
        indexLabel: 'B2',
        title: 'Slagelse Kommune Lovovertrædelses-Tabel (ESDH / SBSYS)',
        subtitle: `27-kolonners KLE/FACET-klassificeret journaliseringstabel (${legalViolationsCount} registrerede lovbrud).`,
        formatTag: 'CSV · Semikolon (;)',
        onTrigger: () => onExportSlagelseViolationsCsv(';'),
        secondaryAction: {
          label: 'CSV Komma (,)',
          icon: 'csv',
          onTrigger: () => onExportSlagelseViolationsCsv(','),
        },
      },
      {
        id: 'b3-forensic-stats-csv',
        category: 'cat_b_csv',
        indexLabel: 'B3',
        title: 'Retsmedicinsk Bilags-Statistik CSV',
        subtitle: 'Nøgletal for fotos, PDF-beviser, fysiske signaler, L 69 bøderisiko og Merkle-Root signatur.',
        formatTag: 'CSV · Statistik',
        onTrigger: onExportPdfWidgetStatsCsv,
      },
      {
        id: 'b4-dba-vs-sim-csv',
        category: 'cat_b_csv',
        indexLabel: 'B4',
        title: 'Historiske DBA-Filer vs. Realtids-Simulering CSV',
        subtitle: '24-timers time-for-time sammenligning af målt .DBA, vindskærmskompensation og >3 dB afvigelse.',
        formatTag: 'CSV · 24t DBA',
        onTrigger: onExportDbaVsRealtimeCsv,
      },
      {
        id: 'b5-range-sim-csv',
        category: 'cat_b_csv',
        indexLabel: 'B5',
        title: 'Interval-Simulering Data CSV',
        subtitle: completedRangeSimulation
          ? `Alle ${completedRangeSimulation.totalHoursSimulated} simulerede timer klar til SBSYS/Excel-import.`
          : 'Åbner Simuler Fra – Til panelet for at køre fler-timers intervalkørsel.',
        formatTag: 'CSV · Interval',
        requiresRangeSim: true,
        onTrigger: () => {
          if (completedRangeSimulation) {
            onDownloadRangeCsv(completedRangeSimulation);
          } else {
            onClose();
            onOpenRangeSimDrawer();
          }
        },
      },

      // KATEGORI C — 8 RÅ TELEMETRI, JSON, TXT, PRINT & BULK
      {
        id: 'c1-audit-log-json',
        category: 'cat_c_raw',
        indexLabel: 'C1',
        title: 'Fuld ISO/IEC 27037 Database Audit-Log JSON',
        subtitle: 'Maskinlæsbar retsmedicinsk revisionslog med fuldt bevistræ, kilder og tilstands-hash.',
        formatTag: 'JSON · Audit',
        onTrigger: onExportForensicAuditLogJson,
      },
      {
        id: 'c2-forensic-report-json',
        category: 'cat_c_raw',
        indexLabel: 'C2',
        title: 'Teknisk Bevis-Rapport JSON',
        subtitle: 'Struktureret JSON-snapshot af spredningsmodel, Gaussiske faner, receptorer og observationer.',
        formatTag: 'JSON · Snapshot',
        onTrigger: onDownloadForensicJsonReport,
      },
      {
        id: 'c3-open-meteo-json',
        category: 'cat_c_raw',
        indexLabel: 'C3',
        title: '24-Timers Open-Meteo Vejr- & Vejkorridor-Datasæt',
        subtitle: 'Alle 24 timers vind, vindstød, Pasquill-stabilitet, opdrift ΔP_s og vejkorridor-eksponering.',
        formatTag: 'JSON · 24t Vejr',
        onTrigger: onExportSelectedDayWeatherJson,
      },
      {
        id: 'c4-wind-noise-json',
        category: 'cat_c_raw',
        indexLabel: 'C4',
        title: 'Maskin-Specifik Vindstøj-Korrelation JSON',
        subtitle: 'Pearson-korrelation r, R², følsomhedskurve (0–22 m/s) og 24t impulsstøjsdata for valgt maskine.',
        formatTag: 'JSON · Akustik',
        onTrigger: onExportMachineWindNoiseJson,
      },
      {
        id: 'c5-range-sim-json',
        category: 'cat_c_raw',
        indexLabel: 'C5',
        title: 'Interval-Simulering Rådata JSON',
        subtitle: completedRangeSimulation
          ? `Komplet JSON-datasæt for ${completedRangeSimulation.totalHoursSimulated} simulerede timer.`
          : 'Åbner Simuler Fra – Til panelet for at generere fler-timers rådata.',
        formatTag: 'JSON · Interval',
        requiresRangeSim: true,
        onTrigger: () => {
          if (completedRangeSimulation) {
            onDownloadRangeJson(completedRangeSimulation);
          } else {
            onClose();
            onOpenRangeSimDrawer();
          }
        },
      },
      {
        id: 'c6-complaint-resume-txt',
        category: 'cat_c_raw',
        indexLabel: 'C6',
        title: 'Juridisk Klage-Resume som Tekstfil (.txt)',
        subtitle: 'Ren tekstudgave klar til direkte indsættelse i Digital Post / Borger.dk til Slagelse Kommune.',
        formatTag: 'TXT · Digital Post',
        onTrigger: onDownloadLegalComplaintTxt,
      },
      {
        id: 'c7-print-appendix',
        category: 'cat_c_raw',
        indexLabel: 'C7',
        title: 'Print Isoleret Retsmedicinsk Bilag',
        subtitle: 'Åbner browserens A4-udskriftsdialog isoleret til det signerede retsmedicinske bevisbilag.',
        formatTag: 'PRINT · A4',
        onTrigger: () => {
          onClose();
          onPrintPdfWidgetAppendix();
        },
      },
      {
        id: 'c8-bulk-package',
        category: 'cat_c_raw',
        indexLabel: 'C8',
        title: 'Tilføj alle fund & Bulk Download pakke',
        subtitle: 'Signerer samtlige aktuelle fund med SHA-256 og downloader samlet bevispakke (PDF + Perkolation + CSV + JSON).',
        formatTag: 'BULK · Komplet',
        onTrigger: onAddAllAndBulkDownload,
      },
    ],
    [
      observationsCount,
      legalViolationsCount,
      completedRangeSimulation,
      dateIso,
      hourLabel,
      onDownloadForensicPdf,
      onOpenForensicReportModal,
      onExportChronologicalEvidencePdf,
      onExportChainOfCustodyPdf,
      onDownloadPercolationPdf,
      onExportAcousticDiagramPdf,
      onDownload29BuildingRegistryPdf,
      onDownloadFormalSlagelseComplaintPdf,
      onDownloadFull168hDbaCatalogPdf,
      onDownloadRangeSupervisionPdf,
      onDownloadRangePercolationPdf,
      onExportSelectedHourCsv,
      onExportSlagelseViolationsCsv,
      onExportPdfWidgetStatsCsv,
      onExportDbaVsRealtimeCsv,
      onDownloadRangeCsv,
      onExportForensicAuditLogJson,
      onDownloadForensicJsonReport,
      onExportSelectedDayWeatherJson,
      onExportMachineWindNoiseJson,
      onDownloadRangeJson,
      onDownloadLegalComplaintTxt,
      onPrintPdfWidgetAppendix,
      onAddAllAndBulkDownload,
      onClose,
      onOpenRangeSimDrawer,
    ]
  );

  if (!isOpen) return null;

  const q = searchQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (activeFilter !== 'all' && item.category !== activeFilter) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.formatTag.toLowerCase().includes(q) ||
      item.indexLabel.toLowerCase().includes(q)
    );
  });

  const ALL_SUBSTANCE_KEYS: SubstanceKey[] = [
    'asbestos',
    'pcb',
    'heavyMetals',
    'quartzWool',
    'moldSewer',
  ];

  const matchingReceptorsInDialog = receptors.filter((r) => {
    const rq = receptorSearchQuery.trim().toLowerCase();
    if (!rq) return true;
    return (
      r.code.toLowerCase().includes(rq) ||
      r.name.toLowerCase().includes(rq) ||
      r.address.toLowerCase().includes(rq)
    );
  });

  const activeReceptorFilterCount =
    exportFilter.receptorIds.length > 0
      ? exportFilter.receptorIds.length
      : receptors.length;

  const handleToggleDraftReceptor = (receptorId: string) => {
    setDraftFilter((prev) => {
      const exists = prev.receptorIds.includes(receptorId);
      return {
        ...prev,
        receptorIds: exists
          ? prev.receptorIds.filter((id) => id !== receptorId)
          : [...prev.receptorIds, receptorId],
      };
    });
  };

  const handleToggleDraftSubstance = (key: SubstanceKey) => {
    setDraftFilter((prev) => {
      const exists = prev.substances.includes(key);
      if (exists && prev.substances.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        substances: exists
          ? prev.substances.filter((k) => k !== key)
          : [...prev.substances, key],
      };
    });
  };

  const handleApplyDraftFilter = (triggerAction?: 'csv' | 'pdf') => {
    const normalizedStart =
      draftFilter.startDateIso <= draftFilter.endDateIso
        ? draftFilter.startDateIso
        : draftFilter.endDateIso;
    const normalizedEnd =
      draftFilter.startDateIso <= draftFilter.endDateIso
        ? draftFilter.endDateIso
        : draftFilter.startDateIso;
    const nextFilter: ExportFilterCriteria = {
      enabled: true,
      startDateIso: normalizedStart,
      endDateIso: normalizedEnd,
      receptorIds: draftFilter.receptorIds,
      substances:
        draftFilter.substances.length > 0 ? draftFilter.substances : ALL_SUBSTANCE_KEYS,
    };
    onChangeExportFilter(nextFilter);
    setIsExportFilterDialogOpen(false);
    if (triggerAction === 'csv') {
      markTriggered('b1-selected-hour-csv', onExportSelectedHourCsv);
    } else if (triggerAction === 'pdf') {
      markTriggered('a1-forensic-pdf', onDownloadForensicPdf);
    }
  };

  const activeSubstanceDropdownValue: string =
    !exportFilter.enabled || exportFilter.substances.length === ALL_SUBSTANCE_KEYS.length
      ? 'all'
      : exportFilter.substances.length === 1
      ? exportFilter.substances[0]
      : 'custom';

  const draftSubstanceDropdownValue: string =
    draftFilter.substances.length === ALL_SUBSTANCE_KEYS.length
      ? 'all'
      : draftFilter.substances.length === 1
      ? draftFilter.substances[0]
      : 'custom';

  const handleSelectCsvSubstanceFilter = (val: string) => {
    if (val === 'all') {
      const hasCustomDateOrReceptor =
        exportFilter.startDateIso !== dateIso ||
        exportFilter.endDateIso !== dateIso ||
        (exportFilter.receptorIds.length > 0 &&
          exportFilter.receptorIds.length < receptors.length);
      onChangeExportFilter({
        ...exportFilter,
        enabled: hasCustomDateOrReceptor,
        substances: ALL_SUBSTANCE_KEYS,
      });
      return;
    }
    if (ALL_SUBSTANCE_KEYS.includes(val as SubstanceKey)) {
      onChangeExportFilter({
        ...exportFilter,
        enabled: true,
        substances: [val as SubstanceKey],
      });
    }
  };

  const handleSelectDraftSubstanceDropdown = (val: string) => {
    if (val === 'all') {
      setDraftFilter((prev) => ({
        ...prev,
        substances: ALL_SUBSTANCE_KEYS,
      }));
      return;
    }
    if (ALL_SUBSTANCE_KEYS.includes(val as SubstanceKey)) {
      setDraftFilter((prev) => ({
        ...prev,
        substances: [val as SubstanceKey],
      }));
    }
  };

  const handleResetExportFilter = () => {
    const resetVal: ExportFilterCriteria = {
      enabled: false,
      startDateIso: dateIso,
      endDateIso: dateIso,
      receptorIds: receptors.map((r) => r.id),
      substances: ALL_SUBSTANCE_KEYS,
    };
    setDraftFilter(resetVal);
    onChangeExportFilter(resetVal);
  };

  const categoryMeta: Array<{
    key: 'cat_a_pdf' | 'cat_b_csv' | 'cat_c_raw';
    heading: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      key: 'cat_a_pdf',
      heading: 'PDF — Retsmedicinske & Tekniske PDF-Rapporter (10 flows)',
      description: 'Færdigformaterede A4-dokumenter med SHA-256 signatur og myndighedsreferencer.',
      icon: FileText,
    },
    {
      key: 'cat_b_csv',
      heading: 'CSV — Kommunale Sagsbehandlings- & ESDH/SBSYS-Tabeller (5 flows)',
      description: 'UTF-8 BOM-kodede tabeller til direkte indlæsning i SBSYS, KLE/FACET og regneark.',
      icon: FileSpreadsheet,
    },
    {
      key: 'cat_c_raw',
      heading: 'JSON — Rå Telemetri, Audit-Logs, TXT, Print & Bulk-Pakke (8 flows)',
      description: 'Maskinlæsbar ISO/IEC 27037 JSON-rådata, Digital Post-tekst, printbilag og samlet bevispakke.',
      icon: FileJson,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-end pt-12 px-3 sm:px-4 pb-6 bg-black/50 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-hub-title"
        data-testid="export-hub-popover"
        className="w-full max-w-4xl max-h-[84dvh] flex flex-col rounded-lg bg-[var(--surface-overlay)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden font-sans tabular-nums text-[var(--text-primary)]"
      >
        {/* Top Header & Cryptographic Verification Bar */}
        <div className="px-5 py-3.5 bg-[var(--surface-panel)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-cyan-400 shrink-0" />
              <h2 id="export-hub-title" className="text-sm font-bold text-slate-100 tracking-tight">
                Rapport &amp; Eksport Hub (PDF · CSV · JSON — 23 flows)
              </h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>SHA-256: {sha256Hash.slice(0, 16)}…</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>Merkle-Root: {merkleRootSignature.slice(0, 14)}…</span>
              <span aria-hidden="true">·</span>
              <span>
                Tidspunkt: {dateIso} kl. {hourLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span>Beviser: {observationsCount}</span>
              <span aria-hidden="true">·</span>
              <span>Lovbrud: {legalViolationsCount}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="export-photo-validation-toggle"
              aria-pressed={effectiveValidatePhotoBinary}
              onClick={handleToggleValidatePhotoBinary}
              className={`px-2.5 py-1.5 rounded font-mono text-[11px] font-bold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
                effectiveValidatePhotoBinary
                  ? photoBinaryAudit.missingCount > 0
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400 text-amber-100'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400 text-emerald-100'
                  : 'bg-[#151C28] hover:bg-[#212C3E] border-[#2D3B50] text-slate-300'
              }`}
              title="Validér om alle forensiske evidensposter har en gyldig foto-binær og flag manglende poster i forensisk PDF-eksport"
            >
              <Camera
                className={`w-3.5 h-3.5 shrink-0 ${
                  effectiveValidatePhotoBinary
                    ? photoBinaryAudit.missingCount > 0
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                    : 'text-slate-400'
                }`}
              />
              <span>
                {effectiveValidatePhotoBinary
                  ? photoBinaryAudit.missingCount > 0
                    ? `Foto-Validér TIL (${photoBinaryAudit.missingCount} flagges i PDF)`
                    : `Foto-Validér TIL (${photoBinaryAudit.validCount}/${photoBinaryAudit.total} OK)`
                  : 'Foto-Validér FRA'}
              </span>
            </button>
            <button
              type="button"
              data-testid="open-export-filter-dialog-btn"
              onClick={() => setIsExportFilterDialogOpen(true)}
              className={`px-3 py-1.5 rounded font-mono text-[11px] font-bold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
                exportFilter.enabled
                  ? 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400 text-cyan-100'
                  : 'bg-[#151C28] hover:bg-[#212C3E] border-[#2D3B50] text-slate-200'
              }`}
              title="Åbn Eksport-Filter for at afgrænse datointerval, receptor-ID'er og stofkategorier før CSV/PDF-generering"
            >
              <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                {exportFilter.enabled
                  ? `Eksport-Filter (Aktiv · ${activeReceptorFilterCount}/${receptors.length} rec.)`
                  : 'Eksport-Filter'}
              </span>
            </button>
            <button
              type="button"
              disabled={isBulkDownloading}
              onClick={() => markTriggered('c8-bulk-package', onAddAllAndBulkDownload)}
              className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              title="Signér samtlige aktuelle fund med SHA-256 og download hele bevispakken på én gang"
            >
              {isBulkDownloading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Download className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{isBulkDownloading ? 'Pakker beviser…' : 'Bulk Download Pakke'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Luk Rapport & Eksport Hub"
              className="p-1.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Export Filter Summary Banner */}
        {exportFilter.enabled && (
          <div
            data-testid="export-filter-active-banner"
            className="px-5 py-2 bg-[#111927] border-b border-cyan-500/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono"
          >
            <div className="flex flex-wrap items-center gap-2 text-cyan-200">
              <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-bold">Fokuseret Eksport-Filter Aktivt:</span>
              <span>
                Periode {exportFilter.startDateIso} → {exportFilter.endDateIso}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Receptorer: {activeReceptorFilterCount}/{receptors.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Stoffer: {exportFilter.substances.map((k) => SUBSTANCE_SPECS[k].shortName).join(', ')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsExportFilterDialogOpen(true)}
                className="px-2 py-0.5 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-cyan-500/40 text-cyan-200 font-semibold cursor-pointer"
              >
                Redigér filter
              </button>
              <button
                type="button"
                onClick={handleResetExportFilter}
                className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Nulstil</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter Tabs & Search Strip */}
        <div className="px-5 py-2.5 bg-[#151C28] border-b border-[#253042] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1 bg-[#0F141D] p-1 rounded-md border border-[#253042] text-[11px] font-medium">
            {(
              [
                { id: 'all', label: 'Alle (23)' },
                { id: 'cat_a_pdf', label: 'PDF (10)' },
                { id: 'cat_b_csv', label: 'CSV / ESDH (5)' },
                { id: 'cat_c_raw', label: 'JSON · TXT · Print (8)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                  activeFilter === tab.id
                    ? 'bg-[#212C3E] text-white font-semibold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[210px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrér 23 rapporter og datasæt…"
              aria-label="Filtrér rapporter og eksportformater"
              className="w-full pl-8 pr-3 py-1.5 rounded bg-[#0F141D] border border-[#2D3B50] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Scrollable Body with 3 Structured Categories */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">
          {categoryMeta.map((cat) => {
            const catItems = filteredItems.filter((i) => i.category === cat.key);
            if (catItems.length === 0) return null;
            const CatIcon = cat.icon;

            return (
              <section key={cat.key} className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#253042] pb-1.5">
                  <div className="flex items-center gap-2">
                    <CatIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                    <h3 className="text-xs font-bold text-slate-100">{cat.heading}</h3>
                  </div>

                  {cat.key === 'cat_b_csv' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
                        <FlaskConical className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="font-semibold">Filtrér efter stof:</span>
                        <select
                          data-testid="csv-substance-filter-dropdown"
                          aria-label="Filter by Substance for CSV Export"
                          value={activeSubstanceDropdownValue}
                          onChange={(e) => handleSelectCsvSubstanceFilter(e.target.value)}
                          className="px-2 py-1 rounded bg-[#0F141D] border border-cyan-500/50 hover:border-cyan-400 text-cyan-100 font-mono text-[11px] font-bold focus:outline-none focus:border-cyan-300 cursor-pointer"
                        >
                          <option value="all">Alle stoffer (5)</option>
                          <option value="asbestos">Kun Asbest (Asbestos)</option>
                          <option value="pcb">Kun PCB</option>
                          <option value="heavyMetals">Kun Tungmetaller (Heavy Metals)</option>
                          <option value="quartzWool">Kun Kvarts- &amp; Mineraluld</option>
                          <option value="moldSewer">Kun Skimmel &amp; Kloak</option>
                          {activeSubstanceDropdownValue === 'custom' && (
                            <option value="custom">
                              Brugerdefineret ({exportFilter.substances.length} stoffer)
                            </option>
                          )}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400">{cat.description}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {catItems.map((item) => {
                    const isJustExported = Boolean(recentExportIds[item.id]);
                    const needsRangeSetup =
                      Boolean(item.requiresRangeSim) && !completedRangeSimulation;

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-md bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-slate-500 transition-colors flex flex-col justify-between gap-2.5"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                            <span>
                              {item.indexLabel} · {item.formatTag}
                            </span>
                            {needsRangeSetup && (
                              <span className="text-amber-300 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>Kræver intervalkørsel</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-100 leading-snug">
                            {item.title}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {item.subtitle}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                          {item.secondaryAction && (
                            <button
                              type="button"
                              onClick={() =>
                                markTriggered(
                                  `${item.id}-sec`,
                                  item.secondaryAction!.onTrigger
                                )
                              }
                              className="px-2.5 py-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-200 font-mono text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                            >
                              {item.secondaryAction.icon === 'preview' ? (
                                <Eye className="w-3 h-3 text-cyan-400 shrink-0" />
                              ) : (
                                <FileSpreadsheet className="w-3 h-3 text-emerald-400 shrink-0" />
                              )}
                              <span>{item.secondaryAction.label}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => markTriggered(item.id, item.onTrigger)}
                            className={`px-3 py-1 rounded font-mono text-[11px] font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
                              isJustExported
                                ? 'bg-emerald-400 text-slate-950 border-emerald-200 font-bold'
                                : needsRangeSetup
                                ? 'bg-[#151C28] hover:bg-[#212C3E] text-amber-200 border-amber-500/40'
                                : 'bg-[#212C3E] hover:bg-[#29374D] text-cyan-100 border-cyan-500/40'
                            }`}
                          >
                            {isJustExported ? (
                              <>
                                <Check className="w-3.5 h-3.5 shrink-0" />
                                <span>Eksporteret</span>
                              </>
                            ) : needsRangeSetup ? (
                              <>
                                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>Åbn Simuler Fra – Til</span>
                              </>
                            ) : item.id === 'c7-print-appendix' ? (
                              <>
                                <Printer className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                                <span>Udskriv Bilag</span>
                              </>
                            ) : item.category === 'cat_c_raw' && item.formatTag.startsWith('JSON') ? (
                              <>
                                <FileJson className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                                <span>Eksportér JSON</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                                <span>Download</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="py-10 text-center text-xs text-slate-400">
              Ingen rapporter eller eksportflows matcher &ldquo;{searchQuery}&rdquo;.
            </div>
          )}
        </div>
      </div>

      {/* Nested 'Export Filter' Dialog (Date Range, Receptor IDs, Substance Categories) */}
      {isExportFilterDialogOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-[1px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsExportFilterDialogOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-filter-dialog-title"
            data-testid="export-filter-dialog"
            className="w-full max-w-2xl max-h-[86dvh] flex flex-col rounded-lg bg-[#151C28] border border-cyan-500/60 shadow-2xl overflow-hidden font-sans tabular-nums text-slate-100"
          >
            {/* Dialog Header */}
            <div className="px-4 py-3 bg-[#1B2433] border-b border-[#2D3B50] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Filter className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <h3
                    id="export-filter-dialog-title"
                    className="text-sm font-bold text-slate-100"
                  >
                    Eksport-Filter (Fokuseret CSV &amp; PDF-Udtræk)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Afgræns datointerval, udvalgte receptor-ID&apos;er og stofkategorier før filgenerering.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportFilterDialogOpen(false)}
                aria-label="Luk Eksport-Filter"
                className="p-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dialog Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-[11px]">
              {/* 1. Date Range */}
              <section className="p-3 rounded-md bg-[#1B2433] border border-[#2D3B50] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-bold text-slate-200 uppercase flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>1. Datointerval (Observationer &amp; Tilsynsperioder)</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1 font-mono">
                    <button
                      type="button"
                      onClick={() =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          startDateIso: dateIso,
                          endDateIso: dateIso,
                        }))
                      }
                      className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-300 cursor-pointer"
                    >
                      Valgte dag
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          startDateIso: shiftDateIsoByDays(dateIso, -7),
                          endDateIso: dateIso,
                        }))
                      }
                      className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-300 cursor-pointer"
                    >
                      Sidste 7 dage
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          startDateIso: shiftDateIsoByDays(dateIso, -30),
                          endDateIso: dateIso,
                        }))
                      }
                      className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-300 cursor-pointer"
                    >
                      Sidste 30 dage
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                  <label className="space-y-1 block">
                    <span className="text-slate-400 block">Fra dato</span>
                    <input
                      type="date"
                      data-testid="export-filter-start-date"
                      value={draftFilter.startDateIso}
                      onChange={(e) => {
                        if (e.target.value) {
                          setDraftFilter((prev) => ({
                            ...prev,
                            startDateIso: e.target.value,
                          }));
                        }
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-[#0F141D] border border-[#2D3B50] text-slate-100 focus:outline-none focus:border-cyan-400 [color-scheme:dark]"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-slate-400 block">Til dato</span>
                    <input
                      type="date"
                      data-testid="export-filter-end-date"
                      value={draftFilter.endDateIso}
                      onChange={(e) => {
                        if (e.target.value) {
                          setDraftFilter((prev) => ({
                            ...prev,
                            endDateIso: e.target.value,
                          }));
                        }
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-[#0F141D] border border-[#2D3B50] text-slate-100 focus:outline-none focus:border-cyan-400 [color-scheme:dark]"
                    />
                  </label>
                </div>
              </section>

              {/* 2. Substance Categories */}
              <section className="p-3 rounded-md bg-[#1B2433] border border-[#2D3B50] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-bold text-slate-200 uppercase flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>
                      2. Stofkategorier ({draftFilter.substances.length}/{ALL_SUBSTANCE_KEYS.length})
                    </span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 font-mono">
                    <select
                      data-testid="export-filter-substance-dropdown"
                      aria-label="Filtrér efter stofkategori"
                      value={draftSubstanceDropdownValue}
                      onChange={(e) => handleSelectDraftSubstanceDropdown(e.target.value)}
                      className="px-2 py-0.5 rounded bg-[#0F141D] border border-cyan-500/50 text-cyan-100 text-[11px] font-bold focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="all">Alle stoffer (5)</option>
                      <option value="asbestos">Kun Asbest (Asbestos)</option>
                      <option value="pcb">Kun PCB</option>
                      <option value="heavyMetals">Kun Tungmetaller (Heavy Metals)</option>
                      <option value="quartzWool">Kun Kvarts- &amp; Mineraluld</option>
                      <option value="moldSewer">Kun Skimmel &amp; Kloak</option>
                      {draftSubstanceDropdownValue === 'custom' && (
                        <option value="custom">
                          Brugerdefineret ({draftFilter.substances.length} valgt)
                        </option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          substances: ALL_SUBSTANCE_KEYS,
                        }))
                      }
                      className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-300 cursor-pointer"
                    >
                      Vælg alle (5)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          substances: ['asbestos', 'pcb'],
                        }))
                      }
                      className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-amber-300 cursor-pointer"
                    >
                      Kun Asbest &amp; PCB
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono">
                  {ALL_SUBSTANCE_KEYS.map((key) => {
                    const spec = SUBSTANCE_SPECS[key];
                    const checked = draftFilter.substances.includes(key);
                    return (
                      <label
                        key={key}
                        data-testid={`export-filter-substance-${key}`}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[#151C28] border-cyan-500/60 text-slate-100'
                            : 'bg-[#0F141D] border-[#253042] text-slate-400'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleDraftSubstance(key)}
                            className="accent-cyan-400 cursor-pointer shrink-0"
                          />
                          <span className="font-semibold truncate">{spec.name}</span>
                        </span>
                        <span className="text-slate-400 shrink-0">
                          GV {spec.limitValue2026} {spec.unit}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              {/* 3. Receptor IDs */}
              <section className="p-3 rounded-md bg-[#1B2433] border border-[#2D3B50] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-bold text-slate-200 uppercase flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>
                      3. Receptor-ID&apos;er ({draftFilter.receptorIds.length}/{receptors.length})
                    </span>
                  </span>
                  <div className="flex items-center gap-1 font-mono">
                    <button
                      type="button"
                      onClick={() =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          receptorIds: receptors.map((r) => r.id),
                        }))
                      }
                      className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-300 cursor-pointer"
                    >
                      Vælg alle ({receptors.length})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          receptorIds: [],
                        }))
                      }
                      className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-300 cursor-pointer"
                    >
                      Ryd valg
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    data-testid="export-filter-receptor-search"
                    value={receptorSearchQuery}
                    onChange={(e) => setReceptorSearchQuery(e.target.value)}
                    placeholder="Søg på receptor-kode, blok eller adresse…"
                    className="w-full pl-8 pr-3 py-1.5 rounded bg-[#0F141D] border border-[#2D3B50] text-[11px] font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {draftFilter.receptorIds.length === 0 && (
                  <div className="px-2.5 py-1.5 rounded bg-amber-950/40 border border-amber-500/40 text-amber-200 font-mono">
                    Ingen specifikke receptorer valgt — ved anvendelse inkluderes alle {receptors.length} receptorer medmindre du vælger mindst én.
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-0.5 font-mono">
                  {matchingReceptorsInDialog.map((rec) => {
                    const checked = draftFilter.receptorIds.includes(rec.id);
                    return (
                      <label
                        key={rec.id}
                        data-testid={`export-filter-receptor-${rec.id}`}
                        className={`flex items-start gap-2 px-2 py-1.5 rounded border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[#151C28] border-cyan-500/60 text-slate-100'
                            : 'bg-[#0F141D] border-[#253042] text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleDraftReceptor(rec.id)}
                          className="accent-cyan-400 cursor-pointer mt-0.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-cyan-300 truncate">
                            {rec.code} · {rec.name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{rec.address}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>

              {/* 4. Foto-Bevis Binær Validering (Forensisk PDF Flagging) */}
              <section
                data-testid="export-filter-photo-validation-section"
                className={`p-3 rounded-md border space-y-2 ${
                  effectiveValidatePhotoBinary && photoBinaryAudit.missingCount > 0
                    ? 'bg-amber-950/35 border-amber-500/60'
                    : 'bg-[#1B2433] border-[#2D3B50]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-bold text-slate-200 uppercase flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>4. Foto-Bevis Binær Validering (Forensisk PDF)</span>
                  </span>
                  <label className="inline-flex items-center gap-2 cursor-pointer font-mono">
                    <input
                      type="checkbox"
                      data-testid="export-dialog-photo-validation-checkbox"
                      checked={effectiveValidatePhotoBinary}
                      onChange={handleToggleValidatePhotoBinary}
                      className="accent-cyan-400 cursor-pointer"
                    />
                    <span className="font-bold text-cyan-200">
                      {effectiveValidatePhotoBinary
                        ? 'Aktivér binær-kontrol & PDF-flagging'
                        : 'Deaktiveret'}
                    </span>
                  </label>
                </div>

                <div className="font-mono text-[11px] flex flex-wrap items-center justify-between gap-2 text-slate-300">
                  <span>
                    Kontrollerede poster:{' '}
                    <strong className="text-white">{photoBinaryAudit.total}</strong> · Gyldig
                    foto-binær:{' '}
                    <strong className="text-emerald-300">{photoBinaryAudit.validCount}</strong> ·{' '}
                    Mangler foto-binær:{' '}
                    <strong
                      className={
                        photoBinaryAudit.missingCount > 0 ? 'text-rose-300' : 'text-emerald-300'
                      }
                    >
                      {photoBinaryAudit.missingCount}
                    </strong>
                  </span>
                </div>

                {effectiveValidatePhotoBinary && photoBinaryAudit.missingCount > 0 && (
                  <div className="p-2 rounded bg-rose-950/45 border border-rose-500/50 text-rose-100 font-mono text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {photoBinaryAudit.missingCount} forensiske poster markeres med
                        [FLAGGET: MANGLER FOTO-BEVIS] i den endelige PDF:
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {photoBinaryAudit.missingEntries.slice(0, 6).map(({ obs, check }) => (
                        <span
                          key={obs.id}
                          className="px-1.5 py-0.5 rounded bg-rose-900/60 border border-rose-500/50 text-[11px]"
                          title={check.reason}
                        >
                          {obs.code} ({obs.observedHourLabel})
                        </span>
                      ))}
                      {photoBinaryAudit.missingCount > 6 && (
                        <span className="px-1.5 py-0.5 text-rose-300">
                          +{photoBinaryAudit.missingCount - 6} yderligere
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Dialog Footer */}
            <div className="px-4 py-3 bg-[#1B2433] border-t border-[#2D3B50] flex flex-wrap items-center justify-between gap-2 shrink-0 font-mono text-[11px]">
              <button
                type="button"
                data-testid="export-filter-reset-btn"
                onClick={() => {
                  handleResetExportFilter();
                  setIsExportFilterDialogOpen(false);
                }}
                className="px-3 py-1.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-300 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nulstil filter</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="export-filter-apply-btn"
                  onClick={() => handleApplyDraftFilter()}
                  className="px-3 py-1.5 rounded bg-[#212C3E] hover:bg-[#29374D] border border-cyan-500/60 text-cyan-100 font-bold cursor-pointer"
                >
                  Anvend filter
                </button>
                <button
                  type="button"
                  data-testid="export-filter-apply-csv-btn"
                  onClick={() => handleApplyDraftFilter('csv')}
                  className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                  <span>Anvend &amp; CSV</span>
                </button>
                <button
                  type="button"
                  data-testid="export-filter-apply-pdf-btn"
                  onClick={() => handleApplyDraftFilter('pdf')}
                  className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>Anvend &amp; PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
