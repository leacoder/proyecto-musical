import { synthParams } from '../audio/synth.js'
import {
  getPattern,
  setBpm,
  getBpm,
  getSwing,
  setSwing,
  getPatternIds,
  getEditingPatternId,
  resetPatterns,
  setEditingPattern,
  getChain,
  setChain,
  isChainEnabled,
  setChainEnabled,
} from '../audio/sequencer.js'
import { setDrumVolume, getDrumVolumes, DRUM_NAMES } from '../audio/drums.js'
import { getEffectsSnapshot } from '../audio/effects.js'
import { getMasterGain } from '../audio/context.js'

const STORAGE_KEY = 'synth-app-state-v3'
const LEGACY_STORAGE_KEYS = ['synth-app-state-v2', 'synth-app-state-v1']
const USER_PRESETS_KEY = 'synth-app-presets-v1'

// Campos válidos de un preset de synth (lo que se reusa entre canciones)
const PRESET_PARAM_KEYS = [
  'waveform', 'attack', 'decay', 'sustain', 'release',
  'filterCutoff', 'filterResonance', 'volume',
]

// Quédate solo con los campos válidos, ignora el resto (ej: sends de efectos)
function pickPresetParams(obj) {
  const out = {}
  for (const key of PRESET_PARAM_KEYS) {
    if (obj[key] !== undefined) out[key] = obj[key]
  }
  return out
}

function readPresetsFile() {
  try {
    const raw = localStorage.getItem(USER_PRESETS_KEY)
    if (!raw) return { presets: [] }
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.presets)) return { presets: [] }
    return parsed
  } catch {
    return { presets: [] }
  }
}

function writePresetsFile(file) {
  try {
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(file))
    return true
  } catch {
    return false
  }
}

export function loadUserPresets() {
  return readPresetsFile().presets.slice()
}

export function saveUserPreset(name, params) {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return null
  const file = readPresetsFile()
  const preset = {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    params: pickPresetParams(params),
    createdAt: new Date().toISOString(),
  }
  file.presets.push(preset)
  writePresetsFile(file)
  return preset
}

export function deleteUserPreset(id) {
  const file = readPresetsFile()
  const before = file.presets.length
  file.presets = file.presets.filter(p => p.id !== id)
  if (file.presets.length === before) return false
  writePresetsFile(file)
  return true
}

export function exportPresetsJson() {
  const file = readPresetsFile()
  return JSON.stringify(file, null, 2)
}

// Devuelve { added, errors } describiendo lo que se importó
export function importPresetsJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { added: 0, errors: ['Archivo no es JSON válido'] }
  }
  if (!parsed || !Array.isArray(parsed.presets)) {
    return { added: 0, errors: ['Formato inválido: falta el campo "presets"'] }
  }
  const file = readPresetsFile()
  const existingIds = new Set(file.presets.map(p => p.id))
  let added = 0
  const errors = []
  for (const entry of parsed.presets) {
    if (!entry || typeof entry.name !== 'string' || !entry.params) {
      errors.push('Entrada ignorada: falta name o params')
      continue
    }
    const preset = {
      id: existingIds.has(entry.id) || !entry.id
        ? `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${added}`
        : entry.id,
      name: entry.name.trim() || 'Sin nombre',
      params: pickPresetParams(entry.params),
      createdAt: entry.createdAt || new Date().toISOString(),
    }
    file.presets.push(preset)
    existingIds.add(preset.id)
    added++
  }
  writePresetsFile(file)
  return { added, errors }
}

function buildSnapshot() {
  const ids = getPatternIds()
  // Snapshot por id leyendo cada uno como editing temporal
  const originalEditing = getEditingPatternId()
  const patternsObj = {}
  for (const id of ids) {
    setEditingPattern(id)
    const p = getPattern()
    patternsObj[id] = p.map(track => [...track])
  }
  setEditingPattern(originalEditing)

  return {
    version: 3,
    synth: { ...synthParams },
    drums: {
      volumes: getDrumVolumes(),
    },
    effects: getEffectsSnapshot(),
    master: {
      volume: getMasterGain() ? getMasterGain().gain.value : 0.8,
    },
    sequencer: {
      bpm: getBpm(),
      swing: getSwing(),
      patterns: patternsObj,
      editingPatternId: originalEditing,
      chain: getChain(),
      chainEnabled: isChainEnabled(),
    },
  }
}

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSnapshot()))
  } catch {
    // Ignorar errores de storage (modo privado, cuota, etc.)
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
    // Fallback: migrar desde versiones anteriores si existen
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacy = localStorage.getItem(legacyKey)
      if (legacy) return JSON.parse(legacy)
    }
    return null
  } catch {
    return null
  }
}

export function applyLoadedState(saved, applyToAudio) {
  if (!saved) return

  // Restaurar patterns del secuenciador. Soporta tres formatos:
  // - v3+: { patterns: { A:..., B:... }, editingPatternId, chain, chainEnabled }
  // - v1/v2: { pattern: 4x16 } único → migrar a { A: pattern }
  const seq = saved.sequencer
  if (seq) {
    if (seq.patterns && typeof seq.patterns === 'object') {
      resetPatterns(seq.patterns, seq.editingPatternId || 'A')
      if (Array.isArray(seq.chain)) setChain(seq.chain)
      if (seq.chainEnabled !== undefined) setChainEnabled(!!seq.chainEnabled)
    } else if (seq.pattern) {
      resetPatterns({ A: seq.pattern }, 'A')
      setChain([{ id: 'A', repeats: 1 }])
      setChainEnabled(false)
    }
  }

  if (saved.sequencer?.bpm) {
    setBpm(saved.sequencer.bpm)
  }

  if (saved.sequencer?.swing !== undefined) {
    setSwing(saved.sequencer.swing)
  }

  // Restaurar volúmenes de drums
  if (saved.drums?.volumes) {
    for (const name of DRUM_NAMES) {
      if (saved.drums.volumes[name] !== undefined) {
        setDrumVolume(name, saved.drums.volumes[name])
      }
    }
  }

  // El resto lo aplica el caller (necesita nodos de audio)
  if (applyToAudio) applyToAudio(saved)
}

// Autoguarda con debounce tras cada cambio de input
let saveTimer = null
export function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveState, 500)
}

// Serializa el estado completo como base64 para compartir por URL
export function stateToUrlHash() {
  const json = JSON.stringify(buildSnapshot())
  return btoa(unescape(encodeURIComponent(json)))
}

export function urlHashToState(hash) {
  try {
    const json = decodeURIComponent(escape(atob(hash)))
    return JSON.parse(json)
  } catch {
    return null
  }
}
