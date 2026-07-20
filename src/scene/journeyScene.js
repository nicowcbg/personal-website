import * as THREE from 'three'

/* ─────────────────────────────────────────────────────────
 * JOURNEY SCENE — orb → penetration → synapse travel
 *
 * A glass orb containing a quiet neural storm. Scrolling
 * dives the camera through the glass, the storm deploys
 * around you, then a synaptic path carries you forward
 * past neuron clusters (one per project) to the outro.
 *
 * All black & white. The React side drives a single
 * smoothed scroll value p ∈ [0,1]; this module maps it
 * to camera, materials and particles.
 * ───────────────────────────────────────────────────────── */

const ORB_RADIUS = 2
const PHASE_APPROACH = 0.32
const PHASE_CROSS = 0.42
const PHASE_DEPLOY = 0.52

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  attribute float aFire;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uTurb;
  varying float vTwinkle;
  varying vec3 vColor;
  varying float vFire;
  void main() {
    vTwinkle = 0.65 + 0.35 * sin(uTime * 0.9 + aPhase * 6.2831);
    vColor = aColor;
    vFire = aFire;
    vec3 pos = position;
    pos.x += sin(position.y * 2.1 + uTime * 0.5 + aPhase * 3.0) * uTurb;
    pos.y += sin(position.z * 1.7 + uTime * 0.4 + aPhase * 5.0) * uTurb;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float px = aSize * (1.0 + aFire * 0.6) * uPixelRatio * (14.0 / -mv.z);
    gl_PointSize = min(px, 24.0 * uPixelRatio);
    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */ `
  uniform float uAlpha;
  uniform float uBaseAlpha;
  uniform float uTwinkle;
  varying float vTwinkle;
  varying vec3 vColor;
  varying float vFire;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.06, d);
    float a = disc * uAlpha * uBaseAlpha * mix(1.0, vTwinkle, uTwinkle) * (1.0 + vFire * 2.5);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`

const GLASS_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const GLASS_FRAG = /* glsl */ `
  uniform float uAlpha;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
    float fr = pow(f, 4.2);
    // iridescent edge: blue → violet → amber at grazing angles
    vec3 col = mix(vec3(0.30, 0.49, 1.0), vec3(0.62, 0.42, 1.0), smoothstep(0.0, 0.35, f));
    col = mix(col, vec3(1.0, 0.69, 0.38), smoothstep(0.55, 1.0, f));
    float a = (fr * 0.55 + 0.006) * uAlpha;
    gl_FragColor = vec4(col, a);
  }
`

function makePoints(positions, { sizes, phases, colors, color = 0xffffff, baseAlpha = 1, twinkle = 1, turb = 0 }) {
  const count = positions.length / 3
  if (!colors) {
    colors = new Float32Array(count * 3)
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aFire', new THREE.BufferAttribute(new Float32Array(count), 1))
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uAlpha: { value: 1 },
      uBaseAlpha: { value: baseAlpha },
      uTwinkle: { value: twinkle },
      uTurb: { value: turb },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const points = new THREE.Points(geo, mat)
  return { points, mat }
}

function pointCloud(count, fill) {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const phases = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    fill(i, positions, sizes, phases)
  }
  return { positions, sizes, phases }
}

/* connect near neighbours of a point set → line segments */
function wireCloud(positions, count, maxDist, maxEdges, mat4, color = 0xffffff) {
  const pts = []
  for (let i = 0; i < count; i++) {
    pts.push(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]))
  }
  const seg = []
  for (let a = 0; a < count && seg.length / 2 < maxEdges; a++) {
    for (let b = a + 1; b < count && seg.length / 2 < maxEdges; b++) {
      if (pts[a].distanceTo(pts[b]) < maxDist) seg.push(a, b)
    }
  }
  const linePos = new Float32Array(seg.length * 3)
  for (let i = 0; i < seg.length; i++) {
    const v = pts[seg[i]]
    linePos[i * 3] = v.x
    linePos[i * 3 + 1] = v.y
    linePos[i * 3 + 2] = v.z
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(linePos, 3))
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const lines = new THREE.LineSegments(geo, mat)
  if (mat4) lines.applyMatrix4(mat4)
  return { lines, mat, segs: seg }
}

