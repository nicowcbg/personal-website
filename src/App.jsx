import { lazy, Suspense } from 'react'
import './App.css'

// The whole experience is a WebGL journey — split three.js into its own
// chunk and show a minimal boot mark while it loads.
const MindJourney = lazy(() => import('./components/MindJourney.jsx'))

export default function App() {
  return (
    <Suspense fallback={<div className="boot">NC</div>}>
      <MindJourney />
    </Suspense>
  )
}
