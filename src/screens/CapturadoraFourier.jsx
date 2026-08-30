import { forwardRef, useEffect, useRef, useState } from 'react'
import { FaCircleStop, FaMicrophone, FaUpload } from 'react-icons/fa6'
import { useAudioVisualizer } from '@tkhdev/react-audio-visualizer'
import JSZip from 'jszip';

const tipos_audio = ['.mp3', '.wav']

function siesAudio(nombre) {
    const minuscula = nombre.toLowerCase()
    return tipos_audio.some(tipo => minuscula.endsWith(tipo))
}

function AudioVisual({ audioURL }) {
    const Audio = useRef(null)
    const [, forceRender] = useState(0)
    const [audioBuffer, setAudioBuffer] = useState(null)
    const canvasTiempoRef = useRef(null)
    const animacionRef = useRef(null)

    useEffect(() => {
        forceRender((n) => n + 1)

        let activo = true
        fetch(audioURL)
            .then((response) => response.arrayBuffer())
            .then((arrayBuffer) => {
                const ctx = new (window.AudioContext || window.webkitAudioContext)()
                return ctx.decodeAudioData(arrayBuffer).then((audioBuffer) => {
                    if (activo) {
                        setAudioBuffer(audioBuffer)
                    }
                    return ctx.close()
                })
            })
            .catch(() => {
                if (activo) setForma(null)
            })

        return () => {
            activo = false
            if (animacionRef.current) cancelAnimationFrame(animacionRef.current)
        }
    }, [audioURL])

    const { canvasRef, start, stop } = useAudioVisualizer({
        source: Audio.current,
        mode: 'spectrum',
        barColor: '#f20707',
        backgroundColor: '#ffffff'
    })

    const actualizarOnda = () => {
        const audio = Audio.current
        if (!audioBuffer || !audio) return

        const muestras = 2048
        const centro = Math.floor(audio.currentTime * audioBuffer.sampleRate)
        const inicio = Math.max(0, centro - Math.floor(muestras / 2))
        const datos = new Float32Array(muestras)
        datos.set(audioBuffer.getChannelData(0).subarray(inicio, inicio + muestras))
        dibujarOnda(canvasTiempoRef.current, datos)

        if (!audio.paused && !audio.ended) {
            animacionRef.current = requestAnimationFrame(actualizarOnda)
        }
    }

    const iniciarOnda = () => {
        if (animacionRef.current) cancelAnimationFrame(animacionRef.current)
        actualizarOnda()
    }

    const detenerOnda = () => {
        if (animacionRef.current) {
            cancelAnimationFrame(animacionRef.current)
            animacionRef.current = null
        }
        actualizarOnda()
    }

    useEffect(() => {
        if (!audioBuffer) return
        actualizarOnda()
    }, [audioBuffer])

    return (
        <>
            <canvas ref={canvasRef} width="1200" height="300" style={{ width: '100%', display: 'block' }} />
            <canvas ref={canvasTiempoRef} width="1200" height="300" style={{ width: '100%', display: 'block' }} />
            <audio
                ref={Audio}
                controls
                src={audioURL}
                style={{ width: '100%', display: 'block' }}
                onPlay={() => {
                    start()
                    iniciarOnda()
                }}
                onPause={() => {
                    stop()
                    detenerOnda()
                }}
                onEnded={() => {
                    stop()
                    detenerOnda()
                }}
            />
        </>
    )
}

function ZoomAudio({ children }) {
    const [Escala, setEscala] = useState(1)
    const containerRef = useRef(null)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const handleWheel = (event) => {
            event.preventDefault()
            setEscala((prev) => {
                const nuevaEscala = Math.min(
                    5,
                    Math.max(0.1, prev - event.deltaY * 0.001)
                )
                return nuevaEscala
            })
        }

        el.addEventListener('wheel', handleWheel, { passive: false })
        return () => el.removeEventListener('wheel', handleWheel)
    }, [])

    return (
        <div
            ref={containerRef}
            style={{
                overflow: 'auto',
                width: '100%',
                maxWidth: '1200px',
                border: '1px solid #ccc',
                position: 'relative'
            }}
        >
            <div
                style={{
                    transform: `scale(${Escala})`,
                    transformOrigin: '0 0',
                    width: '100%',
                    height: 'auto'
                }}
            >
                {children}
            </div>
        </div>
    )
}

async function decodificarArchivo(file) {
    const arrayBuffer = await file.arrayBuffer()
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    ctx.close()
    return audioBuffer
}

function reducirABandas(freqArray, sampleRate, fftSize, numBandas = 28) {
    const nyquist = sampleRate / 2
    const bandas = new Float32Array(numBandas)
    const minFreq = 50
    const maxFreq = Math.min(8000, nyquist)

    const logMin = Math.log2(minFreq)
    const logMax = Math.log2(maxFreq)

    for (let b = 0; b < numBandas; b++) {
        const f0 = Math.pow(2, logMin + (b / numBandas) * (logMax - logMin))
        const f1 = Math.pow(2, logMin + ((b + 1) / numBandas) * (logMax - logMin))

        const i0 = Math.floor((f0 / nyquist) * freqArray.length)
        const i1 = Math.max(i0 + 1, Math.floor((f1 / nyquist) * freqArray.length))

        let suma = 0
        let cuenta = 0
        for (let i = i0; i < i1 && i < freqArray.length; i++) {
            const db = Number.isFinite(freqArray[i]) ? freqArray[i] : -140
            suma += Math.pow(10, db / 20)
            cuenta++
        }
        bandas[b] = cuenta ? suma / cuenta : 0
    }

    let norma = 0
    for (let i = 0; i < bandas.length; i++) norma += bandas[i] * bandas[i]
    norma = Math.sqrt(norma) || 1
    for (let i = 0; i < bandas.length; i++) bandas[i] /= norma

    return bandas
}

