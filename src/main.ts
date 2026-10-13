import './style.css';
import * as THREE from 'three';

// Watercolor blooms: a handful of large translucent washes that drift slowly
// behind the page, multiplied onto a paper-coloured canvas. Everything visible
// lives in index.html, so the page still reads if WebGL is unavailable.

const PAPER = 0xf8f4ec;

// colour, opacity, and a home position in [-1, 1] space; x is scaled by aspect.
// Homes sit toward the edges so the middle of the page stays readable.
const PALETTE = [
  { color: 0xa8bf9f, opacity: 0.42, home: [-0.95, 0.55] },  // sage, top left
  { color: 0xecb9bb, opacity: 0.38, home: [0.9, 0.35] },    // blush, right
  { color: 0xe2c47e, opacity: 0.34, home: [-0.8, -0.75] },  // gold, bottom left
  { color: 0xb5cbdd, opacity: 0.38, home: [0.85, -0.7] },   // sky, bottom right
  { color: 0xa8bf9f, opacity: 0.28, home: [0.15, 1.05] },   // sage, top edge
  { color: 0xecb9bb, opacity: 0.26, home: [-0.2, -1.1] },   // blush, bottom edge
];

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  varying vec2 vUv;

  // 2D simplex noise (Ashima Arts, MIT)
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * snoise(p); p *= 2.1; a *= 0.5; }
    return s;
  }

  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);
    float ang = atan(p.y, p.x);

    // ragged, slowly breathing outline
    float outline = fbm(vec2(cos(ang), sin(ang)) * 0.9 + uSeed + uTime * 0.03);
    float radius = 0.34 + 0.07 * outline;

    // uneven pigment inside the wash
    float grain = fbm(p * 3.0 + uSeed * 3.0 + uTime * 0.02);

    float inside = smoothstep(radius, radius - 0.12, r);
    float edgeBand = smoothstep(radius - 0.12, radius - 0.03, r) * (1.0 - smoothstep(radius - 0.03, radius, r));

    float body = inside * (0.6 + 0.2 * grain);
    float a = clamp(body + edgeBand * 0.45, 0.0, 1.0) * uOpacity;

    // premultiplied for custom multiply blending
    gl_FragColor = vec4(uColor * a, a);
  }
`;

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

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(PAPER, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  camera.position.z = 5;

  type Bloom = {
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
    home: THREE.Vector2;
    size: THREE.Vector2;
    phase: number;
    speed: number;
    spin: number;
  };

  const geometry = new THREE.PlaneGeometry(1, 1);
  const blooms: Bloom[] = PALETTE.map((entry, i) => {
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(entry.color) },
        uTime: { value: 0 },
        uSeed: { value: i * 7.31 + 1.7 },
        uOpacity: { value: entry.opacity },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const size = 1.5 + Math.random() * 0.8;
    mesh.rotation.z = Math.random() * Math.PI;
    scene.add(mesh);
    return {
      mesh,
      material,
      home: new THREE.Vector2(entry.home[0], entry.home[1]),
      size: new THREE.Vector2(size, size * (0.8 + Math.random() * 0.4)),
      phase: Math.random() * Math.PI * 2,
      speed: 0.04 + Math.random() * 0.04,
      spin: (Math.random() - 0.5) * 0.02,
    };
  });

  function resize() {
    const { innerWidth: w, innerHeight: h } = window;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
    // On narrow screens the blooms would pile up in the middle: shrink them
    // and push them further toward the top and bottom edges.
    const shrink = THREE.MathUtils.clamp(aspect, 0.55, 1);
    const spread = aspect < 1 ? 1.3 : 1;
    for (const b of blooms) {
      b.mesh.scale.set(b.size.x * shrink, b.size.y * shrink, 1);
      b.mesh.position.set(b.home.x * aspect, b.home.y * spread, 0);
    }
  }
  addEventListener('resize', resize);
  resize();

  const timer = new THREE.Timer();

  function frame() {
    timer.update();
    const t = timer.getElapsed();
    const aspect = camera.right;
    const spread = aspect < 1 ? 1.3 : 1;

    for (const b of blooms) {
      b.material.uniforms.uTime.value = t;
      const x = b.home.x * aspect + Math.sin(t * b.speed + b.phase) * 0.15;
      const y = b.home.y * spread + Math.cos(t * b.speed * 0.8 + b.phase) * 0.12;
      b.mesh.position.set(x, y, 0);
      b.mesh.rotation.z += b.spin * 0.016;
    }

    renderer.render(scene, camera);
    if (!reducedMotion) requestAnimationFrame(frame);
  }

  frame();
}
