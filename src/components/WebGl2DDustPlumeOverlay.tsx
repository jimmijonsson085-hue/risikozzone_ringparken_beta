import React, { useEffect, useRef } from 'react';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  PasquillClass,
} from '../types/dispersion';
import { RINGPARKEN_CENTER } from '../data/ringparkenData';

import {
  PrioritizedWebGlPlumeSource,
  selectWebGlPlumeSources,
} from '../utils/webglPlumeSelection';

export type { PrioritizedWebGlPlumeSource };
export { selectWebGlPlumeSources };

export interface WebGl2DDustPlumeOverlayProps {
  currentWeather: HourlyWeatherPoint;
  sources: DemolitionSourceNode[];
  selectedSourceId: string | null;
  zoom: number;
  panOffsetPx: { x: number; y: number };
  visible: boolean;
}

const MAX_WEBGL_SOURCES = 8;

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    v_uv.y = 1.0 - v_uv.y;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision highp float;

  varying vec2 v_uv;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_windDir;
  uniform vec2 u_windPerp;
  uniform float u_windSpeed;
  uniform float u_windGusts;
  uniform float u_spreadTan;
  uniform float u_pxScale;
  uniform int u_sourceCount;
  uniform float u_hasSelectedSource;
  uniform vec4 u_sources[${MAX_WEBGL_SOURCES}];

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.52;
    for (int i = 0; i < 4; i++) {
      val += amp * valueNoise(p);
      p = p * 2.07 + vec2(17.1, 31.7);
      amp *= 0.5;
    }
    return val;
  }

  void main() {
    vec2 pixelPos = v_uv * u_resolution;
    float totalDensity = 0.0;
    float selectedDensity = 0.0;
    float waveFrontHighlight = 0.0;

    float baseReachPx = clamp((195.0 + (u_windSpeed - 10.0) * 34.0 + u_windGusts * 8.0) * u_pxScale, 125.0, 680.0);
    float advectSpeed = 52.0 + u_windSpeed * 5.6;

    for (int i = 0; i < ${MAX_WEBGL_SOURCES}; i++) {
      if (i >= u_sourceCount) break;
      vec2 srcPx = u_sources[i].xy;
      float srcStrength = u_sources[i].z;
      float isSelected = u_sources[i].w;

      float reachPx = baseReachPx * (u_hasSelectedSource > 0.5 ? mix(0.92, 1.26, isSelected) : 1.08);
      float emphasis = u_hasSelectedSource > 0.5 ? mix(0.76, 1.35, isSelected) : 1.12;

      vec2 delta = pixelPos - srcPx;
      float along = dot(delta, u_windDir);
      float across = dot(delta, u_windPerp);

      // Smooth upwind core + elongated downwind turbulent plume
      float forwardMask = smoothstep(-24.0 * u_pxScale, 14.0 * u_pxScale, along);
      float maxDistMask = 1.0 - smoothstep(reachPx * 0.60, reachPx, along);

      float effectiveAlong = max(0.0, along);
      float sigmaY = (11.0 + effectiveAlong * u_spreadTan) * u_pxScale;
      float gaussianCross = exp(-(across * across) / max(1.0, 2.0 * sigmaY * sigmaY));

      // Animated turbulent wind advection waves racing downwind
      vec2 noiseCoord = vec2(
        effectiveAlong * 0.022 / max(0.35, u_pxScale) - u_time * (advectSpeed * 0.026),
        across * 0.036 / max(0.35, u_pxScale) + float(i) * 3.1
      );
      float turb = fbm(noiseCoord);
      float fineSwirl = fbm(noiseCoord * 2.15 - vec2(u_time * 1.25, 0.0));

      float pulseWave = 0.5 + 0.5 * sin(effectiveAlong * 0.078 / max(0.35, u_pxScale) - u_time * 5.8 + turb * 3.2);
      float axialDecay = exp(-effectiveAlong / (reachPx * 0.72));

      // Subtle source-origin halo for the selected node
      float srcDist = length(delta);
      float originHalo = isSelected * exp(-srcDist / (24.0 * u_pxScale)) * (0.38 + 0.22 * sin(u_time * 4.5));

      float plumeVal = forwardMask * maxDistMask * gaussianCross * axialDecay * srcStrength * emphasis * (0.48 + 0.68 * turb + 0.34 * fineSwirl);
      totalDensity += plumeVal + originHalo * 0.45;
      selectedDensity += (plumeVal + originHalo * 0.65) * isSelected;
      waveFrontHighlight += plumeVal * pulseWave * mix(0.75, 1.35, isSelected);
    }

    float intensity = clamp(totalDensity, 0.0, 1.0);
    if (intensity < 0.014) {
      discard;
    }

    vec3 coreCrimson = vec3(0.957, 0.247, 0.369); // #f43f5e
    vec3 midAmber = vec3(0.984, 0.749, 0.141);   // #fbbf24
    vec3 edgeCyan = vec3(0.133, 0.827, 0.933);   // #22d3ee

    vec3 plumeColor = mix(edgeCyan, midAmber, smoothstep(0.08, 0.36, intensity));
    plumeColor = mix(plumeColor, coreCrimson, smoothstep(0.34, 0.76, intensity));
    plumeColor += vec3(1.0, 0.88, 0.55) * clamp(waveFrontHighlight * 0.42 + selectedDensity * 0.18, 0.0, 0.44);

    float alpha = clamp(intensity * 0.58 + waveFrontHighlight * 0.15, 0.0, 0.68);
    gl_FragColor = vec4(plumeColor * alpha, alpha);
  }
