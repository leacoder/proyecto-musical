import { synthParams } from '../audio/synth.js'
import { getPattern, setBpm, setStep, getBpm } from '../audio/sequencer.js'
import { setDrumVolume, getDrumVolumes, DRUM_NAMES } from '../audio/drums.js'
import { getEffectsSnapshot } from '../audio/effects.js'
import { getMasterGain } from '../audio/context.js'

const STORAGE_KEY = 'synth-app-state-v1'

function buildSnapshot() {
  const pattern = getPattern()
  return {
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
      pattern: pattern.map(track => [...track]),
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
