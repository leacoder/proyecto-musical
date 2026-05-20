import { resumeAudioContext, getMasterGain, getAudioContext } from './audio/context.js'
import { stopAllNotes, synthParams, setWaveform, setFilterCutoff, setFilterResonance, setSynthVolume, setSynthReverbSend, setSynthDelaySend } from './audio/synth.js'
import { initEffects, setReverbWet, setDelayWet, setDelayTime, setDelayFeedback } from './audio/effects.js'
import { stop as stopSequencer } from './audio/sequencer.js'
import { setDrumVolume, setDrumBusVolume, setDrumReverbSend, setDrumDelaySend, DRUM_NAMES } from './audio/drums.js'
import { renderKeyboard } from './ui/keyboard.js'
import { renderSynthControls, renderEffectsControls, renderDrumControls, renderMixerControls, renderPresetsAndRecording } from './ui/controls.js'
import { renderSequencer, sequencerUIRefresh } from './ui/grid.js'
import { renderScope } from './ui/scope.js'
import { loadState, applyLoadedState, scheduleSave, urlHashToState } from './state/persistence.js'

const overlay = document.getElementById('overlay')
const btnPanic = document.getElementById('btn-panic')

// Activa el AudioContext en el primer gesto del usuario
async function activateAudio() {
  await resumeAudioContext()
  overlay.classList.add('hidden')
  // Pre-computa el impulso de reverb apenas el contexto está activo
  initEffects()
}

overlay.addEventListener('click', activateAudio)
document.addEventListener('keydown', () => {
  if (!overlay.classList.contains('hidden')) return
}, { once: true })
// Activa también con tecla cuando el overlay está visible
document.addEventListener('keydown', (e) => {
  if (!overlay.classList.contains('hidden')) activateAudio()
})

// Pánico: corta todo
btnPanic.addEventListener('click', () => {
  stopAllNotes()
  stopSequencer()
  // Actualizar botón de play del secuenciador
  const playBtn = document.getElementById('seq-play')
  if (playBtn) {
    playBtn.textContent = '▶ Play'
    playBtn.classList.remove('btn-active')
  }
})

// Inicialización de módulos de UI (orden visual de arriba a abajo)
renderSynthControls(document.getElementById('synth-controls-root'))
renderKeyboard(document.getElementById('keyboard-container'))
renderDrumControls(document.getElementById('drums-root'))
renderSequencer(document.getElementById('sequencer-root'))
renderEffectsControls(document.getElementById('effects-root'))
renderMixerControls(document.getElementById('mixer-root'))
renderPresetsAndRecording(document.getElementById('mixer-root'))
renderScope(document.getElementById('scope-root'))

// Carga estado desde localStorage o URL hash
const hashState = window.location.hash.slice(1)
let savedState = null

if (hashState) {
  savedState = urlHashToState(hashState)
}

if (!savedState) {
  savedState = loadState()
}

if (savedState) {
  applyLoadedState(savedState, (saved) => {
    // Aplicar parámetros del synth a los nodos de audio
    if (saved.synth) {
      const s = saved.synth
      if (s.waveform) setWaveform(s.waveform)
      if (s.attack !== undefined) synthParams.attack = s.attack
      if (s.decay !== undefined) synthParams.decay = s.decay
      if (s.sustain !== undefined) synthParams.sustain = s.sustain
      if (s.release !== undefined) synthParams.release = s.release
      if (s.filterCutoff !== undefined) setFilterCutoff(s.filterCutoff)
      if (s.filterResonance !== undefined) setFilterResonance(s.filterResonance)
      if (s.volume !== undefined) setSynthVolume(s.volume)
      if (s.reverbSend !== undefined) setSynthReverbSend(s.reverbSend)
      if (s.delaySend !== undefined) setSynthDelaySend(s.delaySend)
    }

    if (saved.effects) {
      const fx = saved.effects
      if (fx.reverbWet !== undefined) setReverbWet(fx.reverbWet)
      if (fx.delayWet !== undefined) setDelayWet(fx.delayWet)
      if (fx.delayTime !== undefined) setDelayTime(fx.delayTime)
      if (fx.delayFeedback !== undefined) setDelayFeedback(fx.delayFeedback)
    }

    if (saved.drums?.volumes) {
      for (const name of DRUM_NAMES) {
        if (saved.drums.volumes[name] !== undefined) setDrumVolume(name, saved.drums.volumes[name])
      }
    }
    if (saved.drums?.busVolume !== undefined) setDrumBusVolume(saved.drums.busVolume)
    if (saved.drums?.reverbSend !== undefined) setDrumReverbSend(saved.drums.reverbSend)
    if (saved.drums?.delaySend !== undefined) setDrumDelaySend(saved.drums.delaySend)

    // Actualizar sliders DOM con los valores recuperados
    syncDomSliders(saved)
  })
}

