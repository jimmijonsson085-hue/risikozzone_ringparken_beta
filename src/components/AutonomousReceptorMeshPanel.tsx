import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Network,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import {
  AutonomousReceptorMeshNetwork,
  AutonomousReceptorNode,
  LEGAL_STANDING_ROLE_METADATA,
  LegalStandingRoleKey,
  generateZkpLegalIdentityCredential,
  verifyZkpLegalCredential,
} from '../services/autonomousReceptorMeshService';
import { LatLngPoint, ReceptorZone, ReporterRole } from '../types/dispersion';

export interface AutonomousReceptorMeshPanelProps {
  mesh: AutonomousReceptorMeshNetwork;
  receptors: ReceptorZone[];
  selectedReceptorId: string;
  onSelectReceptor: (receptorId: string) => void;
  currentTimestampIso: string;
  onEmitZkpAlgedonicSignal: (params: {
    node: AutonomousReceptorNode;
    legalStandingRole: LegalStandingRoleKey;
    zkpProofHash: string;
    anonymizedRoleCommitment: string;
    nullifierHash: string;
    reporterRole: ReporterRole;
    observationType: string;
    description: string;
    position: LatLngPoint;
    locationLabel: string;
  }) => Promise<void> | void;
}

export const AutonomousReceptorMeshPanel: React.FC<
  AutonomousReceptorMeshPanelProps
