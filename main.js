import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ------------------------------------------------------------------ *
 *  Renderer / scene / camera
 * ------------------------------------------------------------------ */
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe3d0, 22, 70);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 250);
const CAM_START = new THREE.Vector3(2.4, 2.1, 3.3);
const TARGET = new THREE.Vector3(0, 1.6, 0);
// keep the cube comfortably in frame on narrow (portrait) screens
function fitCamera() {
  const a = window.innerWidth / window.innerHeight;
  const k = a < 1 ? Math.pow(1 / a, 0.75) : 1;
  camera.position.copy(TARGET).add(CAM_START.clone().sub(TARGET).multiplyScalar(k));
}
fitCamera();

const TABLE_Y = 0.78;          // table top height
const CUBE_Y = 1.75;           // floating cube centre
const SUN_DIR = new THREE.Vector3(5, 9, 3).normalize();

/* ------------------------------------------------------------------ *
 *  Controls: right drag = orbit, wheel = zoom, left drag = cube
 * ------------------------------------------------------------------ */
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 1.6;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI * 0.49;
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

/* ------------------------------------------------------------------ *
 *  Shared GLSL
 * ------------------------------------------------------------------ */
const HSV = /* glsl */ `
vec3 hsv2rgb(vec3 c){
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}`;

/* ------------------------------------------------------------------ *
 *  Sky
 * ------------------------------------------------------------------ */
{
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x5d9bd6) },
        mid: { value: new THREE.Color(0xe4f1fb) },
        bottom: { value: new THREE.Color(0xcfe3d0) },
        sunDir: { value: SUN_DIR },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top, mid, bottom, sunDir;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h,0.0,1.0), 0.55))
                           : mix(mid, bottom, clamp(-h * 6.0, 0.0, 1.0));
          float s = max(dot(d, sunDir), 0.0);
          c += vec3(1.0, 0.92, 0.75) * (pow(s, 600.0) * 6.0 + pow(s, 12.0) * 0.25);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
  );
  scene.add(sky);
}

/* ------------------------------------------------------------------ *
 *  Lights
 * ------------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0xe3f2ff, 0x56743f, 1.1));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.copy(SUN_DIR).multiplyScalar(12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -6;
sun.shadow.camera.right = 6;
sun.shadow.camera.top = 6;
sun.shadow.camera.bottom = -6;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 30;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);

/* ------------------------------------------------------------------ *
 *  Grass ground (procedural canvas texture, little white flowers)
 * ------------------------------------------------------------------ */
function makeGrassTexture() {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#5d8a3a';
  g.fillRect(0, 0, s, s);
  const greens = ['#4b7a2e', '#6a9a44', '#78a84f', '#3f6b27', '#8ab55c', '#557f33'];
  for (let i = 0; i < 9000; i++) {
    g.strokeStyle = greens[(Math.random() * greens.length) | 0];
    g.globalAlpha = 0.35 + Math.random() * 0.5;
    g.lineWidth = 1 + Math.random() * 1.6;
    const x = Math.random() * s, y = Math.random() * s;
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    const l = 4 + Math.random() * 9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // daisies
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = 1.6 + Math.random() * 2.2;
    g.globalAlpha = 0.95;
    g.fillStyle = '#f7f7f2';
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      g.beginPath();
      g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#f2d14b';
    g.beginPath();
    g.arc(x, y, r * 0.6, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
{
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(120, 64),
    new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

/* ------------------------------------------------------------------ *
 *  White ornate garden table with cut-outs
 * ------------------------------------------------------------------ */
{
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.42, metalness: 0.05 });
  const R = 1.7;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R, 0, Math.PI * 2, false);
  const hole = (x, y, r) => {
    const h = new THREE.Path();
    h.absarc(x, y, r, 0, Math.PI * 2, true);
    shape.holes.push(h);
  };
  const ellipseHole = (x, y, rx, ry, rot) => {
    const h = new THREE.Path();
    h.absellipse(x, y, rx, ry, 0, Math.PI * 2, true, rot);
    shape.holes.push(h);
  };
  hole(0, 0, 0.14);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ellipseHole(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.18, 0.08, a);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    ellipseHole(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.2, 0.11, a + Math.PI / 2);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    hole(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0.085);
  }
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + Math.PI / 36;
    hole(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0.04);
  }
  const topGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 28,
  });
  topGeo.rotateX(-Math.PI / 2);
  const top = new THREE.Mesh(topGeo, white);
  top.position.y = TABLE_Y - 0.05;
  top.castShadow = top.receiveShadow = true;
  scene.add(top);

  // rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.03, 12, 96), white);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = TABLE_Y - 0.02;
  rim.castShadow = true;
  scene.add(rim);

  // curved legs
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const curve = new THREE.CatmullRomCurve3([
      dir.clone().multiplyScalar(1.15).setY(TABLE_Y - 0.06),
      dir.clone().multiplyScalar(0.75).setY(TABLE_Y - 0.35),
      dir.clone().multiplyScalar(0.8).setY(0.3),
      dir.clone().multiplyScalar(1.15).setY(0.01),
    ]);
    const leg = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.035, 10), white);
    leg.castShadow = true;
    scene.add(leg);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.02, 8, 64), white);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.32;
  ring.castShadow = true;
  scene.add(ring);
}

