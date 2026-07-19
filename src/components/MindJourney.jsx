import { useEffect, useRef } from 'react'
import { createJourneyScene } from '../scene/journeyScene.js'
import lobbyLogo from '../assets/LobbyLogo.png'
import hypnoIcon from '../assets/hypno_icon.svg'
import mooneLogo from '../assets/Moone_logo.png'
import slidlyLogo from '../assets/slidly_logo.png'

/* ─────────────────────────────────────────────────────────
 * MIND JOURNEY — scroll-driven dive
 *
 * The page is a 900vh scroll track; a smoothed progress
 * value p ∈ [0,1] drives the 3D scene and every overlay:
 *
 *  0.00       hero headline, orb in view
 *  0.00–0.32  approach the orb
 *  0.32–0.42  through the glass (fog haze peaks at 0.37)
 *  0.42–0.52  the storm deploys, the synapse fades in
 *  0.52–1.00  travel along the synapse; projects fade
 *             in/out one by one; contact at the end
 * ───────────────────────────────────────────────────────── */

const NODE_TS = [0.195, 0.43, 0.67, 0.885, 0.985]

const PROJECTS = [
  {
    id: 'lobby',
    logo: lobbyLogo,
    name: 'Lobby',
    line: 'Agents that understand how you think.',
    url: 'https://thelobby.ai',
    win: [0.52, 0.548, 0.612, 0.64],
  },
  {
    id: 'hypnobuild',
    logo: hypnoIcon,
    name: 'Hypnobuild',
    line: 'Mobile-native coding agents.',
    url: 'https://hypnobuild.com',
    win: [0.632, 0.66, 0.722, 0.75],
  },
  {
    id: 'moone',
    logo: mooneLogo,
    name: 'Moone',
    line: 'AI copilot for team feedback.',
    url: null,
    win: [0.742, 0.77, 0.832, 0.86],
  },
  {
    id: 'slidly',
    logo: slidlyLogo,
    name: 'Slidly AI',
    line: 'One sentence in, a pitch deck out.',
    url: null,
    win: [0.852, 0.88, 0.927, 0.955],
  },
]

const HERO_WIN = [-1, 0, 0.08, 0.13]
const CONTACT_WIN = [0.95, 0.985, 2, 2]
const CENTER_AT = [0, 0.58, 0.691, 0.801, 0.903, 0.97] // intro, 4 projects, contact
const TOTAL = CENTER_AT.length

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const smooth = (k) => {
  const x = clamp01(k)
  return x * x * (3 - 2 * x)
}
const winOpacity = (p, [a, b, c, d]) => smooth((p - a) / (b - a)) * (1 - smooth((p - c) / (d - c)))

