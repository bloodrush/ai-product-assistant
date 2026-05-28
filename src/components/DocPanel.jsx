import { useState } from 'react'
import { PHASES } from '../lib/phases.js'

const DOC_SECTIONS = [
  { key: 'problem',   label: 'Problem' },
  { key: 'affected',  label: 'Who is affected' },
  { key: 'mustHaves', label: 'Must-haves' },
  { key: 'noGoes',    label: 'No-goes' },
  { key: 'whatGood',  label: 'What good looks like' },
]

function renderContent(content) {
  if (!content) return null
  const lines = content.split('\n')
  const bullets = lines.filter(l => l.startsWith('- ')).map(l => l.slice(2))
  if (bullets.length > 0) {
    return <ul>{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
  }
  return <p>{content}</p>
}

function Phase1Body({ output, isLoading, color }) {
  if (!output) return null
  const firstEmptyIdx = DOC_SECTIONS.findIndex(s => !output[s.key])

  return (
    <div className="acc-sections" style={{ '--bubble-color': color }}>
      {DOC_SECTIONS.map((s, i) => {
        const val = output[s.key]
        const isFilled  = !!val
        const isCurrent = !val && i === firstEmptyIdx
        const isPending = !val && i > firstEmptyIdx

        return (
          <div key={s.key} className={`doc-section${isFilled ? ' filled' : isCurrent ? ' current' : ' pending'}`}>
            <div className="doc-sec-label">
              {s.label}
              {isCurrent && isLoading && <div className="pulse-dot" />}
            </div>
            <div className="doc-sec-body">
              {isFilled
                ? renderContent(val)
                : isCurrent
                  ? <span className="doc-in-progress">In progress…</span>
                  : <span>—</span>
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}

function parseRawSections(rawText) {
  if (!rawText) return []
  const blocks = rawText.split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
  const sections = []
  for (const block of blocks) {
    if (/^-{3,}$/.test(block) || block === '—') continue
    const lines = block.split('\n')
    const firstLine = lines[0].trim()
    if (lines.length === 1 && (/^PHASE\s+\d/i.test(firstLine) || /^here'?s/i.test(firstLine))) continue
    if (lines.length > 1) {
      const cleanFirst = firstLine.replace(/^\*\*|\*\*$/g, '').replace(/:$/, '').trim()
      const looksLikeHeader = (
        cleanFirst.length < 60 &&
        !cleanFirst.startsWith('-') &&
        !cleanFirst.startsWith('*') &&
        !/^\d+\./.test(cleanFirst) &&
        !/[.,;!?]$/.test(cleanFirst)
      )
      sections.push(looksLikeHeader
        ? { label: cleanFirst, content: lines.slice(1).join('\n').trim() }
        : { label: null, content: block }
      )
    } else {
      sections.push({ label: null, content: block })
    }
  }
  return sections
}

function PhaseRawBody({ output, color }) {
  if (!output?.rawText) return null
  const sections = parseRawSections(output.rawText)
  if (sections.length === 0) return <span className="acc-empty">No output recorded.</span>

  return (
    <div className="acc-sections" style={{ '--bubble-color': color }}>
      {sections.map((s, i) => (
        <div key={i} className="doc-section filled">
          {s.label && <div className="doc-sec-label">{s.label}</div>}
          <div className="doc-sec-body">
            {renderContent(s.content)}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DocPanel({ sections = {}, isLoading = false, currentPhase = 1, phaseOutputs = {} }) {
  const [copied, setCopied] = useState(false)
  const [expandedDone, setExpandedDone] = useState(new Set())

  const toggleDone = (id) => {
    setExpandedDone(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const activeOutput = { ...phaseOutputs[currentPhase], ...sections }
  const filledKeys = DOC_SECTIONS.filter(s => activeOutput[s.key])
  const isComplete = currentPhase === 1
    ? filledKeys.length === DOC_SECTIONS.length
    : !!(phaseOutputs[currentPhase]?.rawText)

  const copyAll = () => {
    let text = ''
    if (currentPhase === 1) {
      text = filledKeys.map(s => `${s.label}\n${activeOutput[s.key]}`).join('\n\n')
    } else {
      text = activeOutput.rawText ?? ''
    }
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportPDF = () => {
    const filled = DOC_SECTIONS.filter(s => activeOutput[s.key])
    const bodyHtml = filled.map(s => {
      const val = activeOutput[s.key]
      const lines = val.split('\n')
      const bullets = lines.filter(l => l.startsWith('- ')).map(l => l.slice(2))
      const content = bullets.length > 0
        ? `<ul>${bullets.map(b => `<li>${b}</li>`).join('')}</ul>`
        : `<p>${val}</p>`
      return `<section><h2>${s.label}</h2>${content}</section>`
    }).join('')
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Phase ${currentPhase} — Discovery Document</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500&family=DM+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'DM Sans',sans-serif;color:#1c1814;background:#fff;padding:60px 72px;max-width:760px;margin:0 auto;}
  header{margin-bottom:48px;padding-bottom:22px;border-bottom:2px solid #1c1814;display:flex;align-items:baseline;justify-content:space-between;}
  header h1{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;}
  header span{font-family:'DM Mono',monospace;font-size:10px;color:#857f78;}
  section{margin-bottom:36px;}
  h2{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#c4620a;margin-bottom:10px;}
  p{font-size:14px;line-height:1.85;}
  ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:6px;}
  li{font-size:14px;line-height:1.7;padding-left:16px;position:relative;}
  li::before{content:'—';position:absolute;left:0;color:#857f78;}
  footer{margin-top:56px;padding-top:18px;border-top:1px solid #ddd7cc;font-family:'DM Mono',monospace;font-size:10px;color:#857f78;}
</style>
</head><body>
<header><h1>◆ Discovery — Phase ${currentPhase} Output</h1><span>${date}</span></header>
${bodyHtml}
<footer>Generated by Discovery · Phase ${currentPhase}</footer>
</body></html>`)
    win.document.close()
    win.onload = () => win.print()
  }

  const hasActiveContent = currentPhase === 1
    ? filledKeys.length > 0
    : !!(activeOutput.rawText)

  return (
    <div className="doc-panel">
      <div className="doc-panel-header">
        <span className="doc-panel-title">Outcome</span>
      </div>

      <div className="doc-panel-body">
        {PHASES.map(ph => {
          const isActive      = ph.id === currentPhase
          const hasDoneOutput = ph.id < currentPhase && !!(
            ph.id === 1 ? phaseOutputs[ph.id] : phaseOutputs[ph.id]?.rawText
          )
          const isPast   = ph.id < currentPhase && !hasDoneOutput
          const isExpanded = isActive || (hasDoneOutput && expandedDone.has(ph.id))
          const output = isActive ? activeOutput : phaseOutputs[ph.id]

          return (
            <div key={ph.id} className={`phase-accordion${isActive ? ' active' : hasDoneOutput ? ' done' : isPast ? ' past' : ' future'}`}
              style={isActive ? { borderLeftColor: ph.color } : undefined}
            >
              <div
                className={`phase-acc-header${hasDoneOutput ? ' clickable' : ''}`}
                onClick={hasDoneOutput ? () => toggleDone(ph.id) : undefined}
              >
                <div className="phase-acc-indicator" style={isActive ? { color: ph.color } : undefined}>
                  {hasDoneOutput
                    ? <span className="phase-acc-check">✓</span>
                    : isActive
                      ? <span className="phase-acc-dot" style={{ background: ph.color }} />
                      : <span className="phase-acc-num">{ph.id}</span>
                  }
                </div>
                <div className="phase-acc-label">
                  <span className="phase-acc-num-label">Phase {ph.id}</span>
                  <span className="phase-acc-name">{ph.label}</span>
                </div>
                {hasDoneOutput && (
                  <svg
                    className={`phase-acc-chevron${isExpanded ? ' open' : ''}`}
                    width="10" height="10" viewBox="0 0 10 10" fill="none"
                  >
                    <polyline points="2,3 5,7 8,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>

              {isExpanded && (
                <div className="phase-acc-body">
                  {ph.id === 1
                    ? <Phase1Body output={output} isLoading={isActive && isLoading} color={ph.color} />
                    : <PhaseRawBody output={output} color={ph.color} />
                  }
                  {isActive && hasActiveContent && (
                    <div className="acc-actions">
                      <button className="doc-action-btn" onClick={copyAll}>
                        {copied ? '✓ Copied' : isComplete ? 'Copy outcome' : 'Copy so far'}
                      </button>
                      {currentPhase === 1 && (
                        <button className="doc-action-btn" onClick={exportPDF}>Export PDF</button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