/* ------------------------------------------------------------------ *
 *  Bushes, flowers and trees in the distance
 * ------------------------------------------------------------------ */
{
  const rand = (a, b) => a + Math.random() * (b - a);
  const leafMats = [0x3f6e2a, 0x4f8233, 0x5f9440, 0x356024].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })
  );
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const flowerGeo = new THREE.SphereGeometry(0.06, 6, 4);
  const flowerColors = [0xffffff, 0xfff5f8, 0xffd6e7, 0xfff1a8, 0xd8c8ff];
  const flowers = [];

  const addBush = (x, z, size) => {
    const n = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(blob, leafMats[(Math.random() * leafMats.length) | 0]);
      const s = size * rand(0.55, 1);
      m.scale.set(s * rand(0.9, 1.3), s * rand(0.6, 0.9), s * rand(0.9, 1.3));
      m.position.set(x + rand(-size, size) * 0.7, s * 0.55, z + rand(-size, size) * 0.7);
      m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      for (let f = 0; f < 10 * s; f++) {
        const d = new THREE.Vector3(rand(-1, 1), rand(0.1, 1), rand(-1, 1)).normalize();
        flowers.push({
          p: new THREE.Vector3(
            m.position.x + d.x * m.scale.x * 0.95,
            m.position.y + d.y * m.scale.y * 0.95,
            m.position.z + d.z * m.scale.z * 0.95
          ),
          c: flowerColors[(Math.random() * flowerColors.length) | 0],
        });
      }
    }
  };

  for (let i = 0; i < 46; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(5.5, 16);
    addBush(Math.cos(a) * r, Math.sin(a) * r, rand(0.5, 1.2));
  }

  const inst = new THREE.InstancedMesh(
    flowerGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    flowers.length
  );
  const mtx = new THREE.Matrix4();
  flowers.forEach((f, i) => {
    mtx.makeTranslation(f.p.x, f.p.y, f.p.z);
    inst.setMatrixAt(i, mtx);
    inst.setColorAt(i, new THREE.Color(f.c));
  });
  scene.add(inst);

  // trees
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(18, 40);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = rand(3, 6);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, h, 7), trunkMat);
    trunk.position.set(x, h / 2, z);
    scene.add(trunk);
    for (let k = 0; k < 3; k++) {
      const crown = new THREE.Mesh(blob, leafMats[(Math.random() * leafMats.length) | 0]);
      const s = rand(1.6, 2.8);
      crown.scale.setScalar(s);
      crown.position.set(x + rand(-1, 1), h + rand(0, 1.6), z + rand(-1, 1));
      scene.add(crown);
    }
  }
}

/* ------------------------------------------------------------------ *
 *  Colour caustic projected onto the table
 * ------------------------------------------------------------------ */
const causticMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uRot: { value: 0 }, uTilt: { value: 0 }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uRot, uTilt, uTime;
    varying vec2 vUv;
    ${HSV}
    void main(){
      vec2 p = (vUv - 0.5) * 2.0;
      vec3 c = vec3(0.0);
      for (int i = 0; i < 6; i++){
        float fi = float(i);
        float a = uRot + fi * 1.0472 + 0.25 * sin(uTime * 0.4 + fi);
        vec2 q = vec2(cos(a), sin(a)) * (0.32 + 0.12 * uTilt);
        vec2 d = p - q;
        float g = exp(-dot(d, d) * 9.0);
        c += hsv2rgb(vec3(fi / 6.0 + uTilt * 0.2, 0.85, 1.0)) * g;
      }
      c *= smoothstep(1.0, 0.25, length(p)) * 0.55;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const caustic = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), causticMat);
caustic.rotation.x = -Math.PI / 2;
{
  const h = CUBE_Y - TABLE_Y;
  caustic.position.set((-SUN_DIR.x / SUN_DIR.y) * h, TABLE_Y + 0.004, (-SUN_DIR.z / SUN_DIR.y) * h);
}
caustic.renderOrder = 1;
scene.add(caustic);

/* ------------------------------------------------------------------ *
 *  Environment cube map for reflections (live, of the real scene)
 * ------------------------------------------------------------------ */
const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
const cubeCam = new THREE.CubeCamera(0.05, 200, cubeRT);
scene.add(cubeCam);

/* ------------------------------------------------------------------ *
 *  Scene render target (what the glass refracts)
 * ------------------------------------------------------------------ */
const sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const drawSize = new THREE.Vector2();
function sizeRT() {
  renderer.getDrawingBufferSize(drawSize);
  sceneRT.setSize(drawSize.x, drawSize.y);
}
sizeRT();

/* ------------------------------------------------------------------ *
 *  The dichroic glass cube
 *    layer 0 : back faces + inner X-mirror planes   (seen through glass)
 *    layer 1 : front faces (refraction of layer-0 render target)
 * ------------------------------------------------------------------ */
const cube = new THREE.Group();
cube.position.set(0, CUBE_Y, 0);
cube.rotation.set(0.62, 0.78, 0.18);
scene.add(cube);

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
// per-face base hue: +x, -x, +y, -y, +z, -z
const FACE_HUES = [0.52, 0.0, 0.85, 0.15, 0.68, 0.36];
{
  const hues = new Float32Array(24);
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) hues[f * 4 + v] = FACE_HUES[f];
  boxGeo.setAttribute('faceHue', new THREE.BufferAttribute(hues, 1));
}

