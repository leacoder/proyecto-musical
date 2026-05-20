// Estado central con pub/sub simple.
// Los módulos de audio y UI leen de aquí para sincronizarse.

const listeners = new Map()

const state = {
  synth: {
    waveform: 'sawtooth',
    attack: 0.01,
    decay: 0.15,
    sustain: 0.6,
    release: 0.4,
    filterCutoff: 4000,
    filterResonance: 1,
    volume: 0.7,
    reverbSend: 0,
    delaySend: 0,
  },
  drums: {
    volumes: { kick: 0.8, snare: 0.7, hihat: 0.5, clap: 0.6 },
    busVolume: 1.0,
    reverbSend: 0,
    delaySend: 0,
  },
  effects: {
    reverbWet: 0,
    delayWet: 0,
    delayTime: 0.375,
    delayFeedback: 0.35,
  },
  master: {
    volume: 0.8,
  },
  sequencer: {
    bpm: 120,
    pattern: Array.from({ length: 4 }, () => new Array(16).fill(false)),
  },
}

export function getState() {
  return state
}

export function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key).add(callback)
  return () => listeners.get(key).delete(callback)
}

export function notify(key) {
  if (listeners.has(key)) {
    for (const cb of listeners.get(key)) cb(state)
  }
}
