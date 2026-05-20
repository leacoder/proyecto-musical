import {
  getPattern,
  toggleStep,
  setOnStep,
  play,
  stop,
  isSequencerPlaying,
  setBpm,
  getBpm,
  clearPattern,
  SEQUENCER_STEPS,
} from '../audio/sequencer.js'
import { DRUM_NAMES } from '../audio/drums.js'

const TRACK_LABELS = { kick: 'K', snare: 'S', hihat: 'H', clap: 'C' }
const TRACK_FULL_LABELS = { kick: 'Kick', snare: 'Snare', hihat: 'Hi-hat', clap: 'Clap' }

// Elementos DOM de cada celda: stepButtons[trackIndex][stepIndex]
const stepButtons = []

let currentHighlightedStep = -1

export function renderSequencer(container) {
  const section = document.createElement('div')
  section.className = 'section'

  // ── Header del secuenciador ──────────────────────────────────────────────────
  const headerRow = document.createElement('div')
  headerRow.className = 'seq-header'

  const playBtn = document.createElement('button')
  playBtn.id = 'seq-play'
  playBtn.className = 'btn-primary seq-play-btn'
  playBtn.textContent = '▶ Play'

  const bpmLabel = document.createElement('label')
  bpmLabel.className = 'seq-bpm-label'
  bpmLabel.textContent = 'BPM'

  const bpmInput = document.createElement('input')
  bpmInput.type = 'number'
  bpmInput.id = 'seq-bpm'
  bpmInput.className = 'seq-bpm-input'
  bpmInput.min = 40
  bpmInput.max = 220
  bpmInput.value = getBpm()

  const bpmRange = document.createElement('input')
  bpmRange.type = 'range'
  bpmRange.className = 'seq-bpm-range'
  bpmRange.min = 40
  bpmRange.max = 220
  bpmRange.step = 1
  bpmRange.value = getBpm()

  const clearBtn = document.createElement('button')
  clearBtn.id = 'seq-clear'
  clearBtn.textContent = 'Limpiar'

  const sectionTitle = document.createElement('div')
  sectionTitle.className = 'section-title'
  sectionTitle.textContent = 'Secuenciador'

  headerRow.appendChild(sectionTitle)
  headerRow.appendChild(playBtn)
  headerRow.appendChild(bpmLabel)
  headerRow.appendChild(bpmInput)
  headerRow.appendChild(bpmRange)
  headerRow.appendChild(clearBtn)
  section.appendChild(headerRow)

  // ── Grilla 4×16 ─────────────────────────────────────────────────────────────
  const grid = document.createElement('div')
  grid.className = 'seq-grid'
  section.appendChild(grid)

  const pattern = getPattern()

  for (let t = 0; t < DRUM_NAMES.length; t++) {
    const trackName = DRUM_NAMES[t]
    stepButtons[t] = []

    // Etiqueta de pista
    const trackLabel = document.createElement('div')
    trackLabel.className = 'seq-track-label'
    trackLabel.title = TRACK_FULL_LABELS[trackName]
    trackLabel.textContent = TRACK_LABELS[trackName]
    grid.appendChild(trackLabel)

    // 16 pasos
    const stepsRow = document.createElement('div')
    stepsRow.className = 'seq-steps-row'

    for (let s = 0; s < SEQUENCER_STEPS; s++) {
      const btn = document.createElement('button')
      btn.className = 'seq-step'
      // Acento visual cada 4 pasos
      if (s % 4 === 0) btn.classList.add('seq-step-accent')
      if (pattern[t][s]) btn.classList.add('seq-step-on')
      btn.dataset.track = t
      btn.dataset.step = s

      btn.addEventListener('click', () => {
        toggleStep(t, s)
        btn.classList.toggle('seq-step-on')
      })

      stepsRow.appendChild(btn)
      stepButtons[t][s] = btn
    }

    grid.appendChild(stepsRow)
  }

  container.appendChild(section)

  // ── Eventos de control ───────────────────────────────────────────────────────
  playBtn.addEventListener('click', () => {
    if (isSequencerPlaying()) {
      stop()
      playBtn.textContent = '▶ Play'
      playBtn.classList.remove('btn-active')
    } else {
      play()
      playBtn.textContent = '■ Stop'
      playBtn.classList.add('btn-active')
    }
  })

  function syncBpm(value) {
    const numVal = parseInt(value)
    if (isNaN(numVal)) return
    setBpm(numVal)
    bpmInput.value = numVal
    bpmRange.value = numVal
  }

  bpmInput.addEventListener('change', (e) => syncBpm(e.target.value))
  bpmRange.addEventListener('input', (e) => syncBpm(e.target.value))

  clearBtn.addEventListener('click', () => {
    clearPattern()
    for (let t = 0; t < DRUM_NAMES.length; t++) {
      for (let s = 0; s < SEQUENCER_STEPS; s++) {
        stepButtons[t][s].classList.remove('seq-step-on')
      }
    }
  })

  // Resalta el paso actual durante la reproducción
  setOnStep((step) => {
    // Quitar resaltado anterior
    if (currentHighlightedStep >= 0) {
      for (let t = 0; t < DRUM_NAMES.length; t++) {
        stepButtons[t][currentHighlightedStep]?.classList.remove('seq-step-playing')
      }
    }

    currentHighlightedStep = step

    if (step >= 0) {
      for (let t = 0; t < DRUM_NAMES.length; t++) {
        stepButtons[t][step]?.classList.add('seq-step-playing')
      }
    }
  })
}
