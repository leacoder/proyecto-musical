import {
  synthParams,
  setWaveform,
  setFilterCutoff,
  setFilterResonance,
  setSynthVolume,
  setSynthReverbSend,
  setSynthDelaySend,
} from '../audio/synth.js'
import { getMasterGain, getAudioContext, getRecordingDestination } from '../audio/context.js'
import {
  setReverbWet,
  setDelayWet,
  setDelayTime,
  setDelayFeedback,
} from '../audio/effects.js'
import { stateToUrlHash } from '../state/persistence.js'
import {
  DRUM_NAMES,
  DRUM_TRIGGERS,
  setDrumVolume,
  getDrumVolume,
  setDrumBusVolume,
  setDrumReverbSend,
  setDrumDelaySend,
} from '../audio/drums.js'

// Crea un slider con label y valor numérico en tiempo real
function createSlider({ id, label, min, max, step, value, unit = '', onChange, displayFn }) {
  const group = document.createElement('div')
  group.className = 'slider-group'

  const labelRow = document.createElement('div')
  labelRow.className = 'slider-label'

  const labelEl = document.createElement('span')
  labelEl.textContent = label

  const valueEl = document.createElement('span')
  valueEl.className = 'slider-value'
  const display = displayFn ? displayFn(value) : `${value}${unit}`
  valueEl.textContent = display

  labelRow.appendChild(labelEl)
  labelRow.appendChild(valueEl)

  const input = document.createElement('input')
  input.type = 'range'
  input.id = id
  input.min = min
  input.max = max
  input.step = step
  input.value = value

  input.addEventListener('input', () => {
    const numVal = parseFloat(input.value)
    valueEl.textContent = displayFn ? displayFn(numVal) : `${numVal}${unit}`
    onChange(numVal)
  })

  group.appendChild(labelRow)
  group.appendChild(input)
  return { group, input, valueEl }
}

// Crea un grupo de botones de selección exclusiva (tipo radio)
function createToggleGroup({ id, options, current, onChange }) {
  const group = document.createElement('div')
  group.className = 'toggle-group'
  group.id = id

  for (const { value, label } of options) {
    const btn = document.createElement('button')
    btn.textContent = label
    btn.dataset.value = value
    if (value === current) btn.classList.add('btn-active')

    btn.addEventListener('click', () => {
      group.querySelectorAll('button').forEach(b => b.classList.remove('btn-active'))
      btn.classList.add('btn-active')
      onChange(value)
    })

    group.appendChild(btn)
  }

  return group
}