const GLASS_VERT = /* glsl */ `
  attribute float faceHue;
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;
  varying float vHue;
  void main(){
    vUv = uv;
    vHue = faceHue;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const frontMat = new THREE.ShaderMaterial({
  uniforms: {
    tScene: { value: sceneRT.texture },
    uRes: { value: drawSize },
    envMap: { value: cubeRT.texture },
    uTime: { value: 0 },
    uSun: { value: SUN_DIR },
  },
  vertexShader: GLASS_VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tScene;
    uniform vec2 uRes;
    uniform samplerCube envMap;
    uniform float uTime;
    uniform vec3 uSun;
    varying vec3 vN;
    varying vec3 vW;
    varying vec2 vUv;
    varying float vHue;
    ${HSV}
    void main(){
      vec3 N = normalize(vN);
      vec3 V = normalize(cameraPosition - vW);
      float ndv = clamp(dot(N, V), 0.0, 1.0);

      // --- refraction with slight chromatic dispersion ---
      vec2 suv = gl_FragCoord.xy / uRes;
      vec3 vn = normalize((viewMatrix * vec4(N, 0.0)).xyz);
      vec2 off = vn.xy * (0.045 + 0.06 * (1.0 - ndv));
      vec3 refr;
      refr.r = texture2D(tScene, clamp(suv - off * 0.90, 0.001, 0.999)).r;
      refr.g = texture2D(tScene, clamp(suv - off * 1.00, 0.001, 0.999)).g;
      refr.b = texture2D(tScene, clamp(suv - off * 1.12, 0.001, 0.999)).b;

      // --- dichroic coating: colour shifts with viewing angle ---
      float hue = fract(vHue + (1.0 - ndv) * 0.42 + 0.035 * sin(uTime * 0.35 + vW.y * 3.0 + vW.x * 2.0));
      vec3 dich = hsv2rgb(vec3(hue, 0.88, 1.0));
      vec3 comp = hsv2rgb(vec3(fract(hue + 0.5), 0.75, 1.0));

      vec3 trans = refr * mix(vec3(1.0), dich, 0.93) * 1.2;

      // --- reflection of the real surroundings ---
      vec3 R = reflect(-V, N);
      vec3 env = textureCube(envMap, R).rgb;
      float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
      vec3 refl = env * mix(comp, vec3(1.0), 0.35);

      vec3 col = trans + dich * 0.035;
      col = mix(col, refl, clamp(F * 1.0 + 0.035, 0.0, 1.0));

      // --- bright polished edges ---
      vec2 e = min(vUv, 1.0 - vUv);
      float ed = min(e.x, e.y);
      float edge = 1.0 - smoothstep(0.0, 0.012, ed);
      float edge2 = 1.0 - smoothstep(0.0, 0.07, ed);
      col += edge * (vec3(0.3) + comp * 0.4) + edge2 * dich * 0.1;

      // --- sun glint ---
      vec3 H = normalize(uSun + V);
      float spec = pow(max(dot(N, H), 0.0), 400.0) * 8.0 + pow(max(dot(N, H), 0.0), 40.0) * 0.15;
      col += spec * vec3(1.0, 0.96, 0.9);

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});

const backMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  transparent: true,
  depthWrite: false,
  uniforms: { uTime: { value: 0 } },
  vertexShader: GLASS_VERT,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec3 vN;
    varying vec3 vW;
    varying vec2 vUv;
    varying float vHue;
    ${HSV}
    void main(){
      vec3 N = -normalize(vN);
      vec3 V = normalize(cameraPosition - vW);
      float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
      float hue = fract(vHue + (1.0 - ndv) * 0.5 + 0.03 * sin(uTime * 0.3 + vW.y * 3.0));
      vec3 dich = hsv2rgb(vec3(hue, 0.9, 1.0));
      vec2 e = min(vUv, 1.0 - vUv);
      float edge = 1.0 - smoothstep(0.0, 0.02, min(e.x, e.y));
      // internal reflection is strongest at grazing angles
      float a = 0.42 + 0.35 * pow(1.0 - ndv, 2.0) + edge * 0.4;
      vec3 col = dich * (0.7 + 0.5 * pow(1.0 - ndv, 3.0)) + edge * 0.35;
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});

const front = new THREE.Mesh(boxGeo, frontMat);
front.layers.set(1);
front.renderOrder = 3;
cube.add(front);

const back = new THREE.Mesh(boxGeo, backMat);
back.renderOrder = 1;
cube.add(back);

// the two diagonal dichroic mirrors of an X-cube prism
const innerMats = [];
[
  { hue: 0.08, rotY: Math.PI / 4 },
  { hue: 0.58, rotY: -Math.PI / 4 },
].forEach(({ hue, rotY }) => {
  const m = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uHue: { value: hue }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW; varying vec2 vUv;
      void main(){
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uHue, uTime;
      varying vec3 vN; varying vec3 vW; varying vec2 vUv;
      ${HSV}
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float ndv = abs(dot(normalize(vN), V));
        float hue = fract(uHue + (1.0 - ndv) * 0.6 + vUv.y * 0.12 + 0.04 * sin(uTime * 0.5));
        vec3 c = hsv2rgb(vec3(hue, 0.85, 1.0)) * (0.16 + 0.55 * pow(1.0 - ndv, 2.0));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  innerMats.push(m);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(Math.SQRT2 * 0.995, 0.995), m);
  plane.rotation.y = rotY;
  plane.renderOrder = 2;
  cube.add(plane);
});

/* ------------------------------------------------------------------ *
 *  Interaction: left drag rotates the cube (with inertia), click spins
 * ------------------------------------------------------------------ */
const dom = renderer.domElement;
const raycaster = new THREE.Raycaster();
raycaster.layers.enableAll();
const ndc = new THREE.Vector2();
const angVel = new THREE.Vector3();      // axis * radians per frame
const tmpQ = new THREE.Quaternion();
const camRight = new THREE.Vector3();
const camUp = new THREE.Vector3();
const activeTouches = new Set();
let dragging = false;
let lastX = 0, lastY = 0, moved = 0, downOnCube = false;
let lastInteract = -1e9;

function hitCube(e) {
  const r = dom.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(front, false).length > 0;
}

dom.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') {
    activeTouches.add(e.pointerId);
    if (activeTouches.size > 1) { dragging = false; return; }
  }
  if (e.button !== 0) return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  moved = 0;
  downOnCube = hitCube(e);
  angVel.multiplyScalar(0.2);
  lastInteract = performance.now();
  dom.style.cursor = 'grabbing';
});

window.addEventListener('pointermove', (e) => {
  if (!dragging) {
    if (e.pointerType === 'mouse') dom.style.cursor = hitCube(e) ? 'grab' : 'default';
    return;
  }
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  const s = 0.0085;
  camRight.setFromMatrixColumn(camera.matrixWorld, 0);
  camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  const v = new THREE.Vector3().addScaledVector(camUp, dx * s).addScaledVector(camRight, dy * s);
  applyRotation(v);
  angVel.lerp(v, 0.6);
  lastInteract = performance.now();
});

function endDrag(e) {
  if (e.pointerType === 'touch') activeTouches.delete(e.pointerId);
  if (!dragging) return;
  dragging = false;
  dom.style.cursor = 'default';
  if (moved < 5 && downOnCube) {
    // a click on the cube gives it a playful spin
    const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() + 0.3, Math.random() - 0.5).normalize();
    angVel.copy(axis).multiplyScalar(0.12 + Math.random() * 0.08);
  }
  lastInteract = performance.now();
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

function applyRotation(v) {
  const ang = v.length();
  if (ang < 1e-7) return;
  tmpQ.setFromAxisAngle(v.clone().divideScalar(ang), ang);
  cube.quaternion.premultiply(tmpQ);
}

document.getElementById('reset').addEventListener('click', () => {
  fitCamera();
  controls.target.copy(TARGET);
  controls.update();
});

/* ------------------------------------------------------------------ *
 *  Resize
 * ------------------------------------------------------------------ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  sizeRT();
});

/* ------------------------------------------------------------------ *
 *  Loop
 * ------------------------------------------------------------------ */
const clock = new THREE.Clock();
const autoAxis = new THREE.Vector3(0.25, 1, 0.12).normalize();
const xAxis = new THREE.Vector3();
let frame = 0;

function updateEnv() {
  cube.visible = false;
  caustic.visible = false;
  cubeCam.position.copy(cube.position);
  cubeCam.update(renderer, scene);
  cube.visible = true;
  caustic.visible = true;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const f = dt * 60;

  // inertia + idle auto-rotation
  if (!dragging) {
    if (angVel.lengthSq() > 1e-10) {
      applyRotation(angVel.clone().multiplyScalar(f));
      angVel.multiplyScalar(Math.pow(0.955, f));
    }
    const idle = (performance.now() - lastInteract) / 1000;
    if (idle > 2.5) {
      const k = Math.min((idle - 2.5) / 2, 1);
      tmpQ.setFromAxisAngle(autoAxis, 0.12 * dt * k);
      cube.quaternion.premultiply(tmpQ);
    }
  }
  cube.position.y = CUBE_Y + Math.sin(t * 0.9) * 0.035;

  // caustic follows the cube orientation
  xAxis.set(1, 0, 0).applyQuaternion(cube.quaternion);
  causticMat.uniforms.uRot.value = Math.atan2(xAxis.z, xAxis.x);
  causticMat.uniforms.uTilt.value = Math.abs(xAxis.y);
  causticMat.uniforms.uTime.value = t;
  frontMat.uniforms.uTime.value = t;
  backMat.uniforms.uTime.value = t;
  innerMats.forEach((m) => (m.uniforms.uTime.value = t));

  controls.update();

  if (frame % 3 === 0) updateEnv();
  frame++;

  // pass 1: everything except the front faces -> render target
  camera.layers.set(0);
  renderer.setRenderTarget(sceneRT);
  renderer.render(scene, camera);

  // pass 2: full scene to screen, front faces refract pass 1
  camera.layers.enable(1);
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  requestAnimationFrame(animate);
}

updateEnv();
animate();
document.getElementById('loading').classList.add('done');