/* ── electrical activity: firing neurons + lightning arcs ── */
function makeActivity(count, segs, pointsObj, rateMin, rateMax) {
  const adj = Array.from({ length: count }, () => [])
  for (let i = 0; i < segs.length; i += 2) {
    adj[segs[i]].push(segs[i + 1])
    adj[segs[i + 1]].push(segs[i])
  }
  return {
    adj,
    count,
    attr: pointsObj.geometry.attributes.aFire,
    timer: Math.random() * 0.5,
    rateMin,
    rateMax,
  }
}

function updateActivity(a, dt) {
  const fire = a.attr.array
  const decay = Math.exp(-3.2 * dt)
  for (let i = 0; i < fire.length; i++) fire[i] *= decay
  a.timer -= dt
  if (a.timer <= 0) {
    const i = (Math.random() * a.count) | 0
    fire[i] = 1
    const nb = a.adj[i]
    if (nb.length) {
      const n = nb[(Math.random() * nb.length) | 0]
      fire[n] = Math.max(fire[n], 0.8)
    }
    a.timer = a.rateMin + Math.random() * (a.rateMax - a.rateMin)
  }
  a.attr.needsUpdate = true
}

const BOLT_PTS = 6

function makeBolt(parent, positions, count) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOLT_PTS * 3), 3))
  const mat = new THREE.LineBasicMaterial({
    color: 0xdde4ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const line = new THREE.Line(geo, mat)
  line.frustumCulled = false
  parent.add(line)
  return {
    mat,
    positions,
    count,
    state: 'idle',
    timer: 1 + Math.random() * 3,
    alpha: 0,
    attr: geo.attributes.position,
  }
}

function fireBolt(b) {
  const arr = b.attr.array
  const ia = (Math.random() * b.count) | 0
  const ax = b.positions[ia * 3]
  const ay = b.positions[ia * 3 + 1]
  const az = b.positions[ia * 3 + 2]
  // find a partner at bolt distance
  let ib = -1
  for (let tries = 0; tries < 8; tries++) {
    const j = (Math.random() * b.count) | 0
    const dx = b.positions[j * 3] - ax
    const dy = b.positions[j * 3 + 1] - ay
    const dz = b.positions[j * 3 + 2] - az
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (d > 0.4 && d < 1.5) {
      ib = j
      break
    }
  }
  if (ib < 0) return false
  const bx = b.positions[ib * 3]
  const by = b.positions[ib * 3 + 1]
  const bz = b.positions[ib * 3 + 2]
  // jagged midpoints with perpendicular jitter
  const dx = bx - ax
  const dy = by - ay
  const dz = bz - az
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
  // arbitrary perpendicular
  let px = -dy
  let py = dx
  let pz = dz * 0.5
  const pl = Math.sqrt(px * px + py * py + pz * pz) || 1
  px /= pl
  py /= pl
  pz /= pl
  for (let i = 0; i < BOLT_PTS; i++) {
    const t = i / (BOLT_PTS - 1)
    const jag = i === 0 || i === BOLT_PTS - 1 ? 0 : (Math.random() - 0.5) * len * 0.28
    arr[i * 3] = ax + dx * t + px * jag
    arr[i * 3 + 1] = ay + dy * t + py * jag
    arr[i * 3 + 2] = az + dz * t + pz * jag
  }
  b.attr.needsUpdate = true
  return true
}

function updateBolt(b, dt, vis) {
  if (b.state === 'idle') {
    b.timer -= dt
    if (b.timer <= 0) {
      if (fireBolt(b)) {
        b.state = 'firing'
        b.alpha = 1
      } else {
        b.timer = 0.5
      }
    }
  } else {
    b.alpha *= Math.exp(-9 * dt)
    if (b.alpha < 0.02) {
      b.alpha = 0
      b.state = 'idle'
      b.timer = 1.5 + Math.random() * 3.5
    }
  }
  b.mat.opacity = b.alpha * vis
}

function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)
const lerp = (a, b, k) => a + (b - a) * k
const clamp01 = (v) => Math.max(0, Math.min(1, v))

