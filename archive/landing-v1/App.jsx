import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import './App.css'
import EegDivider from './components/EegDivider.jsx'
import lobbyLogo from './assets/LobbyLogo.png'
import hypnoIcon from './assets/hypno_icon.svg'
import mooneLogo from './assets/Moone_logo.png'
import slidlyLogo from './assets/slidly_logo.png'

// three.js is heavy — load the neural scene in its own chunk, after first paint
const NeuralField = lazy(() => import('./components/NeuralField.jsx'))

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Cognition journal
 *
 *    0ms   nav fades in; neural field comes alive behind hero
 *  150ms   hero photo appears
 *  250ms   hero headline rises (24px travel)
 *  450ms   hero body fades in
 *  scroll  progress line sweeps the top edge
 *          hero content parallaxes up; the field zooms + fades
 *          ambient blobs drift with scroll progress
 *          sections reveal blur → sharp; label rules draw in
 *          EEG dividers heartbeat as they cross mid-viewport
 *          work media drifts against scroll (parallax)
 *          edge rail tracks the active section
 *  hover   work cards tilt toward cursor, specular sheen follows
 *          interest tags pop with spring physics
 *  always  pulses propagate through the network; cursor stirs it
 * ───────────────────────────────────────────────────────── */

function useReveal(threshold = 0.05) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true)
      return
    }

    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return [ref, visible]
}

function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }) {
  const [ref, visible] = useReveal()
  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'revealed' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}

/* ── Scroll FX: progress, parallax, ambient drift, divider heartbeat ── */
function useScrollFX() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const bar = document.querySelector('.scroll-progress')
    const hero = document.querySelector('.hero')
    const inner = document.querySelector('.hero-inner')
    const cue = document.querySelector('.scroll-cue')
    const blobA = document.querySelector('.blob-a')
    const blobB = document.querySelector('.blob-b')
    const blobC = document.querySelector('.blob-c')
    let field = document.querySelector('.neural-field')
    const mediaImgs = Array.from(document.querySelectorAll('.work-media > img'))

    let raf = 0
    let scheduled = false

    const update = () => {
      scheduled = false
      const y = window.scrollY
      const vh = window.innerHeight
      const max = document.documentElement.scrollHeight - vh
      const page = max > 0 ? Math.min(y / max, 1) : 0

      if (bar) bar.style.transform = `scaleX(${page})`
      if (reduced) return

      // Ambient warm blobs drift as you travel down the page
      if (blobA) blobA.style.transform = `translate3d(${(page * 12).toFixed(2)}vw, ${(page * 30).toFixed(2)}vh, 0)`
      if (blobB) blobB.style.transform = `translate3d(${(-page * 10).toFixed(2)}vw, ${(page * 22).toFixed(2)}vh, 0)`
      if (blobC) blobC.style.transform = `translate3d(${(page * 6).toFixed(2)}vw, ${(-page * 18).toFixed(2)}vh, 0)`

      if (hero && inner) {
        const p = Math.min(y / (hero.offsetHeight * 0.85), 1)
        inner.style.transform = `translateY(${(y * 0.22).toFixed(1)}px)`
        inner.style.opacity = (1 - p * 0.9).toFixed(3)
        if (cue) cue.style.opacity = Math.max(1 - p * 3, 0).toFixed(3)
        if (!field) field = document.querySelector('.neural-field')
        if (field) {
          field.style.transform = `scale(${(1 + p * 0.08).toFixed(4)})`
          field.style.opacity = (1 - p * 0.55).toFixed(3)
        }
      }

      for (const img of mediaImgs) {
        const r = img.parentElement.getBoundingClientRect()
        if (r.bottom < -100 || r.top > vh + 100) continue
        const prog = (r.top + r.height / 2 - vh / 2) / (vh / 2)
        const py = Math.max(-1, Math.min(1, prog)) * -10
        img.style.setProperty('--py', `${py.toFixed(1)}px`)
      }
    }

    const onScroll = () => {
      if (!scheduled) {
        scheduled = true
        raf = requestAnimationFrame(update)
      }
    }

    // EEG dividers fire a heartbeat as they cross mid-viewport
    let beatObs
    const dividers = Array.from(document.querySelectorAll('.eeg-divider'))
    if (!reduced && dividers.length) {
      beatObs = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add('beat')
              setTimeout(() => e.target.classList.remove('beat'), 950)
            }
          }
        },
        { rootMargin: '-40% 0px -40% 0px' }
      )
      dividers.forEach((d) => beatObs.observe(d))
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
      if (beatObs) beatObs.disconnect()
    }
  }, [])
}