export default function MindJourney() {
  const canvasRef = useRef(null)
  const hazeRef = useRef(null)
  const heroRef = useRef(null)
  const hintRef = useRef(null)
  const indexRef = useRef(null)
  const contactRef = useRef(null)
  const projRefs = useRef([])

  useEffect(() => {
    const scene = createJourneyScene(canvasRef.current, { nodeTs: NODE_TS })
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const onResize = () => scene.resize(window.innerWidth, window.innerHeight)
    onResize()
    window.addEventListener('resize', onResize)

    const onPointer = (e) => {
      scene.setPointer(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1)
      )
    }
    if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true })

    const setOv = (el, o, clickable) => {
      if (!el) return
      el.style.opacity = o.toFixed(3)
      el.style.transform = `translateY(${((1 - o) * 18).toFixed(1)}px)`
      el.style.pointerEvents = clickable && o > 0.45 ? 'auto' : 'none'
    }

    let raf = 0
    let last = performance.now()
    let sm = 0
    let t = 0
    let shownIndex = -1

    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      t += dt

      const max = document.documentElement.scrollHeight - window.innerHeight
      const raw = max > 0 ? Math.min(window.scrollY / max, 1) : 0
      sm += (raw - sm) * (reduced ? 1 : 1 - Math.exp(-dt * 5))

      scene.update(sm, dt, t)

      // hero + scroll hint
      setOv(heroRef.current, winOpacity(sm, HERO_WIN), false)
      if (hintRef.current) hintRef.current.style.opacity = (1 - smooth(sm / 0.03)).toFixed(3)

      // fog haze while crossing the glass — thickens then clears
      const g = Math.exp(-Math.pow((sm - 0.37) / 0.04, 2))
      if (hazeRef.current) {
        const hazeOn = g > 0.01
        hazeRef.current.style.opacity = (g * 0.85).toFixed(3)
        hazeRef.current.style.visibility = hazeOn ? 'visible' : 'hidden'
        if (hazeOn) {
          const blur = (g * 12).toFixed(1)
          hazeRef.current.style.backdropFilter = `blur(${blur}px)`
          hazeRef.current.style.webkitBackdropFilter = `blur(${blur}px)`
        }
      }

      // projects
      for (let i = 0; i < PROJECTS.length; i++) {
        setOv(projRefs.current[i], winOpacity(sm, PROJECTS[i].win), !!PROJECTS[i].url)
      }

      // contact outro
      setOv(contactRef.current, winOpacity(sm, CONTACT_WIN), true)

      // progress index
      let idx = 0
      for (let i = 0; i < CENTER_AT.length; i++) {
        if (sm >= CENTER_AT[i] - 0.04) idx = i
      }
      if (idx !== shownIndex && indexRef.current) {
        shownIndex = idx
        indexRef.current.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(TOTAL).padStart(2, '0')}`
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointer)
      scene.dispose()
    }
  }, [])

  return (
    <>
      {/* scroll track: the journey's length */}
      <div className="scroll-space" aria-hidden="true" />

      <canvas ref={canvasRef} className="journey-canvas" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div ref={hazeRef} className="haze" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="frame-marks" aria-hidden="true">
        <span className="fm-tl" />
        <span className="fm-tr" />
        <span className="fm-bl" />
        <span className="fm-br" />
      </div>

      <header className="chrome">
        <a
          className="chrome-name"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <img className="chrome-photo" src="/profile.png" alt="Nicolas Cabrignac" />
          Nicolas Cabrignac
        </a>
        <a className="chrome-mail" href="mailto:cabri.nico@gmail.com">
          cabri.nico@gmail.com
        </a>
      </header>

      {/* hero */}
      <div className="ov ov-hero-pos" ref={heroRef} style={{ opacity: 0 }}>
        <h1 className="hero-title">
          Building a new era of<br />human and computer interaction
        </h1>
      </div>
      <div className="scroll-hint" ref={hintRef} aria-hidden="true">
        <span>scroll</span>
        <span className="scroll-hint-line" />
      </div>

      {/* projects along the synapse */}
      {PROJECTS.map((p, i) => {
        const inner = (
          <>
            <img className="proj-logo" src={p.logo} alt="" />
            <div>
              <p className="proj-name">{p.name}</p>
              <p className="proj-line">{p.line}</p>
              {p.url && (
                <span className="proj-btn">{p.url.replace('https://', '')} &#8599;</span>
              )}
            </div>
          </>
        )
        return (
          <div className="ov ov-proj-pos" key={p.id}>
            {p.url ? (
              <a
                className="proj"
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ opacity: 0 }}
                ref={(el) => (projRefs.current[i] = el)}
              >
                {inner}
              </a>
            ) : (
              <div className="proj" style={{ opacity: 0 }} ref={(el) => (projRefs.current[i] = el)}>
                {inner}
              </div>
            )}
          </div>
        )
      })}

      {/* contact outro */}
      <div className="ov ov-contact-pos">
        <div className="contact" ref={contactRef} style={{ opacity: 0 }}>
          <h2 className="contact-name">Nicolas Cabrignac</h2>
          <p className="contact-sub">Founder · San Francisco</p>
          <div className="contact-links">
            <a href="mailto:cabri.nico@gmail.com">cabri.nico@gmail.com</a>
            <a href="https://twitter.com/nicowcbg" target="_blank" rel="noopener noreferrer">@nicowcbg</a>
            <a href="https://www.linkedin.com/in/nicolas-cabrignac/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          </div>
        </div>
      </div>

      <div className="journey-index" ref={indexRef} aria-hidden="true">
        01 / 06
      </div>
    </>
  )
}
