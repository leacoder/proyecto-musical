# Synth App

Sintetizador web + drum machine + secuenciador. Sin frameworks, sin librerías de audio. Todo con Web Audio API puro y Vite.

## Instalación

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` en el navegador.

## Build de producción

```bash
npm run build
npm run preview
```

## Atajos de teclado

### Sintetizador melódico

| Tecla | Nota  |
|-------|-------|
| A     | C3    |
| W     | C#3   |
| S     | D3    |
| E     | D#3   |
| D     | E3    |
| F     | F3    |
| T     | F#3   |
| G     | G3    |
| Y     | G#3   |
| H     | A3    |
| U     | A#3   |
| J     | B3    |
| K     | C4    |
| O     | C#4   |
| L     | D4    |
| P     | D#4   |
| ;     | E4    |

### Drum machine

| Tecla | Drum    |
|-------|---------|
| 1     | Kick    |
| 2     | Snare   |
| 3     | Hi-hat  |
| 4     | Clap    |

## Funcionalidades

- **Sintetizador polifónico** (hasta 8 voces simultáneas): waveform selector, envolvente ADSR, filtro lowpass con cutoff y resonance.
- **Drum machine**: kick, snare, hi-hat y clap sintetizados con Web Audio puro. Volumen individual por drum.
- **Secuenciador**: 16 pasos, 4 pistas (una por drum), BPM 40–220, indicador visual de posición, timing preciso con lookahead scheduling.
- **Efectos**: reverb (ConvolverNode con impulso sintético) y delay con feedback, sends independientes para synth y drums.
- **Mixer**: volumen master, synth y drums con sends de efectos.
- **Osciloscopio**: visualizador de forma de onda en tiempo real.
- **Persistencia**: el patrón, parámetros del synth, BPM y volúmenes se guardan automáticamente en `localStorage`.
- **Presets**: Bass, Lead, Pad, Pluck.
- **Grabación**: graba la sesión y descarga como `.webm`.
- **Compartir por URL**: exporta el estado completo en el hash de la URL. Pegarla en otra pestaña restaura todo.
- **Pánico**: botón que corta todo el sonido inmediatamente.

## Arquitectura de audio

```
Synth voices  ─┐
               ├─→ synthBus ─┐
Drum voices   ─┘             │    ┌─→ ConvolverNode (reverb) ─┐
                             ├────┤                            ├─→ DynamicsCompressor → MasterGain → Analyser → destination
                             │    └─→ DelayNode (delay) ───────┘
                             │
                             └─→ dry ─────────────────────────┘
```

El secuenciador usa lookahead scheduling: `setTimeout` cada 25 ms pre-agenda eventos con `ctx.currentTime` para los próximos 100 ms. El timing visual se calcula por separado con `requestAnimationFrame`.
