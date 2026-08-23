import React, { useRef, useState, useEffect } from 'react'
import { FaCircleStop, FaMicrophone, FaUpload } from 'react-icons/fa6'
import { useAudioVisualizer } from '@tkhdev/react-audio-visualizer'



function AudioVisual({ audioURL}){
    const Audio = useRef(null)
    const [, forceRender] = useState(0)

    useEffect(() => {
        forceRender(n => n + 1)
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

        </>)
        
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

    const { canvasRef: liveCanvas, start: startvisualizer, stop } = useAudioVisualizer({
        source: 'mic',
        mode: 'spectrum',
        barColor: '#f20707',
        backgroundColor: '#ffffff'
    })

    //Cambios naty

    const iniciarAnalisisPropio = (stream) => {
        audioCtxRef.current = new AudioContext()
        const source = audioCtxRef.current.createMediaStreamSource(stream)
        analyserRef.current = audioCtxRef.current.createAnalyser()
        analyserRef.current.fftSize = 2048
        source.connect(analyserRef.current)

        const bins = analyserRef.current.frequencyBinCount
        const freqArray = new Float32Array(bins)
        const timeArray = new Float32Array(analyserRef.current.fftSize)

        const capturarFrame = () => {
            if (grabaraudio.current?.state === 'recording') {
                analyserRef.current.getFloatFrequencyData(freqArray)
                analyserRef.current.getFloatTimeDomainData(timeArray)
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
        /*console.log('Ventanas de frecuencia capturadas:', datosFrecuencia.current.length) //Test: Muestra la cantidad de ventanas de frecuencia capturadas
        console.log('Ejemplo primera ventana:', datosFrecuencia.current[0]) //Test: Muestra la primera ventana de frecuencia capturada*/
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
            <ZoomAudio>
            <AudioVisual key={audio} audioURL={audio} />
            </ZoomAudio>
            )}
        </div>
      )
}
export { ZoomAudio }
export default Reproductor