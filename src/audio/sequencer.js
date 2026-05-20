// Motor de secuenciador con lookahead scheduling ("A Tale of Two Clocks").
// setTimeout dispara el scheduler cada TICK_INTERVAL ms.
// El scheduler pre-agenda eventos usando ctx.currentTime para los próximos LOOKAHEAD segundos.
// Los updates visuales se comunican vía callback, sin depender del timing de audio.

import { getAudioContext } from './context.js'
import { DRUM_TRIGGERS, DRUM_NAMES, VELOCITY_FOR_STEP } from './drums.js'

const STEPS = 16
const TICK_INTERVAL = 25       // ms entre ticks del scheduler
const LOOKAHEAD = 0.1          // segundos hacia adelante a pre-agendar

// Estado del secuenciador
let bpm = 120
let swing = 0.5                // 0.5 = recto, hasta 0.75 = shuffle marcado
let isPlaying = false
let currentStep = 0
let nextStepTime = 0
let tickTimerId = null

// Mapa de patterns por id (cada pattern es [trackIndex][stepIndex] = 0|1|2)
const patterns = new Map()
// Orden visible de los tabs en la UI (estable)
let patternOrder = []
// Pattern que el usuario está editando (lo muestra el grid)
let editingPatternId = 'A'

// Modo song: chain de patterns + estado de reproducción del chain
let chain = []
let chainEnabled = false
let chainIndex = 0
let chainRepeatsDone = 0
// Pattern que el scheduler está leyendo ahora (puede diferir del editing)
let playingPatternId = 'A'

function makeEmptyPattern() {
  return Array.from({ length: DRUM_NAMES.length }, () => new Array(STEPS).fill(0))
}

// Inicializa con un pattern vacío "A"
patterns.set('A', makeEmptyPattern())
patternOrder.push('A')
chain = [{ id: 'A', repeats: 1 }]

// Callbacks de UI
let onStepCallback = null
let onPatternChangeCallback = null

export function setOnStep(callback) {
  onStepCallback = callback
}

export function setOnPatternChange(callback) {
  onPatternChangeCallback = callback
}

export function getPattern() {
  return patterns.get(editingPatternId)
}

export function getPatternIds() {
  return [...patternOrder]
}

export function getEditingPatternId() {
  return editingPatternId
}

export function setEditingPattern(id) {
  if (patterns.has(id)) {
    editingPatternId = id
    return true
  }
  return false
}

function nextAvailableId() {
  for (let i = 0; i < 26; i++) {
    const id = String.fromCharCode(65 + i)
    if (!patterns.has(id)) return id
  }
  let i = 0
  while (patterns.has(`P${i}`)) i++
  return `P${i}`
}

export function createPattern() {
  const id = nextAvailableId()
  patterns.set(id, makeEmptyPattern())
  patternOrder.push(id)
  return id
}

export function duplicateCurrentPattern() {
  const src = patterns.get(editingPatternId)
  if (!src) return null
  const id = nextAvailableId()
  patterns.set(id, src.map(track => [...track]))
  patternOrder.push(id)
  return id
}

export function deletePattern(id) {
  if (!patterns.has(id)) return false
  if (patterns.size <= 1) return false   // siempre dejamos al menos uno
  patterns.delete(id)
  patternOrder = patternOrder.filter(p => p !== id)
  // Saca referencias en el chain
  chain = chain.filter(item => item.id !== id)
  if (chain.length === 0) chain = [{ id: patternOrder[0], repeats: 1 }]
  // Si era el editing, mover al primero disponible
  if (editingPatternId === id) editingPatternId = patternOrder[0]
  // Si era el playing, mover al editing (esto no debería pasar mientras suena
  // un chain válido, pero por seguridad)
  if (playingPatternId === id) playingPatternId = patternOrder[0]
  return true
}

export function getChain() {
  return chain.map(c => ({ ...c }))
}

export function setChain(arr) {
  const cleaned = (arr || [])
    .filter(item => item && patterns.has(item.id) && Number(item.repeats) > 0)
    .map(c => ({ id: c.id, repeats: Math.max(1, Math.min(64, Math.floor(c.repeats))) }))
  chain = cleaned.length > 0 ? cleaned : [{ id: patternOrder[0], repeats: 1 }]
}

export function isChainEnabled() {
  return chainEnabled
}

export function setChainEnabled(value) {
  chainEnabled = !!value
}

export function getPlayingPatternId() {
  return playingPatternId
}

// Reemplaza el banco completo de patterns (usado al cargar estado guardado).
// `patternsData` es { id: number[4][16] }. Si está vacío deja al menos "A" vacío.
export function resetPatterns(patternsData, editingId) {
  patterns.clear()
  patternOrder = []
  const entries = Object.entries(patternsData || {})
  for (const [id, raw] of entries) {
    const empty = makeEmptyPattern()
    for (let t = 0; t < empty.length; t++) {
      const srcTrack = raw?.[t] ?? []
      for (let s = 0; s < STEPS; s++) {
        empty[t][s] = normalizeStepValue(srcTrack[s])
      }
    }
    patterns.set(id, empty)
    patternOrder.push(id)
  }
  if (patterns.size === 0) {
    patterns.set('A', makeEmptyPattern())
    patternOrder = ['A']
  }
  editingPatternId = patterns.has(editingId) ? editingId : patternOrder[0]
  playingPatternId = editingPatternId
  // Limpia chain inválido (puede apuntar a ids que ya no existen)
  setChain(chain)
}