> = ({
  mesh,
  receptors,
  selectedReceptorId,
  onSelectReceptor,
  currentTimestampIso,
  onEmitZkpAlgedonicSignal,
}) => {
  const [selectedLegalRole, setSelectedLegalRole] =
    useState<LegalStandingRoleKey>('lejer_huslejekontrakt');
  const [localWitnessPassphrase, setLocalWitnessPassphrase] = useState<string>('');
  const [customSignalNote, setCustomSignalNote] = useState<string>('');
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(
    null
  );
  const [copiedHashFlag, setCopiedHashFlag] = useState<boolean>(false);
  const [emittedBanner, setEmittedBanner] = useState<string | null>(null);

  const activeNode: AutonomousReceptorNode | undefined = useMemo(() => {
    return mesh.nodesByReceptorId[selectedReceptorId] || mesh.nodes[0];
  }, [mesh, selectedReceptorId]);

  const activeReceptorZone = useMemo(() => {
    if (!activeNode) return receptors[0];
    return (
      receptors.find((r) => r.id === activeNode.receptorId) || receptors[0]
    );
  }, [activeNode, receptors]);

  // Recompute live ZKP credential whenever user adjusts legal role or local ephemeral witness passphrase
  const liveZkpCredential = useMemo(() => {
    if (!activeReceptorZone) return activeNode?.zkpCredential;
    return generateZkpLegalIdentityCredential({
      receptor: activeReceptorZone,
      merkleRegistryRootHash: mesh.merkleRegistryRootHash,
      legalStandingRole: selectedLegalRole,
      ephemeralClientSalt:
        localWitnessPassphrase.trim() ||
        `node-auto-witness-${activeReceptorZone.id}`,
      timestampIso: currentTimestampIso,
    });
  }, [
    activeNode?.zkpCredential,
    activeReceptorZone,
    currentTimestampIso,
    localWitnessPassphrase,
    mesh.merkleRegistryRootHash,
    selectedLegalRole,
  ]);

  if (!activeNode || !liveZkpCredential) return null;

  const handleVerifyZkpStanding = () => {
    const res = verifyZkpLegalCredential(
      liveZkpCredential,
      mesh.merkleRegistryRootHash
    );
    setVerificationFeedback(res.reasonDa);
  };

  const handleCopyZkpCertificate = async () => {
    const certText = [
      `AUTONOM NODE ZKP-JURIDISK CERTIFIKAT (${activeNode.nodeId})`,
      `Receptor: ${activeNode.receptorCode} — ${activeNode.receptorName}`,
      `Juridisk Partstatus: ${liveZkpCredential.legalStandingLabelDa}`,
      `Retsgrundlag: ${liveZkpCredential.statutoryBasisDa}`,
      `Merkle Receptor-Rod: ${liveZkpCredential.merkleRegistryRootHash}`,
      `ZKP Groth16 Commitment: ${liveZkpCredential.zkpLegalStandingProofHash}`,
      `Anti-Chikane Nullifier: ${liveZkpCredential.antiHarassmentNullifierHash}`,
      `Nabotest Status: ${activeNode.nabotest.verdictLabelDa}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(certText);
      setCopiedHashFlag(true);
      window.setTimeout(() => setCopiedHashFlag(false), 3000);
    } catch {
      // Clipboard API unavailable in restricted iframe
    }
  };

  const handleEmitAnonymousZkpSignal = async () => {
    const mappedReporterRole: ReporterRole =
      selectedLegalRole === 'arbejdsmiljørepræsentant'
        ? 'Arbejdsmiljørepræsentant (AMR)'
        : 'Beboer (Ringparken)';

    const signalSummary =
      customSignalNote.trim() ||
      `Autonomt algedonisk signal fra ${activeNode.nodeId} (S = ${activeNode.sumQuotient.toFixed(
        2
      )}, L_AFmax = ${activeNode.estimatedLafmaxDb.toFixed(1)} dB(A)).`;

    const fullForensicDesc = `[AUTONOM RECEPTOR-NODE ${activeNode.nodeId} · ZKP ANTI-CHIKANE IDENTIFIKATION] ${signalSummary} Juridisk klageberettigelse dokumenteret via Zero-Knowledge Proof (${liveZkpCredential.legalStandingLabelDa}; ${liveZkpCredential.statutoryBasisDa}) uden eksponering af persondata (ZKP=${liveZkpCredential.zkpLegalStandingProofHash.slice(
      0,
      20
    )}…, Nullifier=${liveZkpCredential.antiHarassmentNullifierHash.slice(
      0,
      16
    )}…). ${activeNode.nabotest.forensicSummaryDa}`;

    await onEmitZkpAlgedonicSignal({
      node: activeNode,
      legalStandingRole: selectedLegalRole,
      zkpProofHash: liveZkpCredential.zkpLegalStandingProofHash,
      anonymizedRoleCommitment: `ZKP-${activeNode.receptorCode}-${liveZkpCredential.antiHarassmentNullifierHash.slice(
        0,
        10
      )}`,
      nullifierHash: liveZkpCredential.antiHarassmentNullifierHash,
      reporterRole: mappedReporterRole,
      observationType: `Autonom Node (${activeNode.receptorCode}): ZKP-Verificeret Algedonisk Signal`,
      description: fullForensicDesc,
      position: activeNode.position,
      locationLabel: `${activeNode.receptorCode}: ${activeNode.receptorName} (${activeNode.address})`,
    });

    setCustomSignalNote('');
    setEmittedBanner(
      `ZKP-signeret algedonisk signal fra ${activeNode.nodeId} + Nabotest (${activeNode.nabotest.corroboratingNeighborCount}/${activeNode.nabotest.analyzedNearbyNodesCount} nabonoder) føjet til Beviser.`
    );
    window.setTimeout(() => setEmittedBanner(null), 5500);
  };

  return (
    <section
      data-autonomous-receptor-mesh-panel="true"
      className="rounded-lg border border-cyan-500/40 bg-[#0B0F19] p-4 space-y-4 text-slate-200"
    >
      {/* Header & Mesh Connectivity Metrics */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-cyan-400 shrink-0" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Autonomt Receptor-Netværk · ZKP Juridisk Identifikation &amp; Nabotest
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
            <span>{mesh.totalNodes} autonome noder</span>
            <span aria-hidden="true">·</span>
            <span>{mesh.totalEdges} mesh-forbindelser</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-300">
              {mesh.isFullyConnectedGraph ? '100% sammenkoblet graf' : 'Delvist forbundet'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-300">
              {mesh.activeAlgedonicNodeCount} aktive algedoniske noder
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-300">
              {mesh.confirmedNabotestClusterCount} bekræftede naboklynger
            </span>
          </div>
        </div>

        {/* Active Receptor Node Selector */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="autonomous-node-selector"
            className="text-xs font-mono text-slate-400 whitespace-nowrap"
          >
            Aktiv Node:
          </label>
          <select
            id="autonomous-node-selector"
            value={activeNode.receptorId}
            onChange={(e) => onSelectReceptor(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-200 focus:border-cyan-400 focus:outline-none"
          >
            {mesh.nodes.map((nd) => (
              <option key={nd.receptorId} value={nd.receptorId}>
                {nd.nodeId} — {nd.receptorName} (S={nd.sumQuotient.toFixed(2)} · Nabotest:{' '}
                {nd.nabotest.corroboratingNeighborCount}/{nd.nabotest.analyzedNearbyNodesCount})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Node Live Telemetry Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono tabular-nums">
        <div className="rounded bg-slate-950 border border-slate-800 p-2.5">
          <div className="text-[11px] text-slate-400">Autonom Node</div>
          <div className="text-sm font-bold text-cyan-300 truncate">{activeNode.nodeId}</div>
          <div className="text-[11px] text-slate-400 truncate">
            {activeNode.connectedPeerReceptorIds.length} direkte mesh-links
          </div>
        </div>

        <div className="rounded bg-slate-950 border border-slate-800 p-2.5">
          <div className="text-[11px] text-slate-400">Sumkvotient S</div>
          <div
            className={`text-sm font-bold ${
              activeNode.sumQuotient >= 1.0
                ? 'text-rose-400'
                : activeNode.sumQuotient >= 0.35
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            {activeNode.sumQuotient.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400">
            {activeNode.alertState === 'CRITICAL_ALGEDONIC'
              ? 'Kritisk algedonisk'
              : activeNode.alertState === 'ELEVATED_ALGEDONIC'
              ? 'Forhøjet signal'
              : 'Nominal standby'}
          </div>
        </div>

        <div className="rounded bg-slate-950 border border-slate-800 p-2.5">
          <div className="text-[11px] text-slate-400">Akustisk Impuls</div>
          <div className="text-sm font-bold text-amber-300">
            {activeNode.estimatedLafmaxDb.toFixed(1)} dB(A)
          </div>
          <div className="text-[11px] text-slate-400">
            L_Aeq {activeNode.estimatedLaeqDb.toFixed(1)} dB(A)
          </div>
        </div>

        <div className="rounded bg-slate-950 border border-slate-800 p-2.5">
          <div className="text-[11px] text-slate-400">Nabotest Konsensus</div>
          <div
            className={`text-sm font-bold ${
              activeNode.nabotest.verdict === 'BEKRÆFTET_NABO_KONSENSUS'
                ? 'text-rose-400'
                : activeNode.nabotest.verdict === 'DELVIS_NABO_KORRELATION'
                ? 'text-amber-300'
                : 'text-cyan-300'
            }`}
          >
            {activeNode.nabotest.corroboratingNeighborCount}/
            {activeNode.nabotest.analyzedNearbyNodesCount} noder (
            {activeNode.nabotest.similarityConsensusPct}%)
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {activeNode.nabotest.verdict === 'BEKRÆFTET_NABO_KONSENSUS'
              ? 'Multi-node bekræftet'
              : activeNode.nabotest.verdict === 'DELVIS_NABO_KORRELATION'
              ? 'Delvis korrelation'
              : 'Kontinuerlig overvågning'}
          </div>
        </div>
      </div>

      {/* 1b. NABOTEST: Always Analyze Nearby Nodes for Similar Algedonic Signals */}
      <div className="rounded border border-slate-800 bg-slate-950/90 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-white">
              Automatisk Nabotest — Kontinuerlig Analyse af Nærliggende Autonome Noder
            </span>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-amber-300">
            {activeNode.nabotest.verdictLabelDa}
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {activeNode.nabotest.forensicSummaryDa}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono tabular-nums text-[11px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-1.5 pr-2 font-medium">Nabonode</th>
                <th className="py-1.5 px-2 font-medium">Afstand</th>
                <th className="py-1.5 px-2 font-medium">Forbindelse</th>
                <th className="py-1.5 px-2 font-medium">Nabo S</th>
                <th className="py-1.5 px-2 font-medium">L_AFmax</th>
                <th className="py-1.5 px-2 font-medium">Signallighed</th>
                <th className="py-1.5 pl-2 font-medium">Algedonisk Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {activeNode.nabotest.peerComparisons.map((peer) => (
                <tr
                  key={peer.peerReceptorId}
                  onClick={() => onSelectReceptor(peer.peerReceptorId)}
                  className="hover:bg-slate-900/90 cursor-pointer transition-colors"
                  title={`Klik for at skifte til ${peer.peerNodeId} (${peer.peerName})`}
                >
                  <td className="py-1.5 pr-2 font-bold text-cyan-300 whitespace-nowrap">
                    {peer.peerNodeId}
                  </td>
                  <td className="py-1.5 px-2 text-slate-300 whitespace-nowrap">
                    {peer.distanceMeters} m ({peer.bearingDeg}°)
                  </td>
                  <td className="py-1.5 px-2 text-slate-400 whitespace-nowrap">
                    {peer.isDirectMeshNeighbor ? 'Direkte Mesh-Link' : 'Sekundær Nabo'}
                  </td>
                  <td
                    className={`py-1.5 px-2 font-semibold whitespace-nowrap ${
                      peer.peerSumQuotient >= 1.0
                        ? 'text-rose-400'
                        : peer.peerSumQuotient >= 0.35
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    {peer.peerSumQuotient.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-2 text-slate-200 whitespace-nowrap">
                    {peer.peerEstimatedLafmaxDb.toFixed(1)} dB
                  </td>
                  <td className="py-1.5 px-2 font-bold text-amber-200 whitespace-nowrap">
                    {peer.signalSimilarityPct}%
                  </td>
                  <td className="py-1.5 pl-2 whitespace-nowrap">
                    {peer.hasSimilarAlgedonicSignal ? (
                      <span className="text-rose-300 font-semibold">
                        Bekræfter signal ({peer.peerActiveObservationsCount} obs)
                      </span>
                    ) : (
                      <span className="text-slate-400">Ingen tilsvarende alarm</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1a. ZKP Legal Identification without Risk of Targeted Harassment */}
      <div className="rounded border border-slate-800 bg-slate-950/90 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-white">
              Zero-Knowledge Proof (ZKP) til Juridisk Identifikation — Beskyttelse mod Målrettet Chikane
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-300">
            0 personoplysninger (navn, CPR, lejlighed, IP) lagres
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Dokumenterer juridisk klageberettigelse og fysisk tilhørsforhold inden for receptorens geofence (jf. Miljøbeskyttelsesloven § 98 og Århus-konventionen art. 3, stk. 8) via et kryptografisk Merkle-medlemskabsbevis og engangs-nullifier, så beboere og arbejdsmiljørepræsentanter kan indgive retsgyldige algedoniske signaler uden risiko for målrettet chikane eller repressalier.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">
              Juridisk Klagekompetence / Partstatus:
            </label>
            <select
              value={selectedLegalRole}
              onChange={(e) =>
                setSelectedLegalRole(e.target.value as LegalStandingRoleKey)
              }
              className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:border-emerald-400 focus:outline-none"
            >
              {(
                Object.keys(LEGAL_STANDING_ROLE_METADATA) as LegalStandingRoleKey[]
              ).map((rKey) => (
                <option key={rKey} value={rKey}>
                  {LEGAL_STANDING_ROLE_METADATA[rKey].labelDa}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">
              Lokal ZKP-Vidne-Nøgle (forbliver udelukkende lokalt i RAM):
            </label>
            <input
              type="password"
              value={localWitnessPassphrase}
              onChange={(e) => setLocalWitnessPassphrase(e.target.value)}
              placeholder="Valgfri lokal nøgle til deterministisk nullifier…"
              className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:border-emerald-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Cryptographic Proof Readouts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono tabular-nums text-[11px]">
          <div className="rounded bg-slate-900/90 border border-slate-800 p-2">
            <div className="text-slate-400">Merkle Receptor-Rod</div>
            <div className="text-cyan-300 truncate mt-0.5">
              {liveZkpCredential.merkleRegistryRootHash}
            </div>
          </div>
          <div className="rounded bg-slate-900/90 border border-slate-800 p-2">
            <div className="text-slate-400">ZKP Juridisk Partstatus-Bevis</div>
            <div className="text-emerald-300 truncate mt-0.5">
              {liveZkpCredential.zkpLegalStandingProofHash}
            </div>
          </div>
          <div className="rounded bg-slate-900/90 border border-slate-800 p-2">
            <div className="text-slate-400">Anti-Chikane Nullifier</div>
            <div className="text-amber-300 truncate mt-0.5">
              {liveZkpCredential.antiHarassmentNullifierHash}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1">
            Valgfri beskrivelse af observeret hændelse ved {activeNode.nodeId}:
          </label>
          <input
            type="text"
            value={customSignalNote}
            onChange={(e) => setCustomSignalNote(e.target.value)}
            placeholder={`F.eks. Kraftig støvsky og betonhammer-impulser mærket i ${activeNode.receptorName}…`}
            className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleVerifyZkpStanding}
            className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-500/60 text-emerald-200 font-mono text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Verificér ZKP Juridisk Identitet</span>
          </button>

          <button
            type="button"
            onClick={handleCopyZkpCertificate}
            className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-mono text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Copy className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              {copiedHashFlag ? '✓ ZKP-Certifikat Kopieret' : 'Kopiér ZKP-Certifikat'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleEmitAnonymousZkpSignal}
            data-testid="emit-zkp-node-signal-btn"
            className="px-3.5 py-1.5 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-mono text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-950 shrink-0" />
            <span>Indsend ZKP-Beskyttet Signal + Nabotest</span>
          </button>
        </div>

        {verificationFeedback && (
          <div className="text-xs font-mono text-emerald-200 bg-emerald-950/60 border border-emerald-500/50 rounded px-3 py-2">
            ✓ {verificationFeedback}
          </div>
        )}

        {emittedBanner && (
          <div className="text-xs font-mono text-cyan-200 bg-cyan-950/60 border border-cyan-500/50 rounded px-3 py-2">
            ✓ {emittedBanner}
          </div>
        )}
      </div>
    </section>
  );
};
