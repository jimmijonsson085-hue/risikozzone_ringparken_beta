/**
 * @file src/components/mycelium/MyceliumMapLayers.tsx
 * @description Synkroniserede kortlags-komponenter (`MyceliumSvgOverlayLayer` og
 * `MyceliumGoogleMapsOverlayLayer`) til visualisering af `MyceliumNetworkSimulationState`:
 * - CRATER_OFFLINE: Dybrød isolationsring (#ef4444), kryds-markør, brudte kantlinjer & `KRATER (AFKOBLET)`
 * - ISLAND_MODE: Smaragdgrøn dobbelt energiring (#10b981) & `Ø-DRIFT · SOL/LFP 1000J`
 * - SelfHealingRoute: Neon-cyan P2P-sti (#22d3ee, strokeWidth=3.4 / 4) & `⚡ SELVHELING: Tr = ... ms (< 5m)`
 * - BYZANTINE_SPOOF / Gate 1 afvist: Savtakket violet/rød dæmpningsring & `✕ GATE 1: STØJ SLETTET LOKALT (0,0 J)`
 * - CiK 2.0 Sværm-Support: Gylden-grønne pile med `+{energyJoules}J · +{waterMistKg}kg H₂O`
 */

import React from 'react';
import { AdvancedMarker, Polyline } from '@vis.gl/react-google-maps';
import { LatLngPoint } from '../../types/dispersion';
import { MyceliumNetworkSimulationState } from '../../types/myceliumAlert';

export interface MyceliumSvgOverlayLayerProps {
  state: MyceliumNetworkSimulationState;
  projectLatLng: (pt: LatLngPoint) => { x: number; y: number };
  onSelectReceptor: (receptorId: string) => void;
}

