const REGISTRY_KEY = 'productAssistant:discoveries'
const CONV_KEY     = 'productAssistant:activeConversation'
const LEGACY_KEY   = 'productAssistant:activeDiscovery'

/**
 * @typedef {Object} DiscoveryItem
 * @property {string} id
 * @property {string} name
 * @property {'phase1'|'date'} nameSource
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} currentPhase
 * @property {Record<number, object>} phaseOutputs
 */

/**
 * @typedef {Object} Registry
 * @property {2} version
 * @property {string|null} activeId
 * @property {DiscoveryItem[]} items
 */

function genId() {
  return `disc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function formatShortDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** @returns {Registry} */
function loadRegistry() {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    if (!raw) return { version: 2, activeId: null, items: [] }
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 2) return { version: 2, activeId: null, items: [] }
    return parsed
  } catch { return { version: 2, activeId: null, items: [] } }
}

/** @param {Registry} registry */
function saveRegistry(registry) {
  try { localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry)) } catch {}
}

/** @param {string} text @returns {string} */
export function deriveDiscoveryName(text) {
  const first = text.split(/[.!?]/)[0].trim()
  const s = first.length > 5 ? first : text.trim()
  return s.length > 60 ? s.slice(0, 57) + '…' : s
}

/**
 * Migrates legacy single-discovery schema to multi-discovery registry.
 * Safe to call on every boot — no-ops if already done.
 * @returns {boolean} true if migration occurred
 */
export function migrateLegacyDiscovery() {
  try {
    const existing = localStorage.getItem(REGISTRY_KEY)
    if (existing) {
      const parsed = JSON.parse(existing)
      if (parsed?.version === 2) return false
    }

    const legacy = localStorage.getItem(LEGACY_KEY)
    if (!legacy) {
      saveRegistry({ version: 2, activeId: null, items: [] })
      return false
    }

    const data = JSON.parse(legacy)
    if (!data) {
      saveRegistry({ version: 2, activeId: null, items: [] })
      return false
    }

    const id = genId()
    const problemText = data.phaseOutputs?.[1]?.problem
    const name = problemText
      ? deriveDiscoveryName(problemText)
      : `Discovery ${formatShortDate(data.createdAt || new Date().toISOString())}`

    /** @type {DiscoveryItem} */
    const item = {
      id,
      name,
      nameSource: problemText ? 'phase1' : 'date',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      currentPhase: data.currentPhase || 1,
      phaseOutputs: data.phaseOutputs || {},
    }

    saveRegistry({ version: 2, activeId: id, items: [item] })
    try {
      localStorage.setItem(CONV_KEY, JSON.stringify({ discoveryId: id, conversation: data.conversation || [] }))
    } catch {}
    localStorage.removeItem(LEGACY_KEY)
    return true
  } catch { return false }
}

/** @returns {DiscoveryItem[]} sorted newest-first by updatedAt */
export function getAllDiscoveries() {
  const reg = loadRegistry()
  return [...reg.items].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

/**
 * Creates a new blank discovery and sets it as active.
 * @returns {DiscoveryItem}
 */
export function createDiscovery() {
  const id = genId()
  const now = new Date().toISOString()
  /** @type {DiscoveryItem} */
  const item = {
    id,
    name: `Discovery ${formatShortDate(now)}`,
    nameSource: 'date',
    createdAt: now,
    updatedAt: now,
    currentPhase: 1,
    phaseOutputs: {},
  }
  const reg = loadRegistry()
  reg.items.push(item)
  reg.activeId = id
  saveRegistry(reg)
  try { localStorage.setItem(CONV_KEY, JSON.stringify({ discoveryId: id, conversation: [] })) } catch {}
  return item
}

/**
 * Sets the active discovery ID in the registry and loads its conversation.
 * @param {string} id
 */
export function setActiveDiscovery(id) {
  const reg = loadRegistry()
  const item = reg.items.find(d => d.id === id)
  if (!item) return
  reg.activeId = id
  saveRegistry(reg)
  // Load conversation from registry item's saved conv (stored per-item) or clear
  // Conversations are stored separately — the caller calls loadActiveDiscovery() after this
}

/**
 * @returns {{ item: DiscoveryItem, conversation: Array<{role: string, content: string}> }|null}
 */
export function loadActiveDiscovery() {
  try {
    const reg = loadRegistry()
    if (!reg.activeId) return null
    const item = reg.items.find(d => d.id === reg.activeId)
    if (!item) return null

    const convRaw = localStorage.getItem(CONV_KEY)
    let conversation = []
    if (convRaw) {
      const convData = JSON.parse(convRaw)
      if (convData?.discoveryId === reg.activeId) {
        conversation = convData.conversation || []
      }
    }
    return { item, conversation }
  } catch { return null }
}

/**
 * Saves discovery state — updates the registry item and the active conversation.
 * @param {string} id
 * @param {{ currentPhase: number, conversation: Array, phaseOutputs: Record<number, object>, name?: string }} state
 */
export function saveDiscovery(id, { currentPhase, conversation, phaseOutputs, name }) {
  try {
    const reg = loadRegistry()
    const idx = reg.items.findIndex(d => d.id === id)
    if (idx === -1) return
    reg.items[idx] = {
      ...reg.items[idx],
      currentPhase,
      phaseOutputs,
      updatedAt: new Date().toISOString(),
      ...(name ? { name, nameSource: 'phase1' } : {}),
    }
    saveRegistry(reg)
    localStorage.setItem(CONV_KEY, JSON.stringify({ discoveryId: id, conversation }))
  } catch {}
}

/**
 * Removes a discovery from the registry.
 * @param {string} id
 */
export function deleteDiscovery(id) {
  const reg = loadRegistry()
  reg.items = reg.items.filter(d => d.id !== id)
  if (reg.activeId === id) {
    reg.activeId = reg.items.length > 0 ? reg.items[0].id : null
    if (reg.activeId === null) {
      try { localStorage.removeItem(CONV_KEY) } catch {}
    }
  }
  saveRegistry(reg)
}
