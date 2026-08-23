import { useEffect, useRef, useState } from 'react'
import { FaCircleStop, FaMicrophone, FaUpload } from 'react-icons/fa6'
import { useAudioVisualizer } from '@tkhdev/react-audio-visualizer'

function AudioVisual({ audioURL }) {
    const Audio = useRef(null)
    const [, forceRender] = useState(0)

    useEffect(() => {
        forceRender((n) => n + 1)
    }, [audioURL])

    const { canvasRef, start, stop } = useAudioVisualizer({
        source: Audio.current,
        mode: 'spectrum',
        barColor: '#ac65f7',
        backgroundColor: '#464646'
    })

    return (
        <>
            <canvas ref={canvasRef} width="1200" height="300" />
            <audio
                ref={Audio}
                controls
                src={audioURL}
                onPlay={start}
                onPause={stop}
                onEnded={stop}
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

                console.log('Escala actual:', nuevaEscala)
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
                height: '300px',
                border: '1px solid #ccc',
                position: 'relative'
            }}
        >
            <div
                style={{
                    transform: `scale(${Escala})`,
                    transformOrigin: '0 0',
                    width: '100%',
                    height: '100%'
                }}
            >
                {children}
            </div>
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

    // Libera URLs creadas con URL.createObjectURL cuando cambian o al desmontar.
    useEffect(() => {
        return () => {
            if (audio) {
                URL.revokeObjectURL(audio)
            }
        }
    }, [audio])

    // Limpieza general si el componente se desmonta durante una grabación.
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

        // Se omite el bin 0 para evitar considerar el componente DC.
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
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext

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
            frequencyResolution:
                audioCtxRef.current.sampleRate / analyserRef.current.fftSize
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

                // Actualiza la interfaz como máximo 5 veces por segundo.
                if (
                    dominante !== null &&
                    timestamp - ultimaActualizacionFrecuenciaRef.current >= 0.2
                ) {
                    setFrecuenciaDominante(dominante)
                    ultimaActualizacionFrecuenciaRef.current = timestamp
                }

                dibujarOnda(timeArray)
            }

            animacionRef.current = requestAnimationFrame(capturarFrame)
        }

        capturarFrame()
    }

    // Dibuja la onda en el dominio del tiempo usando las muestras capturadas.
    const dibujarOnda = (timeArray) => {
        const canvas = canvasTiempoRef.current
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

            if (i === 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }
        }

        ctx.stroke()
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

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            })

            agregarAudio.current = stream

            const mimeType = MediaRecorder.isTypeSupported(
                'audio/webm;codecs=opus'
            )
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
                setsegundos((s) =>
                    grabaraudio.current?.state === 'recording' ? s + 1 : s
                )
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
                agregarAudio.current
                    .getTracks()
                    .forEach((track) => track.stop())
                agregarAudio.current = null
            }
        }
    }

    const parargrabacion = () => {
        setEstadoGrabacion('detenido')

        if (
            grabaraudio.current &&
            grabaraudio.current.state !== 'inactive'
        ) {
            grabaraudio.current.stop()
        }

        if (agregarAudio.current) {
            agregarAudio.current
                .getTracks()
                .forEach((track) => track.stop())
            agregarAudio.current = null
        }

        if (animacionRef.current) {
            cancelAnimationFrame(animacionRef.current)
            animacionRef.current = null
        }

        if (
            audioCtxRef.current &&
            audioCtxRef.current.state !== 'closed'
        ) {
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
        if (
            grabaraudio.current &&
            grabaraudio.current.state === 'recording'
        ) {
            grabaraudio.current.pause()
            stop()
            setEstadoGrabacion('pausado')
        }
    }

    const reanudargrabacion = () => {
        if (
            grabaraudio.current &&
            grabaraudio.current.state === 'paused'
        ) {
            grabaraudio.current.resume()
            startvisualizer()
            setEstadoGrabacion('grabando')
        }
    }

    const subirAudio = (event) => {
        const archivo = event.target.files[0]
        if (!archivo) return

        const esWav =
            archivo.type === 'audio/wav' ||
            archivo.type === 'audio/x-wav' ||
            archivo.name.toLowerCase().endsWith('.wav')

        if (!esWav) {
            alert('El Analizador únicamente acepta archivos WAV.')
            event.target.value = ''
            return
        }

        if (
            estadoGrabacion === 'grabando' ||
            estadoGrabacion === 'pausado'
        ) {
            // Evita que el onstop de la grabación reemplace el WAV seleccionado.
            descartarGrabacionRef.current = true
            parargrabacion()
        }

        const url = URL.createObjectURL(archivo)
        setaudio(url)
        setsegundos(0)
        setFrecuenciaDominante(null)

        event.target.value = ''
    }

    const tiempoFormateado = () => {
        const minutos = Math.floor(segundos / 60)
        const segundosRestantes = segundos % 60

        return `${minutos.toString().padStart(2, '0')}:${segundosRestantes
            .toString()
            .padStart(2, '0')}`
    }

    return (
        <div className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-500 gap-4 p-4">
            <h1 className="text-white text-[60px] font-black">Analizador</h1>

            <h2 className="text-[100px] text-white bg-black p-4 rounded-lg mx-4">
                {tiempoFormateado(segundos)}
            </h2>

            {frecuenciaDominante !== null &&
                (estadoGrabacion === 'grabando' ||
                    estadoGrabacion === 'pausado') && (
                    <p className="text-white text-xl font-semibold">
                        Frecuencia dominante:{' '}
                        {frecuenciaDominante.toFixed(1)} Hz
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
                accept=".wav,audio/wav,audio/x-wav"
                onChange={subirAudio}
                className="hidden"
            />

            {(estadoGrabacion === 'grabando' ||
                estadoGrabacion === 'pausado') && (
                <>
                    <ZoomAudio>
                        <canvas ref={liveCanvas} width={1200} height={300} />
                    </ZoomAudio>
                    <ZoomAudio>
                        <canvas
                            ref={canvasTiempoRef}
                            width={1200}
                            height={300}
                        />
                    </ZoomAudio>
                </>
            )}

            {audio && estadoGrabacion === 'detenido' && (
                <ZoomAudio>
                    <AudioVisual key={audio} audioURL={audio} />
                </ZoomAudio>
            )}
        </div>
    )
}

export { ZoomAudio }
export default Reproductor