function buildSawtoothRingPoints(cx: number, cy: number, rOuter = 23, rInner = 17, teeth = 16): string {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (i * Math.PI) / teeth;
    const r = i % 2 === 0 ? rOuter : rInner;
    pts.push(`${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

function midpointLatLng(coords: LatLngPoint[]): LatLngPoint | null {
  if (!coords.length) return null;
  if (coords.length === 1) return coords[0];
  const midIdx = Math.floor((coords.length - 1) / 2);
  const a = coords[midIdx], b = coords[Math.min(coords.length - 1, midIdx + 1)];
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

export const MyceliumSvgOverlayLayer: React.FC<MyceliumSvgOverlayLayerProps> = ({
  state, projectLatLng, onSelectReceptor,
}) => {
  const route = state.activeSelfHealingRoute;
  const showRoute = Boolean(route && route.coordinates.length >= 2 && (state.scenario !== 'live_telemetry' || route.bypassedCraterIds.length > 0));
  const routeMid = route ? midpointLatLng(route.coordinates) : null;
  const routeMidPt = routeMid ? projectLatLng(routeMid) : null;

  return (
    <g data-testid="mycelium-svg-bft-overlay">
      <defs>
        <marker id="myc-cik-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#a3e635" />
        </marker>
      </defs>

      {/* Brudte grå/røde kantlinjer ved CRATER_OFFLINE */}
      {state.edges.filter((e) => e.linkState === 'SEVERED_CRATER').map((edge) => {
        const p1 = projectLatLng(edge.fromPos), p2 = projectLatLng(edge.toPos);
        return (
          <g key={`svg-sev-${edge.edgeId}`}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#475569" strokeWidth={2.2} strokeDasharray="3 6" strokeOpacity={0.75} />
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#ef4444" strokeWidth={1.4} strokeDasharray="5 7" strokeOpacity={0.9} />
          </g>
        );
      })}

      {/* Topologisk Selvhelings-Sti (SelfHealingRoute) i neon-cyan med animeret strokeDashoffset */}
      {showRoute && route && (
        <g data-testid="mycelium-svg-self-healing-route">
          <polyline
            points={route.coordinates.map((c) => { const p = projectLatLng(c); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ')}
            fill="none" stroke="#22d3ee" strokeWidth={7.5} strokeOpacity={0.22} strokeLinecap="round" strokeLinejoin="round"
          />
          <polyline
            points={route.coordinates.map((c) => { const p = projectLatLng(c); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ')}
            fill="none" stroke="#22d3ee" strokeWidth={3.4} strokeDasharray="10 6" strokeLinecap="round" strokeLinejoin="round"
          >
            <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.15s" repeatCount="indefinite" />
          </polyline>
          {routeMidPt && (
            <g transform={`translate(${routeMidPt.x}, ${routeMidPt.y - 14})`}>
              <rect x={-106} y={-11} width={212} height={17} rx={3} fill="#083344" fillOpacity={0.94} stroke="#22d3ee" strokeWidth={1.2} />
              <text x={0} y={1} textAnchor="middle" className="fill-cyan-100 text-[9.5px] font-mono font-bold tabular-nums">
                {`SELVHELING: Tr = ${route.reactionTimeTrMs} ms (< 5m)`}
              </text>
            </g>
          )}
        </g>
      )}

      {/* CiK 2.0 Sværm-Support Vektorer (gylden-grønne pile fra donor -> ALGEDONIC_PAIN) */}
      {state.swarmAllocations.map((alloc) => {
        const pts = alloc.routeCoordinates.map((c) => projectLatLng(c));
        if (pts.length < 2) return null;
        const mid = midpointLatLng(alloc.routeCoordinates);
        const midPt = mid ? projectLatLng(mid) : pts[0];
        return (
          <g key={`svg-cik-${alloc.id}`}>
            <polyline
              points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
              fill="none" stroke="#a3e635" strokeWidth={2.3} strokeDasharray="6 3" markerEnd="url(#myc-cik-arrow)" strokeOpacity={0.92}
            />
            <g transform={`translate(${midPt.x}, ${midPt.y + 13})`}>
              <rect x={-96} y={-8} width={192} height={15} rx={3} fill="#1a2e05" fillOpacity={0.93} stroke="#bef264" strokeWidth={1} />
              <text x={0} y={2.5} textAnchor="middle" className="fill-lime-100 text-[9.5px] font-mono font-bold tabular-nums">
                {`+${alloc.energyJoules}J · +${alloc.waterMistKg}kg H₂O · +${alloc.hepaAirM3h}m³/h`}
              </text>
            </g>
          </g>
        );
      })}

      {/* Node-specifikke tilstandsringe: CRATER_OFFLINE, BYZANTINE_SPOOF, ISLAND_MODE & ALGEDONIC_PAIN */}
      {state.nodes.map((nd) => {
        const pt = projectLatLng(nd.position);
        const g1 = state.gate1ByNodeId[nd.nodeId];
        const isSpoofRejected = nd.status === 'BYZANTINE_SPOOF' || g1?.classification === 'VARIANCE_INJECTION_DESTROYED_LOCALLY';

        if (nd.status === 'CRATER_OFFLINE') {
          return (
            <g key={`svg-nd-${nd.nodeId}`} transform={`translate(${pt.x}, ${pt.y})`} onClick={(e) => { e.stopPropagation(); onSelectReceptor(nd.receptorId); }} className="cursor-pointer">
              <circle r={22} fill="#450a0a" fillOpacity={0.48} stroke="#ef4444" strokeWidth={2.4} strokeDasharray="5 3" />
              <line x1={-9} y1={-9} x2={9} y2={9} stroke="#f87171" strokeWidth={2.6} />
              <line x1={9} y1={-9} x2={-9} y2={9} stroke="#f87171" strokeWidth={2.6} />
              <rect x={-64} y={24} width={128} height={15} rx={3} fill="#450a0a" stroke="#ef4444" strokeWidth={1.2} />
              <text x={0} y={34.5} textAnchor="middle" className="fill-rose-100 text-[9.5px] font-mono font-bold">
                KRATER (AFKOBLET)
              </text>
            </g>
          );
        }

        if (isSpoofRejected) {
          return (
            <g key={`svg-nd-${nd.nodeId}`} transform={`translate(${pt.x}, ${pt.y})`} onClick={(e) => { e.stopPropagation(); onSelectReceptor(nd.receptorId); }} className="cursor-pointer">
              <polygon points={buildSawtoothRingPoints(0, 0, 24, 17, 14)} fill="#3b0764" fillOpacity={0.42} stroke="#e879f9" strokeWidth={1.8} />
              <circle r={13} fill="none" stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="3 2" />
              <rect x={-104} y={25} width={208} height={16} rx={3} fill="#3b0764" fillOpacity={0.95} stroke="#f43f5e" strokeWidth={1.2} />
              <text x={0} y={35.5} textAnchor="middle" className="fill-fuchsia-100 text-[9.5px] font-mono font-bold tabular-nums">
                GATE 1: STØJ SLETTET LOKALT (0,0 J)
              </text>
            </g>
          );
        }

        if (nd.status === 'ISLAND_MODE') {
          return (
            <g key={`svg-nd-${nd.nodeId}`} transform={`translate(${pt.x}, ${pt.y})`} onClick={(e) => { e.stopPropagation(); onSelectReceptor(nd.receptorId); }} className="cursor-pointer">
              <circle r={23} fill="#064e3b" fillOpacity={0.22} stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" />
              <circle r={17} fill="none" stroke="#10b981" strokeWidth={2.2} />
              <rect x={-76} y={-36} width={152} height={15} rx={3} fill="#022c22" fillOpacity={0.94} stroke="#10b981" strokeWidth={1.1} />
              <text x={0} y={-25.5} textAnchor="middle" className="fill-emerald-200 text-[9.5px] font-mono font-bold tabular-nums">
                Ø-DRIFT · SOL/LFP 1000J
              </text>
            </g>
          );
        }

        if (nd.status === 'ALGEDONIC_PAIN') {
          return (
            <g key={`svg-nd-${nd.nodeId}`} transform={`translate(${pt.x}, ${pt.y})`} onClick={(e) => { e.stopPropagation(); onSelectReceptor(nd.receptorId); }} className="cursor-pointer">
              <circle r={22} fill="#881337" fillOpacity={0.28} stroke="#fb7185" strokeWidth={2.2} />
              <rect x={-74} y={-36} width={148} height={15} rx={3} fill="#4c0519" fillOpacity={0.95} stroke="#fb7185" strokeWidth={1.1} />
              <text x={0} y={-25.5} textAnchor="middle" className="fill-amber-100 text-[9.5px] font-mono font-bold tabular-nums">
                {`AROUSAL · S=${nd.physicalSumQuotientS.toFixed(2)}`}
              </text>
            </g>
          );
        }
        return null;
      })}
    </g>
  );
};

export interface MyceliumGoogleMapsOverlayLayerProps {
  state: MyceliumNetworkSimulationState;
  onSelectReceptor: (receptorId: string) => void;
}

export const MyceliumGoogleMapsOverlayLayer: React.FC<MyceliumGoogleMapsOverlayLayerProps> = ({
  state, onSelectReceptor,
}) => {
  const route = state.activeSelfHealingRoute;
  const showRoute = Boolean(route && route.coordinates.length >= 2 && (state.scenario !== 'live_telemetry' || route.bypassedCraterIds.length > 0));
  const routeMid = route ? midpointLatLng(route.coordinates) : null;

  return (
    <>
      {state.edges.filter((e) => e.linkState === 'SEVERED_CRATER').map((edge) => (
        <Polyline key={`gmp-sev-${edge.edgeId}`} path={[edge.fromPos, edge.toPos]} strokeColor="#ef4444" strokeOpacity={0.65} strokeWeight={2} zIndex={45} />
      ))}

      {showRoute && route && (
        <>
          <Polyline path={route.coordinates} strokeColor="#22d3ee" strokeOpacity={0.96} strokeWeight={4} zIndex={60} />
          {routeMid && (
            <AdvancedMarker position={routeMid}>
              <div className="px-2 py-0.5 rounded bg-cyan-950/95 border border-cyan-400 text-cyan-100 font-mono tabular-nums text-[11px] font-bold shadow-lg whitespace-nowrap">
                SELVHELING: Tr = {route.reactionTimeTrMs} ms (&lt; 5m)
              </div>
            </AdvancedMarker>
          )}
        </>
      )}

      {state.swarmAllocations.map((alloc) => {
        const mid = midpointLatLng(alloc.routeCoordinates);
        return (
          <React.Fragment key={`gmp-cik-${alloc.id}`}>
            <Polyline path={alloc.routeCoordinates} strokeColor="#a3e635" strokeOpacity={0.92} strokeWeight={3} zIndex={58} />
            {mid && (
              <AdvancedMarker position={mid}>
                <div className="px-2 py-0.5 rounded bg-lime-950/95 border border-lime-400 text-lime-100 font-mono tabular-nums text-[11px] font-bold shadow-lg whitespace-nowrap">
                  +{alloc.energyJoules}J · +{alloc.waterMistKg}kg H₂O · +{alloc.hepaAirM3h}m³/h HEPA
                </div>
              </AdvancedMarker>
            )}
          </React.Fragment>
        );
      })}

      {state.nodes.map((nd) => {
        const g1 = state.gate1ByNodeId[nd.nodeId];
        const isSpoofRejected = nd.status === 'BYZANTINE_SPOOF' || g1?.classification === 'VARIANCE_INJECTION_DESTROYED_LOCALLY';
        if (nd.status === 'CRATER_OFFLINE') {
          return (
            <AdvancedMarker key={`gmp-nd-${nd.nodeId}`} position={nd.position} onClick={() => onSelectReceptor(nd.receptorId)}>
              <div className="px-2 py-0.5 rounded bg-rose-950/95 border border-rose-500 text-rose-100 font-mono text-[11px] font-bold shadow-lg cursor-pointer whitespace-nowrap">
                {nd.code} · KRATER (AFKOBLET)
              </div>
            </AdvancedMarker>
          );
        }
        if (isSpoofRejected) {
          return (
            <AdvancedMarker key={`gmp-nd-${nd.nodeId}`} position={nd.position} onClick={() => onSelectReceptor(nd.receptorId)}>
              <div className="px-2 py-0.5 rounded bg-purple-950/95 border border-rose-400 text-fuchsia-100 font-mono tabular-nums text-[11px] font-bold shadow-lg cursor-pointer whitespace-nowrap">
                GATE 1: STØJ SLETTET LOKALT (0,0 J)
              </div>
            </AdvancedMarker>
          );
        }
        if (nd.status === 'ISLAND_MODE') {
          return (
            <AdvancedMarker key={`gmp-nd-${nd.nodeId}`} position={nd.position} onClick={() => onSelectReceptor(nd.receptorId)}>
              <div className="px-2 py-0.5 rounded bg-emerald-950/95 border border-emerald-400 text-emerald-100 font-mono tabular-nums text-[11px] font-bold shadow-lg cursor-pointer whitespace-nowrap">
                Ø-DRIFT · SOL/LFP 1000J ({nd.code})
              </div>
            </AdvancedMarker>
          );
        }
        if (nd.status === 'ALGEDONIC_PAIN') {
          return (
            <AdvancedMarker key={`gmp-nd-${nd.nodeId}`} position={nd.position} onClick={() => onSelectReceptor(nd.receptorId)}>
              <div className="px-2 py-0.5 rounded bg-rose-950/95 border border-amber-400 text-amber-100 font-mono tabular-nums text-[11px] font-bold shadow-lg cursor-pointer whitespace-nowrap">
                AROUSAL ({nd.code}) · S={nd.physicalSumQuotientS.toFixed(2)}
              </div>
            </AdvancedMarker>
          );
        }
        return null;
      })}
    </>
  );
};
