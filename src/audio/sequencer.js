// Motor de secuenciador con lookahead scheduling ("A Tale of Two Clocks").
// setTimeout dispara el scheduler cada TICK_INTERVAL ms.
// El scheduler pre-agenda eventos usando ctx.currentTime para los próximos LOOKAHEAD segundos.
// Los updates visuales se comunican vía callback, sin depender del timing de audio.

import { getAudioContext } from './context.js'
import { DRUM_TRIGGERS, DRUM_NAMES } from './drums.js'

const STEPS = 16
const TICK_INTERVAL = 25       // ms entre ticks del scheduler
const LOOKAHEAD = 0.1          // segundos hacia adelante a pre-agendar

// Estado del secuenciador
let bpm = 120
let isPlaying = false
let currentStep = 0
let nextStepTime = 0
let tickTimerId = null

// Patrón: matriz [trackIndex][stepIndex] = boolean
const pattern = Array.from({ length: DRUM_NAMES.length }, () => new Array(STEPS).fill(false))

// Callback que recibe el número de paso actual para actualizar la UI
let onStepCallback = null

export function setOnStep(callback) {
  onStepCallback = callback
}

export function getPattern() {
  return pattern
}

export function getBpm() {
  return bpm
}

export function setBpm(newBpm) {
  bpm = Math.max(40, Math.min(220, newBpm))
}

export function toggleStep(trackIndex, stepIndex) {
  pattern[trackIndex][stepIndex] = !pattern[trackIndex][stepIndex]
}

export function setStep(trackIndex, stepIndex, value) {
  pattern[trackIndex][stepIndex] = value
}

export function clearPattern() {
  for (let t = 0; t < pattern.length; t++) {
    for (let s = 0; s < STEPS; s++) {
      pattern[t][s] = false
    }
  }
}

// Duración de un paso en segundos según el BPM actual
// Un paso = una corchea = 60 / (bpm * 2)... o simplemente 60/bpm para negras.
// Usamos negras: 4 pasos por compás → 4 beats por ciclo de 16 pasos = 4 compases.
// Para que 16 pasos sea un ciclo natural de 2 compases usamos corcheas:
// stepDuration = 60 / bpm / 2
function getStepDuration() {
  return 60 / bpm / 2
}

function scheduleStep(step, time) {
  const trackNames = DRUM_NAMES
  for (let t = 0; t < trackNames.length; t++) {
    if (pattern[t][step]) {
      DRUM_TRIGGERS[trackNames[t]](time)
    }
  }
}

function tick() {
  if (!isPlaying) return

  const context = getAudioContext()
  const stepDuration = getStepDuration()

  // Pre-agenda todos los pasos que caen dentro de la ventana de lookahead
  while (nextStepTime < context.currentTime + LOOKAHEAD) {
    scheduleStep(currentStep, nextStepTime)

    // Notifica a la UI con el paso actual y su tiempo de audio agendado
    if (onStepCallback) {
      const stepToShow = currentStep
      const timeToShow = nextStepTime
      // Retrasa la notificación visual para que coincida con el audio
      const delay = Math.max(0, (timeToShow - context.currentTime) * 1000)
      setTimeout(() => {
        if (isPlaying) onStepCallback(stepToShow)
      }, delay)
    }

    currentStep = (currentStep + 1) % STEPS
    nextStepTime += stepDuration
  }

  tickTimerId = setTimeout(tick, TICK_INTERVAL)
}

export function play() {
  if (isPlaying) return
  const context = getAudioContext()
  isPlaying = true
  currentStep = 0
  nextStepTime = context.currentTime + 0.05  // pequeño offset inicial
  tick()
}

export function stop() {
  isPlaying = false
  if (tickTimerId !== null) {
    clearTimeout(tickTimerId)
    tickTimerId = null
  }
  if (onStepCallback) onStepCallback(-1)  // -1 = sin paso activo
}

export function isSequencerPlaying() {
  return isPlaying
}

export const SEQUENCER_STEPS = STEPS
