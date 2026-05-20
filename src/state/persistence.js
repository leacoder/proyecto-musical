import { getState } from './store.js'
import { synthParams } from '../audio/synth.js'
import { getPattern, setBpm, setStep, getBpm } from '../audio/sequencer.js'
import { setDrumVolume } from '../audio/drums.js'
import { DRUM_NAMES } from '../audio/drums.js'

const STORAGE_KEY = 'synth-app-state-v1'

export function saveState() {
  const pattern = getPattern()
  const state = getState()

  const snapshot = {
    synth: { ...synthParams },
    drums: { ...state.drums },
    effects: { ...state.effects },
    master: { ...state.master },
    sequencer: {
      bpm: getBpm(),
      // Copia profunda del patrón
      pattern: pattern.map(track => [...track]),
    },
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Ignorar errores de storage (modo privado, cuota, etc.)
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function applyLoadedState(saved, applyToAudio) {
  if (!saved) return

  // Restaurar patrón del secuenciador
  if (saved.sequencer?.pattern) {
    for (let t = 0; t < saved.sequencer.pattern.length; t++) {
      for (let s = 0; s < saved.sequencer.pattern[t].length; s++) {
        setStep(t, s, saved.sequencer.pattern[t][s])
      }
    }
  }

  if (saved.sequencer?.bpm) {
    setBpm(saved.sequencer.bpm)
  }

  // Restaurar volúmenes de drums
  if (saved.drums?.volumes) {
    for (const name of DRUM_NAMES) {
      if (saved.drums.volumes[name] !== undefined) {
        setDrumVolume(name, saved.drums.volumes[name])
      }
    }
  }

  // El resto (synth params, effects, master) lo aplica el caller
  // porque necesita acceso a los nodos de audio ya inicializados
  if (applyToAudio) applyToAudio(saved)
}

// Autoguarda cada vez que hay un cambio relevante (debounced)
let saveTimer = null
export function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveState, 500)
}

// Serializa el estado completo como base64 para compartir por URL
export function stateToUrlHash() {
  const pattern = getPattern()
  const state = getState()
  const snapshot = {
    synth: { ...synthParams },
    drums: { ...state.drums },
    effects: { ...state.effects },
    master: { ...state.master },
    sequencer: {
      bpm: getBpm(),
      pattern: pattern.map(track => [...track]),
    },
  }
  const json = JSON.stringify(snapshot)
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