export function renderSynthControls(container) {
  const section = document.createElement('div')
  section.className = 'section'

  const title = document.createElement('div')
  title.className = 'section-title'
  title.textContent = 'Sintetizador'
  section.appendChild(title)

  const grid = document.createElement('div')
  grid.className = 'controls-grid'
  section.appendChild(grid)

  // Waveform selector
  const waveformCol = document.createElement('div')
  waveformCol.className = 'control-col'

  const waveLabel = document.createElement('div')
  waveLabel.className = 'slider-label'
  waveLabel.textContent = 'Forma de onda'
  waveformCol.appendChild(waveLabel)

  const waveToggle = createToggleGroup({
    id: 'waveform-toggle',
    options: [
      { value: 'sine', label: 'Sine' },
      { value: 'triangle', label: 'Tri' },
      { value: 'sawtooth', label: 'Saw' },
      { value: 'square', label: 'Square' },
    ],
    current: synthParams.waveform,
    onChange: setWaveform,
  })
  waveformCol.appendChild(waveToggle)
  grid.appendChild(waveformCol)

  // ADSR
  const adsrCol = document.createElement('div')
  adsrCol.className = 'control-col'

  const adsrLabel = document.createElement('div')
  adsrLabel.className = 'slider-label'
  adsrLabel.textContent = 'Envolvente ADSR'
  adsrCol.appendChild(adsrLabel)

  const adsrGrid = document.createElement('div')
  adsrGrid.className = 'adsr-grid'

  const formatTime = (v) => v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(1)}s`

  const { group: attackGroup } = createSlider({
    id: 'adsr-attack', label: 'Attack', min: 0.001, max: 2, step: 0.001,
    value: synthParams.attack, displayFn: formatTime,
    onChange: (v) => { synthParams.attack = v },
  })
  const { group: decayGroup } = createSlider({
    id: 'adsr-decay', label: 'Decay', min: 0.01, max: 2, step: 0.01,
    value: synthParams.decay, displayFn: formatTime,
    onChange: (v) => { synthParams.decay = v },
  })
  const { group: sustainGroup } = createSlider({
    id: 'adsr-sustain', label: 'Sustain', min: 0, max: 1, step: 0.01,
    value: synthParams.sustain, unit: '',
    displayFn: (v) => `${Math.round(v * 100)}%`,
    onChange: (v) => { synthParams.sustain = v },
  })
  const { group: releaseGroup } = createSlider({
    id: 'adsr-release', label: 'Release', min: 0.01, max: 4, step: 0.01,
    value: synthParams.release, displayFn: formatTime,
    onChange: (v) => { synthParams.release = v },
  })

  adsrGrid.appendChild(attackGroup)
  adsrGrid.appendChild(decayGroup)
  adsrGrid.appendChild(sustainGroup)
  adsrGrid.appendChild(releaseGroup)
  adsrCol.appendChild(adsrGrid)
  grid.appendChild(adsrCol)

  // Filtro
  const filterCol = document.createElement('div')
  filterCol.className = 'control-col'

  const filterLabel = document.createElement('div')
  filterLabel.className = 'slider-label'
  filterLabel.textContent = 'Filtro Lowpass'
  filterCol.appendChild(filterLabel)

  const { group: cutoffGroup } = createSlider({
    id: 'filter-cutoff', label: 'Cutoff', min: 80, max: 18000, step: 10,
    value: synthParams.filterCutoff,
    displayFn: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}kHz` : `${Math.round(v)}Hz`,
    onChange: setFilterCutoff,
  })
  const { group: resonanceGroup } = createSlider({
    id: 'filter-resonance', label: 'Resonance', min: 0.1, max: 25, step: 0.1,
    value: synthParams.filterResonance,
    displayFn: (v) => v.toFixed(1),
    onChange: setFilterResonance,
  })
  const { group: synthVolGroup } = createSlider({
    id: 'synth-volume', label: 'Volumen Synth', min: 0, max: 1, step: 0.01,
    value: synthParams.volume,
    displayFn: (v) => `${Math.round(v * 100)}%`,
    onChange: setSynthVolume,
  })

  filterCol.appendChild(cutoffGroup)
  filterCol.appendChild(resonanceGroup)
  filterCol.appendChild(synthVolGroup)
  grid.appendChild(filterCol)

  container.appendChild(section)
}

export function renderEffectsControls(container) {
  const section = document.createElement('div')
  section.className = 'section'

  const title = document.createElement('div')
  title.className = 'section-title'
  title.textContent = 'Efectos'
  section.appendChild(title)

  const grid = document.createElement('div')
  grid.className = 'controls-grid effects-grid'
  section.appendChild(grid)

  // Reverb
  const reverbCol = document.createElement('div')
  reverbCol.className = 'control-col'

  const reverbLabel = document.createElement('div')
  reverbLabel.className = 'slider-label'
  reverbLabel.textContent = 'Reverb'
  reverbCol.appendChild(reverbLabel)

  const pctFn = (v) => `${Math.round(v * 100)}%`

  const { group: reverbWetGroup } = createSlider({
    id: 'reverb-wet', label: 'Wet', min: 0, max: 1, step: 0.01,
    value: 0, displayFn: pctFn, onChange: setReverbWet,
  })
  const { group: synthReverbGroup } = createSlider({
    id: 'synth-reverb-send', label: 'Synth Send', min: 0, max: 1, step: 0.01,
    value: 0, displayFn: pctFn, onChange: setSynthReverbSend,
  })

  reverbCol.appendChild(reverbWetGroup)
  reverbCol.appendChild(synthReverbGroup)
  grid.appendChild(reverbCol)

  // Delay
  const delayCol = document.createElement('div')
  delayCol.className = 'control-col'

  const delayLabel = document.createElement('div')
  delayLabel.className = 'slider-label'
  delayLabel.textContent = 'Delay'
  delayCol.appendChild(delayLabel)

  const { group: delayWetGroup } = createSlider({
    id: 'delay-wet', label: 'Wet', min: 0, max: 1, step: 0.01,
    value: 0, displayFn: pctFn, onChange: setDelayWet,
  })
  const { group: delayTimeGroup } = createSlider({
    id: 'delay-time', label: 'Tiempo', min: 0.05, max: 1.0, step: 0.005,
    value: 0.375,
    displayFn: (v) => `${Math.round(v * 1000)}ms`,
    onChange: setDelayTime,
  })
  const { group: delayFeedbackGroup } = createSlider({
    id: 'delay-feedback', label: 'Feedback', min: 0, max: 0.9, step: 0.01,
    value: 0.35, displayFn: pctFn, onChange: setDelayFeedback,
  })
  const { group: synthDelayGroup } = createSlider({
    id: 'synth-delay-send', label: 'Synth Send', min: 0, max: 1, step: 0.01,
    value: 0, displayFn: pctFn, onChange: setSynthDelaySend,
  })
  const { group: drumDelayGroup } = createSlider({
    id: 'drum-delay-send', label: 'Drums Send', min: 0, max: 1, step: 0.01,
    value: 0, displayFn: pctFn, onChange: setDrumDelaySend,
  })

  delayCol.appendChild(delayWetGroup)
  delayCol.appendChild(delayTimeGroup)
  delayCol.appendChild(delayFeedbackGroup)
  delayCol.appendChild(synthDelayGroup)
  delayCol.appendChild(drumDelayGroup)
  grid.appendChild(delayCol)

  // Drums reverb send (agrega a la columna de reverb)
  const { group: drumReverbGroup } = createSlider({
    id: 'drum-reverb-send', label: 'Drums Send', min: 0, max: 1, step: 0.01,
    value: 0, displayFn: pctFn, onChange: setDrumReverbSend,
  })
  reverbCol.appendChild(drumReverbGroup)

  container.appendChild(section)
}

