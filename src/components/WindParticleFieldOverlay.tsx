import React, { useEffect, useRef } from 'react';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  PasquillClass,
} from '../types/dispersion';
import { RINGPARKEN_CENTER } from '../data/ringparkenData';

interface WindParticleFieldOverlayProps {
  currentWeather: HourlyWeatherPoint;
  sources: DemolitionSourceNode[];
  zoom: number;
  panOffsetPx: { x: number; y: number };
  visible: boolean;
}

interface StreamlineParticle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  speedMultiplier: number;
  lateralPhase: number;
  kind: 'ambient_wind' | 'source_aerosol';
  sourceIndex: number;
  trail: Array<{ x: number; y: number }>;
}

function getTurbulenceAmplitude(stability: PasquillClass): number {
  switch (stability) {
    case 'A':
      return 1.45;
    case 'B':
      return 1.15;
    case 'C':
      return 0.85;
    case 'D':
      return 0.58;
    case 'E':
      return 0.36;
    case 'F':
    default:
      return 0.22;
  }
}

export const WindParticleFieldOverlay: React.FC<WindParticleFieldOverlayProps> = ({
  currentWeather,
  sources,
  zoom,
  panOffsetPx,
  visible,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const weatherRef = useRef<HourlyWeatherPoint>(currentWeather);
  const sourcesRef = useRef<DemolitionSourceNode[]>(sources);
  const zoomRef = useRef<number>(zoom);
  const panRef = useRef<{ x: number; y: number }>(panOffsetPx);

  useEffect(() => {
    weatherRef.current = currentWeather;
  }, [currentWeather]);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = panOffsetPx;
  }, [panOffsetPx]);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let width = 1000;
    let height = 720;

    const updateCanvasSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const nextW = Math.max(320, Math.round(rect.width));
      const nextH = Math.max(260, Math.round(rect.height));
      if (canvas.width !== nextW || canvas.height !== nextH) {
        width = canvas.width = nextW;
        height = canvas.height = nextH;
      } else {
        width = nextW;
        height = nextH;
      }
    };

    updateCanvasSize();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateCanvasSize())
        : null;
    if (resizeObserver && canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    window.addEventListener('resize', updateCanvasSize);

    const projectLatLngToCanvas = (pt: LatLngPoint): { x: number; y: number } => {
      const VIEW_W = 1000;
      const VIEW_H = 720;
      const scaleFactor = Math.pow(2, zoomRef.current - 17);
      const PX_PER_DEG_LAT = 195000 * scaleFactor;
      const PX_PER_DEG_LNG = 110800 * scaleFactor;
      const dx = (pt.lng - RINGPARKEN_CENTER.lng) * PX_PER_DEG_LNG;
      const dy = (RINGPARKEN_CENTER.lat - pt.lat) * PX_PER_DEG_LAT;
      const svgX = VIEW_W / 2 + dx + panRef.current.x;
      const svgY = VIEW_H / 2 + dy + panRef.current.y;
      return {
        x: (svgX / VIEW_W) * width,
        y: (svgY / VIEW_H) * height,
      };
    };

    const AMBIENT_COUNT = 175;
    const AEROSOL_COUNT = 120;
    const particles: StreamlineParticle[] = [];

    const spawnParticle = (
      kind: 'ambient_wind' | 'source_aerosol',
      randomAge = false
    ): StreamlineParticle => {
      const activeSources = sourcesRef.current.filter((s) => s.active);
      const sourceIndex =
        activeSources.length > 0 ? Math.floor(Math.random() * activeSources.length) : 0;

      let x = Math.random() * width;
      let y = Math.random() * height;

      if (kind === 'source_aerosol' && activeSources.length > 0) {
        const src = activeSources[sourceIndex];
        const srcPx = projectLatLngToCanvas(src.position);
        const jitterRadius = 6 + Math.random() * 16;
        const jitterAngle = Math.random() * Math.PI * 2;
        x = srcPx.x + Math.cos(jitterAngle) * jitterRadius;
        y = srcPx.y + Math.sin(jitterAngle) * jitterRadius;
      }

      const maxAge =
        kind === 'ambient_wind'
          ? 75 + Math.floor(Math.random() * 70)
          : 65 + Math.floor(Math.random() * 60);
      const age = randomAge ? Math.floor(Math.random() * maxAge) : 0;

      return {
        x,
        y,
        age,
        maxAge,
        speedMultiplier: 0.8 + Math.random() * 0.5,
        lateralPhase: Math.random() * Math.PI * 2,
        kind,
        sourceIndex,
        trail: [{ x, y }],
      };
    };

    for (let i = 0; i < AMBIENT_COUNT; i++) {
      particles.push(spawnParticle('ambient_wind', true));
    }
    for (let i = 0; i < AEROSOL_COUNT; i++) {
      particles.push(spawnParticle('source_aerosol', true));
    }

    let pulsePhase = 0;

    const renderFrame = () => {
      ctx.clearRect(0, 0, width, height);
      pulsePhase += 0.045;

      const weather = weatherRef.current;
      // Plume/wind advection direction (where the wind blows TOWARD): (W + 180) mod 360
      const advectionDeg = (weather.windDirection10m + 180) % 360;
      const advectionRad = (advectionDeg * Math.PI) / 180;

      // Unit advection vector on screen (0° North = up, 90° East = right)
      const dirX = Math.sin(advectionRad);
      const dirY = -Math.cos(advectionRad);
      // Perpendicular cross-wind unit vector for Pasquill-Gifford turbulence
      const perpX = -dirY;
      const perpY = dirX;

      // Pixel speed per frame scaled to Open-Meteo wind speed (m/s) and wind gusts (m/s)
      const isHighWindAbove10 = weather.windSpeed10m > 10;
      const baseSpeedPx = Math.max(
        0.75,
        Math.min(
          isHighWindAbove10 ? 7.4 : 5.8,
          weather.windSpeed10m * (isHighWindAbove10 ? 0.46 : 0.38) + weather.windGusts10m * 0.1
        )
      );
      const trailMaxPoints = Math.max(
        9,
        Math.min(isHighWindAbove10 ? 30 : 24, Math.round(8 + weather.windSpeed10m * 1.5))
      );
      const turbAmp = getTurbulenceAmplitude(weather.pasquillClass) * (isHighWindAbove10 ? 1.25 : 1.0);

      // 1. Subtle Wind-Field Vector Grid (animated directional arrows showing wind flow across the map)
      const gridCols = 6;
      const gridRows = 4;
      const cellW = width / gridCols;
      const cellH = height / gridRows;
      const arrowHeadingAngle = Math.atan2(dirY, dirX);

      ctx.save();
      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          const gx = (c + 0.5) * cellW;
          const gy = (r + 0.5) * cellH;
          const waveOffset = Math.sin(pulsePhase + c * 0.7 + r * 0.5) * 6;
          const ax = gx + dirX * waveOffset;
          const ay = gy + dirY * waveOffset;

          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(arrowHeadingAngle);

          ctx.beginPath();
          ctx.moveTo(-14, 0);
          ctx.lineTo(10, 0);
          ctx.strokeStyle = isHighWindAbove10
            ? 'rgba(251, 191, 36, 0.28)'
            : 'rgba(56, 189, 248, 0.22)';
          ctx.lineWidth = 1.4;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(12, 0);
          ctx.lineTo(5, -4);
          ctx.lineTo(5, 4);
          ctx.closePath();
          ctx.fillStyle = isHighWindAbove10
            ? 'rgba(251, 191, 36, 0.38)'
            : 'rgba(56, 189, 248, 0.32)';
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();

      // 2. Render & advance Ambient Wind Streamlines + Demolition Source Aerosol Particles
      for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.age += 1;

        if (
          p.age >= p.maxAge ||
          p.x < -80 ||
          p.x > width + 80 ||
          p.y < -80 ||
          p.y > height + 80
        ) {
          p = spawnParticle(p.kind, false);
          particles[i] = p;
          continue;
        }

        // Lateral turbulent eddy component based on Pasquill stability class
        const eddyFactor =
          p.kind === 'source_aerosol'
            ? Math.sin(p.age * 0.14 + p.lateralPhase) * turbAmp * (1 + p.age * 0.028)
            : Math.sin(p.age * 0.09 + p.lateralPhase) * turbAmp * 0.45;

        const stepSpeed = baseSpeedPx * p.speedMultiplier;
        p.x += dirX * stepSpeed + perpX * eddyFactor;
        p.y += dirY * stepSpeed + perpY * eddyFactor;

        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > trailMaxPoints) {
          p.trail.shift();
        }

        if (p.trail.length < 2) continue;

        const lifeRatio = p.age / p.maxAge;
        const fadeAlpha =
          lifeRatio < 0.15
            ? lifeRatio / 0.15
            : lifeRatio > 0.8
            ? (1 - lifeRatio) / 0.2
            : 1.0;

        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let t = 1; t < p.trail.length; t++) {
          ctx.lineTo(p.trail[t].x, p.trail[t].y);
        }

        if (p.kind === 'ambient_wind') {
          ctx.strokeStyle = `rgba(34, 211, 238, ${(0.55 * fadeAlpha).toFixed(3)})`;
          ctx.lineWidth = 1.65;
          ctx.stroke();

          // Leading wind streamline directional chevron / particle head
          const prevPt = p.trail[p.trail.length - 2] || p.trail[0];
          const segAngle = Math.atan2(p.y - prevPt.y, p.x - prevPt.x);

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(segAngle);
          ctx.beginPath();
          ctx.moveTo(4.2, 0);
          ctx.lineTo(-2.5, -2.4);
          ctx.lineTo(-2.5, 2.4);
          ctx.closePath();
          ctx.fillStyle = `rgba(165, 243, 252, ${(0.88 * fadeAlpha).toFixed(3)})`;
          ctx.fill();
          ctx.restore();
        } else {
          // Demolition source aerosol particle (rose-red near source -> amber/gold downwind)
          const isCloseToSource = lifeRatio < 0.44;
          ctx.strokeStyle = isCloseToSource
            ? `rgba(244, 63, 94, ${(0.78 * fadeAlpha).toFixed(3)})`
            : `rgba(251, 191, 36, ${(0.68 * fadeAlpha).toFixed(3)})`;
          ctx.lineWidth = isCloseToSource ? 2.4 : 1.9;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(p.x, p.y, isCloseToSource ? 2.8 : 2.2, 0, Math.PI * 2);
          ctx.fillStyle = isCloseToSource
            ? `rgba(255, 228, 230, ${(0.94 * fadeAlpha).toFixed(3)})`
            : `rgba(254, 243, 199, ${(0.9 * fadeAlpha).toFixed(3)})`;
          ctx.fill();
        }
      }

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      aria-label="Animeret Open-Meteo vindfelt og partikelspredning"
    />
  );
};
