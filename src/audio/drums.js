import { getAudioContext, getMasterInput } from './context.js'
import { getReverbSendBus, getDelaySendBus } from './effects.js'

// Nombres y orden de las pistas de batería
export const DRUM_NAMES = ['kick', 'snare', 'hihat', 'clap']

// Volúmenes individuales (0–1)
const drumVolumes = { kick: 0.8, snare: 0.7, hihat: 0.5, clap: 0.6 }

// Multiplicadores de velocity por valor de step (0=off, 1=normal, 2=accent)
export const VELOCITY_FOR_STEP = [0, 1.0, 1.3]

// Bus de salida para cada drum → se mezclan en drumBus → masterInput
let drumBus = null
let drumBusGain = null
let drumBusReverbSend = null
let drumBusDelaySend = null

function getDrumBus() {
  if (!drumBus) {
    const context = getAudioContext()

    drumBus = context.createGain()
    drumBus.gain.value = 1.0
    drumBus.connect(getMasterInput())

    drumBusReverbSend = context.createGain()
    drumBusReverbSend.gain.value = 0
    drumBus.connect(drumBusReverbSend)
    drumBusReverbSend.connect(getReverbSendBus())

    drumBusDelaySend = context.createGain()
    drumBusDelaySend.gain.value = 0
    drumBus.connect(drumBusDelaySend)
    drumBusDelaySend.connect(getDelaySendBus())

    drumBusGain = drumBus
  }
  return drumBus
}

export function setDrumBusVolume(value) {
  getDrumBus()
  drumBusGain.gain.setTargetAtTime(value, getAudioContext().currentTime, 0.02)
}

export function setDrumReverbSend(value) {
  getDrumBus()
  drumBusReverbSend.gain.setTargetAtTime(value, getAudioContext().currentTime, 0.02)
}

export function setDrumDelaySend(value) {
  getDrumBus()
  drumBusDelaySend.gain.setTargetAtTime(value, getAudioContext().currentTime, 0.02)
}

export function setDrumVolume(name, value) {
  drumVolumes[name] = value
}

export function getDrumVolume(name) {
  return drumVolumes[name]
}

export function getDrumVolumes() {
  return { ...drumVolumes }
}

// Genera un buffer de ruido blanco monoaural
function createNoiseBuffer(context, durationSeconds = 0.5) {
  const length = Math.floor(context.sampleRate * durationSeconds)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

// ── Kick ──────────────────────────────────────────────────────────────────────
// Oscilador sine con pitch envelope rápido + gain envelope
export function triggerKick(scheduledTime, velocity = 1) {
  const context = getAudioContext()
  const time = scheduledTime ?? context.currentTime
  const destination = getDrumBus()

  const oscillator = context.createOscillator()
  const gainNode = context.createGain()

  oscillator.type = 'sine'
  // Pitch cae de 180 Hz a 40 Hz en 60 ms (el thump característico del kick)
  oscillator.frequency.setValueAtTime(180, time)
  oscillator.frequency.exponentialRampToValueAtTime(40, time + 0.06)

  gainNode.gain.setValueAtTime(drumVolumes.kick * velocity, time)
  gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.5)

  oscillator.connect(gainNode)
  gainNode.connect(destination)

  oscillator.start(time)
  oscillator.stop(time + 0.55)

  oscillator.onended = () => { oscillator.disconnect(); gainNode.disconnect() }
}

// ── Snare ─────────────────────────────────────────────────────────────────────
// Ruido blanco + filtro bandpass + transiente de tono
export function triggerSnare(scheduledTime, velocity = 1) {
  const context = getAudioContext()
  const time = scheduledTime ?? context.currentTime
  const destination = getDrumBus()

  // Cuerpo de ruido
  const noiseBuffer = context.createBufferSource()
  noiseBuffer.buffer = createNoiseBuffer(context, 0.3)

  const bandpass = context.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 1200
  bandpass.Q.value = 0.8

  const noiseGain = context.createGain()
  noiseGain.gain.setValueAtTime(drumVolumes.snare * velocity, time)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.25)

  noiseBuffer.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(destination)

  // Transiente de tono (da cuerpo al ataque)
  const toneOsc = context.createOscillator()
  toneOsc.type = 'sine'
  toneOsc.frequency.setValueAtTime(200, time)
  toneOsc.frequency.exponentialRampToValueAtTime(100, time + 0.05)

  const toneGain = context.createGain()
  toneGain.gain.setValueAtTime(drumVolumes.snare * velocity * 0.5, time)
  toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1)

  toneOsc.connect(toneGain)
  toneGain.connect(destination)

  noiseBuffer.start(time)
  noiseBuffer.stop(time + 0.3)
  toneOsc.start(time)
  toneOsc.stop(time + 0.15)

  noiseBuffer.onended = () => { noiseBuffer.disconnect(); bandpass.disconnect(); noiseGain.disconnect() }
  toneOsc.onended = () => { toneOsc.disconnect(); toneGain.disconnect() }
}

// ── Hi-hat ────────────────────────────────────────────────────────────────────
// Ruido blanco + highpass agresivo + envelope muy corto
export function triggerHihat(scheduledTime, velocity = 1) {
  const context = getAudioContext()
  const time = scheduledTime ?? context.currentTime
  const destination = getDrumBus()

  const noiseBuffer = context.createBufferSource()
  noiseBuffer.buffer = createNoiseBuffer(context, 0.15)

  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 7000
  highpass.Q.value = 1

  const gainNode = context.createGain()
  gainNode.gain.setValueAtTime(drumVolumes.hihat * velocity, time)
  gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.08)

  noiseBuffer.connect(highpass)
  highpass.connect(gainNode)
  gainNode.connect(destination)

  noiseBuffer.start(time)
  noiseBuffer.stop(time + 0.15)

  noiseBuffer.onended = () => { noiseBuffer.disconnect(); highpass.disconnect(); gainNode.disconnect() }
}

// ── Clap ──────────────────────────────────────────────────────────────────────
// 3 ráfagas de ruido en cascada rápida para simular múltiples manos
export function triggerClap(scheduledTime, velocity = 1) {
  const context = getAudioContext()
  const time = scheduledTime ?? context.currentTime
  const destination = getDrumBus()

  const burstTimes = [0, 0.012, 0.024]

  for (const offset of burstTimes) {
    const noiseBuffer = context.createBufferSource()
    noiseBuffer.buffer = createNoiseBuffer(context, 0.1)

    const bandpass = context.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = 1800
    bandpass.Q.value = 0.5

    const gainNode = context.createGain()
    const burstTime = time + offset
    gainNode.gain.setValueAtTime(drumVolumes.clap * velocity, burstTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, burstTime + 0.07)

    noiseBuffer.connect(bandpass)
    bandpass.connect(gainNode)
    gainNode.connect(destination)

    noiseBuffer.start(burstTime)
    noiseBuffer.stop(burstTime + 0.1)

    noiseBuffer.onended = () => { noiseBuffer.disconnect(); bandpass.disconnect(); gainNode.disconnect() }
  }
}

// Mapa de funciones de trigger por nombre de drum
export const DRUM_TRIGGERS = {
  kick: triggerKick,
  snare: triggerSnare,
  hihat: triggerHihat,
  clap: triggerClap,
}