async function extraerCaracteristicas(audioBuffer, { hopSize = 2048, numBandas = 28 } = {}) {
    const offlineCtx = new OfflineAudioContext(
        1,
        audioBuffer.length,
        audioBuffer.sampleRate
    )

    const source = offlineCtx.createBufferSource()
    source.buffer = audioBuffer

    const analyser = offlineCtx.createAnalyser()
    analyser.fftSize = hopSize
    source.connect(analyser)
    analyser.connect(offlineCtx.destination)

    const processor = offlineCtx.createScriptProcessor(hopSize, 1, 1)
    analyser.connect(processor)
    processor.connect(offlineCtx.destination)

    const framesBandas = []
    const framesPotencia = []

    const freqArray = new Float32Array(analyser.frequencyBinCount)
    const timeArray = new Float32Array(analyser.fftSize)

    processor.onaudioprocess = () => {
        analyser.getFloatFrequencyData(freqArray)
        analyser.getFloatTimeDomainData(timeArray)

        framesBandas.push(reducirABandas(freqArray, audioBuffer.sampleRate, analyser.fftSize, numBandas))

        let sumaCuadrados = 0
        for (let i = 0; i < timeArray.length; i++) sumaCuadrados += timeArray[i] * timeArray[i]
        framesPotencia.push(Math.sqrt(sumaCuadrados / timeArray.length))
    }

    source.start()
    await offlineCtx.startRendering()

    return {
        bandas: framesBandas,
        potencia: framesPotencia,
        sampleRate: audioBuffer.sampleRate,
        hopSize
    }
}


function promedioBandas(frames) {
    if (!frames.length) return new Float32Array(0)
    const numBandas = frames[0].length
    const promedio = new Float32Array(numBandas)

    for (const f of frames) {
        for (let i = 0; i < numBandas; i++) promedio[i] += f[i]
    }
    for (let i = 0; i < numBandas; i++) promedio[i] /= frames.length

    return promedio
}

function similitudCoseno(a, b) {
    let dot = 0
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
    return dot
}


function calcularConfianza(puntajes, mejorPuntaje) {
    const n = puntajes.length
    const confianzaBruta = Math.max(0, Math.min(1, mejorPuntaje))

    const MINIMO_OFFSETS_PARA_ESTADISTICA = 10
    if (n < MINIMO_OFFSETS_PARA_ESTADISTICA) {
        return confianzaBruta
    }

    let media = 0
    for (let i = 0; i < n; i++) media += puntajes[i]
    media /= n

    let varianza = 0
    for (let i = 0; i < n; i++) varianza += (puntajes[i] - media) ** 2
    const desvio = Math.sqrt(varianza / n) || 0.0001

    const zScore = (mejorPuntaje - media) / desvio
    const confianzaUnicidad = 1 / (1 + Math.exp(-zScore + 2))

    return (confianzaBruta * 0.5) + (confianzaUnicidad * 0.5)
}


function calcularUmbralSilencio(potencia) {
    let max = 0
    for (let i = 0; i < potencia.length; i++) max = Math.max(max, potencia[i])
    return max * 0.05
}

function buscarCoincidencia(featA, featB, modo = 'armonicos') {
    const framesA = modo === 'armonicos' ? featA.bandas : featA.potencia
    const framesB = modo === 'armonicos' ? featB.bandas : featB.potencia

    const nA = framesA.length
    const nB = framesB.length

    if (nA === 0 || nB === 0) throw new Error('Uno de los audios no tiene suficientes datos.')
    if (nA > nB) throw new Error('El audio A es más largo que B, no puede estar "dentro" de B.')


    const umbralA = calcularUmbralSilencio(featA.potencia)
    const umbralB = calcularUmbralSilencio(featB.potencia)

    const puntajes = new Float32Array(nB - nA + 1)

    for (let offset = 0; offset <= nB - nA; offset++) {
        let suma = 0
        let cuentaValida = 0

        for (let i = 0; i < nA; i++) {
            const silencioA = featA.potencia[i] < umbralA
            const silencioB = featB.potencia[offset + i] < umbralB

            if (silencioA && silencioB) continue

            cuentaValida++

            if (modo === 'armonicos') {
                suma += similitudCoseno(framesA[i], framesB[offset + i])
            } else {
                const diff = Math.abs(framesA[i] - framesB[offset + i])
                suma += 1 - Math.min(1, diff)
            }
        }

        puntajes[offset] = cuentaValida > 0 ? suma / cuentaValida : 0
    }

    let mejorOffset = 0
    let mejorPuntaje = -Infinity
    for (let i = 0; i < puntajes.length; i++) {
        if (puntajes[i] > mejorPuntaje) {
            mejorPuntaje = puntajes[i]
            mejorOffset = i
        }
    }

    const confianza = calcularConfianza(puntajes, mejorPuntaje)
    const tiempoSegundos = (mejorOffset * featB.hopSize) / featB.sampleRate

    return {
        offset: mejorOffset,
        tiempoSegundos,
        puntajeBruto: mejorPuntaje,
        confianza,
        puntajes
    }
}