/* ── Edge rail: fixed section index (desktop only) ── */
const RAIL_SECTIONS = [
  { id: 'thesis', num: '01' },
  { id: 'work', num: '02' },
  { id: 'background', num: '03' },
  { id: 'climbing', num: '04' },
]

function SectionRail() {
  const [active, setActive] = useState('')

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id)
        }
      },
      { rootMargin: '-45% 0px -45% 0px' }
    )
    for (const { id } of RAIL_SECTIONS) {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [])

  return (
    <nav className="rail" aria-label="Section index">
      {RAIL_SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`rail-item ${active === s.id ? 'active' : ''}`}
        >
          <span className="rail-num">{s.num}</span>
          <span className="rail-line" />
        </a>
      ))}
    </nav>
  )
}

function SectionLabel({ num, children }) {
  return (
    <p className="section-label">
      <span className="section-num">{num}</span>
      {children}
    </p>
  )
}

/* ── Project data ───────────────────────────────────────── */
const PROJECTS = [
  {
    id: 'lobby',
    name: 'Lobby',
    logo: lobbyLogo,
    meta: 'Co-founder & CTO · 2023 — Present',
    badge: 'Current',
    tagline: 'An OS for work, driven by how you think.',
    desc: 'Lobby builds extensions of human cognition: agents that learn how you prioritize, delegate and decide, then handle your email, calendar and sheets before you ask. Backed by Betaworks.',
    url: 'https://thelobby.ai',
    linkLabel: 'thelobby.ai',
    accent: '#3B63E0',
    media: {
      type: 'image',
      src: '/work/lobby.jpg',
      alt: 'Lobby — a live behavioral model of human cognition',
    },
  },
  {
    id: 'hypnobuild',
    name: 'Hypnobuild',
    logo: hypnoIcon,
    meta: 'Side project · 2026 — Present',
    badge: 'Side project',
    tagline: 'Code from your pocket.',
    desc: 'A mobile-native AI coding agent. Describe what you want from your phone, Hypnobuild writes and edits the code for you — and notifies you when the work is done.',
    url: 'https://hypnobuild.com',
    linkLabel: 'hypnobuild.com',
    accent: '#1FA853',
    media: {
      type: 'image',
      src: '/work/hypnobuild.jpg',
      alt: 'Hypnobuild — an AI coding agent editing files with live diffs',
    },
  },
  {
    id: 'moone',
    name: 'Moone',
    logo: mooneLogo,
    meta: 'Co-founder & CTO · 2019 — 2022',
    badge: 'Previous',
    tagline: 'What your team actually thinks, made legible.',
    desc: 'An AI copilot for team feedback. Moone turned pulse surveys into a clear, honest read on morale and alignment — and told managers where to act. Techstars \'21, backed by Comcast.',
    url: null,
    accent: '#D97706',
    media: { type: 'mock-moone' },
  },
  {
    id: 'slidly',
    name: 'Slidly AI',
    logo: slidlyLogo,
    meta: 'Side project · 2023 — Present',
    badge: 'Side project',
    tagline: 'One sentence in. A pitch deck out.',
    desc: 'An experiment in generative storytelling — describe an idea in a single line and Slidly structures, writes and designs the deck.',
    url: null,
    accent: '#7C3AED',
    media: { type: 'mock-slidly' },
  },
]

