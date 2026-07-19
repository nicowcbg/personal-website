/* ─────────────────────────────────────────────────────────
 * EEG DIVIDER — section separator
 *
 * A flat-line EEG trace with a bright "heartbeat" segment
 * sweeping left → right (stroke-dashoffset animation).
 * ───────────────────────────────────────────────────────── */

const TRACE =
  'M0 20 H168 l5 -7 5 14 5 -11 5 4 H296 l4 -13 5 21 4 -8 H424 l5 -6 5 11 5 -5 H600'

export default function EegDivider() {
  return (
    <div className="eeg-divider" aria-hidden="true">
      <svg
        viewBox="0 0 600 40"
        preserveAspectRatio="none"
        className="eeg-svg"
        focusable="false"
      >
        <path d={TRACE} pathLength="600" className="eeg-trace" fill="none" vectorEffect="non-scaling-stroke" />
        <path d={TRACE} pathLength="600" className="eeg-pulse" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
