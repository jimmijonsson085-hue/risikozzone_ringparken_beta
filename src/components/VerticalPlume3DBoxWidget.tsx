import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Box,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Hammer,
  Layers,
  Maximize2,
  Minimize2,
  PlusCircle,
  RotateCcw,
  Wind,
} from 'lucide-react';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  PasquillClass,
  ReceptorExposureResult,
  ReceptorZone,
  RingparkenBuildingUnit,
} from '../types/dispersion';

interface VerticalPlume3DBoxWidgetProps {
  dateIso: string;
  currentWeather: HourlyWeatherPoint;
  hours: HourlyWeatherPoint[];
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  receptorExposures: ReceptorExposureResult[];
  buildings: RingparkenBuildingUnit[];
  maxSiteSumQuotient: number;
  onSelectHour: (hourIndex: number) => void;
  onLogVerticalPlumeEvidence?: (payload: {
    hourIndex: number;
    hourLabel: string;
    pasquillClass: PasquillClass;
    windSpeedMs: number;
    plumeDirectionDeg: number;
    sliceDistanceMeters: number;
    sigmaZAtSliceMeters: number;
    plumeTopHeightMeters: number;
    floorQuots: { label: string; zMeters: number; sQuotient: number }[];
  }) => void;
}

// Pasquill-Gifford dispersion coefficients sigma_y(x) = a * x^b, sigma_z(x) = c * x^d
const PG_COEFFS: Record<
  PasquillClass,
  { a: number; b: number; c: number; d: number; mixingLidM: number; labelDa: string }
> = {
  A: { a: 0.22, b: 0.894, c: 0.2, d: 0.894, mixingLidM: 34, labelDa: 'Meget ustabil (Stærk termisk vertikal opblanding)' },
  B: { a: 0.16, b: 0.894, c: 0.12, d: 0.894, mixingLidM: 30, labelDa: 'Moderat ustabil (Høj vertikal fanespredning)' },
  C: { a: 0.11, b: 0.894, c: 0.08, d: 0.894, mixingLidM: 26, labelDa: 'Let ustabil (Konisk vertikal faneudbredelse)' },
  D: { a: 0.08, b: 0.894, c: 0.06, d: 0.894, mixingLidM: 22, labelDa: 'Neutral (Mekanisk vindturbulens langs etager)' },
  E: { a: 0.06, b: 0.894, c: 0.03, d: 0.85, mixingLidM: 16, labelDa: 'Let stabil (Lavthængende koncentreret støvfane)' },
  F: { a: 0.04, b: 0.894, c: 0.016, d: 0.82, mixingLidM: 13.5, labelDa: 'Meget stabil / Inversion (Fane låst i bolighøjde)' },
};

const CENTER_LAT = 55.4128;
const CENTER_LNG = 11.3533;

function latLngToSceneXZ(lat: number, lng: number): { x: number; z: number } {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((CENTER_LAT * Math.PI) / 180);
  // 1 scene unit = 2 meters in physical Ringparken space
  const xMeters = (lng - CENTER_LNG) * mPerDegLng;
  const zMeters = -(lat - CENTER_LAT) * mPerDegLat;
  return { x: xMeters * 0.5, z: zMeters * 0.5 };
}

