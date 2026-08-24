export function obtenerInstantanea(analyser) {
    const frecuencias = new Uint8Array(analyser.frequencyBinCount)
    const tiempo = new Uint8Array(analyser.fftSize)
    analyser.getByteFrequencyData(frecuencias)
    analyser.getByteTimeDomainData(tiempo)
    return { frecuencias, tiempo }
}

function distanciaPromedio(a, b) {
    const largo = Math.min(a.length, b.length)
    let suma = 0
    for (let i = 0; i < largo; i++) {
        suma += Math.abs(a[i] - b[i])
    }
    return suma / largo
}

// para probar el flujo completo falta armonico, potencia y definir más de el orden
export function compararPorArmonicos(referencia, muestra) {
    const distancia = distanciaPromedio(referencia.frecuencias, muestra.frecuencias)
    const confianza = Math.max(0, 100 - (distancia / 255) * 100)
    return Math.round(confianza)
}

export function compararPorPotencia(referencia, muestra) {
    const distancia = distanciaPromedio(referencia.tiempo, muestra.tiempo)
    const confianza = Math.max(0, 100 - (distancia / 255) * 100)
    return Math.round(confianza)
}