function formatearTiempo(segundos) {
    const m = Math.floor(segundos / 60)
    const s = Math.floor(segundos % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const GraficoCoincidencia = forwardRef(function GraficoCoincidencia(
    { puntajes, mejorOffset, hopSize, sampleRate, potenciaB },
    canvasRefExterno
) {
    const canvasPropio = useRef(null)
    const canvasRef = canvasRefExterno || canvasPropio

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !puntajes || !puntajes.length) return

        const ctx = canvas.getContext('2d')
        const ancho = canvas.width
        const alto = canvas.height
        const margenInferior = 24
        const altoEnergia = 40
        const altoPrincipal = alto - margenInferior - altoEnergia - 6

        ctx.fillStyle = '#111827'
        ctx.fillRect(0, 0, ancho, alto)
   
        ctx.strokeStyle = '#374151'
        ctx.lineWidth = 1
        for (let i = 0; i <= 4; i++) {
            const y = (altoPrincipal / 4) * i
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(ancho, y)
            ctx.stroke()
        }

        let min = Infinity
        let max = -Infinity
        let media = 0
        for (let i = 0; i < puntajes.length; i++) {
            if (puntajes[i] < min) min = puntajes[i]
            if (puntajes[i] > max) max = puntajes[i]
            media += puntajes[i]
        }
        media /= puntajes.length
        const rango = (max - min) || 1

        // Etiquetas de valor en el eje Y (arriba = máximo, abajo = mínimo)
        ctx.fillStyle = '#9ca3af'
        ctx.font = '11px sans-serif'
        ctx.fillText(`${(max * 100).toFixed(0)}%`, 4, 12)
        ctx.fillText(`${(min * 100).toFixed(0)}%`, 4, altoPrincipal - 4)

        // Línea de media (referencia de "esto es lo normal")
        const yMedia = altoPrincipal - ((media - min) / rango) * altoPrincipal
        ctx.strokeStyle = '#4b5563'
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(0, yMedia)
        ctx.lineTo(ancho, yMedia)
        ctx.stroke()
        ctx.setLineDash([])

        // Curva de similitud
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < puntajes.length; i++) {
            const x = (i / (puntajes.length - 1 || 1)) * ancho
            const yNorm = (puntajes[i] - min) / rango
            const y = altoPrincipal - yNorm * altoPrincipal
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.stroke()

        const xPico = (mejorOffset / (puntajes.length - 1 || 1)) * ancho
        const yPico = altoPrincipal - ((puntajes[mejorOffset] - min) / rango) * altoPrincipal

        ctx.strokeStyle = '#f87171'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(xPico, 0)
        ctx.lineTo(xPico, altoPrincipal)
        ctx.stroke()

        ctx.fillStyle = '#f87171'
        ctx.beginPath()
        ctx.arc(xPico, yPico, 4, 0, Math.PI * 2)
        ctx.fill()

        const tiempoPico = (mejorOffset * hopSize) / sampleRate
        ctx.font = 'bold 13px sans-serif'
        const etiqueta = `${tiempoPico.toFixed(1)}s · ${(puntajes[mejorOffset] * 100).toFixed(0)}%`
        const etiquetaX = Math.min(Math.max(xPico + 8, 4), ancho - 120)
        ctx.fillText(etiqueta, etiquetaX, 16)

        const yEnergiaBase = altoPrincipal + 6
        ctx.fillStyle = '#1f2937'
        ctx.fillRect(0, yEnergiaBase, ancho, altoEnergia)

        if (potenciaB && potenciaB.length) {
            let maxEnergia = 0
            for (let i = 0; i < potenciaB.length; i++) maxEnergia = Math.max(maxEnergia, potenciaB[i])
            maxEnergia = maxEnergia || 1

            ctx.fillStyle = '#6ee7b7'
            const pasoX = ancho / potenciaB.length
            for (let i = 0; i < potenciaB.length; i++) {
                const h = (potenciaB[i] / maxEnergia) * altoEnergia
                ctx.fillRect(i * pasoX, yEnergiaBase + altoEnergia - h, Math.max(1, pasoX), h)
            }

            ctx.fillStyle = '#9ca3af'
            ctx.font = '10px sans-serif'
            ctx.fillText('energía real de B', 4, yEnergiaBase + 12)
        }

        // Marcas de tiempo en el eje X
        const duracionTotal = (puntajes.length * hopSize) / sampleRate
        ctx.fillStyle = '#9ca3af'
        ctx.font = '11px sans-serif'
        const pasos = 6
        for (let i = 0; i <= pasos; i++) {
            const x = (i / pasos) * ancho
            const t = (i / pasos) * duracionTotal
            ctx.fillText(`${t.toFixed(0)}s`, Math.min(x, ancho - 24), alto - 6)
        }
    }, [puntajes, mejorOffset, hopSize, sampleRate, potenciaB])

    return (
        <canvas
            ref={canvasRef}
            width={1600}
            height={260}
            style={{ background: '#111827', borderRadius: 8, width: '100%', display: 'block' }}
        />
    )
})


