import { getAudioContext, getMasterInput } from './context.js'

// Genera un impulso de reverb sintético (ruido con decaimiento exponencial)
function buildReverbImpulse(context, duration = 2.5, decay = 2.0) {
  const sampleRate = context.sampleRate
  const length = Math.floor(sampleRate * duration)
  const impulse = context.createBuffer(2, length, sampleRate)

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      // Ruido blanco con envolvente exponencial descendente
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return impulse
}

let reverbNode = null
let reverbWetGain = null

let delayNode = null
let delayFeedbackGain = null
let delayWetGain = null

// Punto de envío para reverb (las voces conectan aquí con su send gain)
let reverbSendBus = null
// Punto de envío para delay
let delaySendBus = null

export function getReverbSendBus() {
  if (!reverbSendBus) buildReverbChain()
  return reverbSendBus
}

export function getDelaySendBus() {
  if (!delaySendBus) buildDelayChain()
  return delaySendBus
}

function buildReverbChain() {
  const context = getAudioContext()
  const destination = getMasterInput()

  reverbSendBus = context.createGain()
  reverbSendBus.gain.value = 1.0

  reverbNode = context.createConvolver()
  reverbNode.buffer = buildReverbImpulse(context)

  reverbWetGain = context.createGain()
  reverbWetGain.gain.value = 0.0

  reverbSendBus.connect(reverbNode)
  reverbNode.connect(reverbWetGain)
  reverbWetGain.connect(destination)
}

function buildDelayChain() {
  const context = getAudioContext()
  const destination = getMasterInput()

  delaySendBus = context.createGain()
  delaySendBus.gain.value = 1.0

  delayNode = context.createDelay(2.0)
  delayNode.delayTime.value = 0.375  // 375ms por defecto (corchea a 80bpm)

  delayFeedbackGain = context.createGain()
  delayFeedbackGain.gain.value = 0.35

  delayWetGain = context.createGain()
  delayWetGain.gain.value = 0.0

  delaySendBus.connect(delayNode)
  delayNode.connect(delayFeedbackGain)
  delayFeedbackGain.connect(delayNode)   // loop de feedback
  delayNode.connect(delayWetGain)
  delayWetGain.connect(destination)
}

// Asegura que ambas cadenas estén inicializadas
export function initEffects() {
  buildReverbChain()
  buildDelayChain()
}

// Devuelve el estado actual de los efectos para persistencia
export function getEffectsSnapshot() {
  return {
    reverbWet: reverbWetGain ? reverbWetGain.gain.value : 0,
    delayWet: delayWetGain ? delayWetGain.gain.value : 0,
    delayTime: delayNode ? delayNode.delayTime.value : 0.375,
    delayFeedback: delayFeedbackGain ? delayFeedbackGain.gain.value : 0.35,
  }
}

export function setReverbWet(value) {
  if (!reverbWetGain) buildReverbChain()
  reverbWetGain.gain.setTargetAtTime(value, getAudioContext().currentTime, 0.02)
}

export function setDelayWet(value) {
  if (!delayWetGain) buildDelayChain()
  delayWetGain.gain.setTargetAtTime(value, getAudioContext().currentTime, 0.02)
}

export function setDelayTime(seconds) {
  if (!delayNode) buildDelayChain()
  delayNode.delayTime.setTargetAtTime(seconds, getAudioContext().currentTime, 0.02)
}

export function setDelayFeedback(value) {
  if (!delayFeedbackGain) buildDelayChain()
  delayFeedbackGain.gain.setTargetAtTime(value, getAudioContext().currentTime, 0.02)
}
