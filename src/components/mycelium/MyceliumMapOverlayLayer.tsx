import React from 'react';
import { AdvancedMarker, Polyline } from '@vis.gl/react-google-maps';
import { LatLngPoint } from '../../types/dispersion';
import { MyceliumNetworkSimulationSnapshot } from '../../types/myceliumAlert';

export interface MyceliumGoogleMapOverlayProps {
  snapshot: MyceliumNetworkSimulationSnapshot;
  onSelectReceptor: (receptorId: string) => void;
}

export const MyceliumGoogleMapOverlay: React.FC<MyceliumGoogleMapOverlayProps> = ({
  snapshot,
  onSelectReceptor,
}) => {
  const activeSelfHealedRoutes = snapshot.dijkstraRoutes.filter(
    (r) => r.isReachable && r.pathCoordinates.length >= 2 && r.isSelfHealedReroute
  );

  return (
    <>
      {/* Dijkstra P2P Self-Healing Rerouted Failover Links */}
      {activeSelfHealedRoutes.map((route) => (
        <Polyline
          key={`gmp-myc-heal-${route.originReceptorId}`}
          path={route.pathCoordinates}
          strokeColor="#10b981"
          strokeOpacity={0.95}
          strokeWeight={3.2}
        />
      ))}

      {/* System B Root Gateway Marker */}
      {snapshot.gatewayReceptorId && (
        <AdvancedMarker
          position={snapshot.gatewayPosition}
          onClick={() => onSelectReceptor(snapshot.gatewayReceptorId)}
        >
          <div className="px-2 py-0.5 rounded bg-cyan-950/95 border border-cyan-300 text-cyan-100 font-mono tabular-nums text-[11px] font-bold shadow-xl cursor-pointer whitespace-nowrap">
            SYS-B GW ({snapshot.gatewayCode}) · EU868 {snapshot.meanEu868DutyUtilizedPct}%
          </div>
        </AdvancedMarker>
      )}

      {/* Offline / Byzantine Fault Node Indicators on Google Maps */}
      {snapshot.bftAudits
        .filter((a) => a.isDisabledOffline || a.verdict === 'BFT_BYZANTINSK_AFVIST')
        .map((audit) => (
          <AdvancedMarker
            key={`gmp-myc-fault-${audit.receptorId}`}
            position={audit.position}
            onClick={() => onSelectReceptor(audit.receptorId)}
          >
            <div
              className={`px-2 py-0.5 rounded font-mono tabular-nums text-[11px] font-bold shadow-xl cursor-pointer whitespace-nowrap border ${
                audit.isDisabledOffline
                  ? 'bg-slate-950/95 border-amber-400 text-amber-200'
                  : 'bg-rose-950/95 border-rose-300 text-rose-100'
              }`}
            >
              {audit.isDisabledOffline
                ? `✕ ${audit.receptorCode} OFFLINE (P2P Reroute)`
                : `⚠ ${audit.receptorCode} BFT AFVIST`}
            </div>
          </AdvancedMarker>
        ))}
    </>
  );
};

export interface MyceliumSvgMapOverlayProps {
  snapshot: MyceliumNetworkSimulationSnapshot;
  projectLatLng: (pt: LatLngPoint) => { x: number; y: number };
  onSelectReceptor: (receptorId: string) => void;
}

export const MyceliumSvgMapOverlay: React.FC<MyceliumSvgMapOverlayProps> = ({
  snapshot,
  projectLatLng,
  onSelectReceptor,
}) => {
  const healedRoutes = snapshot.dijkstraRoutes.filter(
    (r) => r.isReachable && r.pathCoordinates.length >= 2 && r.isSelfHealedReroute
  );
  const gwPt = snapshot.gatewayReceptorId
    ? projectLatLng(snapshot.gatewayPosition)
    : null;

  return (
    <g data-testid="svg-mycelium-cybernetic-layer">
      {/* Dijkstra P2P Self-Healing Failover Polylines */}
      {healedRoutes.map((route) => {
        const pts = route.pathCoordinates
          .map((c) => {
            const p = projectLatLng(c);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          })
          .join(' ');
        return (
          <polyline
            key={`svg-myc-heal-${route.originReceptorId}`}
            points={pts}
            fill="none"
            stroke="#10b981"
            strokeWidth={2.8}
            strokeDasharray="7 4"
            strokeOpacity={0.95}
          />
        );
      })}

      {/* System B Gateway Callout */}
      {gwPt && (
        <g
          transform={`translate(${gwPt.x}, ${gwPt.y - 34})`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectReceptor(snapshot.gatewayReceptorId);
          }}
          className="cursor-pointer"
        >
          <rect
            x={-76}
            y={-15}
            width={152}
            height={16}
            rx={3}
            fill="#083344"
            stroke="#67e8f9"
            strokeWidth={1.2}
          />
          <text
            x={0}
            y={-4}
            textAnchor="middle"
            className="fill-cyan-100 text-[11px] font-mono font-bold"
          >
            {`SYS-B GW (${snapshot.gatewayCode}) · EU868`}
          </text>
        </g>
      )}

      {/* Offline / Byzantine-Rejected Node Badges */}
      {snapshot.bftAudits
        .filter((a) => a.isDisabledOffline || a.verdict === 'BFT_BYZANTINSK_AFVIST')
        .map((audit) => {
          const pt = projectLatLng(audit.position);
          const label = audit.isDisabledOffline
            ? `✕ ${audit.receptorCode} OFFLINE · P2P HEAL`
            : `⚠ ${audit.receptorCode} BFT AFVIST`;
          return (
            <g
              key={`svg-myc-fault-${audit.receptorId}`}
              transform={`translate(${pt.x}, ${pt.y + 24})`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectReceptor(audit.receptorId);
              }}
              className="cursor-pointer"
            >
              <rect
                x={-74}
                y={-12}
                width={148}
                height={15}
                rx={3}
                fill={audit.isDisabledOffline ? '#451a03' : '#4c0519'}
                stroke={audit.isDisabledOffline ? '#fbbf24' : '#fda4af'}
                strokeWidth={1.2}
              />
              <text
                x={0}
                y={-1.5}
                textAnchor="middle"
                className="fill-white text-[11px] font-mono font-bold"
              >
                {label}
              </text>
            </g>
          );
        })}
    </g>
  );
};