const GraficoPerfil = forwardRef(function GraficoPerfil({ perfilA, perfilB, modo }, canvasRefExterno) {
    const canvasPropio = useRef(null)
    const canvasRef = canvasRefExterno || canvasPropio

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !perfilA || !perfilB || !perfilA.length) return

        const ctx = canvas.getContext('2d')
        const ancho = canvas.width
        const alto = canvas.height
        const margenSuperior = 26

        ctx.fillStyle = '#111827'
        ctx.fillRect(0, 0, ancho, alto)

        let max = 0
        for (let i = 0; i < perfilA.length; i++) {
            max = Math.max(max, perfilA[i], perfilB[i] || 0)
        }
        max = max || 1

        if (modo === 'armonicos') {
            const n = perfilA.length
            const anchoBanda = ancho / n

            for (let i = 0; i < n; i++) {
                const alturaA = (perfilA[i] / max) * (alto - margenSuperior - 10)
                const alturaB = (perfilB[i] / max) * (alto - margenSuperior - 10)

                ctx.fillStyle = 'rgba(172, 101, 247, 0.85)'
                ctx.fillRect(i * anchoBanda, alto - alturaA, anchoBanda / 2 - 1, alturaA)

                ctx.fillStyle = 'rgba(56, 189, 248, 0.85)'
                ctx.fillRect(i * anchoBanda + anchoBanda / 2, alto - alturaB, anchoBanda / 2 - 1, alturaB)
            }
        } else {
            const dibujarLinea = (datos, color) => {
                ctx.strokeStyle = color
                ctx.lineWidth = 2
                ctx.beginPath()
                for (let i = 0; i < datos.length; i++) {
                    const x = (i / (datos.length - 1 || 1)) * ancho
                    const y = alto - (datos[i] / max) * (alto - margenSuperior - 10)
                    if (i === 0) ctx.moveTo(x, y)
                    else ctx.lineTo(x, y)
                }
                ctx.stroke()
            }
            dibujarLinea(perfilA, '#ac65f7')
            dibujarLinea(perfilB, '#38bdf8')
        }

        // Leyenda
        ctx.fillStyle = '#ac65f7'
        ctx.fillRect(10, 6, 12, 12)
        ctx.fillStyle = '#e5e7eb'
        ctx.font = '13px sans-serif'
        ctx.fillText('Audio A', 26, 16)

        ctx.fillStyle = '#38bdf8'
        ctx.fillRect(110, 6, 12, 12)
        ctx.fillStyle = '#e5e7eb'
        ctx.fillText('Audio B (segmento encontrado)', 126, 16)
    }, [perfilA, perfilB, modo])

    return (
        <canvas
            ref={canvasRef}
            width={1200}
            height={200}
            style={{ background: '#111827', borderRadius: 8, width: '100%', display: 'block' }}
        />
    )
})


function extraerFormaOnda(channelData, muestrasSalida = 1600) {
    const paso = Math.floor(channelData.length / muestrasSalida) || 1
    const min = new Float32Array(muestrasSalida)
    const max = new Float32Array(muestrasSalida)

    for (let i = 0; i < muestrasSalida; i++) {
        let mn = 1
        let mx = -1
        const inicio = i * paso
        const fin = Math.min(inicio + paso, channelData.length)
        for (let j = inicio; j < fin; j++) {
            const v = channelData[j]
            if (v < mn) mn = v
            if (v > mx) mx = v
        }
        min[i] = mn
        max[i] = mx
    }

    return { min, max }
}

function extensionDeMime(mime) {
    if (!mime) return 'audio'
    if (mime.includes('wav')) return 'wav'
    if (mime.includes('mpeg')) return 'mp3'
    if (mime.includes('webm')) return 'webm'
    if (mime.includes('ogg')) return 'ogg'
    return 'audio'
}

function dibujarOnda(canvas, timeArray) {
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const ancho = canvas.width
    const alto = canvas.height

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#2563eb'
    ctx.beginPath()

    const paso = ancho / timeArray.length
    for (let i = 0; i < timeArray.length; i++) {
        const x = i * paso
        const y = (timeArray[i] * 0.5 + 0.5) * alto
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
    }
    ctx.stroke()
}

const GraficoOriginal = forwardRef(function GraficoOriginal({ forma, duracion, nombre }, canvasRefExterno) {
    const canvasPropio = useRef(null)
    const canvasRef = canvasRefExterno || canvasPropio

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !forma) return

        dibujarOnda(canvas, forma.max)
    }, [forma, duracion, nombre])

    return (
        <canvas
            ref={canvasRef}
            width={1200}
            height={160}
            style={{ background: '#111827', borderRadius: 8, width: '100%', display: 'block' }}
        />
    )
})