/* ── Abstract product panels (for projects without a live URL) ── */
function MooneMock() {
  const rows = [
    { label: 'Energy', value: 78, delta: '+6' },
    { label: 'Alignment', value: 64, delta: '+2' },
    { label: 'Workload', value: 41, delta: '-9' },
    { label: 'Trust', value: 86, delta: '+4' },
  ]
  return (
    <div className="work-mock">
      <div className="mock-panel">
        <div className="mock-head">
          <span>team sentiment · wk 24</span>
        </div>
        <div className="mock-rows">
          {rows.map((r) => (
            <div className="mock-row" key={r.label}>
              <span className="mock-row-label">{r.label}</span>
              <span className="mock-bar">
                <span className="mock-bar-fill" style={{ width: `${r.value}%` }} />
              </span>
              <span className={`mock-delta ${r.delta.startsWith('-') ? 'neg' : ''}`}>{r.delta}</span>
            </div>
          ))}
        </div>
        <div className="mock-foot">summary ready — 3 actions suggested</div>
      </div>
    </div>
  )
}

function SlidlyMock() {
  return (
    <div className="work-mock">
      <div className="mock-panel">
        <div className="mock-head">
          <span>slidly.ai</span>
        </div>
        <div className="mock-input">
          <span className="mock-caret">›</span>
          <span className="mock-input-text">a deck about the future of compute</span>
          <span className="mock-cursor" />
        </div>
        <div className="mock-slides">
          <div className="mock-slide" />
          <div className="mock-slide" />
          <div className="mock-slide" />
        </div>
        <div className="mock-foot">12 slides generated</div>
      </div>
    </div>
  )
}

/* ── Work cards ─────────────────────────────────────────── */
const TILT_ENABLED =
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

