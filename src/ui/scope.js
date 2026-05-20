import { getAnalyser } from '../audio/context.js'

let animationId = null
let canvas = null
let ctx2d = null

export function renderScope(container) {
  const section = document.createElement('div')
  section.className = 'section scope-section'

  const title = document.createElement('div')
  title.className = 'section-title'
  title.textContent = 'Forma de onda'
  section.appendChild(title)

  canvas = document.createElement('canvas')
  canvas.className = 'scope-canvas'
  canvas.width = 800
  canvas.height = 80
  section.appendChild(canvas)

  ctx2d = canvas.getContext('2d')
  container.appendChild(section)

  startDrawing()
}

function startDrawing() {
  const analyser = getAnalyser()
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Float32Array(bufferLength)

  function draw() {
    animationId = requestAnimationFrame(draw)

    analyser.getFloatTimeDomainData(dataArray)

    const width = canvas.offsetWidth || canvas.width
    const height = canvas.height
    canvas.width = width  // ajusta al tamaño real del canvas

    // Fondo
    ctx2d.fillStyle = '#0f0f0f'
    ctx2d.fillRect(0, 0, width, height)

    // Línea de centro
    ctx2d.strokeStyle = '#222'
    ctx2d.lineWidth = 1
    ctx2d.beginPath()
    ctx2d.moveTo(0, height / 2)
    ctx2d.lineTo(width, height / 2)
    ctx2d.stroke()

    // Forma de onda
    ctx2d.strokeStyle = '#5b5bd6'
    ctx2d.lineWidth = 1.5
    ctx2d.beginPath()

    const sliceWidth = width / bufferLength

    for (let i = 0; i < bufferLength; i++) {
      const sample = dataArray[i]
      const x = i * sliceWidth
      const y = (1 - (sample * 0.5 + 0.5)) * height

      if (i === 0) {
        ctx2d.moveTo(x, y)
      } else {
        ctx2d.lineTo(x, y)
      }
    }

    ctx2d.stroke()
  }

  draw()
}
