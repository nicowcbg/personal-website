import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/* ─────────────────────────────────────────────────────────
 * NEURAL FIELD — hero backdrop
 *
 * A cloud of neurons (points) wired by synapses (lines).
 * Signal pulses travel along edges; on arrival they flash
 * the destination neuron and propagate to an adjacent edge,
 * like action potentials. The mouse stirs the field:
 * nearby neurons brighten and drift toward the cursor.
 *
 * Tunable live via the DialKit panel ("Neural Field").
 * ───────────────────────────────────────────────────────── */

const NEURON_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aIntensity;
  uniform float uPixelRatio;
  varying float vIntensity;
  void main() {
    vIntensity = aIntensity;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depthScale = 26.0 / -mv.z;
    gl_PointSize = aSize * uPixelRatio * depthScale * (1.0 + aIntensity * 0.7);
    gl_Position = projectionMatrix * mv;
  }
`

const NEURON_FRAG = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uAccent;
  varying float vIntensity;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float halo = smoothstep(0.5, 0.04, d);
    float i = clamp(vIntensity, 0.0, 1.0);
    vec3 col = mix(uBase, uAccent, i);
    float a = halo * (0.36 + 0.64 * i);
    if (a < 0.012) discard;
    gl_FragColor = vec4(col, a);
  }
`

const PULSE_VERT = /* glsl */ `
  uniform float uPixelRatio;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 9.0 * uPixelRatio * (26.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const PULSE_FRAG = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uDeep;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float halo = smoothstep(0.5, 0.05, d);
    float core = smoothstep(0.14, 0.0, d);
    vec3 col = mix(uAccent, uDeep, core);
    float a = halo * 0.95;
    if (a < 0.012) discard;
    gl_FragColor = vec4(col, a);
  }
`

/* Field tuning — baked-in defaults */
const CONFIG = {
  particleCount: 220,
  linkDistance: 4.4,
  pulseCount: 26,
  pulseSpeed: 7,
  drift: 0.5,
  rotation: 0.045,
  mouseRadius: 6,
  mouseStrength: 1.8,
  fireRate: 0.5,
}

