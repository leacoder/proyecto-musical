// Singleton del AudioContext + cadena master de audio.
// La cadena es: nodos de voz → masterInput → compressor → masterGain → analyser → destination

let audioContext = null
let masterInput = null
let masterCompressor = null
let masterGain = null
let analyser = null
let recordingDestination = null

function buildAudioGraph(context) {
  // Punto de entrada para todas las voces
  masterInput = context.createGain()
  masterInput.gain.value = 1.0

  // Compresor para evitar clipping cuando suenan muchas voces juntas
  masterCompressor = context.createDynamicsCompressor()
  masterCompressor.threshold.value = -6
  masterCompressor.knee.value = 5
  masterCompressor.ratio.value = 4
  masterCompressor.attack.value = 0.003
  masterCompressor.release.value = 0.25

  // Volumen master
  masterGain = context.createGain()
  masterGain.gain.value = 0.8

  // Analizador para el osciloscopio
  analyser = context.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.8

  // Destino de grabación (MediaStreamDestination)
  recordingDestination = context.createMediaStreamDestination()

  masterInput.connect(masterCompressor)
  masterCompressor.connect(masterGain)
  masterGain.connect(analyser)
  analyser.connect(context.destination)
  // Tap de grabación conectado post-analyser
  analyser.connect(recordingDestination)
}

export function getRecordingDestination() {
  getAudioContext()
  return recordingDestination
}

export function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
    buildAudioGraph(audioContext)
  }
  return audioContext
}

export async function resumeAudioContext() {
  const context = getAudioContext()
  if (context.state === 'suspended') {
    await context.resume()
  }
  return context
}

// Nodo al que conectan todas las voces
export function getMasterInput() {
  getAudioContext()
  return masterInput
}

export function getMasterGain() {
  getAudioContext()
  return masterGain
}

export function getAnalyser() {
  getAudioContext()
  return analyser
}