`;

function getPasquillSpreadTangent(stability: PasquillClass): number {
  switch (stability) {
    case 'A':
      return 0.36;
    case 'B':
      return 0.29;
    case 'C':
      return 0.22;
    case 'D':
      return 0.16;
    case 'E':
      return 0.12;
    case 'F':
    default:
      return 0.09;
  }
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export const WebGl2DDustPlumeOverlay: React.FC<WebGl2DDustPlumeOverlayProps> = ({
  currentWeather,
  sources,
  selectedSourceId,
  zoom,
  panOffsetPx,
  visible,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const weatherRef = useRef<HourlyWeatherPoint>(currentWeather);
  const sourcesRef = useRef<DemolitionSourceNode[]>(sources);
  const selectedSourceIdRef = useRef<string | null>(selectedSourceId);
  const zoomRef = useRef<number>(zoom);
  const panRef = useRef<{ x: number; y: number }>(panOffsetPx);

  useEffect(() => {
    weatherRef.current = currentWeather;
  }, [currentWeather]);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    selectedSourceIdRef.current = selectedSourceId;
  }, [selectedSourceId]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = panOffsetPx;
  }, [panOffsetPx]);

  const isHighWindAbove10 = visible && currentWeather.windSpeed10m > 10;

  useEffect(() => {
    if (!isHighWindAbove10) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      (canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
      }) as WebGLRenderingContext | null) ||
      (canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
      }) as WebGLRenderingContext | null);

    if (!gl) return;

    const vertShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vertShader || !fragShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      return;
    }

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPositionLoc = gl.getAttribLocation(program, 'a_position');
    const uResolutionLoc = gl.getUniformLocation(program, 'u_resolution');
    const uTimeLoc = gl.getUniformLocation(program, 'u_time');
    const uWindDirLoc = gl.getUniformLocation(program, 'u_windDir');
    const uWindPerpLoc = gl.getUniformLocation(program, 'u_windPerp');
    const uWindSpeedLoc = gl.getUniformLocation(program, 'u_windSpeed');
    const uWindGustsLoc = gl.getUniformLocation(program, 'u_windGusts');
    const uSpreadTanLoc = gl.getUniformLocation(program, 'u_spreadTan');
    const uPxScaleLoc = gl.getUniformLocation(program, 'u_pxScale');
    const uSourceCountLoc = gl.getUniformLocation(program, 'u_sourceCount');
    const uHasSelectedSourceLoc = gl.getUniformLocation(program, 'u_hasSelectedSource');
    const uSourcesLoc = gl.getUniformLocation(program, 'u_sources[0]');

    let width = 1000;
    let height = 720;

    const updateCanvasSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextW = Math.max(320, Math.round(rect.width * dpr));
      const nextH = Math.max(240, Math.round(rect.height * dpr));
      if (canvas.width !== nextW || canvas.height !== nextH) {
        width = canvas.width = nextW;
        height = canvas.height = nextH;
      } else {
        width = nextW;
        height = nextH;
      }
      gl.viewport(0, 0, width, height);
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

    // Match SVG viewBox="0 0 1000 720" preserveAspectRatio="xMidYMid meet" exactly
    const VIEW_W = 1000;
    const VIEW_H = 720;
    const projectLatLngToCanvas = (pt: LatLngPoint): { x: number; y: number } => {
      const scaleFactor = Math.pow(2, zoomRef.current - 17);
      const PX_PER_DEG_LAT = 195000 * scaleFactor;
      const PX_PER_DEG_LNG = 110800 * scaleFactor;
      const dx = (pt.lng - RINGPARKEN_CENTER.lng) * PX_PER_DEG_LNG;
      const dy = (RINGPARKEN_CENTER.lat - pt.lat) * PX_PER_DEG_LAT;
      const svgX = VIEW_W / 2 + dx + panRef.current.x;
      const svgY = VIEW_H / 2 + dy + panRef.current.y;

      const uniformScale = Math.min(width / VIEW_W, height / VIEW_H);
      const offsetX = (width - VIEW_W * uniformScale) * 0.5;
      const offsetY = (height - VIEW_H * uniformScale) * 0.5;

      return {
        x: offsetX + svgX * uniformScale,
        y: offsetY + svgY * uniformScale,
      };
    };

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    const startMs = performance.now();

    const drawScene = (nowMs: number) => {
      const weather = weatherRef.current;
      const targetSources = selectWebGlPlumeSources(
        sourcesRef.current,
        selectedSourceIdRef.current,
        MAX_WEBGL_SOURCES
      );

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.enableVertexAttribArray(aPositionLoc);
      gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

      const advectionDeg = (weather.windDirection10m + 180) % 360;
      const advectionRad = (advectionDeg * Math.PI) / 180;
      const dirX = Math.sin(advectionRad);
      const dirY = -Math.cos(advectionRad);
      const perpX = -dirY;
      const perpY = dirX;

      const sourceVecs = new Float32Array(MAX_WEBGL_SOURCES * 4);
      targetSources.forEach(({ source, isSelected }, idx) => {
        const px = projectLatLngToCanvas(source.position);
        const rawFactor = source.sourceEmissionFactor ?? source.fiberReleaseIndex ?? 1.0;
        sourceVecs[idx * 4] = px.x;
        sourceVecs[idx * 4 + 1] = px.y;
        sourceVecs[idx * 4 + 2] = Math.min(1.45, Math.max(0.65, rawFactor));
        sourceVecs[idx * 4 + 3] = isSelected ? 1.0 : 0.0;
      });

      const uniformScale = Math.min(width / VIEW_W, height / VIEW_H);
      const pxScale = uniformScale * Math.pow(2, zoomRef.current - 17);

      gl.uniform2f(uResolutionLoc, width, height);
      gl.uniform1f(uTimeLoc, prefersReducedMotion ? 1.5 : (nowMs - startMs) * 0.001);
      gl.uniform2f(uWindDirLoc, dirX, dirY);
      gl.uniform2f(uWindPerpLoc, perpX, perpY);
      gl.uniform1f(uWindSpeedLoc, weather.windSpeed10m);
      gl.uniform1f(uWindGustsLoc, weather.windGusts10m);
      gl.uniform1f(uSpreadTanLoc, getPasquillSpreadTangent(weather.pasquillClass));
      gl.uniform1f(uPxScaleLoc, pxScale);
      const hasAnySelected = targetSources.some((t) => t.isSelected);
      gl.uniform1i(uSourceCountLoc, targetSources.length);
      gl.uniform1f(uHasSelectedSourceLoc, hasAnySelected ? 1.0 : 0.0);
      if (uSourcesLoc) {
        gl.uniform4fv(uSourcesLoc, sourceVecs);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(drawScene);
      }
    };

    if (prefersReducedMotion) {
      drawScene(startMs);
    } else {
      rafId = window.requestAnimationFrame(drawScene);
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateCanvasSize);
      gl.deleteBuffer(posBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      const loseExt = gl.getExtension('WEBGL_lose_context');
      if (loseExt) loseExt.loseContext();
    };
  }, [isHighWindAbove10]);

  if (!isHighWindAbove10) return null;

  return (
    <canvas
      ref={canvasRef}
      data-testid="webgl-2d-dust-plume-overlay"
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      aria-label="WebGL støvfane-animation fra valgte kildenoder ved vindhastighed over 10 m/s"
    />
  );
};