// Mapeo teclas 1-2-3-4 a drums
const KEY_TO_DRUM = { '1': 'kick', '2': 'snare', '3': 'hihat', '4': 'clap' }
const DRUM_LABELS = { kick: 'Kick', snare: 'Snare', hihat: 'Hi-hat', clap: 'Clap' }

export function renderDrumControls(container) {
  const section = document.createElement('div')
  section.className = 'section'

  const title = document.createElement('div')
  title.className = 'section-title'
  title.textContent = 'Drums — Teclas 1 2 3 4'
  section.appendChild(title)

  const padsRow = document.createElement('div')
  padsRow.className = 'drum-pads'
  section.appendChild(padsRow)

  for (const name of DRUM_NAMES) {
    const col = document.createElement('div')
    col.className = 'drum-col'

    // Pad de golpe
    const pad = document.createElement('button')
    pad.className = 'drum-pad'
    pad.textContent = DRUM_LABELS[name]
    pad.dataset.drum = name

    pad.addEventListener('mousedown', (e) => {
      e.preventDefault()
      DRUM_TRIGGERS[name]()
      pad.classList.add('drum-pad-active')
    })
    pad.addEventListener('mouseup', () => pad.classList.remove('drum-pad-active'))
    pad.addEventListener('mouseleave', () => pad.classList.remove('drum-pad-active'))
    pad.addEventListener('touchstart', (e) => {
      e.preventDefault()
      DRUM_TRIGGERS[name]()
      pad.classList.add('drum-pad-active')
    }, { passive: false })
    pad.addEventListener('touchend', () => pad.classList.remove('drum-pad-active'))

    col.appendChild(pad)

    // Slider de volumen individual
    const { group: volGroup } = createSlider({
      id: `drum-vol-${name}`,
      label: 'Vol',
      min: 0, max: 1, step: 0.01,
      value: getDrumVolume(name),
      displayFn: (v) => `${Math.round(v * 100)}%`,
      onChange: (v) => setDrumVolume(name, v),
    })
    col.appendChild(volGroup)
    padsRow.appendChild(col)
  }

  container.appendChild(section)

  // Teclas físicas 1-2-3-4
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
    if (e.repeat) return
    const drum = KEY_TO_DRUM[e.key]
    if (drum) {
      DRUM_TRIGGERS[drum]()
      const pad = padsRow.querySelector(`[data-drum="${drum}"]`)
      if (pad) {
        pad.classList.add('drum-pad-active')
        setTimeout(() => pad.classList.remove('drum-pad-active'), 100)
      }
    }
  })
}

// ── Presets ─────────────────────────────────────────────────────────────────
const PRESETS = {
  bass: {
    waveform: 'sawtooth',
    attack: 0.005,
    decay: 0.2,
    sustain: 0.5,
    release: 0.3,
    filterCutoff: 600,
    filterResonance: 3,
    volume: 0.8,
  },
  lead: {
    waveform: 'square',
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.2,
    filterCutoff: 3000,
    filterResonance: 2,
    volume: 0.65,
  },
  pad: {
    waveform: 'sine',
    attack: 0.6,
    decay: 0.5,
    sustain: 0.8,
    release: 1.5,
    filterCutoff: 2000,
    filterResonance: 0.5,
    volume: 0.6,
  },
  pluck: {
    waveform: 'triangle',
    attack: 0.001,
    decay: 0.4,
    sustain: 0.1,
    release: 0.6,
    filterCutoff: 5000,
    filterResonance: 4,
    volume: 0.75,
  },
}

