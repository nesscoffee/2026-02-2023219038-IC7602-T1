import React, { useRef, useState } from 'react'
import { leerAtm } from '../utils/leerAtm'
import { obtenerInstantanea, compararPorArmonicos, compararPorPotencia } from '../utils/compararAudio'

function Comparador() {
    const [referenciaUrl, setReferenciaUrl] = useState('')
    const [grabando, setGrabando] = useState(false)
    const [resultado, setResultado] = useState(null)

    const audioRefRef = useRef(null)
    const audioMuestraRef = useRef(null)
    const streamRef = useRef(null)
    const grabadorRef = useRef(null)
    const trozos = useRef([])

    const cargarReferencia = async (e) => {
        const archivo = e.target.files[0]
        if (!archivo) return
        try {
            const { url } = await leerAtm(archivo)
            setReferenciaUrl(url)
            setResultado(null)
        } catch (error) {
            console.log(error)
            alert('No se pudo leer ese .atm')
        }
        e.target.value = ''
    }

    const grabarFrase = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream
            grabadorRef.current = new MediaRecorder(stream)
            trozos.current = []

            grabadorRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) trozos.current.push(e.data)
            }

            grabadorRef.current.onstop = () => {
                const grabado = new Blob(trozos.current, { type: 'audio/webm' })
                if (audioMuestraRef.current) {
                    audioMuestraRef.current.src = URL.createObjectURL(grabado)
                }
            }

            grabadorRef.current.start()
            setGrabando(true)
        } catch (error) {
            console.log(error)
        }
    }

    const pararGrabacion = () => {
        setGrabando(false)
        if (grabadorRef.current) grabadorRef.current.stop()
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }

    const instantaneaDe = (audioElement) => new Promise((resolve) => {
        const ctx = new AudioContext()
        const fuente = ctx.createMediaElementSource(audioElement)
        const analyser = ctx.createAnalyser()
        fuente.connect(analyser)
        analyser.connect(ctx.destination)

        audioElement.currentTime = 0
        audioElement.play()

        setTimeout(() => {
            const datos = obtenerInstantanea(analyser)
            audioElement.pause()
            ctx.close()
            resolve(datos)
        }, 300)
    })

    const compararAhora = async () => {
        if (!referenciaUrl || !audioMuestraRef.current?.src) {
            alert('Falta cargar la referencia o grabar la frase')
            return
        }

        const referencia = await instantaneaDe(audioRefRef.current)
        const muestra = await instantaneaDe(audioMuestraRef.current)

        setResultado({
            porArmonicos: compararPorArmonicos(referencia, muestra),
            porPotencia: compararPorPotencia(referencia, muestra)
        })
    }

    return (
        <div className='w-full h-screen flex flex-col items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 gap-4 text-white'>
            <h1 className='text-[40px] font-black'>Comparador (prueba)</h1>

            <input type='file' accept='.atm' onChange={cargarReferencia} />
            <audio ref={audioRefRef} src={referenciaUrl} controls />

            <div className='flex gap-4'>
                {grabando ? (
                    <button onClick={pararGrabacion} className='bg-red-500 rounded-full px-6 py-2'>Detener</button>
                ) : (
                    <button onClick={grabarFrase} className='bg-blue-500 rounded-full px-6 py-2'>Grabar frase</button>
                )}
                <button onClick={compararAhora} className='bg-green-500 rounded-full px-6 py-2'>Comparar</button>
            </div>

            <audio ref={audioMuestraRef} controls />

            {resultado && (
                <div className='bg-black/40 p-4 rounded-lg'>
                    <p>Confianza por armonicos: {resultado.porArmonicos}%</p>
                    <p>Confianza por potencia: {resultado.porPotencia}%</p>
                </div>
            )}
        </div>
    )
}

export default Comparador
