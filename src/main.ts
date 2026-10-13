import './style.css';
import * as THREE from 'three';

// A quiet field of drifting motes behind the page. Everything visible lives in
// index.html, so the page still reads correctly if WebGL is unavailable.

const canvas = document.querySelector<HTMLCanvasElement>('#bg');
if (canvas) {
  try {
    start(canvas);
  } catch (err) {
    console.warn('WebGL scene disabled:', err);
    canvas.remove();
  }
}

function start(canvas: HTMLCanvasElement) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.z = 7;

  const COUNT = 700;
  const SPREAD = { x: 18, y: 12, z: 8 };
  const positions = new Float32Array(COUNT * 3);
  const speeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * SPREAD.x;
    positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD.y;
    positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD.z;
    speeds[i] = 0.08 + Math.random() * 0.18;
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute('position', positionAttr);

  const material = new THREE.PointsMaterial({
    color: 0xe6c79c,
    size: 0.045,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: true,
    depthWrite: false,
  });

  const motes = new THREE.Points(geometry, material);
  scene.add(motes);

  function resize() {
    const { innerWidth: w, innerHeight: h } = window;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const timer = new THREE.Timer();

  function frame() {
    timer.update();
    const t = timer.getElapsed();
    const dt = Math.min(timer.getDelta(), 0.05);

    for (let i = 0; i < COUNT; i++) {
      let y = positions[i * 3 + 1] + speeds[i] * dt;
      if (y > SPREAD.y / 2) y -= SPREAD.y;
      positions[i * 3 + 1] = y;
    }
    positionAttr.needsUpdate = true;

    motes.rotation.y = t * 0.02;
    camera.position.x = Math.sin(t * 0.12) * 0.3;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    if (!reducedMotion) requestAnimationFrame(frame);
  }

  frame();
}
