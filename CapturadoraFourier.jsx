import React, { useRef, useState, useEffect } from 'react'
import { FaCircleStop, FaMicrophone, FaUpload } from 'react-icons/fa6'
import { useAudioVisualizer } from '@tkhdev/react-audio-visualizer'


//Cambio naty: permite reproducir un audio (el análisis de espectro/tiempo lo maneja Reproductor con su propio AnalyserNode)
function AudioVisual({ audioURL, onAudioReady, onPlay: onPlayExterno, onPause: onPauseExterno }){
    const Audio = useRef(null)

    useEffect(() => {
        if (Audio.current && onAudioReady) {
            onAudioReady(Audio.current)
        }
    }, [audioURL])

    const manejarPlay = () => {
        if (onPlayExterno) onPlayExterno()
    }

    const manejarPause = () => {
        if (onPauseExterno) onPauseExterno()
    }

    return (
        <audio
            ref={Audio}
            controls
            src={audioURL}
            onPlay={manejarPlay}
            onPause={manejarPause}
            onEnded={manejarPause}
        />
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
            setEscala((prev) => Math.max(0.1, prev - event.deltaY * 0.001))
            console.log('Escala actual:', Escala)
        }

        el.addEventListener('wheel', handleWheel, { passive: false })
        return () => el.removeEventListener('wheel', handleWheel)
    }, [])

    return (
        <div
            ref={containerRef}
            style={{
                overflow: 'auto',
                width: '1200',
                height: '300',
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

// Cambios naty
function Reproductor(){
    const [estadoGrabacion, setEstadoGrabacion] = useState('detenido') // valores posibles: 'detenido' | 'grabando' | 'pausado'
    const [audio, setaudio] = useState('')
    const [segundos, setsegundos] = useState(0)

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
    const canvasEspectroSubidoRef = useRef(null)
    const audioSubidoRef = useRef(null)

    const { canvasRef: liveCanvas, start: startvisualizer, stop } = useAudioVisualizer({
        source: 'mic',
        mode: 'spectrum',
        barColor: '#f20707',
        backgroundColor: '#ffffff'
    })

    //Cambios naty
    const iniciarAnalisisPropio = (streamOAudioElement, esArchivo = false) => {
        audioCtxRef.current = new AudioContext()

        let source
        if (esArchivo) {
            source = audioCtxRef.current.createMediaElementSource(streamOAudioElement)
        } else {
            source = audioCtxRef.current.createMediaStreamSource(streamOAudioElement)
        }

        analyserRef.current = audioCtxRef.current.createAnalyser()
        analyserRef.current.fftSize = 2048
        source.connect(analyserRef.current)

        if (esArchivo) {
            source.connect(audioCtxRef.current.destination)
        }

        const bins = analyserRef.current.frequencyBinCount
        const freqArray = new Float32Array(bins)
        const timeArray = new Float32Array(analyserRef.current.fftSize)

        const capturarFrame = () => {
            let grabando = false
            if (grabaraudio.current && grabaraudio.current.state === 'recording') {
                grabando = true
            }

            if (grabando) {
                analyserRef.current.getFloatFrequencyData(freqArray)  // Captura de datos de frecuencia
                analyserRef.current.getFloatTimeDomainData(timeArray)  // Captura de datos de tiempo para la forma de onda
                datosFrecuencia.current.push(Array.from(freqArray))
                datosTiempo.current.push(Array.from(timeArray))
                dibujarOnda(timeArray)
            }
            animacionRef.current = requestAnimationFrame(capturarFrame)
        }
        capturarFrame()
    }

    // Función para dibujar la onda de tiempo en base a de los datos de tiempo capturados
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

    // Función para dibujar el espectro de frecuencia (barras) del audio subido, ya que no se usa la librería en este modo
    const dibujarEspectro = (freqArray) => {
        const canvas = canvasEspectroSubidoRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        const ancho = canvas.width
        const alto = canvas.height

        ctx.fillStyle = '#464646'
        ctx.fillRect(0, 0, ancho, alto)

        const anchoBarra = ancho / freqArray.length
        ctx.fillStyle = '#ac65f7'
        for (let i = 0; i < freqArray.length; i++) {
            const valor = (freqArray[i] + 140) / 140
            const alturaBarra = Math.max(0, valor) * alto
            ctx.fillRect(i * anchoBarra, alto - alturaBarra, anchoBarra, alturaBarra)
        }
    }

    // Se conecta una única vez, cuando el <audio> del archivo subido está listo (evita el error de "already connected" al reproducir varias veces)
    const audioSubidoListo = (elementoAudio) => {
        if (audioSubidoRef.current === elementoAudio && analyserRef.current) {
            return
        }
        audioSubidoRef.current = elementoAudio
        audioCtxRef.current = new AudioContext()
        const source = audioCtxRef.current.createMediaElementSource(elementoAudio)
        analyserRef.current = audioCtxRef.current.createAnalyser()
        analyserRef.current.fftSize = 2048
        source.connect(analyserRef.current)
        source.connect(audioCtxRef.current.destination)
    }

    // Se llama cada vez que se le da play al audio subido; solo inicia el loop de captura, no vuelve a conectar nada
    const audioSubidoAnalizar = () => {
        if (!analyserRef.current) return
        datosFrecuencia.current = []
        datosTiempo.current = []

        const bins = analyserRef.current.frequencyBinCount
        const freqArray = new Float32Array(bins)
        const timeArray = new Float32Array(analyserRef.current.fftSize)

        const capturarFrame = () => {
            if (!audioSubidoRef.current.paused) {
                analyserRef.current.getFloatFrequencyData(freqArray)
                analyserRef.current.getFloatTimeDomainData(timeArray)
                datosFrecuencia.current.push(Array.from(freqArray))
                datosTiempo.current.push(Array.from(timeArray))
                dibujarOnda(timeArray)
                dibujarEspectro(freqArray)
            }
            animacionRef.current = requestAnimationFrame(capturarFrame)
        }
        capturarFrame()
    }

    const audioSubidoDetener = () => {
        if (animacionRef.current) {
            cancelAnimationFrame(animacionRef.current)
        }
    }

    const hacergrabacion = async () => {
        try{
            setsegundos(0)
            setaudio('')
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            agregarAudio.current = stream
            grabaraudio.current = new MediaRecorder(stream)
            datosFrecuencia.current = []
            datosTiempo.current = []
            iniciarAnalisisPropio(stream)
            grabaraudio.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    trozos.current.push(e.data)
                }}

            const timer = setInterval(() => {
                setsegundos(s => grabaraudio.current?.state === 'recording' ? s + 1 : s)
            }, 1000) //AQUÍ

            grabaraudio.current.onstop = () => {
                const grabado = new Blob(trozos.current, { type: 'audio/mp3' })
                setaudio(URL.createObjectURL(grabado))
                trozos.current = []
                clearInterval(timer)
            }
            
            grabaraudio.current.start()
            startvisualizer()
            setEstadoGrabacion('grabando')
        } catch (error) {
            console.log(error)
        }

    }

    const parargrabacion = () => {
        setEstadoGrabacion('detenido')
        if (grabaraudio.current) {
            grabaraudio.current.stop()
            agregarAudio.current.getTracks().forEach(track => track.stop())
        }
        if (animacionRef.current) {
            cancelAnimationFrame(animacionRef.current)
        }
        if (audioCtxRef.current) {
            audioCtxRef.current.close()
        }
        stop()
    }

    const pausargrabacion = () => {
        if (grabaraudio.current && grabaraudio.current.state === 'recording') {
            grabaraudio.current.pause()
            setEstadoGrabacion('pausado')
        }
    }

    const reanudargrabacion = () => {
        if (grabaraudio.current && grabaraudio.current.state === 'paused') {
            grabaraudio.current.resume()
            setEstadoGrabacion('grabando')
        }
    }

    const subirAudio = (e) => {
        const archivo = e.target.files[0]
        if (!archivo) return


        if (!archivo.type.startsWith('audio/')) {
            alert('Por favor, selecciona un archivo de audio válido.')
            return
        }

        if (estadoGrabacion === 'grabando' || estadoGrabacion === 'pausado') {
            parargrabacion()
        }
        
        const url = URL.createObjectURL(archivo)
        setaudio(url)
        setsegundos(0)
        e.target.value = ''
    }

    const tiempoFormateado = () => {
        const minutos = Math.floor(segundos / 60)
        const segundosRestantes = segundos % 60
        return `${minutos.toString().padStart(2, '0')}:${segundosRestantes.toString().padStart(2, '0')}`
    }

    return (<div className='w-full h-screen flex flex-col items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-500 gap-4'>
          <h1 className='text-white text-[60px] font-black'>Reproductor</h1>
    
          <h2 className='text-[100px] text-white bg-black p-4 rounded-lg mx-4'>
            {tiempoFormateado(segundos)}
          </h2>
    
          <div className='flex items-center gap-4'>
            {estadoGrabacion === 'detenido' && (
                <button onClick={hacergrabacion} className='flex items-center justify-center text-[60px] bg-blue-500 rounded-full p-4 text-white w-[100px] h-[100px]'>
                    <FaMicrophone />
                </button>
                )}
            {estadoGrabacion === 'grabando' && (
                <>
                    <button onClick={pausargrabacion} className='flex items-center justify-center text-[24px] bg-yellow-500 rounded-full p-4 text-white w-[100px] h-[100px]'>
                        Pausar
                    </button>
                    <button onClick={parargrabacion} className='flex items-center justify-center text-[60px] bg-red-500 rounded-full p-4 text-white w-[100px] h-[100px]'>
                        <FaCircleStop />
                    </button>
                </>
            )}
            {estadoGrabacion === 'pausado' && (
                <>
                    <button onClick={reanudargrabacion} className='flex items-center justify-center text-[20px] bg-green-500 rounded-full p-4 text-white w-[100px] h-[100px]'>
                        Continuar
                    </button>
                    <button onClick={parargrabacion} className='flex items-center justify-center text-[60px] bg-red-500 rounded-full p-4 text-white w-[100px] h-[100px]'>
                        <FaCircleStop />
                    </button>
                </>
            )}
            <button
              onClick={() => inputFile.current?.click()}
              className='flex items-center justify-center text-[32px] bg-white text-blue-600 rounded-full p-4 w-[100px] h-[100px]'
            >
              <FaUpload />
            </button>
          </div>
    
          <input
            ref={inputFile}
            type='file'
            accept='audio/*'
            onChange={subirAudio}
            className='hidden'
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
            <>
            <ZoomAudio>
            <AudioVisual
                key={audio}
                audioURL={audio}
                onAudioReady={audioSubidoListo}
                onPlay={audioSubidoAnalizar}
                onPause={audioSubidoDetener}
            />
            </ZoomAudio>
            <ZoomAudio>
            <canvas ref={canvasEspectroSubidoRef} width={1200} height={300} />
            </ZoomAudio>
            <ZoomAudio>
            <canvas ref={canvasTiempoRef} width={1200} height={300} />
            </ZoomAudio>
            </>
            )}
        </div>
      )
}
export { ZoomAudio }
export default Reproductor