function compassLabelDa(deg: number): string {
  const dirs = ['N', 'NNØ', 'NØ', 'ØNØ', 'Ø', 'ØSØ', 'SØ', 'SSØ', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
  const norm = ((deg % 360) + 360) % 360;
  return dirs[Math.round(norm / 22.5) % 16];
}

export const VerticalPlume3DBoxWidget: React.FC<VerticalPlume3DBoxWidgetProps> = ({
  dateIso,
  currentWeather,
  hours,
  sources,
  receptors,
  receptorExposures,
  buildings,
  maxSiteSumQuotient,
  onSelectHour,
  onLogVerticalPlumeEvidence,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isTallViewport, setIsTallViewport] = useState<boolean>(false);
  const [sliceDistanceMeters, setSliceDistanceMeters] = useState<number>(140);
  const [horizontalCutHeightMeters, setHorizontalCutHeightMeters] = useState<number>(8.2);
  const [showInversionLid, setShowInversionLid] = useState<boolean>(true);
  const [showVerticalSlicePlane, setShowVerticalSlicePlane] = useState<boolean>(true);
  const [showHydraulicHammerImpulse3D, setShowHydraulicHammerImpulse3D] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<'isometric' | 'side_profile' | 'downwind_axis' | 'top_overview'>('isometric');
  const [loggedConfirmation, setLoggedConfirmation] = useState<boolean>(false);

  const activeSources = useMemo(() => {
    const filtered = sources.filter((s) => s.active);
    return filtered.length > 0 ? filtered : sources.slice(0, 2);
  }, [sources]);

  const plumeDirectionDeg = useMemo(
    () => (currentWeather.windDirection10m + 180) % 360,
    [currentWeather.windDirection10m]
  );

  const pgSpec = PG_COEFFS[currentWeather.pasquillClass] || PG_COEFFS.D;

  // Compute vertical dispersion profile at the user-selected downwind slice distance x
  const verticalMetrics = useMemo(() => {
    const x = Math.max(20, sliceDistanceMeters);
    const u10 = Math.max(0.8, currentWeather.windSpeed10m);
    const gustRatio = Math.max(1.0, currentWeather.windGusts10m / u10);
    const primarySource = activeSources[0];
    const hEff = primarySource?.releaseHeightMeters ?? 6.5;

    // Effective vertical dispersion sigma_z(x) in meters
    const rawSigmaZ = pgSpec.c * Math.pow(x, pgSpec.d) * (0.85 + 0.15 * Math.min(2.2, gustRatio));
    const sigmaZ = Math.min(pgSpec.mixingLidM * 0.62, Math.max(1.8, rawSigmaZ));
    const sigmaY = Math.max(4.0, pgSpec.a * Math.pow(x, pgSpec.b));

    // Upper 10% concentration boundary of the plume (H_eff + 2.15 * sigma_z), capped by mixing lid
    const plumeTopHeightMeters = Math.min(pgSpec.mixingLidM, hEff + 2.15 * sigmaZ);

    // Base centerline sum quotient scaled to current site max S
    const baseCenterlineS = Math.max(0.28, maxSiteSumQuotient * Math.exp(-Math.pow(x - 95, 2) / 28000));

    // Gaussian vertical factor with ground reflection:
    // G_z(z) = exp(-(z - H)^2 / (2*sigma_z^2)) + exp(-(z + H)^2 / (2*sigma_z^2))
    const evalFloorS = (zMeters: number) => {
      const termDirect = Math.exp(-Math.pow(zMeters - hEff, 2) / (2 * sigmaZ * sigmaZ));
      const termGroundRefl = Math.exp(-Math.pow(zMeters + hEff, 2) / (2 * sigmaZ * sigmaZ));
      const normRef = 1 + Math.exp(-(2 * hEff * hEff) / (2 * sigmaZ * sigmaZ));
      const ratio = (termDirect + termGroundRefl) / Math.max(0.5, normRef);
      return Number((baseCenterlineS * ratio).toFixed(2));
    };

    const floorQuots = [
      { label: 'Terræn / Indånding (1,5 m)', zMeters: 1.5, sQuotient: evalFloorS(1.5) },
      { label: '1. Sal Altan/Vindue (4,8 m)', zMeters: 4.8, sQuotient: evalFloorS(4.8) },
      { label: '2. Sal Opholdsrum (8,2 m)', zMeters: 8.2, sQuotient: evalFloorS(8.2) },
      { label: '3. Sal & Tagkant (11,2 m)', zMeters: 11.2, sQuotient: evalFloorS(11.2) },
      { label: 'Over Tag / Afkast (16,0 m)', zMeters: 16.0, sQuotient: evalFloorS(16.0) },
    ];

    const cutHeightS = evalFloorS(horizontalCutHeightMeters);

    // Hourly acoustic refraction dB for hydraulic concrete hammer impulse waves based on wind speed, gusts & Pasquill thermal gradient
    const thermalRefrDb =
      currentWeather.pasquillClass === 'F'
        ? 1.9
        : currentWeather.pasquillClass === 'E'
        ? 1.2
        : currentWeather.pasquillClass === 'D'
        ? 0.4
        : -0.3;
    const effWindMs =
      0.65 * currentWeather.windSpeed10m +
      0.35 * Math.max(currentWeather.windSpeed10m, currentWeather.windGusts10m);
    const windShearRefrDb = Math.min(5.2, effWindMs * 0.36);
    const hourlyRefractionDb = Number(Math.max(0.2, windShearRefrDb + thermalRefrDb).toFixed(1));
    const hammerImpulseLafmaxDb = Number((81.5 + hourlyRefractionDb * 1.65).toFixed(1));

    return {
      hEff,
      sigmaZ,
      sigmaY,
      plumeTopHeightMeters,
      mixingLidM: pgSpec.mixingLidM,
      floorQuots,
      cutHeightS,
      hourlyRefractionDb,
      hammerImpulseLafmaxDb,
    };
  }, [
    sliceDistanceMeters,
    currentWeather.windSpeed10m,
    currentWeather.windGusts10m,
    currentWeather.pasquillClass,
    activeSources,
    pgSpec,
    maxSiteSumQuotient,
    horizontalCutHeightMeters,
  ]);

  // Keep latest reactive telemetry in a ref so the Three.js render/update loop can update smoothly
  const sceneParamsRef = useRef({
    currentWeather,
    plumeDirectionDeg,
    activeSources,
    receptors,
    receptorExposures,
    buildings,
    verticalMetrics,
    sliceDistanceMeters,
    horizontalCutHeightMeters,
    showInversionLid,
    showVerticalSlicePlane,
    showHydraulicHammerImpulse3D,
    cameraPreset,
  });

  useEffect(() => {
    sceneParamsRef.current = {
      currentWeather,
      plumeDirectionDeg,
      activeSources,
      receptors,
      receptorExposures,
      buildings,
      verticalMetrics,
      sliceDistanceMeters,
      horizontalCutHeightMeters,
      showInversionLid,
      showVerticalSlicePlane,
      showHydraulicHammerImpulse3D,
      cameraPreset,
    };
  }, [
    currentWeather,
    plumeDirectionDeg,
    activeSources,
    receptors,
    receptorExposures,
    buildings,
    verticalMetrics,
    sliceDistanceMeters,
    horizontalCutHeightMeters,
    showInversionLid,
    showVerticalSlicePlane,
    showHydraulicHammerImpulse3D,
    cameraPreset,
  ]);

  // Ref for triggering dynamic geometry rebuild when hour/weather/slice changes
  const rebuildPlumeRef = useRef<(() => void) | null>(null);
  const applyCameraPresetRef = useRef<((preset: typeof cameraPreset) => void) | null>(null);

  useEffect(() => {
    if (rebuildPlumeRef.current) {
      rebuildPlumeRef.current();
    }
  }, [
    currentWeather.hourIndex,
    currentWeather.windSpeed10m,
    currentWeather.windDirection10m,
    currentWeather.pasquillClass,
    sliceDistanceMeters,
    horizontalCutHeightMeters,
    showInversionLid,
    showVerticalSlicePlane,
    activeSources,
    maxSiteSumQuotient,
  ]);

  useEffect(() => {
    if (applyCameraPresetRef.current) {
      applyCameraPresetRef.current(cameraPreset);
    }
  }, [cameraPreset]);

  useEffect(() => {
    if (!isExpanded) return;
    const container = mountRef.current;
    if (!container) return;

    // 1. Renderer & Software WebGL Detection
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    const gl = renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|Software|Basic Render Driver/i.test(rendererStr);

    const initWidth = Math.max(320, container.clientWidth || 640);
    const initHeight = Math.max(260, container.clientHeight || 340);

    renderer.setPixelRatio(isSoftwareGl ? 1.0 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(initWidth, initHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene, Environment & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);
    scene.fog = new THREE.FogExp2(0x070b14, 0.0028);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();

    const camera = new THREE.PerspectiveCamera(42, initWidth / initHeight, 0.5, 900);
    camera.position.set(115, 68, 135);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 28;
    controls.maxDistance = 380;
    controls.target.set(0, 12, 0);
    controls.update();

    // 3. Three-Point + Hemisphere Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff3e0, 2.2);
    keyLight.position.set(90, 140, 80);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 10;
      keyLight.shadow.camera.far = 380;
      const d = 140;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rimLight.position.set(-110, 75, -95);
    scene.add(rimLight);

    // 4. Static Ringparken Ground Terrain, Grid & Vertical Altitude Poles
    // Physical vertical scale: 1m height = 1.6 Y scene units (exaggerated 3.2x vs horizontal so vertical plume spread is crystal-clear)
    const Y_PER_METER = 1.6;
    const XZ_PER_METER = 0.5;

    const staticGroup = new THREE.Group();
    scene.add(staticGroup);

    const groundGeo = new THREE.CircleGeometry(185, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0b1322,
      roughness: 0.92,
      metalness: 0.08,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = !isSoftwareGl;
    staticGroup.add(groundMesh);

    const gridHelper = new THREE.GridHelper(320, 32, 0x1e3a5f, 0x111c30);
    gridHelper.position.y = 0.05;
    staticGroup.add(gridHelper);

    // Compass Ring at ground level
    const compassRingGeo = new THREE.RingGeometry(142, 144.5, 64);
    const compassRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const compassRing = new THREE.Mesh(compassRingGeo, compassRingMat);
    compassRing.rotation.x = -Math.PI / 2;
    compassRing.position.y = 0.12;
    staticGroup.add(compassRing);

    // Vertical Reference Altitude Tower (0m to 35m) with height rings
    const altitudeTowerGroup = new THREE.Group();
    altitudeTowerGroup.position.set(-85, 0, -65);
    const poleGeo = new THREE.CylinderGeometry(0.35, 0.35, 35 * Y_PER_METER, 12);
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.4,
      metalness: 0.6,
    });
    const poleMesh = new THREE.Mesh(poleGeo, poleMat);
    poleMesh.position.y = (35 * Y_PER_METER) / 2;
    altitudeTowerGroup.add(poleMesh);

    [5, 10, 12, 15, 20, 25, 30].forEach((altM) => {
      const isRoof12m = altM === 12;
      const tickGeo = new THREE.TorusGeometry(isRoof12m ? 3.2 : 2.0, isRoof12m ? 0.28 : 0.16, 8, 24);
      const tickMat = new THREE.MeshBasicMaterial({
        color: isRoof12m ? 0xfbbf24 : 0x38bdf8,
      });
      const tick = new THREE.Mesh(tickGeo, tickMat);
      tick.rotation.x = Math.PI / 2;
      tick.position.y = altM * Y_PER_METER;
      altitudeTowerGroup.add(tick);
    });
    staticGroup.add(altitudeTowerGroup);

    // 5. Ringparken Multi-Story Building Blocks (with floor bands at 3m, 6m, 9m, 12m)
    const buildingsGroup = new THREE.Group();
    staticGroup.add(buildingsGroup);

    const buildRingparkenBlocks = () => {
      while (buildingsGroup.children.length > 0) {
        const child = buildingsGroup.children[0];
        buildingsGroup.remove(child);
      }

      const bList = sceneParamsRef.current.buildings;
      bList.forEach((b) => {
        const pos = latLngToSceneXZ(b.center.lat, b.center.lng);
        const isDemolition =
          b.category === 'd_under_demolition' || b.category === 'e_demolished_unsecured';
        const isRenovation = b.category === 'c_under_renovation';
        const heightMeters = isDemolition ? 7.5 : Math.max(9, b.floors * 3.0);
        const hScene = heightMeters * Y_PER_METER;

        // Estimate footprint dimensions
        let widthScene = 18;
        let depthScene = 6.5;
        if (b.footprint && b.footprint.length >= 3) {
          const xs = b.footprint.map((pt) => latLngToSceneXZ(pt.lat, pt.lng).x);
          const zs = b.footprint.map((pt) => latLngToSceneXZ(pt.lat, pt.lng).z);
          widthScene = Math.max(5.5, Math.min(34, Math.max(...xs) - Math.min(...xs)));
          depthScene = Math.max(4.5, Math.min(24, Math.max(...zs) - Math.min(...zs)));
        }

        const blockGroup = new THREE.Group();
        blockGroup.position.set(pos.x, 0, pos.z);

        const bodyColor = isDemolition
          ? 0xdc2626
          : isRenovation
          ? 0xd97706
          : 0x1e3a5f;

        const bodyGeo = new THREE.BoxGeometry(widthScene, hScene, depthScene);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: bodyColor,
          roughness: 0.55,
          metalness: 0.2,
          transparent: true,
          opacity: isDemolition ? 0.88 : 0.92,
        });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = hScene / 2;
        bodyMesh.castShadow = !isSoftwareGl;
        bodyMesh.receiveShadow = !isSoftwareGl;
        blockGroup.add(bodyMesh);

        // Floor separator strips (Stue, 1. sal, 2. sal, 3. sal) so vertical plume height vs apartment stories is clear
        const floorCount = Math.min(4, Math.max(1, b.floors));
        for (let f = 1; f <= floorCount; f++) {
          const floorY = f * 3.0 * Y_PER_METER;
          if (floorY < hScene) {
            const bandGeo = new THREE.BoxGeometry(widthScene + 0.3, 0.22, depthScene + 0.3);
            const bandMat = new THREE.MeshBasicMaterial({
              color: isDemolition ? 0xfca5a5 : 0x7dd3fc,
              transparent: true,
              opacity: 0.55,
            });
            const bandMesh = new THREE.Mesh(bandGeo, bandMat);
            bandMesh.position.y = floorY;
            blockGroup.add(bandMesh);
          }
        }

        // Roof cap
        const roofGeo = new THREE.BoxGeometry(widthScene + 0.4, 0.45, depthScene + 0.4);
        const roofMat = new THREE.MeshStandardMaterial({
          color: isDemolition ? 0xfef08a : 0x38bdf8,
          roughness: 0.4,
          metalness: 0.4,
        });
        const roofMesh = new THREE.Mesh(roofGeo, roofMat);
        roofMesh.position.y = hScene + 0.22;
        blockGroup.add(roofMesh);

        buildingsGroup.add(blockGroup);
      });
    };

    buildRingparkenBlocks();

    // 6. Dynamic Plume Group (Volumetric 3D Plume Cones, Vertical Cross-Section Slice Plane, Inversion Lid, Horizontal Cut)
    const dynamicPlumeGroup = new THREE.Group();
    scene.add(dynamicPlumeGroup);

    // 7. Advected 3D Dust Particle Cloud
    const PARTICLE_COUNT = isSoftwareGl ? 320 : 650;
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleColors = new Float32Array(PARTICLE_COUNT * 3);
    const particleSeeds = new Float32Array(PARTICLE_COUNT * 4); // [progress 0..1, normY -1..1, normZ -1..1, sourceIdx]

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particleSeeds[i * 4 + 0] = Math.random();
      // Box-Muller-like bell distribution
      const u1 = Math.max(0.001, Math.random());
      const u2 = Math.random();
      const gauss1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const gauss2 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
      particleSeeds[i * 4 + 1] = Math.max(-2.2, Math.min(2.2, gauss1 * 0.65));
      particleSeeds[i * 4 + 2] = Math.max(-2.2, Math.min(2.2, gauss2 * 0.65));
      particleSeeds[i * 4 + 3] = i % 3;
    }

    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particlesGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particlesMat = new THREE.PointsMaterial({
      size: isSoftwareGl ? 2.2 : 2.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particlesPoints = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particlesPoints);

    // 7b. 3D Hydraulic Concrete Hammer Impulse Shockwave Rings propagating toward Neighboring Blocks based on Hourly Refraction (dB)
    const HAMMER_WAVE_COUNT = isSoftwareGl ? 36 : 56;
    const hammerWaveGeo = new THREE.TorusGeometry(1.1, 0.14, 10, 28);
    const hammerWaveMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const hammerWavesInstanced = new THREE.InstancedMesh(
      hammerWaveGeo,
      hammerWaveMat,
      HAMMER_WAVE_COUNT
    );
    hammerWavesInstanced.frustumCulled = false;
    scene.add(hammerWavesInstanced);

    const hammerWaveSeeds = Array.from({ length: HAMMER_WAVE_COUNT }, (_, idx) => ({
      progress: (idx / HAMMER_WAVE_COUNT) % 1.0,
      targetIdx: idx,
    }));
    const hammerDummy = new THREE.Object3D();
    const hammerColor = new THREE.Color();

    const disposeGroupChildren = (grp: THREE.Group) => {
      while (grp.children.length > 0) {
        const obj = grp.children[0] as THREE.Mesh;
        grp.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    };

    // Build / Rebuild 3D Vertical Plume Envelope & Cross-Section Slice Meshes
    const rebuildPlumeGeometry = () => {
      disposeGroupChildren(dynamicPlumeGroup);

      const {
        currentWeather: cw,
        plumeDirectionDeg: pDeg,
        activeSources: srcs,
        verticalMetrics: vm,
        sliceDistanceMeters: sliceDistM,
        horizontalCutHeightMeters: hCutM,
        showInversionLid: lidOn,
        showVerticalSlicePlane: sliceOn,
      } = sceneParamsRef.current;

      const pg = PG_COEFFS[cw.pasquillClass] || PG_COEFFS.D;
      const rad = (pDeg * Math.PI) / 180;
      const dirX = Math.sin(rad);
      const dirZ = -Math.cos(rad);
      const perpX = -dirZ;
      const perpZ = dirX;

      const gustBoost = Math.max(1.0, cw.windGusts10m / Math.max(0.8, cw.windSpeed10m));

      // Create 3D Gaussian Plume Envelope Tubes for each active demolition source
      srcs.forEach((src, srcIdx) => {
        const origin = latLngToSceneXZ(src.position.lat, src.position.lng);
        const hEffM = src.releaseHeightMeters || 6.5;

        // Vertical emitter stack marker at demolition source
        const emitterGeo = new THREE.CylinderGeometry(1.1, 1.8, hEffM * Y_PER_METER, 16);
        const emitterMat = new THREE.MeshStandardMaterial({
          color: 0xf43f5e,
          emissive: 0x9f1239,
          emissiveIntensity: 0.7,
          roughness: 0.35,
        });
        const emitterMesh = new THREE.Mesh(emitterGeo, emitterMat);
        emitterMesh.position.set(origin.x, (hEffM * Y_PER_METER) / 2, origin.z);
        dynamicPlumeGroup.add(emitterMesh);

        // Build 3 concentric 3D plume iso-surface shells:
        // Shell 0: Core Red Zone (1.0 * sigma_y, 1.0 * sigma_z)
        // Shell 1: Middle Orange Zone (1.65 * sigma_y, 1.65 * sigma_z)
        // Shell 2: Outer Yellow Envelope (2.15 * sigma_y, 2.15 * sigma_z)
        const shells = [
          { scale: 0.95, color: 0xf43f5e, opacity: 0.42 },
          { scale: 1.55, color: 0xf59e0b, opacity: 0.25 },
          { scale: 2.15, color: 0x38bdf8, opacity: 0.14 },
        ];

        const lengthSteps = 28;
        const radialSteps = 24;
        const maxDownwindM = 340;

        shells.forEach((shell) => {
          const positions: number[] = [];
          const indices: number[] = [];

          for (let i = 0; i <= lengthSteps; i++) {
            const frac = i / lengthSteps;
            const xDistM = 6 + frac * maxDownwindM;
            const sigY_M = Math.max(2.5, pg.a * Math.pow(xDistM, pg.b)) * shell.scale;
            const rawSigZ_M =
              pg.c *
              Math.pow(xDistM, pg.d) *
              (0.85 + 0.15 * Math.min(2.2, gustBoost)) *
              shell.scale;
            const sigZ_M = Math.min(pg.mixingLidM * 0.92, Math.max(1.5, rawSigZ_M));

            // Plume centerline rises slightly with thermal buoyancy / mechanical momentum before leveling under mixing lid
            const centerHeightM = Math.min(
              pg.mixingLidM * 0.78,
              hEffM + Math.min(6.5, frac * (cw.pasquillClass <= 'C' ? 5.5 : 2.2))
            );

            const cx = origin.x + dirX * (xDistM * XZ_PER_METER);
            const cz = origin.z + dirZ * (xDistM * XZ_PER_METER);

            for (let j = 0; j <= radialSteps; j++) {
              const theta = (j / radialSteps) * Math.PI * 2;
              const localCrossM = Math.cos(theta) * sigY_M;
              const localVertM = Math.sin(theta) * sigZ_M;

              // Ground reflection clamp at z = 0.2m and inversion lid clamp at mixingLidM
              const clampedHeightM = Math.min(
                pg.mixingLidM,
                Math.max(0.25, centerHeightM + localVertM)
              );

              const vx = cx + perpX * (localCrossM * XZ_PER_METER);
              const vy = clampedHeightM * Y_PER_METER;
              const vz = cz + perpZ * (localCrossM * XZ_PER_METER);

              positions.push(vx, vy, vz);
            }
          }

          const ringVerts = radialSteps + 1;
          for (let i = 0; i < lengthSteps; i++) {
            for (let j = 0; j < radialSteps; j++) {
              const a = i * ringVerts + j;
              const b = (i + 1) * ringVerts + j;
              const c = (i + 1) * ringVerts + (j + 1);
              const d = i * ringVerts + (j + 1);
              indices.push(a, b, d);
              indices.push(b, c, d);
            }
          }

          const shellGeo = new THREE.BufferGeometry();
          shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          shellGeo.setIndex(indices);
          shellGeo.computeVertexNormals();

          const shellMat = new THREE.MeshPhysicalMaterial({
            color: shell.color,
            transparent: true,
            opacity: shell.opacity,
            roughness: 0.35,
            metalness: 0.05,
            side: THREE.DoubleSide,
            depthWrite: false,
          });

          const shellMesh = new THREE.Mesh(shellGeo, shellMat);
          dynamicPlumeGroup.add(shellMesh);
        });

        // Plume Centerline Trajectory Curve (H_eff(x)) for primary source
        if (srcIdx === 0) {
          const curvePts: THREE.Vector3[] = [];
          for (let i = 0; i <= 32; i++) {
            const frac = i / 32;
            const xDistM = frac * 340;
            const centerHeightM = Math.min(
              pg.mixingLidM * 0.78,
              hEffM + Math.min(6.5, frac * (cw.pasquillClass <= 'C' ? 5.5 : 2.2))
            );
            curvePts.push(
              new THREE.Vector3(
                origin.x + dirX * (xDistM * XZ_PER_METER),
                centerHeightM * Y_PER_METER,
                origin.z + dirZ * (xDistM * XZ_PER_METER)
              )
            );
          }
          const curve = new THREE.CatmullRomCurve3(curvePts);
          const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.42, 8, false);
          const tubeMat = new THREE.MeshBasicMaterial({
            color: 0xfef08a,
          });
          const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
          dynamicPlumeGroup.add(tubeMesh);

          // Vertical Cross-Section Slice Plane at sliceDistM
          if (sliceOn) {
            const sliceCenterX = origin.x + dirX * (sliceDistM * XZ_PER_METER);
            const sliceCenterZ = origin.z + dirZ * (sliceDistM * XZ_PER_METER);
            const sliceWidthScene = Math.max(36, vm.sigmaY * 4.5 * XZ_PER_METER);
            const sliceHeightScene = pg.mixingLidM * Y_PER_METER;

            const slicePlaneGeo = new THREE.PlaneGeometry(sliceWidthScene, sliceHeightScene);
            const slicePlaneMat = new THREE.MeshBasicMaterial({
              color: 0x22d3ee,
              transparent: true,
              opacity: 0.2,
              side: THREE.DoubleSide,
              depthWrite: false,
            });
            const slicePlane = new THREE.Mesh(slicePlaneGeo, slicePlaneMat);
            slicePlane.position.set(sliceCenterX, sliceHeightScene / 2, sliceCenterZ);
            // Orient normal along plume direction
            slicePlane.rotation.y = Math.atan2(dirX, dirZ);
            dynamicPlumeGroup.add(slicePlane);

            // Bright frame border around vertical slice plane
            const edgesGeo = new THREE.EdgesGeometry(slicePlaneGeo);
            const edgesMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
            const edgesLine = new THREE.LineSegments(edgesGeo, edgesMat);
            edgesLine.position.copy(slicePlane.position);
            edgesLine.rotation.copy(slicePlane.rotation);
            dynamicPlumeGroup.add(edgesLine);

            // Vertical Plume Height Pillar at Slice Center (0 to Z_top)
            const topPillarH = vm.plumeTopHeightMeters * Y_PER_METER;
            const topPillarGeo = new THREE.CylinderGeometry(0.45, 0.45, topPillarH, 12);
            const topPillarMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
            const topPillar = new THREE.Mesh(topPillarGeo, topPillarMat);
            topPillar.position.set(sliceCenterX, topPillarH / 2, sliceCenterZ);
            dynamicPlumeGroup.add(topPillar);
          }
        }
      });

      // Horizontal Altitude Cut Plane (shows which building floor height is being inspected)
      const hCutY = hCutM * Y_PER_METER;
      const hCutGeo = new THREE.RingGeometry(12, 138, 48);
      const hCutMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const hCutMesh = new THREE.Mesh(hCutGeo, hCutMat);
      hCutMesh.rotation.x = -Math.PI / 2;
      hCutMesh.position.y = hCutY;
      dynamicPlumeGroup.add(hCutMesh);

      // Atmospheric Mixing / Inversion Lid Ceiling Plane
      if (lidOn) {
        const lidY = pg.mixingLidM * Y_PER_METER;
        const lidGeo = new THREE.CircleGeometry(142, 48);
        const lidMat = new THREE.MeshBasicMaterial({
          color: cw.pasquillClass >= 'E' ? 0xf43f5e : 0x38bdf8,
          transparent: true,
          opacity: cw.pasquillClass >= 'E' ? 0.16 : 0.08,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const lidMesh = new THREE.Mesh(lidGeo, lidMat);
        lidMesh.rotation.x = -Math.PI / 2;
        lidMesh.position.y = lidY;
        dynamicPlumeGroup.add(lidMesh);
      }
    };

    rebuildPlumeRef.current = rebuildPlumeGeometry;
    rebuildPlumeGeometry();

    // Camera Presets
    const applyPreset = (preset: typeof cameraPreset) => {
      const pDeg = sceneParamsRef.current.plumeDirectionDeg;
      const rad = (pDeg * Math.PI) / 180;
      const dirX = Math.sin(rad);
      const dirZ = -Math.cos(rad);
      const perpX = -dirZ;
      const perpZ = dirX;

      if (preset === 'isometric') {
        camera.position.set(115, 68, 135);
        controls.target.set(0, 14, 0);
      } else if (preset === 'side_profile') {
        // Orthogonal to wind vector so the vertical plume rise and building floors are seen in true side elevation
        camera.position.set(perpX * 155, 26, perpZ * 155);
        controls.target.set(dirX * 35, 16, dirZ * 35);
      } else if (preset === 'downwind_axis') {
        // Looking from behind the demolition source along the plume trajectory
        camera.position.set(-dirX * 125, 42, -dirZ * 125);
        controls.target.set(dirX * 55, 14, dirZ * 55);
      } else if (preset === 'top_overview') {
        camera.position.set(0, 215, 18);
        controls.target.set(0, 0, 0);
      }
      controls.update();
    };
    applyCameraPresetRef.current = applyPreset;

    // 8. ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(300, Math.floor(entry.contentRect.width));
        const h = Math.max(240, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // 9. Animation Loop with Software WebGL Pacing Guard
    const clock = new THREE.Clock();
    let rafId = 0;
    let frameInFlight = false;

    const afterDraw = isSoftwareGl
      ? (cb: () => void) => {
          gl.getError();
          setTimeout(cb, 0);
        }
      : (cb: () => void) => cb();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (frameInFlight) return;
      frameInFlight = true;

      const dt = Math.min(clock.getDelta(), 0.1);
      const {
        currentWeather: cw,
        plumeDirectionDeg: pDeg,
        activeSources: srcs,
      } = sceneParamsRef.current;

      const pg = PG_COEFFS[cw.pasquillClass] || PG_COEFFS.D;
      const rad = (pDeg * Math.PI) / 180;
      const dirX = Math.sin(rad);
      const dirZ = -Math.cos(rad);
      const perpX = -dirZ;
      const perpZ = dirX;
      const speedNorm = Math.max(0.08, Math.min(0.55, cw.windSpeed10m * 0.032));
      const gustFactor = Math.max(1.0, cw.windGusts10m / Math.max(0.8, cw.windSpeed10m));

      const posAttr = particlesGeo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = particlesGeo.getAttribute('color') as THREE.BufferAttribute;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let prog = particleSeeds[i * 4 + 0] + dt * speedNorm;
        if (prog > 1.0) prog -= 1.0;
        particleSeeds[i * 4 + 0] = prog;

        const normCross = particleSeeds[i * 4 + 1];
        const normVert = particleSeeds[i * 4 + 2];
        const srcIdx = Math.floor(particleSeeds[i * 4 + 3]) % Math.max(1, srcs.length);
        const src = srcs[srcIdx] || srcs[0];
        const origin = src ? latLngToSceneXZ(src.position.lat, src.position.lng) : { x: 0, z: 0 };
        const hEffM = src?.releaseHeightMeters ?? 6.5;

        const xDistM = 4 + prog * 335;
        const sigY_M = Math.max(2.0, pg.a * Math.pow(xDistM, pg.b));
        const sigZ_M = Math.min(
          pg.mixingLidM * 0.65,
          Math.max(1.5, pg.c * Math.pow(xDistM, pg.d) * (0.85 + 0.15 * Math.min(2.2, gustFactor)))
        );

        const centerHeightM = Math.min(
          pg.mixingLidM * 0.78,
          hEffM + Math.min(6.5, prog * (cw.pasquillClass <= 'C' ? 5.5 : 2.2))
        );

        const localCrossM = normCross * sigY_M * 1.35;
        let heightM = centerHeightM + normVert * sigZ_M * 1.35;
        // Ground reflection & inversion lid bounce
        if (heightM < 0.3) heightM = 0.3 + Math.abs(heightM) * 0.65;
        if (heightM > pg.mixingLidM) heightM = pg.mixingLidM - (heightM - pg.mixingLidM) * 0.5;

        const px = origin.x + dirX * (xDistM * XZ_PER_METER) + perpX * (localCrossM * XZ_PER_METER);
        const py = heightM * Y_PER_METER;
        const pz = origin.z + dirZ * (xDistM * XZ_PER_METER) + perpZ * (localCrossM * XZ_PER_METER);

        posAttr.setXYZ(i, px, py, pz);

        // Color gradient by concentration intensity (core red -> orange -> cyan)
        const radialDistNorm = Math.sqrt(normCross * normCross + normVert * normVert);
        if (radialDistNorm < 0.75 && prog < 0.55) {
          colAttr.setXYZ(i, 0.98, 0.24, 0.36); // Rose-red core
        } else if (radialDistNorm < 1.35) {
          colAttr.setXYZ(i, 0.98, 0.68, 0.15); // Amber-orange middle
        } else {
          colAttr.setXYZ(i, 0.22, 0.78, 0.98); // Sky-cyan outer plume
        }
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      // Update 3D Hydraulic Concrete Hammer Impulse Shockwaves propagating toward Neighboring Blocks based on Hourly Refraction (dB)
      const {
        receptors: recs,
        verticalMetrics: vm,
        showHydraulicHammerImpulse3D: showHammer,
      } = sceneParamsRef.current;

      hammerWavesInstanced.visible = showHammer;
      if (showHammer && srcs.length > 0 && recs.length > 0) {
        const refrDb = vm.hourlyRefractionDb;
        const refrNorm = Math.min(1.4, Math.max(0.2, refrDb / 4.2));
        const waveSpeed = (0.32 + refrNorm * 0.18) * dt;

        for (let wIdx = 0; wIdx < HAMMER_WAVE_COUNT; wIdx++) {
          const seed = hammerWaveSeeds[wIdx];
          seed.progress = (seed.progress + waveSpeed) % 1.0;

          const src = srcs[wIdx % srcs.length];
          const rec = recs[seed.targetIdx % recs.length];
          const sPos = latLngToSceneXZ(src.position.lat, src.position.lng);
          const rPos = latLngToSceneXZ(rec.center.lat, rec.center.lng);

          const t = seed.progress;
          const wx = THREE.MathUtils.lerp(sPos.x, rPos.x, t);
          const wz = THREE.MathUtils.lerp(sPos.z, rPos.z, t);

          // Parabolic acoustic refraction arch over 2.5m barrier bending downward onto neighbor block facade based on hourlyRefractionDb
          const archHeightM = 3.5 + Math.sin(t * Math.PI) * (5.0 + refrDb * 1.45) - t * refrNorm * 1.8;
          const wy = Math.max(1.2, archHeightM) * Y_PER_METER;

          const nextT = Math.min(1.0, t + 0.04);
          const nx = THREE.MathUtils.lerp(sPos.x, rPos.x, nextT);
          const nz = THREE.MathUtils.lerp(sPos.z, rPos.z, nextT);
          const ny =
            Math.max(
              1.2,
              3.5 + Math.sin(nextT * Math.PI) * (5.0 + refrDb * 1.45) - nextT * refrNorm * 1.8
            ) * Y_PER_METER;

          hammerDummy.position.set(wx, wy, wz);
          hammerDummy.lookAt(nx, ny, nz);
          const ringScale = 0.7 + t * (2.6 + refrNorm * 1.5);
          hammerDummy.scale.set(ringScale * 1.25, ringScale * 0.95, 1.0);
          hammerDummy.updateMatrix();
          hammerWavesInstanced.setMatrixAt(wIdx, hammerDummy.matrix);

          if (t < 0.2) {
            hammerColor.setHex(0xfde047);
          } else if (refrDb >= 3.0) {
            hammerColor.setHex(t > 0.65 ? 0xe879f9 : 0xf43f5e);
          } else {
            hammerColor.setHex(0xf97316);
          }
          hammerWavesInstanced.setColorAt(wIdx, hammerColor);
        }
        hammerWavesInstanced.instanceMatrix.needsUpdate = true;
        if (hammerWavesInstanced.instanceColor) {
          hammerWavesInstanced.instanceColor.needsUpdate = true;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      afterDraw(() => {
        frameInFlight = false;
      });
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      rebuildPlumeRef.current = null;
      applyCameraPresetRef.current = null;
      controls.dispose();
      disposeGroupChildren(dynamicPlumeGroup);
      disposeGroupChildren(buildingsGroup);
      disposeGroupChildren(staticGroup);
      particlesGeo.dispose();
      particlesMat.dispose();
      hammerWaveGeo.dispose();
      hammerWaveMat.dispose();
      envRT.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, [isExpanded]);

  const prevHourIdx = (currentWeather.hourIndex + 23) % 24;
  const nextHourIdx = (currentWeather.hourIndex + 1) % 24;

  const handleLogFinding = () => {
    if (onLogVerticalPlumeEvidence) {
      onLogVerticalPlumeEvidence({
        hourIndex: currentWeather.hourIndex,
        hourLabel: currentWeather.hourLabel,
        pasquillClass: currentWeather.pasquillClass,
        windSpeedMs: currentWeather.windSpeed10m,
        plumeDirectionDeg,
        sliceDistanceMeters,
        sigmaZAtSliceMeters: verticalMetrics.sigmaZ,
        plumeTopHeightMeters: verticalMetrics.plumeTopHeightMeters,
        floorQuots: verticalMetrics.floorQuots,
      });
    }
    setLoggedConfirmation(true);
    window.setTimeout(() => setLoggedConfirmation(false), 3800);
  };

  return (
    <section
      aria-label="3D-visualisering af støvfanens vertikale udbredelse over Ringparken"
      className="rounded-md bg-[var(--surface-panel)] border border-[var(--border-subtle)] border-l-4 border-l-sky-400 overflow-hidden font-mono text-xs"
    >
      {/* Top Header Bar */}
      <div className="px-3 py-2 bg-[#0B1220] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 font-extrabold text-[11px] flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span>3D VERTIKAL STØVFANE-UDBREDELSE OVER RINGPARKEN (σ_z &amp; ETAGEPROFIL)</span>
          </span>

          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-bold text-[11px] inline-flex items-center gap-1.5 tabular-nums">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>{dateIso}</span>
            <span>·</span>
            <Clock className="w-3 h-3 shrink-0" />
            <span>kl. {currentWeather.hourLabel}</span>
          </span>

          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-300 text-[11px]">
            Pasquill <strong className="text-white">{currentWeather.pasquillClass}</strong> · Vind{' '}
            <strong className="text-white">{currentWeather.windSpeed10m.toFixed(1)} m/s</strong> (stød{' '}
            {currentWeather.windGusts10m.toFixed(1)} m/s) · Fane mod{' '}
            <strong className="text-amber-300">
              {plumeDirectionDeg}° ({compassLabelDa(plumeDirectionDeg)})
            </strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Hour Stepper directly in the 3D box header */}
          <div className="inline-flex items-center rounded bg-slate-900 border border-slate-700 p-0.5">
            <button
              type="button"
              onClick={() => onSelectHour(prevHourIdx)}
              className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-0.5 text-[11px] cursor-pointer"
              title="Forrige time"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>{String(prevHourIdx).padStart(2, '0')}:00</span>
            </button>
            <span className="px-2 py-0.5 text-[11px] font-extrabold text-amber-300">
              kl. {currentWeather.hourLabel}
            </span>
            <button
              type="button"
              onClick={() => onSelectHour(nextHourIdx)}
              className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-0.5 text-[11px] cursor-pointer"
              title="Næste time"
            >
              <span>{String(nextHourIdx).padStart(2, '0')}:00</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsTallViewport((prev) => !prev)}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            title="Skift højde på 3D-boksen"
          >
            {isTallViewport ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            <span>{isTallViewport ? 'Standard 3D-Boks' : 'Udvid 3D-Boks'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{isExpanded ? 'Minimer' : 'Vis 3D-Boks'}</span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Main 12-Column Grid: 8 Cols Interactive Three.js 3D Viewport + 4 Cols Vertical Altitude Telemetry */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* LEFT 8 COLS: Dedicated Three.js 3D Viewport */}
            <div className="lg:col-span-8 flex flex-col rounded border border-slate-800 bg-[#070B14] overflow-hidden relative">
              {/* Solid Top-Left Telemetry Overlay (No backdrop-filter over WebGL canvas) */}
              <div className="px-2.5 py-1.5 bg-[#0A0F1D] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-cyan-300 font-bold flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      Kildehøjde H_eff = <strong className="text-white">{verticalMetrics.hEff.toFixed(1)} m</strong>
                    </span>
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-amber-300">
                    Vertikal spredning σ_z({sliceDistanceMeters}m) ={' '}
                    <strong className="text-white">{verticalMetrics.sigmaZ.toFixed(1)} m</strong>
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-rose-300">
                    Fanetop Z_max ={' '}
                    <strong className="text-white">{verticalMetrics.plumeTopHeightMeters.toFixed(1)} m</strong> (Tag = 12,0 m)
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-fuchsia-300 font-bold inline-flex items-center gap-1">
                    <Hammer className="w-3 h-3 shrink-0" />
                    <span>
                      Betonhammer Refraktion (kl. {currentWeather.hourLabel}):{' '}
                      <strong className="text-white">+{verticalMetrics.hourlyRefractionDb.toFixed(1)} dB</strong>{' '}
                      (Spids {verticalMetrics.hammerImpulseLafmaxDb.toFixed(1)} dB)
                    </span>
                  </span>
                </div>

                {/* Camera Presets */}
                <div className="flex flex-wrap items-center gap-1">
                  <Camera className="w-3 h-3 text-slate-400" />
                  {(
                    [
                      { id: 'isometric', label: '3D Skråfoto' },
                      { id: 'side_profile', label: 'Vertikal Sideprofil (z)' },
                      { id: 'downwind_axis', label: 'Langs Vindaksen' },
                      { id: 'top_overview', label: 'Top-Oversigt' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setCameraPreset(preset.id)}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                        cameraPreset === preset.id
                          ? 'bg-cyan-400 text-slate-950 border-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Three.js Canvas Mount Container */}
              <div
                ref={mountRef}
                className={`w-full relative ${isTallViewport ? 'h-[460px]' : 'h-[320px]'}`}
              />

              {/* Bottom Control Dock below WebGL Canvas */}
              <div className="px-3 py-2 bg-[#0A0F1D] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-cyan-200">
                    <span className="font-bold">Tværsnits-afstand x:</span>
                    <input
                      type="range"
                      min={30}
                      max={300}
                      step={10}
                      value={sliceDistanceMeters}
                      onChange={(e) => setSliceDistanceMeters(Number(e.target.value))}
                      className="w-24 accent-cyan-400 cursor-pointer"
                    />
                    <span className="text-white font-extrabold w-12">{sliceDistanceMeters} m</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-amber-200">
                    <span className="font-bold">Horisontalt snit z:</span>
                    <input
                      type="range"
                      min={1.5}
                      max={22.0}
                      step={0.5}
                      value={horizontalCutHeightMeters}
                      onChange={(e) => setHorizontalCutHeightMeters(Number(e.target.value))}
                      className="w-24 accent-amber-400 cursor-pointer"
                    />
                    <span className="text-white font-extrabold w-12">
                      {horizontalCutHeightMeters.toFixed(1)} m
                    </span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showVerticalSlicePlane}
                      onChange={(e) => setShowVerticalSlicePlane(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    <span>Vis vertikalt tværsnitsplan (y-z)</span>
                  </label>

                  <label className="flex items-center gap-1 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showInversionLid}
                      onChange={(e) => setShowInversionLid(e.target.checked)}
                      className="accent-rose-400"
                    />
                    <span>Vis blandingshøjde ({verticalMetrics.mixingLidM} m)</span>
                  </label>

                  <label className="flex items-center gap-1 text-fuchsia-300 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHydraulicHammerImpulse3D}
                      onChange={(e) => setShowHydraulicHammerImpulse3D(e.target.checked)}
                      className="accent-fuchsia-400"
                    />
                    <span className="inline-flex items-center gap-1">
                      <Hammer className="w-3 h-3 shrink-0" />
                      <span>
                        Impuls-støjbølger fra betonhammere (+{verticalMetrics.hourlyRefractionDb.toFixed(1)} dB)
                      </span>
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setCameraPreset('isometric');
                      if (applyCameraPresetRef.current) {
                        applyCameraPresetRef.current('isometric');
                      }
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
                    title="Nulstil 3D-kamera"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Nulstil Kamera</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT 4 COLS: Analytical Vertical Elevation Profile C(z) & Floor-by-Floor Exposure */}
            <div className="lg:col-span-4 rounded border border-slate-800 bg-[#0A101F] p-2.5 flex flex-col justify-between space-y-2.5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-1 border-b border-slate-800 pb-1.5">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase text-cyan-300">
                      Vertikal Koncentrationsprofil C(z) ved x = {sliceDistanceMeters} m
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {pgSpec.labelDa}
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-extrabold shrink-0 ${
                      verticalMetrics.plumeTopHeightMeters >= 12.0
                        ? 'bg-rose-500/20 border border-rose-400/60 text-rose-300'
                        : 'bg-amber-500/20 border border-amber-400/60 text-amber-300'
                    }`}
                  >
                    {verticalMetrics.plumeTopHeightMeters >= 12.0
                      ? 'DÆKKER ALLE 4 ETAGER + TAG'
                      : 'KONCENTRERET I BOLIGHØJDE'}
                  </span>
                </div>

                {/* 2D Analytical Vertical Gaussian Profile SVG alongside 3D Box */}
                <svg
                  viewBox="0 0 280 132"
                  className="w-full h-32 rounded bg-[#060911] border border-slate-800/90"
                  role="img"
                  aria-label="Vertikal Gaussisk støvfane-profil fra 0 til 25 meters højde"
                >
                  {/* Altitude grid lines */}
                  {[0, 4.8, 8.2, 12.0, 18.0, 24.0].map((zM) => {
                    const py = 118 - (zM / 26.0) * 102;
                    const isRoof = zM === 12.0;
                    return (
                      <g key={`vprof-grid-${zM}`}>
                        <line
                          x1="42"
                          y1={py}
                          x2="268"
                          y2={py}
                          stroke={isRoof ? '#f59e0b' : '#1e293b'}
                          strokeWidth={isRoof ? '1.1' : '0.8'}
                          strokeDasharray={isRoof ? '3 2' : '2 2'}
                        />
                        <text
                          x="6"
                          y={py + 3}
                          fill={isRoof ? '#fcd34d' : '#94a3b8'}
                          fontSize="9.5"
                          fontWeight={isRoof ? 'bold' : 'normal'}
                        >
                          {zM.toFixed(1)}m
                        </text>
                      </g>
                    );
                  })}

                  {/* Building Silhouette (0 to 12m) */}
                  <rect
                    x="44"
                    y={118 - (12.0 / 26.0) * 102}
                    width="26"
                    height={(12.0 / 26.0) * 102}
                    fill="#1e3a5f"
                    fillOpacity="0.55"
                    stroke="#38bdf8"
                    strokeWidth="0.9"
                  />
                  <text x="47" y="114" fill="#bae6fd" fontSize="9.5">
                    Stue
                  </text>
                  <text x="47" y="99" fill="#bae6fd" fontSize="9.5">
                    1.sal
                  </text>
                  <text x="47" y="86" fill="#bae6fd" fontSize="9.5">
                    2.sal
                  </text>
                  <text x="47" y="75" fill="#bae6fd" fontSize="9.5">
                    3.sal
                  </text>

                  {/* Vertical Gaussian Curve S(z) */}
                  {(() => {
                    const maxS = Math.max(
                      1.2,
                      ...verticalMetrics.floorQuots.map((f) => f.sQuotient)
                    );
                    const pts: string[] = [];
                    for (let i = 0; i <= 26; i++) {
                      const zM = i;
                      const py = 118 - (zM / 26.0) * 102;
                      const term1 = Math.exp(
                        -Math.pow(zM - verticalMetrics.hEff, 2) /
                          (2 * verticalMetrics.sigmaZ * verticalMetrics.sigmaZ)
                      );
                      const term2 = Math.exp(
                        -Math.pow(zM + verticalMetrics.hEff, 2) /
                          (2 * verticalMetrics.sigmaZ * verticalMetrics.sigmaZ)
                      );
                      const norm = Math.min(1.0, (term1 + term2) / 1.35);
                      const px = 76 + norm * 176 * Math.min(1, maxSiteSumQuotient / maxS + 0.35);
                      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
                    }
                    const areaPoints = `76,118 ${pts.join(' ')} 76,16`;
                    return (
                      <>
                        <polygon points={areaPoints} fill="#f43f5e" fillOpacity="0.22" />
                        <polyline
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth="2.2"
                          points={pts.join(' ')}
                        />
                      </>
                    );
                  })()}

                  {/* Horizontal Cut Indicator Line */}
                  {(() => {
                    const cutPy = 118 - (Math.min(25, horizontalCutHeightMeters) / 26.0) * 102;
                    return (
                      <g>
                        <line
                          x1="42"
                          y1={cutPy}
                          x2="268"
                          y2={cutPy}
                          stroke="#22d3ee"
                          strokeWidth="1.4"
                        />
                        <text x="165" y={Math.max(12, cutPy - 3)} fill="#67e8f9" fontSize="9.5" fontWeight="bold">
                          Snit z={horizontalCutHeightMeters.toFixed(1)}m (S={verticalMetrics.cutHeightS.toFixed(2)})
                        </text>
                      </g>
                    );
                  })()}
                </svg>

                {/* Floor-by-Floor Exposure Breakdown */}
                <div className="space-y-1">
                  {verticalMetrics.floorQuots.map((fl) => {
                    const isCritical = fl.sQuotient >= 1.0;
                    const isElevated = fl.sQuotient >= 0.5 && fl.sQuotient < 1.0;
                    const barPct = Math.min(100, Math.round((fl.sQuotient / 1.5) * 100));
                    return (
                      <div
                        key={fl.label}
                        onClick={() => setHorizontalCutHeightMeters(fl.zMeters)}
                        className="p-1.5 rounded bg-slate-950/90 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-200 font-semibold">{fl.label}</span>
                          <span
                            className={`font-extrabold ${
                              isCritical
                                ? 'text-rose-400'
                                : isElevated
                                ? 'text-amber-300'
                                : 'text-emerald-300'
                            }`}
                          >
                            S(z) = {fl.sQuotient.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1">
                          <div
                            className={`h-full ${
                              isCritical
                                ? 'bg-rose-500'
                                : isElevated
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Log Vertical 3D Plume Finding to Beviser (SHA-256) */}
              <button
                type="button"
                onClick={handleLogFinding}
                className={`w-full px-3 py-1.5 rounded font-mono text-[11px] font-extrabold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  loggedConfirmation
                    ? 'bg-emerald-400 text-slate-950 border-white'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-200'
                }`}
                title="Registrér den vertikale 3D-støvfaneudbredelse og etage-eksponering for den valgte time i Beviser med SHA-256 signatur"
              >
                {loggedConfirmation ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {loggedConfirmation
                    ? `3D Vertikal Støvfane (kl. ${currentWeather.hourLabel}) Føjet til Beviser`
                    : `Føj 3D Vertikal Faneprofil (kl. ${currentWeather.hourLabel}) til Beviser`}
                </span>
              </button>
            </div>
          </div>

          {/* 24-Hour Quick Timeline Bar for Inspecting Vertical Plume Spread Across All Hours */}
          <div className="px-2.5 py-1.5 rounded bg-[#0B1220] border border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vælg time for 3D vertikal støvfane:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {hours.map((h) => {
                const isSelected = h.hourIndex === currentWeather.hourIndex;
                return (
                  <button
                    key={`vplume-hr-${h.hourIndex}`}
                    type="button"
                    onClick={() => onSelectHour(h.hourIndex)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-400 text-slate-950 border-white font-extrabold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                    title={`kl. ${h.hourLabel} · Vind ${h.windSpeed10m} m/s · Pasquill ${h.pasquillClass}`}
                  >
                    {String(h.hourIndex).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
