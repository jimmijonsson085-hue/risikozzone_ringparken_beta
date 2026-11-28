/**
 * @file src/components/RiskGis3DBuildingsView.tsx
 * @description Interaktiv Three.js 3D-bygningsmodelvisning til 'RiskGIS'-tilstanden
 * med glidende kamera-tilt og bygnings-ekstruderingsanimation ved skift mellem
 * 2D-kortvisning og 3D-bygningsmodeller.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Box, Compass, Layers, RotateCcw } from 'lucide-react';
import {
  PROTECTED_FEATURES,
  RINGPARKEN_BUILDINGS,
} from '../constants/ringparkenData';
import { RingparkenBuilding } from '../types';
import { ReceptorExposureResultDetails } from '../utils/riskEngine';

export interface RiskGisLayerVisibility {
  demolitionAndShelters: boolean;
  receptorRiskChoropleth: boolean;
  basementAsbestosDust: boolean;
  envelopeAndCav: boolean;
  hydrologyAndLar: boolean;
  protectedTreesAndBats: boolean;
}

export interface RiskGis3DBuildingsViewProps {
  windFromDeg: number;
  windSpeedMs: number;
  isDryWeather: boolean;
  selectedBuildingId: string | null;
  exposureByBuildingId: Map<string, ReceptorExposureResultDetails>;
  layers: RiskGisLayerVisibility;
  onSelectBuilding: (building: RingparkenBuilding) => void;
  transitionTriggerKey: number;
  isExitingTo2D?: boolean;
}

const GIS_ORIGIN_LAT = 55.4153;
const GIS_ORIGIN_LNG = 11.3555;
const METERS_PER_UNIT = 2.0;

function latLngToWorldXZ(lat: number, lng: number): { x: number; z: number } {
  const latRad = (GIS_ORIGIN_LAT * Math.PI) / 180;
  const metersNorth = (lat - GIS_ORIGIN_LAT) * 111320;
  const metersEast = (lng - GIS_ORIGIN_LNG) * 111320 * Math.cos(latRad);
  return {
    x: metersEast / METERS_PER_UNIT,
    z: -metersNorth / METERS_PER_UNIT,
  };
}

function getBuildingFootprintDimensions(b: RingparkenBuilding): {
  axisDeg: number;
  lengthM: number;
  widthM: number;
  floors: number;
} {
  if (b.id === 'byg-1-kierulffsvej-2') {
    return { axisDeg: 22, lengthM: 34, widthM: 16, floors: 2 };
  }
  if (b.id === 'byg-2-kierulffsvej-12') {
    return { axisDeg: 8, lengthM: 44, widthM: 24, floors: 2 };
  }
  if (b.id === 'byg-3-valbyvej-58') {
    return { axisDeg: 90, lengthM: 38, widthM: 18, floors: 2 };
  }
  if (b.id === 'nordcentret-4') {
    return { axisDeg: 82, lengthM: 46, widthM: 22, floors: 2 };
  }
  if (b.id === 'albert-ibsens-vej-1-5-etape3') {
    return { axisDeg: 80, lengthM: 42, widthM: 16, floors: 2 };
  }
  if (b.fobDepartment === 'Nabo') {
    return { axisDeg: 85, lengthM: 24, widthM: 16, floors: 2 };
  }
  if (b.id.startsWith('blok-1-') || b.id.startsWith('blok-2-')) {
    return { axisDeg: 12, lengthM: 68, widthM: 14, floors: 3 };
  }
  if (b.id.includes('albert-ibsens') || b.id.includes('jacob-dampes')) {
    return { axisDeg: 82, lengthM: 72, widthM: 14, floors: 3 };
  }
  return { axisDeg: 16, lengthM: 68, widthM: 14, floors: 3 };
}

function getRiskColorHex(riskLevel: ReceptorExposureResultDetails['riskLevel']): number {
  switch (riskLevel) {
    case 'KRITISK':
      return 0xef4444;
    case 'HØJ':
      return 0xf97316;
    case 'MODERAT':
      return 0xf59e0b;
    case 'LAV':
    default:
      return 0x10b981;
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}

export const RiskGis3DBuildingsView: React.FC<RiskGis3DBuildingsViewProps> = ({
  windFromDeg,
  windSpeedMs,
  isDryWeather,
  selectedBuildingId,
  exposureByBuildingId,
  layers,
  onSelectBuilding,
  transitionTriggerKey,
  isExitingTo2D = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredBuildingName, setHoveredBuildingName] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<'perspective' | 'topdown'>('perspective');

  const onSelectBuildingRef = useRef(onSelectBuilding);
  onSelectBuildingRef.current = onSelectBuilding;

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    buildingGroups: Map<
      string,
      {
        group: THREE.Group;
        bodyMesh: THREE.Mesh;
        roofMesh: THREE.Mesh;
        collarMesh: THREE.Mesh;
        selectionRing: THREE.Mesh;
        building: RingparkenBuilding;
      }
    >;
    windGroup: THREE.Group;
    treesGroup: THREE.Group;
    hydroGroup: THREE.Group;
    animTarget: {
      active: boolean;
      startMs: number;
      durationMs: number;
      fromPos: THREE.Vector3;
      toPos: THREE.Vector3;
      fromTarget: THREE.Vector3;
      toTarget: THREE.Vector3;
      extrudeFrom: number;
      extrudeTo: number;
    };
    currentExtrudeScale: number;
  } | null>(null);

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') || probe.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param) || '');
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(320, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);
    scene.fog = new THREE.FogExp2(0x070b14, 0.0022);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.5, 1400);
    // Start directly overhead (2D map-like nadir) and smoothly sweep down into 3D perspective
    camera.position.set(0, 290, 22);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 42;
    controls.maxDistance = 390;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.target.set(0, 0, 0);

    // Lighting rig
    const hemi = new THREE.HemisphereLight(0xcbe7ff, 0x162032, 1.15);
    scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfff5e4, 1.55);
    sunLight.position.set(110, 180, 95);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 20;
      sunLight.shadow.camera.far = 480;
      const d = 190;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
    }
    scene.add(sunLight);

    // Ground plane + GIS tactical grid
    const groundGeo = new THREE.PlaneGeometry(780, 780);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0b1220,
      roughness: 0.94,
      metalness: 0.04,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = !isSoftwareGl;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(460, 46, 0x1e3a5f, 0x132033);
    gridHelper.position.y = 0.05;
    scene.add(gridHelper);

    // Build Ringparken 3D Building Models (multi-part THREE.Group per building)
    const buildingGroups = new Map<
      string,
      {
        group: THREE.Group;
        bodyMesh: THREE.Mesh;
        roofMesh: THREE.Mesh;
        collarMesh: THREE.Mesh;
        selectionRing: THREE.Mesh;
        building: RingparkenBuilding;
      }
    >();
    const clickableMeshes: THREE.Mesh[] = [];

    for (const b of RINGPARKEN_BUILDINGS) {
      const { x, z } = latLngToWorldXZ(b.coordinates.lat, b.coordinates.lng);
      const { axisDeg, lengthM, widthM, floors } = getBuildingFootprintDimensions(b);
      const unitW = widthM / METERS_PER_UNIT;
      const unitL = lengthM / METERS_PER_UNIT;
      const unitH = Math.max(2.6, (floors * 3.2) / METERS_PER_UNIT);

      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = (-axisDeg * Math.PI) / 180;

      // 1. Foundation Plinth (bottom-center flush with ground)
      const plinthGeo = new THREE.BoxGeometry(unitW + 0.7, 0.55, unitL + 0.7);
      const plinthMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.92,
        metalness: 0.08,
      });
      const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
      plinthMesh.position.y = 0.275;
      plinthMesh.receiveShadow = !isSoftwareGl;
      group.add(plinthMesh);

      // 2. Main Extruded Building Block (pivoted at base for smooth height extrusion)
      const bodyGeo = new THREE.BoxGeometry(unitW, unitH, unitL);
      bodyGeo.translate(0, unitH / 2, 0);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.72,
        metalness: 0.14,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.position.y = 0.55;
      bodyMesh.castShadow = !isSoftwareGl;
      bodyMesh.receiveShadow = !isSoftwareGl;
      bodyMesh.userData = { buildingId: b.id, buildingName: b.name };
      group.add(bodyMesh);
      clickableMeshes.push(bodyMesh);

      // 3. Roof Parapet / Cap (contrasting roughness)
      const roofGeo = new THREE.BoxGeometry(unitW * 0.94, 0.5, unitL * 0.94);
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.42,
        metalness: 0.35,
      });
      const roofMesh = new THREE.Mesh(roofGeo, roofMat);
      roofMesh.position.y = 0.55 + unitH + 0.25;
      roofMesh.userData = { buildingId: b.id, buildingName: b.name };
      group.add(roofMesh);
      clickableMeshes.push(roofMesh);

      // 4. COWI/CAV or Demolition Rim Collar
      const collarGeo = new THREE.BoxGeometry(unitW + 0.45, 0.45, unitL + 0.45);
      const collarMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0x7c2d12,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        metalness: 0.25,
      });
      const collarMesh = new THREE.Mesh(collarGeo, collarMat);
      collarMesh.position.y = 0.55 + unitH * 0.78;
      collarMesh.visible = false;
      group.add(collarMesh);

      // 5. Selection Highlight Base Ring
      const selGeo = new THREE.RingGeometry(
        Math.max(unitW, unitL) * 0.62,
        Math.max(unitW, unitL) * 0.72,
        32
      );
      selGeo.rotateX(-Math.PI / 2);
      const selMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      });
      const selectionRing = new THREE.Mesh(selGeo, selMat);
      selectionRing.position.y = 0.16;
      selectionRing.visible = false;
      group.add(selectionRing);

      // Start slightly flattened so opening glides smoothly upward
      bodyMesh.scale.y = 0.08;
      roofMesh.position.y = 0.55 + unitH * 0.08 + 0.25;
      collarMesh.position.y = 0.55 + unitH * 0.08 * 0.78;

      scene.add(group);
      buildingGroups.set(b.id, {
        group,
        bodyMesh,
        roofMesh,
        collarMesh,
        selectionRing,
        building: b,
      });
    }

    // Protected Trees & Bats Group
    const treesGroup = new THREE.Group();
    for (const pf of PROTECTED_FEATURES) {
      const { x, z } = latLngToWorldXZ(pf.coordinates.lat, pf.coordinates.lng);
      const isBat = pf.category === 'Flagermus-screeningzone';
      const treeGrp = new THREE.Group();
      treeGrp.position.set(x, 0, z);

      if (isBat) {
        const ringGeo = new THREE.RingGeometry(3.2, 4.4, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xa855f7,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.65,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.2;
        treeGrp.add(ring);
      } else {
        const trunkGeo = new THREE.CylinderGeometry(0.45, 0.7, 3.2, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.6;
        treeGrp.add(trunk);

        const crownGeo = new THREE.ConeGeometry(2.8, 5.2, 10);
        const crownMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.y = 5.0;
        treeGrp.add(crown);
      }
      treesGroup.add(treeGrp);
    }
    scene.add(treesGroup);

    // Hydrology Depression Ring (Kierulffsvej 12)
    const hydroGroup = new THREE.Group();
    const lavPos = latLngToWorldXZ(55.41472, 11.35218);
    const hydroGeo = new THREE.CircleGeometry(31, 40);
    hydroGeo.rotateX(-Math.PI / 2);
    const hydroMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });
    const hydroCircle = new THREE.Mesh(hydroGeo, hydroMat);
    hydroCircle.position.set(lavPos.x, 0.12, lavPos.z);
    hydroGroup.add(hydroCircle);
    scene.add(hydroGroup);

    // Wind Cones Group
    const windGroup = new THREE.Group();
    scene.add(windGroup);

    sceneRefs.current = {
      scene,
      camera,
      controls,
      buildingGroups,
      windGroup,
      treesGroup,
      hydroGroup,
      animTarget: {
        active: true,
        startMs: performance.now(),
        durationMs: 680,
        fromPos: new THREE.Vector3(0, 290, 22),
        toPos: new THREE.Vector3(-85, 138, 155),
        fromTarget: new THREE.Vector3(0, 0, 0),
        toTarget: new THREE.Vector3(0, 0, 0),
        extrudeFrom: 0.08,
        extrudeTo: 1.0,
      },
      currentExtrudeScale: 0.08,
    };

    // Raycasting for hover & click selection
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moved > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const bId = hits[0].object.userData?.buildingId as string | undefined;
        if (bId) {
          const found = RINGPARKEN_BUILDINGS.find((b) => b.id === bId);
          if (found) onSelectBuildingRef.current(found);
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const name = hits[0].object.userData?.buildingName as string | undefined;
        setHoveredBuildingName(name ?? null);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredBuildingName(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (!container) return;
            const w = Math.max(200, container.clientWidth);
            const h = Math.max(200, container.clientHeight);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
          })
        : null;
    resizeObserver?.observe(container);

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const refs = sceneRefs.current;
      if (refs && refs.animTarget.active) {
        const elapsed = performance.now() - refs.animTarget.startMs;
        const rawT = Math.min(1, elapsed / refs.animTarget.durationMs);
        const eased = easeOutCubic(rawT);

        camera.position.lerpVectors(
          refs.animTarget.fromPos,
          refs.animTarget.toPos,
          eased
        );
        controls.target.lerpVectors(
          refs.animTarget.fromTarget,
          refs.animTarget.toTarget,
          eased
        );

        const extScale =
          refs.animTarget.extrudeFrom +
          (refs.animTarget.extrudeTo - refs.animTarget.extrudeFrom) * eased;
        refs.currentExtrudeScale = extScale;

        refs.buildingGroups.forEach((entry) => {
          const { floors } = getBuildingFootprintDimensions(entry.building);
          const unitH = Math.max(2.6, (floors * 3.2) / METERS_PER_UNIT);
          entry.bodyMesh.scale.y = extScale;
          entry.roofMesh.position.y = 0.55 + unitH * extScale + 0.25;
          entry.collarMesh.position.y = 0.55 + unitH * extScale * 0.78;
        });

        if (rawT >= 1) {
          refs.animTarget.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      controls.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRefs.current = null;
    };
  }, []);

  // Trigger smooth camera & building extrusion transition when entering 3D or exiting to 2D
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    if (isExitingTo2D) {
      refs.animTarget = {
        active: true,
        startMs: performance.now(),
        durationMs: 440,
        fromPos: refs.camera.position.clone(),
        toPos: new THREE.Vector3(0, 290, 18),
        fromTarget: refs.controls.target.clone(),
        toTarget: new THREE.Vector3(0, 0, 0),
        extrudeFrom: refs.currentExtrudeScale,
        extrudeTo: 0.08,
      };
    } else {
      refs.animTarget = {
        active: true,
        startMs: performance.now(),
        durationMs: 650,
        fromPos: refs.camera.position.clone(),
        toPos:
          cameraPreset === 'topdown'
            ? new THREE.Vector3(0, 265, 20)
            : new THREE.Vector3(-85, 138, 155),
        fromTarget: refs.controls.target.clone(),
        toTarget: new THREE.Vector3(0, 0, 0),
        extrudeFrom: refs.currentExtrudeScale,
        extrudeTo: cameraPreset === 'topdown' ? 0.35 : 1.0,
      };
    }
  }, [transitionTriggerKey, isExitingTo2D, cameraPreset]);

  // Smoothly update building colors, collars, selection ring, wind cones, and visibility layers
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    refs.treesGroup.visible = layers.protectedTreesAndBats;
    refs.hydroGroup.visible = layers.hydrologyAndLar;

    refs.buildingGroups.forEach((entry, bId) => {
      const b = entry.building;
      const isDemolition = b.stage === 'Aktiv nedrivning (2026)';
      const isPlanned = b.stage === 'Planlagt nedrivning (Etape 2/3)';
      const isInhabited = b.stage === 'Beboet / Renoveres';
      const isNeighbor = b.stage === 'Ekstern nabo / Institution';
      const isSelected = bId === selectedBuildingId;
      const exposure = exposureByBuildingId.get(bId);

      const mat = entry.bodyMesh.material as THREE.MeshStandardMaterial;
      let colorHex = 0x475569;
      let emissiveHex = 0x000000;
      let emissiveIntensity = 0;

      if (isDemolition) {
        colorHex = layers.demolitionAndShelters ? 0xdc2626 : 0x7f1d1d;
        emissiveHex = 0x7f1d1d;
        emissiveIntensity = 0.45;
      } else if (isPlanned) {
        colorHex = 0xd97706;
      } else if (layers.receptorRiskChoropleth && exposure && (isInhabited || isNeighbor)) {
        colorHex = getRiskColorHex(exposure.riskLevel);
      }

      if (isSelected) {
        emissiveHex = 0x0284c7;
        emissiveIntensity = 0.55;
      }

      mat.color.setHex(colorHex);
      mat.emissive.setHex(emissiveHex);
      mat.emissiveIntensity = emissiveIntensity;

      const hasEnvelopeRisk =
        layers.envelopeAndCav &&
        (b.fobDepartment === 'Afd. 023' || b.fobDepartment === 'Afd. 024') &&
        (b.cowiJointFailurePct >= 50 || b.hasCavNegativePressure);
      entry.collarMesh.visible = (hasEnvelopeRisk && !isDemolition) || (layers.basementAsbestosDust && b.hasBasementAsbestosDust);
      (entry.collarMesh.material as THREE.MeshStandardMaterial).color.setHex(
        layers.basementAsbestosDust && b.hasBasementAsbestosDust && !hasEnvelopeRisk
          ? 0xfb7185
          : 0xf97316
      );

      entry.selectionRing.visible = isSelected;
    });

    // Rebuild 3D wind cones cleanly
    while (refs.windGroup.children.length > 0) {
      const child = refs.windGroup.children[0];
      refs.windGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    if (windSpeedMs > 0.1) {
      const downwindDeg = ((windFromDeg + 180) % 360 + 360) % 360;
      const scaleLen =
        (Math.max(55, 85 + windSpeedMs * 18) * (isDryWeather ? 1 : 0.62)) /
        METERS_PER_UNIT;
      const coneRad = scaleLen * Math.tan((30 * Math.PI) / 180);

      for (const src of RINGPARKEN_BUILDINGS.filter(
        (b) => b.stage === 'Aktiv nedrivning (2026)'
      )) {
        const { x, z } = latLngToWorldXZ(src.coordinates.lat, src.coordinates.lng);
        const coneGeo = new THREE.ConeGeometry(coneRad, scaleLen, 24, 1, true);
        // Align cone tip at origin and widen along +Z, then rotate to downwindDeg
        coneGeo.translate(0, -scaleLen / 2, 0);
        coneGeo.rotateX(-Math.PI / 2);
        const coneMat = new THREE.MeshBasicMaterial({
          color: isDryWeather ? 0xf59e0b : 0x38bdf8,
          transparent: true,
          opacity: isDryWeather ? 0.24 : 0.14,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);
        coneMesh.position.set(x, 3.2, z);
        // Compass: 0 deg = North (-Z), 90 deg = East (+X)
        const rad = (downwindDeg * Math.PI) / 180;
        coneMesh.rotation.y = Math.atan2(Math.sin(rad), -Math.cos(rad));
        refs.windGroup.add(coneMesh);
      }
    }
  }, [
    selectedBuildingId,
    exposureByBuildingId,
    layers,
    windFromDeg,
    windSpeedMs,
    isDryWeather,
  ]);

  const handleResetCamera = () => {
    setCameraPreset('perspective');
    const refs = sceneRefs.current;
    if (!refs) return;
    refs.animTarget = {
      active: true,
      startMs: performance.now(),
      durationMs: 520,
      fromPos: refs.camera.position.clone(),
      toPos: new THREE.Vector3(-85, 138, 155),
      fromTarget: refs.controls.target.clone(),
      toTarget: new THREE.Vector3(0, 0, 0),
      extrudeFrom: refs.currentExtrudeScale,
      extrudeTo: 1.0,
    };
  };

  return (
    <div
      data-testid="riskgis-3d-buildings-view"
      className="relative w-full h-full min-h-[420px] lg:min-h-[540px] bg-[#070B14] overflow-hidden select-none"
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Top HUD Bar */}
      <div className="pointer-events-none absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="pointer-events-auto px-2.5 py-1 rounded bg-[#0B0F19]/90 border border-[#334155] backdrop-blur-sm text-[11px] font-mono text-slate-200 flex items-center gap-2">
          <Box className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            3D RiskGIS Bygningsmodeller ({RINGPARKEN_BUILDINGS.length} blokke)
          </span>
          {hoveredBuildingName && (
            <span className="text-cyan-300 font-semibold border-l border-[#334155] pl-2 truncate max-w-[180px]">
              {hoveredBuildingName}
            </span>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              setCameraPreset((p) => (p === 'perspective' ? 'topdown' : 'perspective'))
            }
            className="px-2 py-1 rounded bg-[#0B0F19]/90 hover:bg-[#1E293B] border border-[#334155] text-[10.5px] font-mono text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
            title="Skift glidende mellem skrå 3D-vinkel og 2D-fugleperspektiv"
          >
            {cameraPreset === 'perspective' ? (
              <>
                <Compass className="w-3 h-3 text-cyan-400" />
                <span>Fugleperspektiv</span>
              </>
            ) : (
              <>
                <Layers className="w-3 h-3 text-amber-400" />
                <span>3D Skråvinkel</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleResetCamera}
            className="px-2 py-1 rounded bg-[#0B0F19]/90 hover:bg-[#1E293B] border border-[#334155] text-[10.5px] font-mono text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
            title="Nulstil 3D kamera"
          >
            <RotateCcw className="w-3 h-3 text-slate-300" />
            <span>Nulstil</span>
          </button>
        </div>
      </div>

      {/* Bottom Legend */}
      <div className="pointer-events-none absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded bg-[#0B0F19]/85 border border-[#334155] text-[10px] font-mono text-slate-300 flex flex-wrap items-center gap-2.5">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-rose-600 inline-block" /> Nedrivning
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-amber-500 inline-block" /> Planlagt / Moderat
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block" /> Lav risiko
        </span>
        <span className="text-slate-400">Træk for 3D-orbit · Klik bygning for detaljer</span>
      </div>
    </div>
  );
};
