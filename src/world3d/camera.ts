/**
 * WASD exploration camera with mouse orbit and scroll zoom.
 * Camera target moves with WASD; orbit wraps around the moving target.
 * Uses Babylon.js FreeCamera with all default inputs disabled — custom rig only.
 */

import { FreeCamera, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

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
  camera: FreeCamera;
  target: Vector3;
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

export function createCameraRig(canvas: HTMLCanvasElement, scene: Scene): CameraRig {
  const camera = new FreeCamera('camera', new Vector3(0, 20, 0), scene);
  camera.minZ = 0.1;
  camera.maxZ = 800;
  camera.fov = (60 * Math.PI) / 180; // 60 degrees in radians

  // Disable all built-in Babylon camera inputs — we handle input ourselves
  camera.inputs.clear();

  const target = new Vector3(0, 0, 0);
  let orbitAngle = Math.PI / 4;
  let orbitPitch = 0.6;
  let distance = 40;
  const keys = new Set<string>();
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // Smooth camera position — pre-allocated to avoid GC pressure
  const smoothCamPos = new Vector3();
  const _desiredPos = new Vector3(); // temp vector for lerp
  let initialised = false;

  // Key handlers
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.key.toLowerCase());
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase());
  };
  const onMouseDown = (e: MouseEvent) => {
    // Right-click only for orbit — left-click reserved for tool actions
    if (e.button === 2) {
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
    const sinAngle = Math.sin(orbitAngle);
    const cosAngle = Math.cos(orbitAngle);
    const moveSpeed = MOVE_SPEED * delta;

    // Forward/right directions on XZ plane
    const fwdX = -sinAngle;
    const fwdZ = -cosAngle;
    const rightX = cosAngle;
    const rightZ = -sinAngle;

    if (keys.has('w')) {
      target.x += fwdX * moveSpeed;
      target.z += fwdZ * moveSpeed;
    }
    if (keys.has('s')) {
      target.x -= fwdX * moveSpeed;
      target.z -= fwdZ * moveSpeed;
    }
    if (keys.has('a')) {
      target.x -= rightX * moveSpeed;
      target.z -= rightZ * moveSpeed;
    }
    if (keys.has('d')) {
      target.x += rightX * moveSpeed;
      target.z += rightZ * moveSpeed;
    }

    // Keep target on terrain
    target.y = getHeight(target.x, target.z);

    // Compute desired camera position from orbit parameters
    _desiredPos.x = target.x + sinAngle * Math.cos(orbitPitch) * distance;
    _desiredPos.y = target.y + Math.sin(orbitPitch) * distance;
    _desiredPos.z = target.z + cosAngle * Math.cos(orbitPitch) * distance;

    // Smooth interpolation (LerpToRef avoids allocation)
    if (!initialised) {
      smoothCamPos.copyFrom(_desiredPos);
      initialised = true;
    } else {
      Vector3.LerpToRef(smoothCamPos, _desiredPos, LERP_FACTOR, smoothCamPos);
    }

    camera.position.copyFrom(smoothCamPos);
    camera.setTarget(new Vector3(target.x, target.y + 2, target.z));
  }

  function handleResize(_width: number, _height: number): void {
    // Babylon handles camera aspect ratio via engine.resize()
    // This function exists for interface compatibility
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