export function createJourneyScene(canvas, { nodeTs = [0.16, 0.39, 0.62, 0.81, 0.95] } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 1)

  /* shared palette: electric blue / violet / hot amber / white */
  const STORM_PALETTE = [
    [0x4d / 255, 0x7c / 255, 1.0, 0.36], // electric blue
    [0x9d / 255, 0x6b / 255, 1.0, 0.28], // violet
    [1.0, 0xb0 / 255, 0x60 / 255, 0.26], // hot amber
    [0.96, 0.96, 0.95, 0.1], // white
  ]
  const pickStormColor = () => {
    let x = Math.random()
    for (const [r, g, b, w] of STORM_PALETTE) {
      if ((x -= w) <= 0) return [r, g, b]
    }
    return [0.96, 0.96, 0.95]
  }
  const paletteColors = (count) => {
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const [r, g, b] = pickStormColor()
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
    return colors
  }

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x000000, 0.026)

  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 400)
  camera.position.set(0, 0.15, 14)

  /* ── THE ORB ── */
  const orbGroup = new THREE.Group()
  scene.add(orbGroup)

  const glassMat = new THREE.ShaderMaterial({
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
    uniforms: { uAlpha: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
  orbGroup.add(new THREE.Mesh(new THREE.SphereGeometry(ORB_RADIUS, 64, 64), glassMat))

  const glowTex = makeGlowTexture()
  const haloMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0x8f9fff, // faint cool aura around the glass
    transparent: true,
    opacity: 0.085,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const halo = new THREE.Sprite(haloMat)
  halo.scale.setScalar(12)
  orbGroup.add(halo)

  /* ── THE STORM (quiet neural network inside the orb) ── */
  const stormGroup = new THREE.Group()
  orbGroup.add(stormGroup)

  const STORM_N = 800
  const stormColors = paletteColors(STORM_N)
  const stormCloud = pointCloud(STORM_N, (i, pos, sizes, phases) => {
    // gaussian-ish sphere fill
    const r = Math.cbrt(Math.random()) * ORB_RADIUS * 0.92
    const th = Math.random() * Math.PI * 2
    const ph = Math.acos(2 * Math.random() - 1)
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th)
    pos[i * 3 + 2] = r * Math.cos(ph)
    sizes[i] = 1.6 + Math.random() * 2.2
    phases[i] = Math.random()
  })
  const storm = makePoints(stormCloud.positions, {
    sizes: stormCloud.sizes,
    phases: stormCloud.phases,
    colors: stormColors,
    baseAlpha: 0.92,
    turb: 0.05,
  })
  stormGroup.add(storm.points)
  const stormWires = wireCloud(stormCloud.positions, STORM_N, 0.55, 1500, null, 0x5b6dd6)
  stormWires.mat.opacity = 0.14
  stormGroup.add(stormWires.lines)

  // the storm is alive: neurons fire + propagate, bolts arc through it
  const stormActivity = makeActivity(STORM_N, stormWires.segs, storm.points, 0.12, 0.6)
  const stormBolts = [
    makeBolt(stormGroup, stormCloud.positions, STORM_N),
    makeBolt(stormGroup, stormCloud.positions, STORM_N),
  ]

  /* ── THE SYNAPSE PATH ── */
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 2),
    new THREE.Vector3(0.5, -0.2, -6),
    new THREE.Vector3(2.5, 0.6, -16),
    new THREE.Vector3(-1.5, 1.2, -28),
    new THREE.Vector3(-3.0, -0.8, -40),
    new THREE.Vector3(1.5, -1.6, -52),
    new THREE.Vector3(3.0, 0.8, -64),
    new THREE.Vector3(-1.0, 1.8, -78),
    new THREE.Vector3(-2.5, -0.5, -92),
    new THREE.Vector3(0.5, -1.2, -106),
    new THREE.Vector3(1.0, 0.4, -120),
  ])

  const pathGroup = new THREE.Group()
  scene.add(pathGroup)
  const pathMats = []
  const trackPath = (mat, base) => {
    mat.transparent = true
    pathMats.push({ mat, base })
  }

  // color ramp along the synapse: blue → violet → amber (cool → warm)
  const rampColor = (t) => {
    const blue = new THREE.Color(0x4d7cff)
    const violet = new THREE.Color(0x9d6bff)
    const amber = new THREE.Color(0xffb060)
    if (t < 0.4) return blue.lerp(violet, t / 0.4)
    return violet.lerp(amber, (t - 0.4) / 0.6)
  }

  // main axon line, gradient along its length
  const pathSamples = curve.getPoints(500)
  const pathGeo = new THREE.BufferGeometry().setFromPoints(pathSamples)
  const pathColors = new Float32Array((pathSamples.length) * 3)
  for (let i = 0; i < pathSamples.length; i++) {
    const c = rampColor(i / (pathSamples.length - 1))
    pathColors[i * 3] = c.r
    pathColors[i * 3 + 1] = c.g
    pathColors[i * 3 + 2] = c.b
  }
  pathGeo.setAttribute('color', new THREE.BufferAttribute(pathColors, 3))
  const pathMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  trackPath(pathMat, 0.85)
  pathGroup.add(new THREE.Line(pathGeo, pathMat))

  // neuron clusters at each node (one per project + outro)
  const UP = new THREE.Vector3(0, 1, 0)
  const clusters = []
  const clusterActivities = []
  const clusterBolts = []
  for (let ni = 0; ni < nodeTs.length; ni++) {
    const t = nodeTs[ni]
    const center = curve.getPointAt(t)
    const tangent = curve.getTangentAt(t)
    const side = tangent.clone().cross(UP).normalize()
    center.addScaledVector(side, -2.6).add(new THREE.Vector3(0, 0.1, 0))

    const N = 160
    const cloud = pointCloud(N, (i, pos, sizes, phases) => {
      const r = Math.cbrt(Math.random()) * 1.35
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = center.x + r * Math.sin(ph) * Math.cos(th)
      pos[i * 3 + 1] = center.y + r * Math.sin(ph) * Math.sin(th)
      pos[i * 3 + 2] = center.z + r * Math.cos(ph)
      sizes[i] = 2.2 + Math.random() * 2.6
      phases[i] = Math.random()
    })
    // cluster neurons: same mixed palette as the orb's storm
    const node = makePoints(cloud.positions, {
      sizes: cloud.sizes,
      phases: cloud.phases,
      colors: paletteColors(N),
      baseAlpha: 1,
      turb: 0.03,
    })
    pathMats.push({ mat: node.mat, base: 1, uniform: true })
    const group = new THREE.Group()
    group.add(node.points)
    const wires = wireCloud(cloud.positions, N, 0.62, 380, null, 0x5b6dd6)
    trackPath(wires.mat, 0.24)
    group.add(wires.lines)

    // junction lines: cluster → main axon
    const junctionPos = []
    const anchor = curve.getPointAt(t)
    for (let j = 0; j < 5; j++) {
      const i = (Math.random() * N) | 0
      junctionPos.push(
        cloud.positions[i * 3], cloud.positions[i * 3 + 1], cloud.positions[i * 3 + 2],
        anchor.x, anchor.y, anchor.z
      )
    }
    const jGeo = new THREE.BufferGeometry()
    jGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(junctionPos), 3))
    const jMat = new THREE.LineBasicMaterial({
      color: rampColor(t),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    trackPath(jMat, 0.55)
    group.add(new THREE.LineSegments(jGeo, jMat))

    // soft glow so the node reads as a "place" from afar
    const haloCMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: rampColor(t).lerp(new THREE.Color(0xffffff), 0.5),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    trackPath(haloCMat, 0.045)
    const haloC = new THREE.Sprite(haloCMat)
    haloC.position.copy(center)
    haloC.scale.setScalar(5.5)
    group.add(haloC)

    pathGroup.add(group)
    clusters.push(group)
    clusterActivities.push(makeActivity(N, wires.segs, node.points, 0.3, 1.1))
    const bolt = makeBolt(group, cloud.positions, N)
    bolt.timer = 2 + ni * 1.5 + Math.random() * 4 // staggered, so they never sync
    clusterBolts.push(bolt)
  }

  // ambient mini-clusters: a continuous forest along the tunnel so the
  // deploy doesn't cut to a void (project nodes get their own bigger ones)
  const ambientTs = []
  for (let i = 0; i < 16; i++) {
    const t = 0.04 + (i / 16) * 0.94 + (Math.random() - 0.5) * 0.025
    if (nodeTs.some((n) => Math.abs(n - t) < 0.05)) continue
    ambientTs.push(t)
  }
  for (const t of ambientTs) {
    const center = curve.getPointAt(t)
    const tangent = curve.getTangentAt(t)
    const side = tangent.clone().cross(UP).normalize()
    const sign = Math.random() < 0.5 ? 1 : -1
    center
      .addScaledVector(side, sign * (4 + Math.random() * 5))
      .add(new THREE.Vector3(0, (Math.random() - 0.5) * 4, 0))

    const N = 36 + ((Math.random() * 20) | 0)
    const radius = 0.9 + Math.random() * 0.6
    const cloud = pointCloud(N, (i, pos, sizes, phases) => {
      const r = Math.cbrt(Math.random()) * radius
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = center.x + r * Math.sin(ph) * Math.cos(th)
      pos[i * 3 + 1] = center.y + r * Math.sin(ph) * Math.sin(th)
      pos[i * 3 + 2] = center.z + r * Math.cos(ph)
      sizes[i] = 1.4 + Math.random() * 1.8
      phases[i] = Math.random()
    })
    const node = makePoints(cloud.positions, {
      sizes: cloud.sizes,
      phases: cloud.phases,
      baseAlpha: 0.55,
      turb: 0.03,
    })
    pathMats.push({ mat: node.mat, base: 1, uniform: true })
    pathGroup.add(node.points)
    const wires = wireCloud(cloud.positions, N, 0.6, 90)
    trackPath(wires.mat, 0.12)
    pathGroup.add(wires.lines)
  }

  // ambient dust through the tunnel
  const DUST_N = 1200
  const dustCloud = pointCloud(DUST_N, (i, pos, sizes, phases) => {
    const u = Math.random()
    const p = curve.getPointAt(u)
    const th = Math.random() * Math.PI * 2
    const rr = 2 + Math.random() * 10
    pos[i * 3] = p.x + Math.cos(th) * rr
    pos[i * 3 + 1] = p.y + Math.sin(th) * rr * 0.7
    pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 8
    sizes[i] = 1.2 + Math.random() * 1.8
    phases[i] = Math.random()
  })
  const dust = makePoints(dustCloud.positions, {
    sizes: dustCloud.sizes,
    phases: dustCloud.phases,
    baseAlpha: 0.75,
  })
  pathMats.push({ mat: dust.mat, base: 1, uniform: true })
  pathGroup.add(dust.points)

  // signal pulses riding the axon
  const PULSE_N = 9
  const pulseCloud = pointCloud(PULSE_N, (i, pos, sizes, phases) => {
    sizes[i] = 3.2 + Math.random() * 1.6
    phases[i] = Math.random()
  })
  const pulses = makePoints(pulseCloud.positions, {
    sizes: pulseCloud.sizes,
    phases: pulseCloud.phases,
    baseAlpha: 1,
    twinkle: 0,
    color: 0xe8b06b, // firing signals burn warm amber
  })
  pathMats.push({ mat: pulses.mat, base: 1, uniform: true })
  pathGroup.add(pulses.points)
  const pulseState = Array.from({ length: PULSE_N }, () => ({
    u: Math.random(),
    speed: 0.02 + Math.random() * 0.035,
  }))

  /* ── pointer parallax ── */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  const setPointer = (x, y) => {
    pointer.tx = x
    pointer.ty = y
  }

  /* ── per-frame update driven by smoothed scroll p ── */
  const lookTarget = new THREE.Vector3()

  const update = (p, dt, t) => {
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3)
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3)

    // storm idle motion (always alive while visible)
    stormGroup.rotation.y = t * 0.06
    stormGroup.rotation.z = Math.sin(t * 0.07) * 0.15
    storm.mat.uniforms.uTime.value = t
    haloMat.rotation = t * 0.05

    let deploy = 0
    let pathVis = 0
    let glassAlpha = 1
    let parallaxAmp = 0.5
    let roll = 0

    if (p < PHASE_APPROACH) {
      const k = easeInOut(p / PHASE_APPROACH)
      camera.position.set(0, lerp(0.15, 0.12, k), lerp(14, 3.9, k))
      lookTarget.set(0, -0.9, 0) // orb rides high, headline below
    } else if (p < PHASE_CROSS) {
      const k = easeInOut((p - PHASE_APPROACH) / (PHASE_CROSS - PHASE_APPROACH))
      camera.position.set(0, 0.12, lerp(3.9, 0.6, k))
      lookTarget.set(0, lerp(-0.9, 0, k), 0) // recenter smoothly while penetrating
      // the glass dissolves into fog before we touch it — the haze
      // overlay carries the membrane moment, not the rim
      glassAlpha = Math.max(0, 1 - k * 1.3)
    } else if (p < PHASE_DEPLOY) {
      const k = (p - PHASE_CROSS) / (PHASE_DEPLOY - PHASE_CROSS)
      deploy = easeInOut(k)
      camera.position.set(0, lerp(0.12, 0.15, k), lerp(0.6, 2.4, k))
      // hand the gaze off to the path ahead without snapping
      const ahead = curve.getPointAt(0.04)
      lookTarget.set(lerp(0, ahead.x, k), lerp(0, ahead.y, k), lerp(0, ahead.z, k))
      glassAlpha = 0
    } else {
      const ku = clamp01((p - PHASE_DEPLOY) / (1 - PHASE_DEPLOY))
      const u = ku * ku * (3 - 2 * ku) * 0.12 + ku * 0.88
      const pos = curve.getPointAt(u)
      camera.position.copy(pos)
      const ahead = curve.getPointAt(Math.min(u + 0.04, 1))
      lookTarget.copy(ahead)
      deploy = 1
      pathVis = 1
      glassAlpha = 0
      parallaxAmp = 0.3
      // gentle banking through the tunnel
      roll = Math.sin(u * Math.PI * 3) * 0.03 + pointer.x * 0.015
    }

    // storm deploys around the camera, then lingers and recedes behind
    // us through the first stretch of travel (no hard density cut)
    const stormScale = 1 + deploy * 4.5
    stormGroup.scale.setScalar(stormScale)
    let stormAlpha
    if (p < PHASE_DEPLOY) {
      stormAlpha = Math.pow(1 - deploy, 1.2)
    } else {
      const ku = clamp01((p - PHASE_DEPLOY) / (1 - PHASE_DEPLOY))
      stormAlpha = 0.3 * (1 - clamp01(ku / 0.15))
    }
    storm.mat.uniforms.uAlpha.value = stormAlpha
    stormWires.mat.opacity = 0.14 * stormAlpha

    if (p >= PHASE_DEPLOY) pathVis = 1
    else if (p >= PHASE_CROSS) pathVis = Math.pow(deploy, 1.5)
    for (const f of pathMats) {
      if (f.uniform) f.mat.uniforms.uAlpha.value = pathVis
      else f.mat.opacity = f.base * pathVis
    }

    glassMat.uniforms.uAlpha.value = glassAlpha
    haloMat.opacity = 0.06 * glassAlpha

    // shader clocks (clusters are world-baked — no group rotation,
    // twinkle + turbulence carry the idle motion)
    dust.mat.uniforms.uTime.value = t
    pulses.mat.uniforms.uTime.value = t

    // electrical activity: firing neurons everywhere, bolts arcing
    updateActivity(stormActivity, dt)
    for (const b of stormBolts) updateBolt(b, dt, stormAlpha)
    for (let i = 0; i < clusterActivities.length; i++) {
      updateActivity(clusterActivities[i], dt)
      updateBolt(clusterBolts[i], dt, pathVis)
    }

    // pulses ride the axon
    for (let i = 0; i < pulseState.length; i++) {
      const s = pulseState[i]
      s.u += s.speed * dt
      if (s.u > 1) {
        s.u = 0
        s.speed = 0.02 + Math.random() * 0.035
      }
      const pos = curve.getPointAt(s.u)
      const arr = pulseCloud.positions
      arr[i * 3] = pos.x
      arr[i * 3 + 1] = pos.y
      arr[i * 3 + 2] = pos.z
    }
    pulses.points.geometry.attributes.position.needsUpdate = true

    // pointer parallax + look + banking roll
    camera.position.x += pointer.x * parallaxAmp
    camera.position.y += pointer.y * parallaxAmp * 0.6
    lookTarget.x += pointer.x * 0.4
    lookTarget.y += pointer.y * 0.25
    camera.lookAt(lookTarget)
    if (roll) camera.rotateZ(roll)

    renderer.render(scene, camera)
  }

  const resize = (width, height) => {
    const dpr = Math.min(window.devicePixelRatio, 2)
    camera.aspect = width / height
    camera.fov = camera.aspect < 0.8 ? 68 : 55
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    storm.mat.uniforms.uPixelRatio.value = dpr
    for (const f of pathMats) {
      if (f.uniform) f.mat.uniforms.uPixelRatio.value = dpr
    }
  }

  const dispose = () => {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const m of mats) {
          if (m.map) m.map.dispose()
          m.dispose()
        }
      }
    })
    renderer.dispose()
  }

  return { update, resize, dispose, setPointer }
}
