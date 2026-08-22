import React, { useRef, useState, useEffect } from 'react'
import { FaCircleStop, FaMicrophone, FaUpload } from 'react-icons/fa6'
import { useAudioVisualizer } from '@tkhdev/react-audio-visualizer'
import JSZip from 'jszip';

const tipos_audio = ['.mp3', '.wav']

function siesAudio(nombre) {
    const minuscula = nombre.toLowerCase()
    return tipos_audio.some(tipo => minuscula.endsWith(tipo))

}

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
function Reproductor(){
    const [Grabando, setGrabando] = useState(false)
    const [audio, setaudio] = useState('')
    const [segundos, setsegundos] = useState(0)

    const agregarAudio = useRef(null)
    const grabaraudio = useRef(null)
    const trozos = useRef([])
    const inputFile = useRef(null)

    const { canvasRef: liveCanvas, start: startvisualizer, stop } = useAudioVisualizer({
        source: 'mic',
        mode: 'spectrum',
        barColor: '#f20707',
        backgroundColor: '#ffffff'
    })


    const hacergrabacion = async () => {
        try{
            setsegundos(0)
            setaudio('')
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            agregarAudio.current = stream
            grabaraudio.current = new MediaRecorder(stream)
            grabaraudio.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    trozos.current.push(e.data)
                }}

            
            const timer = setInterval(() => {
                setsegundos(s => s + 1)
            }, 1000)


            grabaraudio.current.onstop = () => {
                const grabado = new Blob(trozos.current, { type: 'audio/mp3' })
                setaudio(URL.createObjectURL(grabado))
                trozos.current = []
                clearInterval(timer)
            }
            
            grabaraudio.current.start()
            startvisualizer()
            setGrabando(true)
        } catch (error) {
            console.log(error)
        }

    }

    const parargrabacion = () => {
        setGrabando(false)
        if (grabaraudio.current) {
            grabaraudio.current.stop()
            agregarAudio.current.getTracks().forEach(track => track.stop())
        }
        stop()
    }

const subirAudio = async (e) => {
    const archivo = e.target.files[0]
    if (!archivo) return

    const siesATM = archivo.name.toLowerCase().endsWith('.atm')

    if (!siesATM && !archivo.type.startsWith('audio/')) {
        alert('Este bicho usa .atm(podes poner un .zip y cambiarle la extension a .atm) o un audio para probar, mp3 o wav, pero nada mas')
        return
    }

    if (Grabando) {
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
                e.target.value = ''
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

    e.target.value = ''
}

    const tiempoFormateado = () => {
        const minutos = Math.floor(segundos / 60)
        const segundosRestantes = segundos % 60
        return `${minutos.toString().padStart(2, '0')}:${segundosRestantes.toString().padStart(2, '0')}`
    }
    // Hay que mejorar el frontend, pero la verdad yo NO le se al frontend 

    return (<div className='w-full h-screen flex flex-col items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-500 gap-4'>
          
    
          <h2 className='text-[100px] text-white bg-black p-4 rounded-lg mx-4'>
            {tiempoFormateado(segundos)}
          </h2>
    
          <div className='flex items-center gap-4'>
            {Grabando ? (
              <button onClick={parargrabacion} className='flex items-center justify-center text-[60px] bg-red-500 rounded-full p-4 text-white w-[100px] h-[100px]'>
                <FaCircleStop />
              </button>
            ) : (
              <button onClick={hacergrabacion} className='flex items-center justify-center text-[60px] bg-blue-500 rounded-full p-4 text-white w-[100px] h-[100px]'>
                <FaMicrophone />
              </button>
            )}

          </div>
    
          <input
            ref={inputFile}
            type='file'
            accept='audio/*,.atm'
            onChange={subirAudio}
            className='hidden'
          />
    
          {Grabando && (
            <ZoomAudio>
            <canvas ref={liveCanvas} width={1200} height={300} />
            </ZoomAudio>
          )}
    
          {audio && !Grabando && (
            <ZoomAudio>
            <AudioVisual key={audio} audioURL={audio} />
            </ZoomAudio>
          )}
        </div>
      )
}
export { ZoomAudio }
export default Reproductor