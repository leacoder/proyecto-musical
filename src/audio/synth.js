import { getAudioContext, getMasterInput } from './context.js'
import { getReverbSendBus, getDelaySendBus } from './effects.js'

// Parámetros por defecto del sintetizador
export const DEFAULT_SYNTH_PARAMS = {
  waveform: 'sawtooth',
  attack: 0.01,
  decay: 0.15,
  sustain: 0.6,
  release: 0.4,
  filterCutoff: 4000,
  filterResonance: 1,
  volume: 0.7,
}

// Estado mutable del synth (se modifica desde controls.js)
export const synthParams = { ...DEFAULT_SYNTH_PARAMS }

// Mapa de voces activas: nota MIDI → { oscillator, gainNode, filterNode }
const activeVoices = new Map()

// Máximo de voces simultáneas para evitar leaks y clipping
const MAX_VOICES = 8

// Bus de salida del synth + sends de efectos
let synthBus = null
let synthReverbSend = null
let synthDelaySend = null

export function getSynthBus() {
  if (!synthBus) {
    const context = getAudioContext()
    synthBus = context.createGain()
    synthBus.gain.value = synthParams.volume
    synthBus.connect(getMasterInput())

    // Sends de efectos (wet=0 por defecto, se ajustan desde controls)
    synthReverbSend = context.createGain()
    synthReverbSend.gain.value = 0
    synthBus.connect(synthReverbSend)
    synthReverbSend.connect(getReverbSendBus())

    synthDelaySend = context.createGain()
    synthDelaySend.gain.value = 0
    synthBus.connect(synthDelaySend)
    synthDelaySend.connect(getDelaySendBus())
  }
  return synthBus
}

export function setSynthReverbSend(value) {
  getSynthBus()
  synthReverbSend.gain.setTargetAtTime(value, getAudioContext().currentTime, 0.02)
}

export function setSynthDelaySend(value) {
  getSynthBus()
  synthDelaySend.gain.setTargetAtTime(value, getAudioContext().currentTime, 0.02)
}

export function setSynthVolume(value) {
  synthParams.volume = value
  if (synthBus) {
    synthBus.gain.setTargetAtTime(value, getAudioContext().currentTime, 0.02)
  }
}

// Convierte nota MIDI a frecuencia en Hz
function midiToFrequency(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12)
}

// Roba la voz más antigua si se alcanzó el límite de polifonía
function evictOldestVoice() {
  if (activeVoices.size >= MAX_VOICES) {
    const oldestNote = activeVoices.keys().next().value
    stopNote(oldestNote, true)
  }
}

export function startNote(midiNote) {
  if (activeVoices.has(midiNote)) return

  evictOldestVoice()

  const context = getAudioContext()
  const now = context.currentTime
  const frequency = midiToFrequency(midiNote)
  const destination = getSynthBus()

  // Cadena de señal: oscillator → filter → gainNode → synthBus
  const oscillator = context.createOscillator()
  oscillator.type = synthParams.waveform
  oscillator.frequency.setValueAtTime(frequency, now)

  const filterNode = context.createBiquadFilter()
  filterNode.type = 'lowpass'
  filterNode.frequency.setValueAtTime(synthParams.filterCutoff, now)
  filterNode.Q.setValueAtTime(synthParams.filterResonance, now)

  const gainNode = context.createGain()
  gainNode.gain.setValueAtTime(0, now)

  oscillator.connect(filterNode)
  filterNode.connect(gainNode)
  gainNode.connect(destination)

  oscillator.start(now)

  // Envolvente de ataque
  gainNode.gain.linearRampToValueAtTime(0.8, now + synthParams.attack)
  // Decay hasta sustain
  gainNode.gain.setTargetAtTime(synthParams.sustain * 0.8, now + synthParams.attack, synthParams.decay / 3)

  activeVoices.set(midiNote, { oscillator, gainNode, filterNode })
}

export function stopNote(midiNote, immediate = false) {
  const voice = activeVoices.get(midiNote)
  if (!voice) return

  activeVoices.delete(midiNote)

  const context = getAudioContext()
  const now = context.currentTime
  const { oscillator, gainNode, filterNode } = voice

  if (immediate) {
    gainNode.gain.cancelScheduledValues(now)
    gainNode.gain.setTargetAtTime(0, now, 0.005)
    oscillator.stop(now + 0.05)
  } else {
    // Release
    gainNode.gain.cancelScheduledValues(now)
    gainNode.gain.setValueAtTime(gainNode.gain.value, now)
    gainNode.gain.setTargetAtTime(0, now, synthParams.release / 3)
    oscillator.stop(now + synthParams.release + 0.1)
  }

  oscillator.onended = () => {
    oscillator.disconnect()
    filterNode.disconnect()
    gainNode.disconnect()
  }
}

export function stopAllNotes() {
  for (const midiNote of activeVoices.keys()) {
    stopNote(midiNote, true)
  }
}

export function setWaveform(type) {
  synthParams.waveform = type
  // Aplica a voces activas también
  for (const { oscillator } of activeVoices.values()) {
    oscillator.type = type
  }
}

export function setFilterCutoff(value) {
  synthParams.filterCutoff = value
  const context = getAudioContext()
  for (const { filterNode } of activeVoices.values()) {
    filterNode.frequency.setTargetAtTime(value, context.currentTime, 0.02)
  }
}

export function setFilterResonance(value) {
  synthParams.filterResonance = value
  const context = getAudioContext()
  for (const { filterNode } of activeVoices.values()) {
    filterNode.Q.setTargetAtTime(value, context.currentTime, 0.02)
  }
}
