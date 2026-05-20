import {
  getPattern,
  toggleStep,
  toggleStepAccent,
  setOnStep,
  setOnPatternChange,
  play,
  stop,
  isSequencerPlaying,
  setBpm,
  getBpm,
  setSwing,
  getSwing,
  clearPattern,
  SEQUENCER_STEPS,
  getPatternIds,
  getEditingPatternId,
  setEditingPattern,
  createPattern,
  duplicateCurrentPattern,
  deletePattern,
  getChain,
  setChain,
  isChainEnabled,
  setChainEnabled,
} from '../audio/sequencer.js'
import { DRUM_NAMES } from '../audio/drums.js'

const LONG_PRESS_MS = 400
const LONG_PRESS_MOVE_TOLERANCE = 8

const TRACK_LABELS = { kick: 'K', snare: 'S', hihat: 'H', clap: 'C' }
const TRACK_FULL_LABELS = { kick: 'Kick', snare: 'Snare', hihat: 'Hi-hat', clap: 'Clap' }

// Elementos DOM de cada celda: stepButtons[trackIndex][stepIndex]
const stepButtons = []

let currentHighlightedStep = -1

// Refleja el valor 0/1/2 del step en clases CSS
export function renderStepCell(btn, value) {
  btn.classList.toggle('seq-step-on', value >= 1)
  btn.classList.toggle('seq-step-accent', value === 2)
}

