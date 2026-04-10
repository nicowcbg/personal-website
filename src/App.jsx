import { useEffect, useRef, useState } from 'react'
import './App.css'
import lobbyLogo from './assets/LobbyLogo.png'
import mooneLogo from './assets/Moone_logo.png'
import slidlyLogo from './assets/slidly_logo.png'

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — CSS-driven, intersection-observed
 *
 *    0ms   page loads, nav fades in
 *  150ms   hero photo appears
 *  300ms   hero headline rises
 *  450ms   hero body fades in
 *  scroll  each section fades up on intersection
 * ───────────────────────────────────────────────────────── */

function useReveal(threshold = 0.05) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Check if already in viewport on mount
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

const VENTURES = [
  {
    name: 'Lobby',
    logo: lobbyLogo,
    role: 'Co-founder & CTO · 2023 – Present',
    desc: 'AI OS that handles your emails, calendar and sheets proactively. Backed by Betaworks.',
    url: 'https://thelobby.ai',
    badge: 'active',
    badgeLabel: 'Current',
  },
  {
    name: 'Moone',
    logo: mooneLogo,
    role: 'Co-founder & CTO · 2019 – 2022',
    desc: 'AI copilot for team feedback. Helped managers understand what their people actually think. Techstars \'21, backed by Comcast.',
    url: 'https://moonehq.com',
    badge: 'previous',
    badgeLabel: 'Previous',
  },
  {
    name: 'Slidly AI',
    logo: slidlyLogo,
    role: 'Side project · 2023 – Present',
    desc: 'Type one sentence, get a pitch deck. That simple.',
    url: null,
    badge: 'side',
    badgeLabel: 'Side project',
  },
]

const INTERESTS = ['Cocktails', 'Climbing', 'Esports', 'Guitar', 'Cognitive Science']

function App() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={`site ${loaded ? 'loaded' : ''}`}>
      {/* ─── NAV ─── */}
      <nav className="nav anim-in" style={{ transitionDelay: '0ms' }}>
        <a href="#" className="nav-name">NC</a>
        <ul className="nav-links">
          <li><a href="#thesis">Vision</a></li>
          <li><a href="#ventures">Ventures</a></li>
          <li><a href="#background">Background</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>

      {/* ─── HERO ─── */}
      <section className="hero">
        <div className="hero-intro">
          <img
            src="/profile.png"
            alt="Nicolas Cabrignac"
            className="hero-photo anim-in"
            style={{ transitionDelay: '150ms' }}
          />
          <div className="hero-text">
            <p className="hero-eyebrow anim-in" style={{ transitionDelay: '100ms' }}>
              Founder · San Francisco
            </p>
            <h1 className="anim-in-up" style={{ transitionDelay: '250ms' }}>
              Nicolas<br />Cabrignac
            </h1>
            <p className="hero-body anim-in" style={{ transitionDelay: '450ms' }}>
              2x founder backed by Betaworks and Techstars. On a mission to build the first generation of truly autonomous agents.
            </p>
          </div>
        </div>
      </section>

      {/* ─── THESIS ─── */}
      <section className="section" id="thesis">
        <Reveal>
          <p className="section-label">How I see things</p>
        </Reveal>
        <Reveal delay={80}>
          <p className="thesis-text">
            The best AI doesn't feel like <em>software.</em><br />
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

      {/* ─── VENTURES ─── */}
      <section className="section" id="ventures">
        <Reveal>
          <p className="section-label">What I'm building</p>
        </Reveal>
        <div className="ventures-grid">
          {VENTURES.map((v, i) => (
            <Reveal key={v.name} delay={i * 80}>
              {v.url ? (
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="venture-card"
                >
                  <div className="venture-main">
                    <div className="venture-header">
                      <img src={v.logo} alt={v.name} className="venture-logo" />
                      <div>
                        <div className="venture-name">{v.name}</div>
                        <div className="venture-role">{v.role}</div>
                      </div>
                    </div>
                    <div className="venture-desc">{v.desc}</div>
                  </div>
                  <div className="venture-meta">
                    <span className={`venture-badge ${v.badge}`}>{v.badgeLabel}</span>
                    <span className="venture-arrow">&#8599;</span>
                  </div>
                </a>
              ) : (
                <div className="venture-card venture-card--static">
                  <div className="venture-main">
                    <div className="venture-header">
                      <img src={v.logo} alt={v.name} className="venture-logo" />
                      <div>
                        <div className="venture-name">{v.name}</div>
                        <div className="venture-role">{v.role}</div>
                      </div>
                    </div>
                    <div className="venture-desc">{v.desc}</div>
                  </div>
                  <div className="venture-meta">
                    <span className={`venture-badge ${v.badge}`}>{v.badgeLabel}</span>
                  </div>
                </div>
              )}
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── BACKGROUND ─── */}
      <section className="section" id="background">
        <Reveal>
          <p className="section-label">A bit about me</p>
        </Reveal>
        <div className="bg-grid">
          <Reveal delay={50}>
            <a
              href="https://ieeexplore.ieee.org/abstract/document/9477765"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card featured full"
            >
              <p className="bg-label">Published research · IEEE</p>
              <p className="bg-title featured-title">Trust between humans and automated systems</p>
              <p className="bg-detail">Peer-reviewed paper on how people build and calibrate trust with autonomous systems. Turns out it's the same problem AI agents face today.</p>
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
          <Reveal delay={300}>
            <div className="bg-card full">
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

      {/* ─── CLIMBING ─── */}
      <section className="section" id="climbing">
        <Reveal>
          <p className="section-label">When I'm not coding</p>
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
            I'm always up for a <em>good conversation.</em>
          </p>
        </Reveal>
        <Reveal delay={80}>
          <div className="footer-links">
            <a href="mailto:cabri.nico@gmail.com" className="footer-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              cabri.nico@gmail.com
            </a>
            <a href="https://twitter.com/nicowcbg" target="_blank" rel="noopener noreferrer" className="footer-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              @Nicowcbg
            </a>
            <a href="https://www.linkedin.com/in/nicolas-cabrignac/" target="_blank" rel="noopener noreferrer" className="footer-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
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
