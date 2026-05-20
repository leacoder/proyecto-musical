import { startNote, stopNote } from '../audio/synth.js'

// Teclado de 2 octavas: C3 (MIDI 48) a B4 (MIDI 71)
const KEYBOARD_START_MIDI = 48  // C3
const KEYBOARD_END_MIDI = 71    // B4

// Mapeo de teclas físicas a notas MIDI (orden cromático)
// A W S E D F T G Y H U J K = C D E F G A B C D E F G (2 octavas)
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
  'o': 61,  // C#4
  'l': 62,  // D4
  'p': 63,  // D#4
  ';': 64,  // E4
}

// Qué notas son sostenidos (teclas negras)
const BLACK_NOTES = new Set([1, 3, 6, 8, 10]) // offset desde cada C

function isBlackKey(midiNote) {
  return BLACK_NOTES.has(midiNote % 12)
}

// Teclas presionadas actualmente (para evitar repetición de keydown)
const pressedKeys = new Set()

let keyboardElement = null
// Mapa de midiNote → elemento DOM de tecla
const keyElements = new Map()

export function renderKeyboard(container) {
  keyboardElement = document.createElement('div')
  keyboardElement.className = 'keyboard'
  keyboardElement.setAttribute('role', 'group')
  keyboardElement.setAttribute('aria-label', 'Teclado virtual')

  for (let midi = KEYBOARD_START_MIDI; midi <= KEYBOARD_END_MIDI; midi++) {
    const key = document.createElement('button')
    key.className = isBlackKey(midi) ? 'key key-black' : 'key key-white'
    key.dataset.midi = midi
    key.setAttribute('aria-label', midiToNoteName(midi))
    key.setAttribute('tabindex', '-1')

    key.addEventListener('mousedown', (e) => {
      e.preventDefault()
      pressKey(midi)
    })

    key.addEventListener('mouseup', () => releaseKey(midi))
    key.addEventListener('mouseleave', () => releaseKey(midi))
    // Touch
    key.addEventListener('touchstart', (e) => { e.preventDefault(); pressKey(midi) }, { passive: false })
    key.addEventListener('touchend', (e) => { e.preventDefault(); releaseKey(midi) }, { passive: false })

    keyboardElement.appendChild(key)
    keyElements.set(midi, key)
  }

  container.appendChild(keyboardElement)
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
    // Ignorar si el foco está en un input/select
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