function WorkCard({ project, index }) {
  const num = String(index + 1).padStart(2, '0')
  const Tag = project.url ? 'a' : 'div'
  const linkProps = project.url
    ? { href: project.url, target: '_blank', rel: 'noopener noreferrer' }
    : {}

  // Cursor-tracked tilt + specular sheen (vars smoothed by the CSS transition)
  const onPointerMove = (e) => {
    if (!TILT_ENABLED) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    const el = e.currentTarget
    el.style.setProperty('--ry', `${((px - 0.5) * 3.5).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${((0.5 - py) * 2.5).toFixed(2)}deg`)
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
  }

  const onPointerLeave = (e) => {
    if (!TILT_ENABLED) return
    const el = e.currentTarget
    el.style.removeProperty('--rx')
    el.style.removeProperty('--ry')
    el.style.removeProperty('--mx')
    el.style.removeProperty('--my')
  }

  return (
    <Tag
      className="work-card"
      style={{ '--vaccent': project.accent }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      {...linkProps}
    >
      <div className="work-media">
        {project.media.type === 'image' && (
          <img src={project.media.src} alt={project.media.alt} loading="lazy" />
        )}
        {project.media.type === 'mock-moone' && <MooneMock />}
        {project.media.type === 'mock-slidly' && <SlidlyMock />}
      </div>
      <div className="work-body">
        <p className="work-meta">
          <img className="work-chip" src={project.logo} alt="" />
          <span className="work-num">{num}</span>
          <span>{project.meta}</span>
          <span className="work-badge">{project.badge}</span>
        </p>
        <h3 className="work-name">{project.name}</h3>
        <p className="work-tagline">{project.tagline}</p>
        <p className="work-desc">{project.desc}</p>
        {project.url && (
          <span className="work-link">{project.linkLabel} &#8599;</span>
        )}
      </div>
    </Tag>
  )
}

/* ── Main App ───────────────────────────────────────────── */
function App() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 50)
    return () => clearTimeout(timer)
  }, [])

  useScrollFX()

  return (
    <div className={`site ${loaded ? 'loaded' : ''}`}>
      <div className="bg-wash" aria-hidden="true">
        <div className="blob blob-a" />
        <div className="blob blob-b" />
        <div className="blob blob-c" />
      </div>
      <div className="scroll-progress" />
      <SectionRail />

      {/* ─── NAV ─── */}
      <nav className="nav anim-in" style={{ transitionDelay: '0ms' }}>
        <a href="#" className="nav-name">NC</a>
        <ul className="nav-links">
          <li><a href="#thesis">vision</a></li>
          <li><a href="#work">work</a></li>
          <li><a href="#background">background</a></li>
          <li><a href="#contact">contact</a></li>
        </ul>
      </nav>

      {/* ─── HERO ─── */}
      <section className="hero">
        <Suspense fallback={null}>
          <NeuralField />
        </Suspense>
        <div className="hero-inner">
          <img
            src="/profile.png"
            alt="Nicolas Cabrignac"
            className="hero-photo anim-in"
            style={{ transitionDelay: '150ms' }}
          />
          <p className="hero-status anim-in" style={{ transitionDelay: '100ms' }}>
            <span className="status-dot" />
            Founder · San Francisco
          </p>
          <h1 className="anim-in-up" style={{ transitionDelay: '250ms' }}>
            Nicolas<br />Cabrignac
          </h1>
          <p className="hero-body anim-in" style={{ transitionDelay: '450ms' }}>
            2x founder backed by Betaworks and Techstars. Cognitive scientist by training — on a mission to build the first generation of truly autonomous agents.
          </p>
        </div>
        <div className="scroll-cue anim-in" style={{ transitionDelay: '900ms' }}>
          <span>scroll</span>
          <div className="scroll-cue-line" />
        </div>
      </section>

      <EegDivider />

      {/* ─── THESIS ─── */}
      <section className="section" id="thesis">
        <Reveal>
          <SectionLabel num="01">How I see things</SectionLabel>
        </Reveal>
        <Reveal delay={80}>
          <p className="thesis-text">
            The best AI doesn&apos;t feel like <em>software.</em><br />
            It feels like someone who <em>already knows</em> how you think.
          </p>
        </Reveal>
        <Reveal delay={160}>
          <p className="thesis-detail">
            I&apos;ve spent years doing research in HCI around trust in automated systems: how humans delegate, when they let go of control, and what makes automation feel legitimate. Today, I&apos;m building autonomous agents that people can trust.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <p className="thesis-detail">
            AI systems now have extraordinary technical capability. They can use tools, call APIs, and complete increasingly complex tasks. But context without understanding is not intelligence. Without a model of how someone thinks, how they work, and how their organization operates, an agent is simply executing instructions in the dark. That is why today&apos;s interaction model remains so fragile: prompt, correct, prompt again. It works until it doesn&apos;t, and when it fails, the flaw is structural.
          </p>
        </Reveal>
        <Reveal delay={320}>
          <p className="thesis-detail">
            I&apos;m building Lobby to change that. Lobby is a knowledge base of human cognitive frameworks for autonomous agents. It gives agents the context they need to understand a person, operate within their environment, and align with how a company actually runs. The result is software that can become genuinely proactive, reliable, and useful at the level of real work. Lobby is already proving this in email, where it predicts and executes workflows across multiple tools with near-perfect accuracy.
          </p>
        </Reveal>
      </section>

      <EegDivider />

      {/* ─── WORK ─── */}
      <section className="section section--band" id="work" style={{ '--band': 'rgba(216, 67, 29, 0.032)' }}>
        <Reveal>
          <SectionLabel num="02">Selected work</SectionLabel>
        </Reveal>
        <div className="work-list">
          {PROJECTS.map((p, i) => (
            <Reveal key={p.id} delay={i * 60}>
              <WorkCard project={p} index={i} />
            </Reveal>
          ))}
        </div>
      </section>

      <EegDivider />

      {/* ─── BACKGROUND ─── */}
      <section className="section section--band" id="background" style={{ '--band': 'rgba(47, 70, 196, 0.028)' }}>
        <Reveal>
          <SectionLabel num="03">A bit about me</SectionLabel>
        </Reveal>
        <div className="bg-grid">
          <Reveal delay={50} className="full">
            <a
              href="https://ieeexplore.ieee.org/abstract/document/9477765"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card featured"
            >
              <p className="bg-label">Published research · IEEE</p>
              <p className="bg-title featured-title">Trust between humans and automated systems</p>
              <p className="bg-detail">Peer-reviewed paper on how people build and calibrate trust with autonomous systems. Turns out it&apos;s the same problem AI agents face today.</p>
              <span className="bg-link">Read on IEEE &#8599;</span>
            </a>
          </Reveal>
          <Reveal delay={100}>
            <div className="bg-card">
              <p className="bg-label">Technical skills</p>
              <div className="interests-row">
                <span className="interest-tag">Cognitive Science</span>
                <span className="interest-tag">HCI / Trust in Automation</span>
                <span className="interest-tag">Full-stack Development</span>
                <span className="interest-tag">AI / LLM Systems</span>
                <span className="interest-tag">UX Research</span>
                <span className="interest-tag">Design</span>
                <span className="interest-tag">Product Architecture</span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="bg-card">
              <p className="bg-label">Experience</p>
              <p className="bg-title">Product Management — Airbnb</p>
              <p className="bg-sub">2018–2021 · Team listing</p>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="bg-card">
              <p className="bg-label">Education</p>
              <p className="bg-title">MSc Cognitive Sciences</p>
              <p className="bg-detail">Neuroscience, HCI, human decision-making</p>
            </div>
          </Reveal>
          <Reveal delay={250}>
            <div className="bg-card">
              <p className="bg-label">Education</p>
              <p className="bg-title">BSc Health Sciences</p>
              <p className="bg-sub">Universit&eacute; Paris Cit&eacute; · 2014–2017</p>
            </div>
          </Reveal>
          <Reveal delay={300} className="full">
            <div className="bg-card">
              <p className="bg-label">Things I love</p>
              <div className="interests-row">
                <span className="interest-tag">Making cocktails</span>
                <span className="interest-tag">Climbing walls</span>
                <span className="interest-tag">Playing guitar (badly)</span>
                <span className="interest-tag">Esports nerd</span>
                <span className="interest-tag">Top 100 Hearthstone EU (not bad)</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <EegDivider />

      {/* ─── CLIMBING ─── */}
      <section className="section" id="climbing">
        <Reveal>
          <SectionLabel num="04">When I&apos;m not coding</SectionLabel>
        </Reveal>
        <Reveal delay={80}>
          <div className="video-carousel">
            {['/videos/Climbing1.mov', '/videos/Climb2.mp4', '/videos/Climb 3.mov'].map((src, i) => (
              <video
                key={i}
                className="video-card"
                src={src}
                muted
                autoPlay
                loop
                playsInline
              />
            ))}
          </div>
        </Reveal>
      </section>

      {/* ─── FOOTER / CONTACT ─── */}
      <footer className="footer" id="contact">
        <Reveal>
          <p className="footer-cta">
            I&apos;m always up for a <em>good conversation.</em>
          </p>
        </Reveal>
        <Reveal delay={80}>
          <div className="footer-links">
            <a href="mailto:cabri.nico@gmail.com" className="footer-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              cabri.nico@gmail.com
            </a>
            <a href="https://twitter.com/nicowcbg" target="_blank" rel="noopener noreferrer" className="footer-link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              @Nicowcbg
            </a>
            <a href="https://www.linkedin.com/in/nicolas-cabrignac/" target="_blank" rel="noopener noreferrer" className="footer-link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              LinkedIn
            </a>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <p className="footer-bottom">
            Based in San Francisco. French. O-1 visa. Probably making a cocktail right now.
          </p>
        </Reveal>
      </footer>
    </div>
  )
}

export default App