export default function NeuralField({ className = '' }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const count = Math.max(20, CONFIG.particleCount)

    let width = mount.clientWidth
    let height = mount.clientHeight

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
    } catch {
      return // no WebGL — the CSS gradient hero remains as fallback
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100)
    camera.position.set(0, 0, 26)

    const group = new THREE.Group()
    group.position.set(2.5, -1, 0) // nudge the cloud down-right, clear of the text column
    scene.add(group)

    /* ── Neuron layout: wide ellipsoid cloud, gaussian density ── */
    const aspect = width / height
    const spreadX = 17 * Math.max(0.7, Math.min(1.15, aspect))
    const spreadY = 9.5
    const spreadZ = 6

    const gauss = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1

    const base = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      base[i * 3] = gauss() * spreadX
      base[i * 3 + 1] = gauss() * spreadY
      base[i * 3 + 2] = gauss() * spreadZ
      phase[i] = Math.random() * Math.PI * 2
      sizes[i] = 2.2 + Math.random() * 2.8
    }

    /* ── Synapses: edges between neurons closer than linkDistance ── */
    const adj = Array.from({ length: count }, () => [])
    const edgeList = [] // [nodeA, nodeB]
    const edgeLen = []
    const va = new THREE.Vector3()
    const vb = new THREE.Vector3()
    for (let a = 0; a < count && edgeList.length < 1400; a++) {
      va.set(base[a * 3], base[a * 3 + 1], base[a * 3 + 2])
      for (let b = a + 1; b < count && edgeList.length < 1400; b++) {
        vb.set(base[b * 3], base[b * 3 + 1], base[b * 3 + 2])
        const d = va.distanceTo(vb)
        if (d < CONFIG.linkDistance) {
          const idx = edgeList.length
          edgeList.push([a, b])
          edgeLen.push(d)
          adj[a].push(idx)
          adj[b].push(idx)
        }
      }
    }

    /* ── Neuron points (per-node intensity drives glow) ── */
    const neuronPos = new Float32Array(base)
    const intensity = new Float32Array(count)
    const neuronGeo = new THREE.BufferGeometry()
    neuronGeo.setAttribute('position', new THREE.BufferAttribute(neuronPos, 3))
    neuronGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    neuronGeo.setAttribute('aIntensity', new THREE.BufferAttribute(intensity, 1))
    const neuronMat = new THREE.ShaderMaterial({
      vertexShader: NEURON_VERT,
      fragmentShader: NEURON_FRAG,
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uBase: { value: new THREE.Color(0xa8b0be) },
        uAccent: { value: new THREE.Color(0xd8431d) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
    group.add(new THREE.Points(neuronGeo, neuronMat))

    /* ── Synapse lines ── */
    const edgePos = new Float32Array(edgeList.length * 6)
    const edgeGeo = new THREE.BufferGeometry()
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3))
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x17130e,
      transparent: true,
      opacity: 0.05,
      blending: THREE.NormalBlending,
      depthWrite: false,
    })
    group.add(new THREE.LineSegments(edgeGeo, edgeMat))

    /* ── Signal pulses ── */
    const pulses = []
    const pulsePos = new Float32Array(Math.max(CONFIG.pulseCount, 0) * 3)
    const pulseGeo = new THREE.BufferGeometry()
    pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3))
    const pulseMat = new THREE.ShaderMaterial({
      vertexShader: PULSE_VERT,
      fragmentShader: PULSE_FRAG,
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uAccent: { value: new THREE.Color(0xd8431d) },
        uDeep: { value: new THREE.Color(0x7a1e05) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
    group.add(new THREE.Points(pulseGeo, pulseMat))

    const randEdge = () => (Math.random() * edgeList.length) | 0

    const spawnPulse = () => {
      const e = randEdge()
      const [a, b] = edgeList[e]
      const flip = Math.random() < 0.5
      return {
        edge: e,
        from: flip ? b : a,
        to: flip ? a : b,
        t: Math.random(),
        speed: 0.8 + Math.random() * 0.5,
      }
    }

    for (let i = 0; i < CONFIG.pulseCount; i++) pulses.push(spawnPulse())

    // On arrival: flash the neuron, propagate along an adjacent edge
    const propagate = (p) => {
      const arrived = p.to
      intensity[arrived] = 1
      const options = adj[arrived]
      if (!options || options.length === 0) {
        Object.assign(p, spawnPulse(), { t: 0 })
        return
      }
      const forward = options.filter((eIdx) => {
        const [a, b] = edgeList[eIdx]
        const other = a === arrived ? b : a
        return other !== p.from
      })
      const pool = forward.length ? forward : options
      const eIdx = pool[(Math.random() * pool.length) | 0]
      const [a, b] = edgeList[eIdx]
      p.edge = eIdx
      p.from = arrived
      p.to = a === arrived ? b : a
      p.t = 0
      p.speed = 0.8 + Math.random() * 0.5
    }

    /* ── Mouse: parallax + local attraction ── */
    const mouseNDC = { x: 0, y: 0 }
    const onPointerMove = (e) => {
      const rect = mount.getBoundingClientRect()
      mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseNDC.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    // Per-node spring offsets (pulled toward cursor, spring back)
    const offset = new Float32Array(count * 3)
    const velocity = new Float32Array(count * 3)

    const clock = new THREE.Clock()
    let fireTimer = 0
    const mouseWorld = new THREE.Vector3()
    const mouseLocal = new THREE.Vector3()
    const rayDir = new THREE.Vector3()

    const update = (dt, t) => {
      const P = CONFIG

      // Spontaneous firing keeps the field alive
      fireTimer -= dt
      if (fireTimer <= 0) {
        const n = (Math.random() * count) | 0
        intensity[n] = Math.max(intensity[n], 0.85)
        fireTimer = 0.1 + Math.random() * Math.max(0.05, 1 - P.fireRate) * 0.8
      }

      // Intensity decay
      const decay = Math.exp(-2.6 * dt)
      for (let i = 0; i < count; i++) intensity[i] *= decay

      // Cloud rotation + camera parallax
      group.rotation.y = t * P.rotation + mouseNDC.x * 0.06
      group.rotation.x = -mouseNDC.y * 0.04
      camera.position.x += (mouseNDC.x * 1.1 - camera.position.x) * 0.04
      camera.position.y += (mouseNDC.y * 0.7 - camera.position.y) * 0.04
      camera.lookAt(0, 0, 0)

      // Cursor position on the z=0 plane, in the group's local space
      rayDir.set(mouseNDC.x, mouseNDC.y, 0.5).unproject(camera).sub(camera.position).normalize()
      mouseWorld.copy(camera.position).addScaledVector(rayDir, -camera.position.z / rayDir.z)
      group.worldToLocal(mouseLocal.copy(mouseWorld))

      const r2 = P.mouseRadius * P.mouseRadius
      const springK = 10 * dt
      const damp = Math.exp(-6 * dt)

      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const bx = base[i3]
        const by = base[i3 + 1]
        const bz = base[i3 + 2]

        // Ambient drift
        const dx = Math.cos(t * 0.35 + phase[i] * 1.7) * 0.3 * P.drift
        const dy = Math.sin(t * 0.5 + phase[i]) * 0.4 * P.drift

        // Mouse attraction (target offset, spring-integrated)
        const mx = mouseLocal.x - bx
        const my = mouseLocal.y - by
        const distSq = mx * mx + my * my
        let tx = 0
        let ty = 0
        if (distSq < r2 && distSq > 0.0001) {
          const dist = Math.sqrt(distSq)
          const pull = (1 - dist / P.mouseRadius) * P.mouseStrength
          tx = (mx / dist) * pull
          ty = (my / dist) * pull
          intensity[i] = Math.min(1, intensity[i] + (1 - dist / P.mouseRadius) * dt * 2.5)
        }
        velocity[i3] = (velocity[i3] + (tx - offset[i3]) * springK) * damp
        velocity[i3 + 1] = (velocity[i3 + 1] + (ty - offset[i3 + 1]) * springK) * damp
        offset[i3] += velocity[i3] * dt * 10
        offset[i3 + 1] += velocity[i3 + 1] * dt * 10

        neuronPos[i3] = bx + dx + offset[i3]
        neuronPos[i3 + 1] = by + dy + offset[i3 + 1]
        neuronPos[i3 + 2] = bz
      }
      neuronGeo.attributes.position.needsUpdate = true
      neuronGeo.attributes.aIntensity.needsUpdate = true

      // Synapse endpoints follow their neurons
      for (let e = 0; e < edgeList.length; e++) {
        const [a, b] = edgeList[e]
        const e6 = e * 6
        const a3 = a * 3
        const b3 = b * 3
        edgePos[e6] = neuronPos[a3]
        edgePos[e6 + 1] = neuronPos[a3 + 1]
        edgePos[e6 + 2] = neuronPos[a3 + 2]
        edgePos[e6 + 3] = neuronPos[b3]
        edgePos[e6 + 4] = neuronPos[b3 + 1]
        edgePos[e6 + 5] = neuronPos[b3 + 2]
      }
      edgeGeo.attributes.position.needsUpdate = true

      // Pulses ride the edges and propagate
      for (let i = 0; i < pulses.length; i++) {
        const p = pulses[i]
        p.t += (P.pulseSpeed * p.speed * dt) / edgeLen[p.edge]
        if (p.t >= 1) propagate(p)
        const a3 = p.from * 3
        const b3 = p.to * 3
        const i3 = i * 3
        pulsePos[i3] = neuronPos[a3] + (neuronPos[b3] - neuronPos[a3]) * p.t
        pulsePos[i3 + 1] = neuronPos[a3 + 1] + (neuronPos[b3 + 1] - neuronPos[a3 + 1]) * p.t
        pulsePos[i3 + 2] = neuronPos[a3 + 2] + (neuronPos[b3 + 2] - neuronPos[a3 + 2]) * p.t
      }
      pulseGeo.attributes.position.needsUpdate = true
    }

    /* ── Render loop with visibility gating ── */
    let raf = 0
    let running = false
    let inViewport = true

    const tick = () => {
      if (!running) return
      raf = requestAnimationFrame(tick)
      update(Math.min(clock.getDelta(), 0.05), clock.elapsedTime)
      renderer.render(scene, camera)
    }
    const start = () => {
      if (running || reduced || !inViewport || document.hidden) return
      running = true
      clock.getDelta()
      raf = requestAnimationFrame(tick)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    const io = new IntersectionObserver(([e]) => {
      inViewport = e.isIntersecting
      if (inViewport) start()
      else stop()
    })
    io.observe(mount)

    const onVisibility = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVisibility)

    const ro = new ResizeObserver(() => {
      width = mount.clientWidth
      height = mount.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      if (reduced) {
        update(0.016, 1)
        renderer.render(scene, camera)
      }
    })
    ro.observe(mount)

    if (reduced) {
      update(0.016, 1)
      renderer.render(scene, camera) // static frame only
    } else {
      start()
    }

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointerMove)
      neuronGeo.dispose()
      edgeGeo.dispose()
      pulseGeo.dispose()
      neuronMat.dispose()
      edgeMat.dispose()
      pulseMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} className={`neural-field ${className}`} aria-hidden="true" />
}