export function getBpm() {
  return bpm
}

export function setBpm(newBpm) {
  bpm = Math.max(40, Math.min(220, newBpm))
}

export function getSwing() {
  return swing
}

export function setSwing(value) {
  swing = Math.max(0.5, Math.min(0.75, value))
}

// Normaliza cualquier valor (booleano viejo, número) a 0/1/2
function normalizeStepValue(value) {
  if (value === 2) return 2
  return value ? 1 : 0
}

export function toggleStep(trackIndex, stepIndex) {
  const p = patterns.get(editingPatternId)
  // Toggle simple: cualquier estado on → off; off → normal
  p[trackIndex][stepIndex] = p[trackIndex][stepIndex] ? 0 : 1
}

export function toggleStepAccent(trackIndex, stepIndex) {
  // Si está normal pasa a accent; si está accent vuelve a normal;
  // si estaba off, lo prende directamente como accent.
  const p = patterns.get(editingPatternId)
  const current = p[trackIndex][stepIndex]
  p[trackIndex][stepIndex] = current === 2 ? 1 : 2
}

export function setStepIn(patternId, trackIndex, stepIndex, value) {
  const p = patterns.get(patternId)
  if (!p) return
  p[trackIndex][stepIndex] = normalizeStepValue(value)
}

export function setStep(trackIndex, stepIndex, value) {
  setStepIn(editingPatternId, trackIndex, stepIndex, value)
}

export function getStep(trackIndex, stepIndex) {
  return patterns.get(editingPatternId)[trackIndex][stepIndex]
}

export function clearPattern() {
  const p = patterns.get(editingPatternId)
  for (let t = 0; t < p.length; t++) {
    for (let s = 0; s < STEPS; s++) {
      p[t][s] = 0
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
  const playing = patterns.get(playingPatternId)
  if (!playing) return
  for (let t = 0; t < trackNames.length; t++) {
    const value = playing[t][step]
    if (value) {
      const velocity = VELOCITY_FOR_STEP[value] ?? 1
      DRUM_TRIGGERS[trackNames[t]](time, velocity)
    }
  }
}

// Avanza al siguiente pattern del chain. Devuelve true si el playingPatternId cambió.
function advanceChain() {
  if (!chainEnabled || chain.length === 0) return false
  const currentItem = chain[chainIndex]
  if (!currentItem) {
    chainIndex = 0
    chainRepeatsDone = 0
    return false
  }
  chainRepeatsDone++
  if (chainRepeatsDone >= currentItem.repeats) {
    chainIndex = (chainIndex + 1) % chain.length
    chainRepeatsDone = 0
  }
  const newId = chain[chainIndex].id
  if (newId !== playingPatternId && patterns.has(newId)) {
    playingPatternId = newId
    return true
  }
  return false
}

// Calcula el offset de swing para el paso dado. Los pasos impares (1,3,5...) se
// retrasan en proporción al swing: 0.5 = sin retraso, 0.75 = +50% de duración.
function getSwingOffset(step, stepDuration) {
  if (step % 2 === 0) return 0
  return (swing - 0.5) * 2 * stepDuration
}

function tick() {
  if (!isPlaying) return

  const context = getAudioContext()
  const stepDuration = getStepDuration()

  // Pre-agenda todos los pasos que caen dentro de la ventana de lookahead
  while (nextStepTime < context.currentTime + LOOKAHEAD) {
    const swingOffset = getSwingOffset(currentStep, stepDuration)
    const scheduledTime = nextStepTime + swingOffset
    scheduleStep(currentStep, scheduledTime)

    // Notifica a la UI con el paso actual y su tiempo de audio agendado
    if (onStepCallback) {
      const stepToShow = currentStep
      const timeToShow = scheduledTime
      const delay = Math.max(0, (timeToShow - context.currentTime) * 1000)
      setTimeout(() => {
        if (isPlaying) onStepCallback(stepToShow)
      }, delay)
    }

    const nextStep = (currentStep + 1) % STEPS
    // Al cruzar 15 → 0, si chain está activo, avanzar al siguiente item
    if (nextStep === 0) {
      const changed = advanceChain()
      if (changed && onPatternChangeCallback) {
        const idToShow = playingPatternId
        const delay = Math.max(0, (scheduledTime + stepDuration - context.currentTime) * 1000)
        setTimeout(() => {
          if (isPlaying) onPatternChangeCallback(idToShow)
        }, delay)
      }
    }
    currentStep = nextStep
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

  // Setup del pattern a reproducir
  if (chainEnabled && chain.length > 0) {
    chainIndex = 0
    chainRepeatsDone = 0
    playingPatternId = chain[0].id
  } else {
    playingPatternId = editingPatternId
  }
  if (onPatternChangeCallback) onPatternChangeCallback(playingPatternId)

  tick()
}

export function stop() {
  isPlaying = false
  if (tickTimerId !== null) {
    clearTimeout(tickTimerId)
    tickTimerId = null
  }
  chainIndex = 0
  chainRepeatsDone = 0
  if (onStepCallback) onStepCallback(-1)  // -1 = sin paso activo
  if (onPatternChangeCallback) onPatternChangeCallback(null)
}

export function isSequencerPlaying() {
  return isPlaying
}

export const SEQUENCER_STEPS = STEPS
