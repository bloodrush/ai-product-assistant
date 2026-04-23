const PHASES = [
  { id: 1, label: 'Understand the Problem' },
  { id: 2, label: 'Validate the Problem' },
  { id: 3, label: 'Forge the Solution' },
  { id: 4, label: 'Write the Stories' },
  { id: 5, label: 'Launch Prep' },
]

export default function PhaseIndicator({ currentPhase = 1 }) {
  return (
    <div className="phase-indicator">
      {PHASES.map((phase, index) => {
        const isActive = phase.id === currentPhase
        const isComplete = phase.id < currentPhase
        const isFuture = phase.id > currentPhase

        return (
          <div key={phase.id} className="phase-item">
            <div className={`phase-dot ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''} ${isFuture ? 'future' : ''}`}>
              {isComplete ? '✓' : phase.id}
            </div>
            <span className={`phase-label ${isActive ? 'active' : ''} ${isFuture ? 'future' : ''}`}>
              {phase.label}
            </span>
            {index < PHASES.length - 1 && (
              <div className={`phase-connector ${isComplete ? 'complete' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