function useGrabadorSimple() {
    const [grabando, setGrabando] = useState(false)
    const [blob, setBlob] = useState(null)
    const [segundos, setSegundos] = useState(0)

    const streamRef = useRef(null)
    const recorderRef = useRef(null)
    const trozosRef = useRef([])
    const timerRef = useRef(null)

    const iniciar = async () => {
        setBlob(null)
        setSegundos(0)
        trozosRef.current = []

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : ''
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
        recorderRef.current = recorder

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) trozosRef.current.push(e.data)
        }

        recorder.onstop = () => {
            const grabado = new Blob(trozosRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' })
            setBlob(grabado)
            trozosRef.current = []

            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop())
                streamRef.current = null
            }
        }

        recorder.start()
        setGrabando(true)

        timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000)
    }

    const detener = () => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop()
        }
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
        setGrabando(false)
    }

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
        }
    }, [])

    return { grabando, blob, segundos, iniciar, detener }
}

function SelectorAudio({ etiqueta, onSeleccion }) {
    const grabador = useGrabadorSimple()

    useEffect(() => {
        if (grabador.blob) onSeleccion(grabador.blob)

    }, [grabador.blob])

    return (
        <div className="flex flex-col gap-2 border border-gray-200 rounded-lg p-3 flex-1">
            <span className="text-sm font-semibold text-blue-900">{etiqueta}</span>

            <input
                type="file"
                accept="audio/*"
                onChange={(e) => onSeleccion(e.target.files[0])}
                disabled={grabador.grabando}
            />

            <div className="flex items-center gap-2">
                {!grabador.grabando ? (
                    <button
                        onClick={grabador.iniciar}
                        className="flex items-center gap-1 bg-red-500 text-white text-xs px-3 py-1.5 rounded"
                    >
                        <FaMicrophone /> Grabar
                    </button>
                ) : (
                    <button
                        onClick={grabador.detener}
                        className="flex items-center gap-1 bg-gray-700 text-white text-xs px-3 py-1.5 rounded"
                    >
                        <FaCircleStop /> Detener ({grabador.segundos}s)
                    </button>
                )}
            </div>
        </div>
    )
}