// Click izq toggle on/off; click der + long-press touch alternan accent
function attachStepHandlers(btn, t, s) {
  let longPressTimer = null
  let longPressed = false
  let lastAccentAt = 0
  let pressX = 0
  let pressY = 0

  // Aplica accent con guard contra doble-disparo cuando long-press touch
  // genera también contextmenu del navegador.
  const handleAccent = () => {
    const now = performance.now()
    if (now - lastAccentAt < 600) return
    lastAccentAt = now
    toggleStepAccent(t, s)
    const pattern = getPattern()
    renderStepCell(btn, pattern[t][s])
  }

  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    handleAccent()
  })

  btn.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    longPressed = false
    pressX = e.clientX
    pressY = e.clientY
    longPressTimer = setTimeout(() => {
      longPressed = true
      handleAccent()
      longPressTimer = null
    }, LONG_PRESS_MS)
  })

  btn.addEventListener('pointermove', (e) => {
    if (longPressTimer === null) return
    if (Math.abs(e.clientX - pressX) > LONG_PRESS_MOVE_TOLERANCE ||
        Math.abs(e.clientY - pressY) > LONG_PRESS_MOVE_TOLERANCE) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  })

  const cancel = () => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }
  btn.addEventListener('pointerup', cancel)
  btn.addEventListener('pointercancel', cancel)
  btn.addEventListener('pointerleave', cancel)

  btn.addEventListener('click', (e) => {
    // Si el long-press ya disparó accent, ignorar el click consecuente
    if (longPressed) {
      e.preventDefault()
      longPressed = false
      return
    }
    toggleStep(t, s)
    const pattern = getPattern()
    renderStepCell(btn, pattern[t][s])
  })
}

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

  const swingLabel = document.createElement('label')
  swingLabel.className = 'seq-bpm-label'
  swingLabel.textContent = 'Swing'

  const swingRange = document.createElement('input')
  swingRange.type = 'range'
  swingRange.id = 'seq-swing'
  swingRange.className = 'seq-bpm-range'
  swingRange.min = 0.5
  swingRange.max = 0.75
  swingRange.step = 0.01
  swingRange.value = getSwing()

  const swingValue = document.createElement('span')
  swingValue.className = 'slider-value seq-swing-value'
  swingValue.textContent = `${Math.round(getSwing() * 100)}%`

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
  headerRow.appendChild(swingLabel)
  headerRow.appendChild(swingRange)
  headerRow.appendChild(swingValue)
  headerRow.appendChild(clearBtn)
  section.appendChild(headerRow)

  // ── Fila de tabs de patterns (A/B/C…) + acciones ──────────────────────────
  const patternsRow = document.createElement('div')
  patternsRow.className = 'pattern-tabs-row'
  section.appendChild(patternsRow)

  const patternTabs = document.createElement('div')
  patternTabs.className = 'pattern-tabs'
  patternsRow.appendChild(patternTabs)

  const patternActions = document.createElement('div')
  patternActions.className = 'pattern-actions'

  const newPatternBtn = document.createElement('button')
  newPatternBtn.textContent = '+ Nuevo'
  newPatternBtn.title = 'Crear pattern vacío'

  const dupPatternBtn = document.createElement('button')
  dupPatternBtn.textContent = 'Duplicar'
  dupPatternBtn.title = 'Duplica el pattern actual'

  patternActions.appendChild(newPatternBtn)
  patternActions.appendChild(dupPatternBtn)
  patternsRow.appendChild(patternActions)

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
      // Acento visual cada 4 pasos (downbeat)
      if (s % 4 === 0) btn.classList.add('seq-step-downbeat')
      btn.dataset.track = t
      btn.dataset.step = s
      btn.title = 'Click: encender/apagar · Click derecho o mantén presionado: acento'
      renderStepCell(btn, pattern[t][s])

      attachStepHandlers(btn, t, s)

      stepsRow.appendChild(btn)
      stepButtons[t][s] = btn
    }

    grid.appendChild(stepsRow)
  }

  // ── Panel Song (chain de patterns) ────────────────────────────────────────
  const songPanel = document.createElement('div')
  songPanel.className = 'song-panel'

  const songHeader = document.createElement('div')
  songHeader.className = 'song-header'

  const songTitle = document.createElement('div')
  songTitle.className = 'song-title'
  songTitle.textContent = 'Song'

  const modeToggleWrap = document.createElement('div')
  modeToggleWrap.className = 'song-mode-toggle'

  const modeLoopBtn = document.createElement('button')
  modeLoopBtn.textContent = 'Loop pattern'
  modeLoopBtn.title = 'Repite el pattern actual indefinidamente'

  const modeChainBtn = document.createElement('button')
  modeChainBtn.textContent = 'Chain'
  modeChainBtn.title = 'Reproduce la secuencia de patterns'

  modeToggleWrap.appendChild(modeLoopBtn)
  modeToggleWrap.appendChild(modeChainBtn)

  songHeader.appendChild(songTitle)
  songHeader.appendChild(modeToggleWrap)
  songPanel.appendChild(songHeader)

  const chainList = document.createElement('div')
  chainList.className = 'song-chain-list'
  songPanel.appendChild(chainList)

  const addStepBtn = document.createElement('button')
  addStepBtn.className = 'song-add-step'
  addStepBtn.textContent = '+ Agregar paso'
  songPanel.appendChild(addStepBtn)

  section.appendChild(songPanel)

  container.appendChild(section)

  // ── Helpers para actualizar UI cuando cambia el modelo ─────────────────────
  function redrawGridFromEditingPattern() {
    const p = getPattern()
    for (let t = 0; t < DRUM_NAMES.length; t++) {
      for (let s = 0; s < SEQUENCER_STEPS; s++) {
        renderStepCell(stepButtons[t][s], p[t][s])
      }
    }
  }

  function refreshPatternTabs() {
    patternTabs.innerHTML = ''
    const ids = getPatternIds()
    const editingId = getEditingPatternId()
    for (const id of ids) {
      const tab = document.createElement('div')
      tab.className = 'pattern-tab'
      tab.dataset.id = id
      if (id === editingId) tab.classList.add('pattern-tab-active')

      const label = document.createElement('button')
      label.className = 'pattern-tab-label'
      label.textContent = id
      label.title = `Editar pattern ${id}`
      label.addEventListener('click', () => {
        if (setEditingPattern(id)) {
          redrawGridFromEditingPattern()
          refreshPatternTabs()
        }
      })

      const closeBtn = document.createElement('button')
      closeBtn.className = 'pattern-tab-close'
      closeBtn.textContent = '✕'
      closeBtn.title = `Borrar pattern ${id}`
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        if (getPatternIds().length <= 1) {
          alert('Tiene que quedar al menos un pattern.')
          return
        }
        if (!confirm(`¿Borrar el pattern ${id}?`)) return
        deletePattern(id)
        redrawGridFromEditingPattern()
        refreshPatternTabs()
        refreshChainList()
      })

      tab.appendChild(label)
      tab.appendChild(closeBtn)
      patternTabs.appendChild(tab)
    }
    highlightPlayingTab(currentPlayingId)
  }

  let currentPlayingId = null
  function highlightPlayingTab(id) {
    currentPlayingId = id
    for (const tab of patternTabs.querySelectorAll('.pattern-tab')) {
      tab.classList.toggle('pattern-tab-playing', id != null && tab.dataset.id === id)
    }
  }

  function refreshModeToggle() {
    const enabled = isChainEnabled()
    modeLoopBtn.classList.toggle('btn-active', !enabled)
    modeChainBtn.classList.toggle('btn-active', enabled)
    chainList.classList.toggle('song-chain-list-disabled', !enabled)
    addStepBtn.disabled = !enabled
  }

  function refreshChainList() {
    chainList.innerHTML = ''
    const chain = getChain()
    const ids = getPatternIds()
    chain.forEach((item, index) => {
      const row = document.createElement('div')
      row.className = 'song-chain-item'

      const select = document.createElement('select')
      for (const id of ids) {
        const opt = document.createElement('option')
        opt.value = id
        opt.textContent = id
        if (id === item.id) opt.selected = true
        select.appendChild(opt)
      }
      select.addEventListener('change', () => {
        const newChain = getChain()
        newChain[index].id = select.value
        setChain(newChain)
      })

      const xLabel = document.createElement('span')
      xLabel.className = 'song-chain-x'
      xLabel.textContent = '×'

      const repeatsInput = document.createElement('input')
      repeatsInput.type = 'number'
      repeatsInput.className = 'song-chain-repeats'
      repeatsInput.min = 1
      repeatsInput.max = 64
      repeatsInput.value = item.repeats
      repeatsInput.addEventListener('change', () => {
        const val = Math.max(1, Math.min(64, parseInt(repeatsInput.value) || 1))
        repeatsInput.value = val
        const newChain = getChain()
        newChain[index].repeats = val
        setChain(newChain)
      })

      const upBtn = document.createElement('button')
      upBtn.className = 'song-chain-move'
      upBtn.textContent = '↑'
      upBtn.disabled = index === 0
      upBtn.addEventListener('click', () => {
        const newChain = getChain()
        const tmp = newChain[index - 1]
        newChain[index - 1] = newChain[index]
        newChain[index] = tmp
        setChain(newChain)
        refreshChainList()
      })

      const downBtn = document.createElement('button')
      downBtn.className = 'song-chain-move'
      downBtn.textContent = '↓'
      downBtn.disabled = index === chain.length - 1
      downBtn.addEventListener('click', () => {
        const newChain = getChain()
        const tmp = newChain[index + 1]
        newChain[index + 1] = newChain[index]
        newChain[index] = tmp
        setChain(newChain)
        refreshChainList()
      })

      const removeBtn = document.createElement('button')
      removeBtn.className = 'song-chain-remove'
      removeBtn.textContent = '✕'
      removeBtn.title = 'Quitar este paso'
      removeBtn.disabled = chain.length <= 1
      removeBtn.addEventListener('click', () => {
        const newChain = getChain()
        newChain.splice(index, 1)
        setChain(newChain)
        refreshChainList()
      })

      row.appendChild(select)
      row.appendChild(xLabel)
      row.appendChild(repeatsInput)
      row.appendChild(upBtn)
      row.appendChild(downBtn)
      row.appendChild(removeBtn)
      chainList.appendChild(row)
    })
  }

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

  swingRange.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value)
    setSwing(val)
    swingValue.textContent = `${Math.round(val * 100)}%`
  })

  clearBtn.addEventListener('click', () => {
    clearPattern()
    for (let t = 0; t < DRUM_NAMES.length; t++) {
      for (let s = 0; s < SEQUENCER_STEPS; s++) {
        renderStepCell(stepButtons[t][s], 0)
      }
    }
  })

  newPatternBtn.addEventListener('click', () => {
    const id = createPattern()
    if (!id) return
    setEditingPattern(id)
    redrawGridFromEditingPattern()
    refreshPatternTabs()
    refreshChainList()  // las opciones de select crecen
  })

  dupPatternBtn.addEventListener('click', () => {
    const id = duplicateCurrentPattern()
    if (!id) return
    setEditingPattern(id)
    redrawGridFromEditingPattern()
    refreshPatternTabs()
    refreshChainList()
  })

  modeLoopBtn.addEventListener('click', () => {
    setChainEnabled(false)
    refreshModeToggle()
  })

  modeChainBtn.addEventListener('click', () => {
    setChainEnabled(true)
    refreshModeToggle()
  })

  addStepBtn.addEventListener('click', () => {
    const chain = getChain()
    const lastId = chain[chain.length - 1]?.id ?? getPatternIds()[0]
    chain.push({ id: lastId, repeats: 1 })
    setChain(chain)
    refreshChainList()
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

  // Notificación de cambio de pattern dentro de un chain — resalta el tab
  setOnPatternChange((id) => {
    highlightPlayingTab(id)
  })

  // Expone los refresh helpers para que main.js los invoque tras cargar estado
  sequencerUIRefresh.redrawGrid = redrawGridFromEditingPattern
  sequencerUIRefresh.refreshTabs = refreshPatternTabs
  sequencerUIRefresh.refreshMode = refreshModeToggle
  sequencerUIRefresh.refreshChain = refreshChainList

  // Render inicial
  refreshPatternTabs()
  refreshModeToggle()
  refreshChainList()
}

// Handle público para refrescar la UI del secuenciador tras cargar un estado.
export const sequencerUIRefresh = {
  redrawGrid: () => {},
  refreshTabs: () => {},
  refreshMode: () => {},
  refreshChain: () => {},
}
