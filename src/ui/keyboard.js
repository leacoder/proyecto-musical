import { startNote, stopNote } from '../audio/synth.js'

// Mapeo de teclas físicas a notas MIDI
// Octava 1 (A–K): C3–C4 con teclas negras (W E T Y U)
// Octava 2 (X–.): C4–C5 sólo teclas blancas
const KEY_TO_MIDI = {
  'a': 48,  // C3
  'w': 49,  // C#3
  's': 50,  // D3
  'e': 51,  // D#3
  'd': 52,  // E3
  'f': 53,  // F3
  't': 54,  // F#3
  'g': 55,  // G3
  'y': 56,  // G#3
  'h': 57,  // A3
  'u': 58,  // A#3
  'j': 59,  // B3
  'k': 60,  // C4
  'x': 60,  // C4
  'c': 62,  // D4
  'v': 64,  // E4
  'b': 65,  // F4
  'n': 67,  // G4
  'm': 69,  // A4
  ',': 71,  // B4
  '.': 72,  // C5
}

const OCTAVES = [
  { start: 48, end: 60, label: 'A W S E D F T G Y H U J K' },
  { start: 60, end: 72, label: 'X C V B N M , .' },
]

// Qué notas son sostenidos (teclas negras)
const BLACK_NOTES = new Set([1, 3, 6, 8, 10]) // offset desde cada C

function isBlackKey(midiNote) {
  return BLACK_NOTES.has(midiNote % 12)
}

// Teclas presionadas actualmente (para evitar repetición de keydown)
const pressedKeys = new Set()

// Mapa de midiNote → elemento DOM de tecla (puede haber múltiples si la nota aparece en dos octavas)
const keyElements = new Map()

function renderOctave(container, start, end, label) {
  const group = document.createElement('div')
  group.className = 'keyboard-group'

  const labelEl = document.createElement('div')
  labelEl.className = 'keyboard-group-label'
  labelEl.textContent = label

  const keyboard = document.createElement('div')
  keyboard.className = 'keyboard'
  keyboard.setAttribute('role', 'group')
  keyboard.setAttribute('aria-label', label)

  for (let midi = start; midi <= end; midi++) {
    const key = document.createElement('button')
    key.className = isBlackKey(midi) ? 'key key-black' : 'key key-white'
    key.dataset.midi = midi
    key.setAttribute('aria-label', midiToNoteName(midi))
    key.setAttribute('tabindex', '-1')

    key.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      pressKey(midi)
    })

    const release = () => releaseKey(midi)
    key.addEventListener('pointerup', release)
    key.addEventListener('pointerleave', release)
    key.addEventListener('pointercancel', release)

    key.addEventListener('contextmenu', (e) => e.preventDefault())

    keyboard.appendChild(key)
    // Si la nota ya tiene elemento (C4 aparece en ambas octavas), guardar el primero
    if (!keyElements.has(midi)) keyElements.set(midi, key)
  }

  group.appendChild(labelEl)
  group.appendChild(keyboard)
  container.appendChild(group)
}

export function renderKeyboard(container) {
  for (const { start, end, label } of OCTAVES) {
    renderOctave(container, start, end, label)
  }
  attachKeyboardListeners()
}

function pressKey(midiNote) {
  startNote(midiNote)
  const el = keyElements.get(midiNote)
  if (el) el.classList.add('key-active')
}

function releaseKey(midiNote) {
  stopNote(midiNote)
  const el = keyElements.get(midiNote)
  if (el) el.classList.remove('key-active')
}

function attachKeyboardListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
    if (e.repeat) return

    const midi = KEY_TO_MIDI[e.key.toLowerCase()]
    if (midi !== undefined && !pressedKeys.has(e.key.toLowerCase())) {
      pressedKeys.add(e.key.toLowerCase())
      pressKey(midi)
    }
  })

  document.addEventListener('keyup', (e) => {
    const midi = KEY_TO_MIDI[e.key.toLowerCase()]
    if (midi !== undefined) {
      pressedKeys.delete(e.key.toLowerCase())
      releaseKey(midi)
    }
  })
}

function midiToNoteName(midi) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midi / 12) - 1
  return notes[midi % 12] + octave
}

export function getKeyboardMappingText() {
  return Object.entries(KEY_TO_MIDI)
    .map(([key, midi]) => `${key.toUpperCase()} → ${midiToNoteName(midi)}`)
    .join(', ')
}