export function renderPresetsAndRecording(container) {
  const section = document.createElement('div')
  section.className = 'section'

  const title = document.createElement('div')
  title.className = 'section-title'
  title.textContent = 'Presets & Herramientas'
  section.appendChild(title)

  const row = document.createElement('div')
  row.className = 'presets-row'
  section.appendChild(row)

  // Botones de presets
  const presetsGroup = document.createElement('div')
  presetsGroup.className = 'presets-group'

  const presetsLabel = document.createElement('span')
  presetsLabel.className = 'presets-label'
  presetsLabel.textContent = 'Preset Synth:'
  presetsGroup.appendChild(presetsLabel)

  for (const [name, preset] of Object.entries(PRESETS)) {
    const btn = document.createElement('button')
    btn.textContent = name.charAt(0).toUpperCase() + name.slice(1)
    btn.addEventListener('click', () => applyPreset(preset))
    presetsGroup.appendChild(btn)
  }

  row.appendChild(presetsGroup)

  // Botón de grabación
  const recordingGroup = document.createElement('div')
  recordingGroup.className = 'recording-group'

  const recordBtn = document.createElement('button')
  recordBtn.id = 'btn-record'
  recordBtn.textContent = '⏺ Grabar'

  const shareBtn = document.createElement('button')
  shareBtn.id = 'btn-share'
  shareBtn.textContent = '⟳ Compartir URL'

  recordingGroup.appendChild(recordBtn)
  recordingGroup.appendChild(shareBtn)
  row.appendChild(recordingGroup)
  container.appendChild(section)

  // Lógica de grabación
  let mediaRecorder = null
  let recordedChunks = []

  recordBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
      recordBtn.textContent = '⏺ Grabar'
      recordBtn.classList.remove('btn-danger')
      return
    }

    const stream = getRecordingDestination().stream
    recordedChunks = []

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    mediaRecorder = new MediaRecorder(stream, { mimeType })

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data)
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `synth-session-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
    }

    mediaRecorder.start()
    recordBtn.textContent = '⏹ Detener'
    recordBtn.classList.add('btn-danger')
  })

  // Compartir URL con estado completo en el hash
  shareBtn.addEventListener('click', () => {
    const hash = stateToUrlHash()
    const url = `${window.location.origin}${window.location.pathname}#${hash}`
    navigator.clipboard.writeText(url).then(() => {
      shareBtn.textContent = '✓ Copiado!'
      setTimeout(() => { shareBtn.textContent = '⟳ Compartir URL' }, 2000)
    })
  })
}

// Aplica un preset al synth y sincroniza el DOM
function applyPreset(preset) {
  setWaveform(preset.waveform)
  Object.assign(synthParams, preset)
  setFilterCutoff(preset.filterCutoff)
  setFilterResonance(preset.filterResonance)
  setSynthVolume(preset.volume)

  // Sincronizar sliders DOM
  const set = (id, value) => {
    const el = document.getElementById(id)
    if (!el) return
    el.value = value
    el.dispatchEvent(new Event('input', { bubbles: false }))
  }

  set('adsr-attack', preset.attack)
  set('adsr-decay', preset.decay)
  set('adsr-sustain', preset.sustain)
  set('adsr-release', preset.release)
  set('filter-cutoff', preset.filterCutoff)
  set('filter-resonance', preset.filterResonance)
  set('synth-volume', preset.volume)

  document.querySelectorAll('#waveform-toggle button').forEach(btn => {
    btn.classList.toggle('btn-active', btn.dataset.value === preset.waveform)
  })
}

export function renderMixerControls(container) {
  const section = document.createElement('div')
  section.className = 'section'

  const title = document.createElement('div')
  title.className = 'section-title'
  title.textContent = 'Mixer'
  section.appendChild(title)

  const grid = document.createElement('div')
  grid.className = 'controls-grid mixer-grid'
  section.appendChild(grid)

  const pctFn = (v) => `${Math.round(v * 100)}%`

  const col = document.createElement('div')
  col.className = 'control-col'

  const { group: masterVolGroup } = createSlider({
    id: 'master-volume', label: 'Volumen Master', min: 0, max: 1, step: 0.01,
    value: 0.8, displayFn: pctFn,
    onChange: (v) => {
      getMasterGain().gain.setTargetAtTime(v, getAudioContext().currentTime, 0.02)
    },
  })

  const { group: drumBusVolGroup } = createSlider({
    id: 'drum-bus-volume', label: 'Volumen Drums', min: 0, max: 1, step: 0.01,
    value: 1.0, displayFn: pctFn, onChange: setDrumBusVolume,
  })

  col.appendChild(masterVolGroup)
  col.appendChild(drumBusVolGroup)
  grid.appendChild(col)

  container.appendChild(section)
}
