const PHASES = [
  { id: 1, label: 'Understand the Problem', color: '#f58916', desc: 'What is actually broken?' },
  { id: 2, label: 'Validate the Problem',   color: '#3dba7e', desc: 'Is it worth solving?' },
  { id: 3, label: 'Forge the Solution',     color: '#5b9cf6', desc: 'Shape the right response' },
  { id: 4, label: 'Write the Stories',      color: '#9b7ef0', desc: 'Break into buildable work' },
  { id: 5, label: 'Launch Prep',            color: '#3dbab3', desc: 'Get to ship-ready' },
]

export default function PhaseSidebar({ currentPhase = 1, collapsed, onToggleCollapse, theme, onThemeChange, showDocPanel, onToggleDocPanel, onStartNew }) {
  return (
    <div className={`phase-sidebar${collapsed ? ' collapsed' : ''}`}>

      <div className={`sidebar-logo${collapsed ? '' : ' expanded'}`}>
        {collapsed ? (
          <svg width="10" height="13" viewBox="0 0 10 13" fill="none">
            <polyline points="1,1 8,6.5 1,12" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <div className="sidebar-wordmark">
            <span className="sidebar-wordmark-underscore">_</span>
            <span className="sidebar-wordmark-text">forg</span>
            <svg width="8" height="10" viewBox="0 0 8 10" fill="none" style={{ flexShrink: 0, marginBottom: 1 }}>
              <polyline points="1,1 7,5 1,9" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>

      {collapsed ? (
        <div className="sidebar-collapsed-phases">
          {PHASES.map(ph => {
            const isActive = ph.id === currentPhase
            const isDone   = ph.id < currentPhase
            return (
              <div key={ph.id} className="collapsed-node" style={
                isActive ? { borderColor: ph.color, color: ph.color, background: `${ph.color}18` } :
                isDone   ? { borderColor: 'var(--border-light)' } : {}
              }>
                {isDone ? '✓' : ph.id}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="phase-list">
          <div className="phase-track">
            {PHASES.map(ph => {
              const isActive = ph.id === currentPhase
              const isDone   = ph.id < currentPhase
              return (
                <div key={ph.id} className={`phase-item${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}>
                  <div className="phase-node" style={
                    isActive ? { borderColor: ph.color, color: ph.color, background: `${ph.color}18` } :
                    isDone   ? { borderColor: 'var(--border-light)' } : {}
                  }>
                    {isDone ? '✓' : ph.id}
                  </div>
                  <div className="phase-meta">
                    <div className="phase-name">{ph.label}</div>
                    {isActive && <div className="phase-desc">{ph.desc}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="sidebar-spacer" />

      {!collapsed && (
        <div className="sidebar-settings">
          <div className="settings-label">Theme</div>
          <div className="theme-btns">
            {['dark', 'light', 'slate'].map(t => (
              <button
                key={t}
                className={`theme-btn${theme === t ? ' on' : ''}`}
                onClick={() => onThemeChange(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="settings-toggle-row">
            <span>Outcome panel</span>
            <button
              className={`tog${showDocPanel ? ' on' : ''}`}
              onClick={onToggleDocPanel}
            />
          </div>
          {onStartNew && (
            <button className="start-new-btn" onClick={onStartNew}>
              Start new discovery
            </button>
          )}
        </div>
      )}

      <div className="sidebar-collapse-btn">
        <button className="collapse-toggle" onClick={onToggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
            <polyline points="8,1 3,6 8,11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

    </div>
  )
}