// Vincula el autosave a todos los inputs de la página (después de renderizar la UI)
document.addEventListener('input', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
    scheduleSave()
  }
})

// Sincroniza los valores DOM de los sliders desde el estado guardado
function syncDomSliders(saved) {
  const set = (id, value) => {
    const el = document.getElementById(id)
    if (!el) return
    el.value = value
    // Actualizar el label de valor si existe
    const label = el.closest('.slider-group')?.querySelector('.slider-value')
    if (label) el.dispatchEvent(new Event('input', { bubbles: false }))
  }

  if (saved.synth) {
    const s = saved.synth
    set('adsr-attack', s.attack)
    set('adsr-decay', s.decay)
    set('adsr-sustain', s.sustain)
    set('adsr-release', s.release)
    set('filter-cutoff', s.filterCutoff)
    set('filter-resonance', s.filterResonance)
    set('synth-volume', s.volume)
    set('synth-reverb-send', s.reverbSend)
    set('synth-delay-send', s.delaySend)

    // Activar el botón de waveform correcto
    if (s.waveform) {
      document.querySelectorAll('#waveform-toggle button').forEach(btn => {
        btn.classList.toggle('btn-active', btn.dataset.value === s.waveform)
      })
    }
  }

  if (saved.effects) {
    const fx = saved.effects
    set('reverb-wet', fx.reverbWet)
    set('delay-wet', fx.delayWet)
    set('delay-time', fx.delayTime)
    set('delay-feedback', fx.delayFeedback)
  }

  if (saved.drums?.volumes) {
    for (const name of DRUM_NAMES) {
      set(`drum-vol-${name}`, saved.drums.volumes[name])
    }
  }
  if (saved.drums?.busVolume !== undefined) set('drum-bus-volume', saved.drums.busVolume)
  if (saved.drums?.reverbSend !== undefined) set('drum-reverb-send', saved.drums.reverbSend)
  if (saved.drums?.delaySend !== undefined) set('drum-delay-send', saved.drums.delaySend)

  if (saved.master?.volume !== undefined) set('master-volume', saved.master.volume)
  if (saved.sequencer?.bpm !== undefined) {
    set('seq-bpm', saved.sequencer.bpm)
    set('seq-bpm-range', saved.sequencer.bpm)
    const bpmRange = document.querySelector('.seq-bpm-range')
    if (bpmRange) bpmRange.value = saved.sequencer.bpm
  }

  if (saved.sequencer?.swing !== undefined) {
    const swingInput = document.getElementById('seq-swing')
    if (swingInput) {
      swingInput.value = saved.sequencer.swing
      swingInput.dispatchEvent(new Event('input', { bubbles: false }))
    }
  }

  // Refresca UI del sequencer (tabs, chain, modo) y redibuja la grilla del editing
  sequencerUIRefresh.refreshTabs()
  sequencerUIRefresh.refreshMode()
  sequencerUIRefresh.refreshChain()
  sequencerUIRefresh.redrawGrid()
}
