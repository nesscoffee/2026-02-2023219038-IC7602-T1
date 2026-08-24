# Recomendación de librerías

## Objetivo

Para la implementación del proyecto se recomienda utilizar un conjunto reducido de librerías de terceros que apoyen el procesamiento de audio, la visualización de señales y la generación de archivos requeridos por el proyecto. La lógica principal de captura de audio y procesamiento en el navegador se mantendrá separada de estas dependencias.

## Librerías recomendadas

### fft.js

**Uso:** cálculo de la Transformada Rápida de Fourier (FFT).

Esta librería permitirá transformar las muestras de audio del dominio del tiempo al dominio de la frecuencia. Será utilizada principalmente por el módulo **Analizador** para obtener las magnitudes correspondientes a cada frecuencia y generar el espectro de audio.

**Instalación:**

```bash
npm install fft.js
```

---

### wavefile

**Uso:** lectura y generación de archivos WAV.

Permitirá trabajar con los archivos WAV requeridos por el proyecto. Se utilizará para convertir grabaciones en datos PCM, analizar archivos cargados por el usuario y generar archivos WAV a partir de las muestras obtenidas desde el micrófono.

**Instalación:**

```bash
npm install wavefile
```

---

### uPlot

**Uso:** visualización de señales y espectros.

Se recomienda para mostrar los gráficos del **dominio del tiempo** y del **dominio de la frecuencia**. Es una alternativa liviana y eficiente para actualizar grandes cantidades de datos de forma continua durante el análisis de audio.

**Instalación:**

```bash
npm install uplot
```

---

### WaveSurfer.js

**Uso:** reproducción y navegación sobre formas de onda.

Se utilizará principalmente en el módulo **Reproductor** para reproducir el audio, realizar pausas, reanudar la reproducción, desplazarse dentro de la señal y aplicar zoom sobre la forma de onda.

**Instalación:**

```bash
npm install wavesurfer.js
```

---

### JSZip

**Uso:** generación y lectura del formato `.atm`.

Se recomienda utilizar esta librería para implementar el archivo `.atm` como un contenedor que incluya, por ejemplo:

```text
archivo.atm
├── manifest.json
├── audio.wav
└── frequency.bin
```

Esto permitirá almacenar en un mismo archivo el audio original, los metadatos del análisis y la información necesaria para reconstruir los gráficos de frecuencia.

**Instalación:**

```bash
npm install jszip
```

---

### Meyda

**Uso:** extracción de características adicionales de audio.

Es una librería opcional que puede utilizarse para obtener valores como RMS, energía y otras características espectrales. Puede resultar útil principalmente para el módulo **Comparador**, aunque se recomienda mantener la FFT y los cálculos principales implementados de forma explícita para facilitar su comprensión.

**Instalación:**

```bash
npm install meyda
```

## Recomendación final

Para la primera implementación se recomienda utilizar como dependencias principales:

```bash
npm install fft.js wavefile uplot wavesurfer.js jszip
```

`Meyda` puede agregarse posteriormente si se determina que sus características simplifican la comparación por potencia o el análisis de armónicos.

Estas librerías permiten cubrir los principales requerimientos del proyecto sin agregar dependencias innecesarias: análisis FFT, manejo de WAV, visualización de señales, reproducción de audio y generación del formato `.atm`.
