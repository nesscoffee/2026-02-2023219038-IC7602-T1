import JSZip from 'jszip'

const tipos_audio = ['.mp3', '.wav']

function esAudio(nombre) {
    const minuscula = nombre.toLowerCase()
    return tipos_audio.some(tipo => minuscula.endsWith(tipo))
}

export async function leerAtm(archivo) {
    const zip = new JSZip()
    const contenido = await zip.loadAsync(archivo)

    let entradaAudio = null
    for (const [nombre, entrada] of Object.entries(contenido.files)) {
        if (!entrada.dir && esAudio(nombre)) {
            entradaAudio = { nombre, entrada }
            break
        }
    }

    if (!entradaAudio) {
        throw new Error('El .atm no trae audio adentro')
    }

    const blob = await entradaAudio.entrada.async('blob')
    const mime = entradaAudio.nombre.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav'
    const audioBlob = new Blob([blob], { type: mime })

    // por ahora el .atm solo me trae el audio, esperar
    // como el analizador deberia guardar los armonicos hay que leerlos 
    return { url: URL.createObjectURL(audioBlob) }
}