function ComparadorAudio() {
    const [archivoA, setArchivoA] = useState(null)
    const [archivoB, setArchivoB] = useState(null)
    const [modo, setModo] = useState('armonicos')
    const [resultado, setResultado] = useState(null)
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState('')
    const [descargando, setDescargando] = useState(false)
    const [original, setOriginal] = useState(null)

    const canvasCoincidenciaRef = useRef(null)
    const canvasPerfilRef = useRef(null)
    const canvasOriginalRef = useRef(null)

    const comparar = async () => {
        setCargando(true)
        setError('')
        setResultado(null)
        setOriginal(null)
        try {
            const [bufferA, bufferB] = await Promise.all([
                decodificarArchivo(archivoA),
                decodificarArchivo(archivoB)
            ])

            const esAOriginal = bufferA.duration >= bufferB.duration
            const bufferOriginal = esAOriginal ? bufferA : bufferB
            setOriginal({
                forma: extraerFormaOnda(bufferOriginal.getChannelData(0)),
                duracion: bufferOriginal.duration,
                nombre: esAOriginal ? 'Audio A' : 'Audio B',
                blob: esAOriginal ? archivoA : archivoB
            })

            const [featA, featB] = await Promise.all([
                extraerCaracteristicas(bufferA),
                extraerCaracteristicas(bufferB)
            ])

            const resultadoComparacion = buscarCoincidencia(featA, featB, modo)

            let perfilA
            let perfilB

            if (modo === 'armonicos') {
                perfilA = promedioBandas(featA.bandas)
                const segmentoB = featB.bandas.slice(
                    resultadoComparacion.offset,
                    resultadoComparacion.offset + featA.bandas.length
                )
                perfilB = promedioBandas(segmentoB)
            } else {
                perfilA = featA.potencia
                perfilB = featB.potencia.slice(
                    resultadoComparacion.offset,
                    resultadoComparacion.offset + featA.potencia.length
                )
            }

            setResultado({
                ...resultadoComparacion,
                perfilA,
                perfilB,
                potenciaB: featB.potencia,
                hopSize: featB.hopSize,
                sampleRate: featB.sampleRate,
                modo
            })
        } catch (e) {
            setError(e.message)
        } finally {
            setCargando(false)
        }
    }

    const canvasABlob = (canvas) => new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92)
    })

    const descargarResultado = async () => {
        if (
            !resultado ||
            !original ||
            !canvasCoincidenciaRef.current ||
            !canvasPerfilRef.current ||
            !canvasOriginalRef.current
        ) return

        setDescargando(true)
        try {
            const [originalBlobJpg, coincidenciaBlob, perfilBlob] = await Promise.all([
                canvasABlob(canvasOriginalRef.current),
                canvasABlob(canvasCoincidenciaRef.current),
                canvasABlob(canvasPerfilRef.current)
            ])

            const zip = new JSZip()
            const extension = extensionDeMime(original.blob.type)

            zip.file(`audio-original.${extension}`, original.blob)
            zip.file('grafico-audio-original.jpg', originalBlobJpg)
            zip.file('grafico-coincidencia.jpg', coincidenciaBlob)
            zip.file('grafico-perfil.jpg', perfilBlob)
            zip.file('resultado.json', JSON.stringify({
                audioOriginal: original.nombre,
                duracionSegundos: original.duracion,
                modo: resultado.modo,
                tiempoSegundos: resultado.tiempoSegundos,
                confianza: resultado.confianza,
                offset: resultado.offset,
                hopSize: resultado.hopSize,
                sampleRate: resultado.sampleRate
            }, null, 2))

            const zipBlob = await zip.generateAsync({ type: 'blob' })
            const url = URL.createObjectURL(zipBlob)

            const enlace = document.createElement('a')
            enlace.href = url
            enlace.download = 'comparacion.atm'
            enlace.click()

            URL.revokeObjectURL(url)
        } catch (e) {
            console.log(e)
            alert('No se pudo armar el archivo de descarga')
        } finally {
            setDescargando(false)
        }
    }

    return (
        <div className="flex flex-col gap-4 p-4 bg-white/90 rounded-lg mt-6 w-full max-w-[1200px]">
            <h3 className="text-xl font-bold text-blue-900">Comparar dos audios</h3>

            <div className="flex gap-4">
                <SelectorAudio etiqueta="Audio A" onSeleccion={setArchivoA} />
                <SelectorAudio etiqueta="Audio B" onSeleccion={setArchivoB} />
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => setModo('armonicos')}
                    className={modo === 'armonicos' ? 'font-bold underline' : ''}
                >
                    Armónicos
                </button>
                <button
                    onClick={() => setModo('potencia')}
                    className={modo === 'potencia' ? 'font-bold underline' : ''}
                >
                    Potencia
                </button>
            </div>

            <button
                onClick={comparar}
                disabled={!archivoA || !archivoB || cargando}
                className="bg-blue-600 text-white rounded p-2 disabled:opacity-50"
            >
                {cargando ? 'Analizando...' : 'Comparar'}
            </button>

            {error && <p className="text-red-600">{error}</p>}

            {resultado && (
                <>
                    <p>
                        Audio A está en Audio B en el momento{' '}
                        <strong>{formatearTiempo(resultado.tiempoSegundos)}</strong> con{' '}
                        <strong>{(resultado.confianza * 100).toFixed(1)}%</strong> de certeza
                        {' '}(modo: {modo})
                    </p>

                    {original && (
                        <div className="flex flex-col gap-2">
                            <h4 className="text-sm font-semibold text-blue-900">
                                Audio original ({original.nombre}, el más largo de los dos)
                            </h4>
                            <GraficoOriginal
                                ref={canvasOriginalRef}
                                forma={original.forma}
                                duracion={original.duracion}
                                nombre={original.nombre}
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <h4 className="text-sm font-semibold text-blue-900">
                            Dónde: puntaje de coincidencia a lo largo de todo el audio B
                        </h4>
                        <ZoomAudio>
                            <GraficoCoincidencia
                                ref={canvasCoincidenciaRef}
                                puntajes={resultado.puntajes}
                                mejorOffset={resultado.offset}
                                hopSize={resultado.hopSize}
                                sampleRate={resultado.sampleRate}
                                potenciaB={resultado.potenciaB}
                            />
                        </ZoomAudio>
                    </div>

                    <div className="flex flex-col gap-2">
                        <h4 className="text-sm font-semibold text-blue-900">
                            Por qué: perfil de A contra el segmento encontrado en B
                        </h4>
                        <GraficoPerfil
                            ref={canvasPerfilRef}
                            perfilA={resultado.perfilA}
                            perfilB={resultado.perfilB}
                            modo={resultado.modo}
                        />
                    </div>

                    <button
                        onClick={descargarResultado}
                        disabled={descargando}
                        className="bg-purple-600 text-white rounded p-2 w-fit disabled:opacity-50"
                    >
                        {descargando ? 'Preparando...' : 'Descargar .atm (audio original + 3 gráficos)'}
                    </button>
                </>
            )}
        </div>
    )
}

