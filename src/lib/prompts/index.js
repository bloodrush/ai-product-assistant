import { PHASE_1_PROMPT } from './phase1.js'
import { PHASE_2_PROMPT } from './phase2.js'
import { PHASE_3_PROMPT } from './phase3.js'
import { PHASE_4_PROMPT } from './phase4.js'
import { PHASE_5_PROMPT } from './phase5.js'

const PROMPTS = {
  1: PHASE_1_PROMPT,
  2: PHASE_2_PROMPT,
  3: PHASE_3_PROMPT,
  4: PHASE_4_PROMPT,
  5: PHASE_5_PROMPT,
}

export function getSystemPrompt(phase) {
  return PROMPTS[phase] ?? PHASE_1_PROMPT
}
