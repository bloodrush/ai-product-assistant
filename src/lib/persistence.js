export const DISCOVERY_KEY = 'productAssistant:activeDiscovery'

/**
 * @typedef {Object} DiscoveryState
 * @property {1} version
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} currentPhase
 * @property {Array<{role: 'user'|'assistant', content: string}>} conversation
 * @property {Record<number, {problem?: string, affected?: string, mustHaves?: string, noGoes?: string, whatGood?: string}>} phaseOutputs
 */

/** @returns {DiscoveryState|null} */
export function loadDiscovery() {
  try {
    const raw = localStorage.getItem(DISCOVERY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1) return null
    return parsed
  } catch { return null }
}

/** @param {DiscoveryState} state */
export function saveDiscovery(state) {
  try { localStorage.setItem(DISCOVERY_KEY, JSON.stringify(state)) }
  catch {} // quota exceeded — ignore
}

export function clearDiscovery() {
  localStorage.removeItem(DISCOVERY_KEY)
}