function Reproductor() {
    const [estadoGrabacion, setEstadoGrabacion] = useState('detenido')
    const [audio, setaudio] = useState('')
    const [segundos, setsegundos] = useState(0)
    const [frecuenciaDominante, setFrecuenciaDominante] = useState(null)

    const agregarAudio = useRef(null)
    const grabaraudio = useRef(null)
    const trozos = useRef([])
    const inputFile = useRef(null)
    const audioCtxRef = useRef(null)
    const analyserRef = useRef(null)
    const datosFrecuencia = useRef([])
    const datosTiempo = useRef([])
    const animacionRef = useRef(null)
    const canvasTiempoRef = useRef(null)
    const timerRef = useRef(null)
    const metadataRef = useRef(null)
    const ultimaActualizacionFrecuenciaRef = useRef(0)
    const descartarGrabacionRef = useRef(false)

    const {
        canvasRef: liveCanvas,
        start: startvisualizer,
        stop
    } = useAudioVisualizer({
        source: 'mic',
        mode: 'spectrum',
        barColor: '#f20707',
        backgroundColor: '#ffffff'
    })

    useEffect(() => {
        return () => {
            if (audio) {
                URL.revokeObjectURL(audio)
            }
        }
    }, [audio])

    useEffect(() => {
        return () => {
            if (animacionRef.current) {
                cancelAnimationFrame(animacionRef.current)
                animacionRef.current = null
            }

            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }

            if (agregarAudio.current) {
                agregarAudio.current
                    .getTracks()
                    .forEach((track) => track.stop())
                agregarAudio.current = null
            }

            if (
                audioCtxRef.current &&
                audioCtxRef.current.state !== 'closed'
            ) {
                audioCtxRef.current.close()
                audioCtxRef.current = null
            }
        }
    }, [])

    const obtenerFrecuencia = (indice) => {
        if (!metadataRef.current) return 0
        const { sampleRate, fftSize } = metadataRef.current
        return (indice * sampleRate) / fftSize
    }

    const obtenerFrecuenciaDominante = (freqArray) => {
        if (!metadataRef.current || !freqArray.length) return null

        let indiceMayor = -1
        let magnitudMayor = -Infinity

        for (let i = 1; i < freqArray.length; i++) {
            const magnitud = freqArray[i]
            if (Number.isFinite(magnitud) && magnitud > magnitudMayor) {
                magnitudMayor = magnitud
                indiceMayor = i
            }
        }

        return indiceMayor === -1 ? null : obtenerFrecuencia(indiceMayor)
    }

    const iniciarAnalisisPropio = (stream) => {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) {
            throw new Error('Web Audio API no está disponible en este navegador.')
        }

        audioCtxRef.current = new AudioContextClass()
        const source = audioCtxRef.current.createMediaStreamSource(stream)
        analyserRef.current = audioCtxRef.current.createAnalyser()
        analyserRef.current.fftSize = 2048
        source.connect(analyserRef.current)

        metadataRef.current = {
            sampleRate: audioCtxRef.current.sampleRate,
            fftSize: analyserRef.current.fftSize,
            frequencyBinCount: analyserRef.current.frequencyBinCount,
            frequencyResolution: audioCtxRef.current.sampleRate / analyserRef.current.fftSize
        }

        const bins = analyserRef.current.frequencyBinCount
        const freqArray = new Float32Array(bins)
        const timeArray = new Float32Array(analyserRef.current.fftSize)

        const capturarFrame = () => {
            if (
                grabaraudio.current?.state === 'recording' &&
                analyserRef.current &&
                audioCtxRef.current
            ) {
                analyserRef.current.getFloatFrequencyData(freqArray)
                analyserRef.current.getFloatTimeDomainData(timeArray)

                const timestamp = audioCtxRef.current.currentTime
                const dominante = obtenerFrecuenciaDominante(freqArray)

                datosFrecuencia.current.push({
                    timestamp,
                    magnitudes: new Float32Array(freqArray),
                    dominantFrequency: dominante
                })

                datosTiempo.current.push({
                    timestamp,
                    samples: new Float32Array(timeArray)
                })

                if (
                    dominante !== null &&
                    timestamp - ultimaActualizacionFrecuenciaRef.current >= 0.2
                ) {
                    setFrecuenciaDominante(dominante)
                    ultimaActualizacionFrecuenciaRef.current = timestamp
                }

                dibujarOnda(canvasTiempoRef.current, timeArray)
            }

            animacionRef.current = requestAnimationFrame(capturarFrame)
        }

        capturarFrame()
    }

    const hacergrabacion = async () => {
        try {
            setsegundos(0)
            setaudio('')
            setFrecuenciaDominante(null)

            trozos.current = []
            datosFrecuencia.current = []
            datosTiempo.current = []
            metadataRef.current = null
            ultimaActualizacionFrecuenciaRef.current = 0
            descartarGrabacionRef.current = false

            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            agregarAudio.current = stream

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : ''

            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream)

            grabaraudio.current = recorder

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    trozos.current.push(event.data)
                }
            }

            recorder.onstop = () => {
                if (timerRef.current) {
                    clearInterval(timerRef.current)
                    timerRef.current = null
                }

                if (descartarGrabacionRef.current) {
                    trozos.current = []
                    descartarGrabacionRef.current = false
                    return
                }

                if (!trozos.current.length) return

                const grabado = new Blob(trozos.current, {
                    type: recorder.mimeType || mimeType || 'audio/webm'
                })

                const url = URL.createObjectURL(grabado)
                setaudio(url)
                trozos.current = []
            }

            iniciarAnalisisPropio(stream)

            timerRef.current = setInterval(() => {
                setsegundos((s) => grabaraudio.current?.state === 'recording' ? s + 1 : s)
            }, 1000)

            recorder.start()
            startvisualizer()
            setEstadoGrabacion('grabando')
        } catch (error) {
            console.error('No se pudo iniciar la grabación:', error)
            setEstadoGrabacion('detenido')

            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }

            if (agregarAudio.current) {
                agregarAudio.current.getTracks().forEach((track) => track.stop())
                agregarAudio.current = null
            }
        }
    }

    const parargrabacion = () => {
        setEstadoGrabacion('detenido')

        if (grabaraudio.current && grabaraudio.current.state !== 'inactive') {
            grabaraudio.current.stop()
        }

        if (agregarAudio.current) {
            agregarAudio.current.getTracks().forEach((track) => track.stop())
            agregarAudio.current = null
        }

        if (animacionRef.current) {
            cancelAnimationFrame(animacionRef.current)
            animacionRef.current = null
        }

        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            audioCtxRef.current.close()
            audioCtxRef.current = null
        }

        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }

        stop()
    }

    const pausargrabacion = () => {
        if (grabaraudio.current && grabaraudio.current.state === 'recording') {
            grabaraudio.current.pause()
            stop()
            setEstadoGrabacion('pausado')
        }
    }

    const reanudargrabacion = () => {
        if (grabaraudio.current && grabaraudio.current.state === 'paused') {
            grabaraudio.current.resume()
            startvisualizer()
            setEstadoGrabacion('grabando')
        }
    }

    const subirAudio = async (event) => {
        const archivo = event.target.files[0]
        if (!archivo) return

        const siesATM = archivo.name.toLowerCase().endsWith('.atm')
        if (!siesATM && !archivo.type.startsWith('audio/')) {
            alert('Este bicho usa .atm(podes poner un .zip y cambiarle la extension a .atm) o un audio para probar, mp3 o wav, pero nada mas')
            return
        }

        if (estadoGrabacion === 'grabando' || estadoGrabacion === 'pausado') {
            descartarGrabacionRef.current = true
            parargrabacion()
        }

        if (siesATM) {
            try {
                const zip = new JSZip()
                const zipencontrado = await zip.loadAsync(archivo)

                let entradaAudio = null

                for (const [nombre, entrada] of Object.entries(zipencontrado.files)) {
                    if (!entrada.dir && siesAudio(nombre)) {
                        entradaAudio = { nombre, entrada }
                        break
                    }
                }

                if (!entradaAudio) {
                    alert('No hay MP3, no hay WAV en el archivo, no se reproduce nada')
                    event.target.value = ''
                    return
                }

                const blob = await entradaAudio.entrada.async('blob')
                const mimeType = entradaAudio.nombre.toLowerCase().endsWith('.mp3')
                    ? 'audio/mpeg'
                    : 'audio/wav'

                const typedBlob = new Blob([blob], { type: mimeType })
                const url = URL.createObjectURL(typedBlob)

                setaudio(url)
                setsegundos(0)
            } catch (error) {
                console.log(error)
                alert('No se pudo leer el archivo .atm.')
            }
        } else {
            const url = URL.createObjectURL(archivo)
            setaudio(url)
            setsegundos(0)
        }

        event.target.value = ''
    }

    const tiempoFormateado = () => {
        const minutos = Math.floor(segundos / 60)
        const segundosRestantes = segundos % 60
        return `${minutos.toString().padStart(2, '0')}:${segundosRestantes.toString().padStart(2, '0')}`
    }

    return (
        <div className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-500 gap-4 p-4">
            <h1 className="text-white text-[60px] font-black">Analizador</h1>

            <h2 className="text-[100px] text-white bg-black p-4 rounded-lg mx-4">
                {tiempoFormateado(segundos)}
            </h2>

            {frecuenciaDominante !== null &&
                (estadoGrabacion === 'grabando' || estadoGrabacion === 'pausado') && (
                    <p className="text-white text-xl font-semibold">
                        Frecuencia dominante: {frecuenciaDominante.toFixed(1)} Hz
                    </p>
                )}

            <div className="flex items-center gap-4">
                {estadoGrabacion === 'detenido' && (
                    <button
                        onClick={hacergrabacion}
                        className="flex items-center justify-center text-[60px] bg-blue-500 rounded-full p-4 text-white w-[100px] h-[100px]"
                    >
                        <FaMicrophone />
                    </button>
                )}

                {estadoGrabacion === 'grabando' && (
                    <>
                        <button
                            onClick={pausargrabacion}
                            className="flex items-center justify-center text-[24px] bg-yellow-500 rounded-full p-4 text-white w-[100px] h-[100px]"
                        >
                            Pausar
                        </button>
                        <button
                            onClick={parargrabacion}
                            className="flex items-center justify-center text-[60px] bg-red-500 rounded-full p-4 text-white w-[100px] h-[100px]"
                        >
                            <FaCircleStop />
                        </button>
                    </>
                )}

                {estadoGrabacion === 'pausado' && (
                    <>
                        <button
                            onClick={reanudargrabacion}
                            className="flex items-center justify-center text-[20px] bg-green-500 rounded-full p-4 text-white w-[100px] h-[100px]"
                        >
                            Continuar
                        </button>
                        <button
                            onClick={parargrabacion}
                            className="flex items-center justify-center text-[60px] bg-red-500 rounded-full p-4 text-white w-[100px] h-[100px]"
                        >
                            <FaCircleStop />
                        </button>
                    </>
                )}

                <button
                    onClick={() => inputFile.current?.click()}
                    className="flex items-center justify-center text-[32px] bg-white text-blue-600 rounded-full p-4 w-[100px] h-[100px]"
                >
                    <FaUpload />
                </button>
            </div>

            <input
                ref={inputFile}
                type="file"
                accept="audio/*,.atm"
                onChange={subirAudio}
                className="hidden"
            />

            {(estadoGrabacion === 'grabando' || estadoGrabacion === 'pausado') && (
                <>
                    <ZoomAudio>
                        <canvas ref={liveCanvas} width={1200} height={300} />
                    </ZoomAudio>
                    <ZoomAudio>
                        <canvas ref={canvasTiempoRef} width={1200} height={300} />
                    </ZoomAudio>
                </>
            )}

            {audio && estadoGrabacion === 'detenido' && (
                <ZoomAudio>
                    <AudioVisual key={audio} audioURL={audio} />
                </ZoomAudio>
            )}

            <ComparadorAudio />
        </div>
    )
}

export { ZoomAudio }
export default Reproductor
