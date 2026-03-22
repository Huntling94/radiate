/**
 * WASD exploration camera with mouse orbit and scroll zoom.
 * Camera target moves with WASD; orbit wraps around the moving target.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOVE_SPEED = 30;
const ORBIT_SENSITIVITY = 0.005;
const ZOOM_SPEED = 3;
const MIN_DISTANCE = 5;
const MAX_DISTANCE = 120;
const MIN_PITCH = 0.15;
const MAX_PITCH = Math.PI / 2 - 0.05;
const LERP_FACTOR = 0.08;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  orbitAngle: number;
  orbitPitch: number;
  distance: number;
  keys: Set<string>;
  isDragging: boolean;
  lastMouseX: number;
  lastMouseY: number;
  update: (delta: number, getHeight: (x: number, z: number) => number) => void;
  handleResize: (width: number, height: number) => void;
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createCameraRig(canvas: HTMLCanvasElement): CameraRig {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 800);
  const target = new THREE.Vector3(0, 0, 0);
  let orbitAngle = Math.PI / 4;
  let orbitPitch = 0.6;
  let distance = 40;
  const keys = new Set<string>();
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // Smooth camera position
  const smoothCamPos = new THREE.Vector3();
  let initialised = false;

  // Key handlers
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.key.toLowerCase());
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase());
  };
  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  };
  const onMouseUp = () => {
    isDragging = false;
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    orbitAngle -= dx * ORBIT_SENSITIVITY;
    orbitPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, orbitPitch + dy * ORBIT_SENSITIVITY));
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    distance = Math.max(
      MIN_DISTANCE,
      Math.min(MAX_DISTANCE, distance + e.deltaY * 0.01 * ZOOM_SPEED),
    );
  };
  const onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);

  function update(delta: number, getHeight: (x: number, z: number) => number): void {
    // WASD movement relative to camera facing (horizontal plane)
    const forward = new THREE.Vector3(-Math.sin(orbitAngle), 0, -Math.cos(orbitAngle));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const moveSpeed = MOVE_SPEED * delta;

    if (keys.has('w')) target.addScaledVector(forward, moveSpeed);
    if (keys.has('s')) target.addScaledVector(forward, -moveSpeed);
    if (keys.has('a')) target.addScaledVector(right, -moveSpeed);
    if (keys.has('d')) target.addScaledVector(right, moveSpeed);

    // Keep target on terrain
    const terrainY = getHeight(target.x, target.z);
    target.y = terrainY;

    // Compute camera position from orbit parameters
    const desiredPos = new THREE.Vector3(
      target.x + Math.sin(orbitAngle) * Math.cos(orbitPitch) * distance,
      target.y + Math.sin(orbitPitch) * distance,
      target.z + Math.cos(orbitAngle) * Math.cos(orbitPitch) * distance,
    );

    // Smooth interpolation
    if (!initialised) {
      smoothCamPos.copy(desiredPos);
      initialised = true;
    } else {
      smoothCamPos.lerp(desiredPos, LERP_FACTOR);
    }

    camera.position.copy(smoothCamPos);
    camera.lookAt(target.x, target.y + 2, target.z);
  }

  function handleResize(width: number, height: number): void {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function dispose(): void {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);
  }

  const rig: CameraRig = {
    camera,
    target,
    get orbitAngle() {
      return orbitAngle;
    },
    set orbitAngle(v) {
      orbitAngle = v;
    },
    get orbitPitch() {
      return orbitPitch;
    },
    set orbitPitch(v) {
      orbitPitch = v;
    },
    get distance() {
      return distance;
    },
    set distance(v) {
      distance = v;
    },
    keys,
    get isDragging() {
      return isDragging;
    },
    set isDragging(v) {
      isDragging = v;
    },
    get lastMouseX() {
      return lastMouseX;
    },
    set lastMouseX(v) {
      lastMouseX = v;
    },
    get lastMouseY() {
      return lastMouseY;
    },
    set lastMouseY(v) {
      lastMouseY = v;
    },
    update,
    handleResize,
    dispose,
  };

  return rig;
}
