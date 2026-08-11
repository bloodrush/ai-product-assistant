import { useState } from 'react'

function ScorePips({ score, max = 5 }) {
  return (
    <div className="score-pips">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} className={`score-pip${i < score ? ' filled' : ''}`} />
      ))}
    </div>
  )
}

function UseCaseCard({ uc }) {
  const [open, setOpen] = useState(false)
  const isLow = uc.lowEvidence

  return (
    <div className={`ts-uc-card${isLow ? ' low-evidence' : ''}`}>
      <div className="ts-uc-header" onClick={() => setOpen(o => !o)}>
        <div className="ts-uc-header-top">
          <span className="ts-uc-title">{uc.title}</span>
          <span className={`ts-evidence-badge${isLow ? ' low' : uc.mentionCount >= 3 ? ' high' : ''}`}>
            {uc.evidence}
          </span>
        </div>
        <svg
          className={`ts-uc-chevron${open ? ' open' : ''}`}
          width="10" height="10" viewBox="0 0 10 10" fill="none"
        >
          <polyline points="2,3 5,7 8,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {open && (
        <div className="ts-uc-body">
          {uc.description && <p className="ts-uc-desc">{uc.description}</p>}

          <div className="ai-uc-fields">
            {[
              ['Current process',  uc.currentProcess],
              ['Frequency',        uc.frequency],
              ['Time impact',      uc.estimatedTimeImpact],
              ['People / systems', uc.peopleAndSystems],
              ['Data readiness',   uc.dataReadiness],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} className="ai-uc-field">
                <span className="ai-uc-field-label">{label}</span>
                <span className="ai-uc-field-value">{value}</span>
              </div>
            ))}
          </div>

          <div className="ai-uc-score-block">
            <div className="ai-uc-score-row">
              <span className="ai-uc-score-label">Impact</span>
              <ScorePips score={uc.impactScore} />
              <span className="ai-uc-score-num">{uc.impactScore}/5</span>
              {uc.impactRationale && (
                <span className="ai-uc-score-note">{uc.impactRationale}</span>
              )}
            </div>
            <div className="ai-uc-score-row">
              <span className="ai-uc-score-label">Feasibility</span>
              <ScorePips score={uc.feasibilityScore} />
              <span className="ai-uc-score-num">{uc.feasibilityScore}/5</span>
              {uc.feasibilityRationale && (
                <span className="ai-uc-score-note">{uc.feasibilityRationale}</span>
              )}
            </div>
            <div className="ai-proposed-badge">
              AI-proposed scores — confirm before finalizing
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TeamSummaryView({ state, onBack, onExportToTracker }) {
  const [exportState, setExportState] = useState(null)

  const handleExport = async () => {
    if (!state.data || exportState === 'loading') return
    setExportState('loading')
    try {
      const result = await onExportToTracker(state.data)
      setExportState({ ok: true, url: result.sheetUrl, rows: result.rowsAdded })
    } catch (err) {
      setExportState({ ok: false, error: err.message })
    }
  }

  const d = state.data

  return (
    <div className="team-summary-view">
      <div className="ts-header">
        <button className="ts-back-btn" onClick={onBack}>← Back</button>
        <div className="ts-header-info">
          <span className="ts-team-name">{d?.team ?? state.team}</span>
          {state.phase === 'loading' && (
            <span className="ts-meta">Analysing…</span>
          )}
          {state.phase === 'done' && d && (
            <span className="ts-meta">
              {d.interviewCount} interview{d.interviewCount !== 1 ? 's' : ''} · {d.generatedDate}
            </span>
          )}
        </div>
      </div>

      <div className="ts-body">
        {state.phase === 'loading' && (
          <div className="ts-loading">
            <div className="typing-indicator">
              <span /><span /><span />
            </div>
            <p className="ts-loading-text">Reading transcripts and finding patterns…</p>
          </div>
        )}

        {state.phase === 'error' && (
          <div className="error-message">
            Aggregation failed: {state.error}
          </div>
        )}

        {state.phase === 'done' && d && (
          <>
            {d.summary && (
              <div className="ts-summary">
                <div className="ts-section-label">Summary</div>
                <p className="ts-summary-text">{d.summary}</p>
              </div>
            )}

            {d.useCases.length > 0 && (
              <div className="ts-use-cases">
                <div className="ts-section-label">
                  Use cases
                  <span className="ts-count">{d.useCases.length}</span>
                </div>
                {d.useCases.map((uc, i) => (
                  <UseCaseCard key={i} uc={uc} />
                ))}
              </div>
            )}

            {d.flags?.length > 0 && (
              <div className="ai-panel-flags">
                <div className="ai-panel-flags-label">Flags</div>
                {d.flags.map((f, i) => (
                  <p key={i} className="ai-panel-flag">{f}</p>
                ))}
              </div>
            )}

            <div className="ts-export">
              {!exportState && (
                <button className="doc-action-btn export-btn" onClick={handleExport}>
                  Export to tracker
                </button>
              )}
              {exportState === 'loading' && (
                <button className="doc-action-btn export-btn" disabled>Exporting…</button>
              )}
              {exportState?.ok && (
                <p className="transcript-status saved">
                  {exportState.rows} row{exportState.rows !== 1 ? 's' : ''} added ·{' '}
                  <a href={exportState.url} target="_blank" rel="noreferrer">Open tracker</a>
                </p>
              )}
              {exportState?.ok === false && (
                <>
                  <p className="export-error">Export failed: {exportState.error}</p>
                  <button
                    className="doc-action-btn export-btn"
                    onClick={handleExport}
                    style={{ marginTop: 8 }}
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
