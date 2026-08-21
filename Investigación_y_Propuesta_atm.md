# Conceptos necesarios

## Archivo contenedor

Un archivo contenedor permite agrupar diferentes recursos bajo una misma
unidad.

En este proyecto, el audio, los metadatos y los resultados del análisis
frecuencial son recursos diferentes, pero deben transportarse como un
único archivo para que el Reproductor pueda recibirlos.

En lugar de entregar:

    audio.wav
    metadata.json
    frequency-data.json

se propone entregar:

    Autrum.atm

internamente compuesto por esos tres recursos.

## Audio WAV

WAV está asociado al formato RIFF. Una estructura WAVE contiene
información que permite interpretar el audio, incluyendo características
como el número de canales, frecuencia de muestreo y cantidad de bits por
muestra [@microsoftRiff].

Entre los parámetros relevantes del audio se encuentran:

- Frecuencia de muestreo (*sample rate*)

- Cantidad de canales

- Bits por muestra

- Cantidad de muestras

- Duración

Estos valores van a permitir determinar cómo debe interpretar la señal
de audio y su correspondiente análisis frecuencial.

## Dominio del tiempo

Una señal de audio puede representarse como amplitud en función del
tiempo:

$$x(t)$$

Esta representación permite observar cómo cambia la amplitud de la señal
a lo largo del tiempo.

En Autrum, la representación temporal forma parte de las visualizaciones
requeridas para el análisis del audio [@tareaAutrum].

Una señal digital puede representarse como una secuencia de muestras:

$$x[0],x[1],x[2],\ldots,x[N-1]$$

Cada muestra representa la amplitud de la señal en un instante
determinado.

## Dominio de la frecuencia

La representación en el dominio de la frecuencia permite analizar qué
componentes frecuenciales forman una señal.

Mientras que el dominio temporal responde principalmente a:

::: center
*¿Cómo cambia la señal con el tiempo?*
:::

el dominio frecuencial permite responder:

::: center
*¿Qué frecuencias están presentes en la señal?*
:::

La transformación entre ambas representaciones es fundamental para la
visualización del espectro de un audio.

## Transformada de Fourier

La Transformada de Fourier permite expresar una señal como una
combinación de componentes sinusoidales de diferentes frecuencias.

De forma conceptual:

$$\text{Señal temporal}
\xrightarrow{\text{Transformada de Fourier}}
\text{Representación frecuencial}$$

Para una señal digital se utiliza la Transformada Discreta de Fourier
(DFT).

La DFT permite obtener información sobre las frecuencias presentes en
una cantidad finita de muestras.

## Fast Fourier Transform (FFT)

La FFT (*Fast Fourier Transform*) es un conjunto de algoritmos
eficientes utilizados para calcular la Transformada Discreta de Fourier.

En lugar de calcular directamente todos los términos de la DFT, la FFT
aprovecha propiedades matemáticas para reducir el costo computacional.

Esto resulta especialmente importante para aplicaciones de audio, donde
el análisis debe realizarse sobre grandes cantidades de muestras y puede
repetirse continuamente.

La Web Audio API dispone de `AnalyserNode`, que proporciona información
en el dominio temporal y frecuencial y utiliza FFT para realizar el
análisis [@mdnAnalyser].

## `fftSize`

El parámetro `fftSize` determina la cantidad de muestras utilizada por
la FFT para realizar el análisis.

En `AnalyserNode`, este valor debe ser una potencia de dos y puede tomar
valores desde 32 hasta 32768 [@mdnFftSize].

Por ejemplo:

$$fftSize = 2048$$

significa que la FFT trabaja con una ventana de 2048 muestras.

El tamaño seleccionado representa un compromiso entre resolución
temporal y resolución frecuencial.

Un tamaño mayor permite distinguir con mayor detalle diferentes
frecuencias, pero utiliza una ventana temporal mayor.

## *Frequency bins*

Los resultados de una FFT se dividen en diferentes intervalos o
*frequency bins*.

En `AnalyserNode`, la propiedad:

    frequencyBinCount

corresponde a la mitad de `fftSize` [@mdnAnalyser].

Por ejemplo:

$$fftSize = 2048$$

produce:

$$frequencyBinCount =
\frac{2048}{2}
=
1024$$

Estos valores representan diferentes componentes de frecuencia que
pueden ser utilizados para construir el espectro.

## Resolución frecuencial

La resolución frecuencial depende del tamaño de la FFT y de la
frecuencia de muestreo.

Una aproximación común es:

$$\Delta f =
\frac{f_s}{N}$$

donde:

- $\Delta f$ es la separación entre bins;

- $f_s$ es la frecuencia de muestreo;

- $N$ es el tamaño de la FFT.

Por ejemplo, considerando:

$$f_s = 44100 \text{ Hz}$$

y:

$$N=2048$$

se obtiene:

$$\Delta f =
\frac{44100}{2048}
\approx
21.53\text{ Hz}$$

Esto significa que los bins del espectro estarán separados
aproximadamente 21.53 Hz.

El valor final dependerá de las características reales del audio y de la
configuración de FFT seleccionada por el grupo.

## Datos de frecuencia

Los datos de frecuencia son los valores producidos por el análisis
frecuencial y utilizados para construir el gráfico.

La Web Audio API ofrece, por ejemplo, `getFloatFrequencyData()`, que
copia los datos de frecuencia a un `Float32Array`. Los valores
representan información frecuencial en decibeles [@mdnFloatFrequency].

También existe:

    getByteFrequencyData()

que utiliza un `Uint8Array` para representar los datos escalados
[@mdnAnalyser].

Por esta razón, el diseño del archivo debe especificar qué tipo de
representación está almacenando.

## Magnitud y decibeles

Una FFT puede producir valores complejos. Para visualizar el espectro
suele ser necesario obtener una magnitud:

$$|X[k]| =
\sqrt{
\operatorname{Re}(X[k])^2+
\operatorname{Im}(X[k])^2
}$$

Esta magnitud puede transformarse a una escala logarítmica expresada en
decibeles.

Una representación común es:

$$dB = 20\log_{10}(|X[k]|)$$

La representación exacta dependerá de la biblioteca de Fourier utilizada
por el proyecto.

Por este motivo, los metadatos del archivo deben indicar cómo se
interpretan los datos almacenados.

## Frames de frecuencia

El espectro de un audio no permanece necesariamente constante durante
toda la reproducción.

Por ejemplo, una grabación de voz puede tener:

    Tiempo 0.000 s -> espectro A
    Tiempo 0.023 s -> espectro B
    Tiempo 0.046 s -> espectro C
    ...

Por esta razón, se propone almacenar múltiples conjuntos de datos
frecuenciales, llamados *frames*.

Cada frame puede estar asociado con una posición temporal:

$$(frame_i,t_i,D_i)$$

donde:

- $frame_i$ es el número de frame;

- $t_i$ es el instante temporal;

- $D_i$ son los datos de frecuencia correspondientes.

Esta estructura permite que el Reproductor sincronice el gráfico
frecuencial con la reproducción del audio.

## Metadatos

Los metadatos son información que describe otros datos.

En el formato de Autrum pueden utilizarse para almacenar información
necesaria para interpretar correctamente el contenido del archivo.

Entre los metadatos propuestos se encuentran:

- nombre del archivo;

- tipo MIME;

- frecuencia de muestreo;

- cantidad de canales;

- duración;

- método de análisis;

- tamaño de FFT;

- cantidad de bins;

- archivo donde se encuentran los datos frecuenciales;

- versión del formato.

## JSON

JSON (*JavaScript Object Notation*) es un formato textual para
representar información estructurada.

Su utilización resulta conveniente para Autrum debido a que el proyecto
está desarrollado utilizando JavaScript.

Por ejemplo, los metadatos podrían representarse de la siguiente forma:

``` {style="jsonstyle"}
{
    "format": "Autrum",
    "version": 1,

    "audio": {
        "file": "audio.wav",
        "mimeType": "audio/wav",
        "sampleRate": 44100,
        "channels": 1,
        "duration": 3.52
    },

    "analysis": {
        "method": "FFT",
        "fftSize": 2048,
        "dataFile": "frequency-data.json"
    }
}
```

Una ventaja de JSON es que puede ser leído fácilmente tanto por personas
como por programas.

Además, JavaScript proporciona mecanismos nativos para convertir objetos
a JSON y viceversa mediante:

    JSON.stringify()
    JSON.parse()

# Análisis de la implementación actual

La implementación actual de Autrum utiliza React y Vite y contiene
funcionalidades relacionadas con la captura y análisis de audio.

El proyecto utiliza `MediaRecorder` para realizar la captura del audio y
genera fragmentos que posteriormente pueden combinarse para obtener un
recurso de audio.

También se dispone de mecanismos para cargar archivos de audio y
realizar visualizaciones relacionadas con la señal.

La implementación de Fourier todavía debe coordinarse con la propuesta
del formato `.atm`, ya que el tipo exacto de datos que se almacenarán
depende de la biblioteca seleccionada y de la representación utilizada.

La investigación realizada por el grupo contempla diferentes
alternativas para implementar Fourier, entre ellas `fft-js` y FFT.js
[@findingsFourier].

Por lo tanto, la estructura general del contenedor puede definirse antes
de terminar esta selección, mientras que los detalles internos de
`frequency-data.json` deberán ajustarse a la salida final de la FFT.

## Consideración sobre el audio generado

Un aspecto que debe verificarse en la implementación es el formato real
generado por `MediaRecorder`.

El hecho de utilizar:

    Blob

con un determinado MIME type no implica necesariamente una conversión
del contenido a otro formato de audio.

Por lo tanto, antes de definir definitivamente:

    audio.wav

se debe comprobar que el contenido almacenado sea realmente WAV.

Si el audio capturado se encuentra en otro formato, el archivo interno
debe utilizar la extensión correspondiente o realizar una conversión
explícita a WAV.

Esta comprobación es importante para evitar que el formato declarado no
coincida con el contenido real.

# Requisitos del archivo .atm

A partir de los requisitos establecidos para Autrum, el archivo debe
permitir conservar tanto el audio como la información necesaria para
reconstruir el análisis frecuencial [@tareaAutrum].

Los principales requisitos identificados son:

  **Requisito**         **Implicación en el diseño**
  --------------------- -------------------------------------------------------------------------------
  Audio original        Debe existir un recurso de audio que pueda recuperarse y reproducirse.
  Datos de frecuencia   Deben almacenarse los datos utilizados para generar el gráfico frecuencial.
  Metadatos             Debe existir información que permita interpretar correctamente los datos.
  Sincronización        Los datos frecuenciales deben poder relacionarse con una posición temporal.
  Versionado            Debe existir una versión que permita diferenciar cambios futuros del formato.
  Validación            El Reproductor debe poder detectar archivos incompletos o incompatibles.

  : Requisitos del archivo `.atm`

# Propuesta de estructura interna

Se propone utilizar la siguiente estructura:

    Autrum.atm
    |
    +-- audio.wav
    |
    +-- metadata.json
    |
    +-- frequency-data.json

Cada archivo cumple una función específica dentro del contenedor.

## `audio.wav`

Contendrá el audio asociado con el análisis.

El objetivo es que el Reproductor pueda extraerlo y reproducirlo sin
necesitar obtener el audio desde otra fuente.

La tarea establece que el archivo `.atm` debe conservar el audio
original [@tareaAutrum].

## `metadata.json`

El archivo de metadatos permitirá describir el contenido del contenedor.

Una propuesta inicial es:

``` {style="jsonstyle"}
{
    "format": "Autrum",
    "version": 1,

    "audio": {
        "file": "audio.wav",
        "mimeType": "audio/wav",
        "sampleRate": 44100,
        "channels": 1,
        "duration": 3.52
    },

    "analysis": {
        "method": "FFT",
        "fftSize": 2048,
        "frequencyBinCount": 1024,
        "dataFile": "frequency-data.json"
    }
}
```

Los valores numéricos utilizados son únicamente ejemplos.

Los valores definitivos deben generarse a partir del audio y de la
configuración real utilizada por la aplicación.

## `frequency-data.json`

Este archivo almacenará los resultados del análisis frecuencial.

Una estructura inicial podría ser:

``` {style="jsonstyle"}
{
    "frames": [
        {
            "time": 0.000,
            "data": []
        },

        {
            "time": 0.023,
            "data": []
        },

        {
            "time": 0.046,
            "data": []
        }
    ]
}
```

El arreglo `data` debe contener los valores producidos por la
implementación de Fourier.

La cantidad de elementos dependerá de:

$$frequencyBinCount =
\frac{fftSize}{2}$$

cuando se utilice la estructura de `AnalyserNode`.

# Justificación de la propuesta

La estructura propuesta presenta varias ventajas.

## Separación de responsabilidades

Cada archivo tiene una función claramente definida:

- `audio.wav`: contiene el audio;

- `metadata.json`: describe el contenido;

- `frequency-data.json`: contiene el resultado del análisis.

Esto evita mezclar los datos de audio con los datos generados por la
FFT.

## Facilidad de depuración

Durante el desarrollo, los archivos JSON pueden abrirse directamente
para verificar si los datos generados son correctos.

Esto resulta útil para comprobar:

- número de frames;

- tiempos;

- cantidad de bins;

- valores frecuenciales;

- parámetros de FFT.

## Compatibilidad con JavaScript

JSON puede ser generado y procesado directamente desde JavaScript.

Esto reduce la complejidad necesaria para implementar el formato y
permite que los integrantes del equipo trabajen con estructuras de datos
fácilmente comprensibles.

## Sincronización

La utilización de una posición temporal para cada frame permite
establecer una correspondencia:

$$\text{posición del audio}
\longleftrightarrow
\text{frame de frecuencia}$$

Esto facilita la implementación de la reproducción sincronizada
requerida para el Reproductor.

## Extensibilidad

El campo:

    "version": 1

permite modificar posteriormente la estructura.

Por ejemplo, una versión futura podría agregar nuevos tipos de análisis
sin necesidad de considerar todos los archivos como equivalentes.

# Compresión

La compresión se realizará a nivel del contenedor ZIP.

JSZip permite generar archivos ZIP mediante `generateAsync()` y permite
seleccionar métodos de compresión como `STORE` y `DEFLATE`
[@jszipGenerate].

Para una primera implementación se propone:

  **Archivo**             **Estrategia**
  ----------------------- -----------------------------------------
  `audio.wav`             Evaluar según el formato real del audio
  `metadata.json`         DEFLATE
  `frequency-data.json`   DEFLATE

  : Estrategia inicial de compresión

Los archivos JSON suelen beneficiarse de la compresión porque contienen
texto repetitivo y estructurado.

En cambio, el beneficio de volver a comprimir un archivo de audio
depende de si el formato de audio ya utiliza algún mecanismo de
compresión.

Por esta razón, la estrategia definitiva debe validarse con archivos
generados por el proyecto.

# Creación del archivo .atm

El proceso de creación puede dividirse en varias etapas:

1.  Capturar o cargar el audio.

2.  Obtener las muestras necesarias para el análisis.

3.  Ejecutar la FFT.

4.  Generar los datos de frecuencia.

5.  Generar los metadatos.

6.  Empaquetar audio y archivos JSON.

7.  Generar el archivo ZIP.

8.  Cambiar la extensión del archivo a `.atm`.

El flujo puede representarse como:

::: center
:::

Durante la primera etapa de desarrollo, este proceso incluso puede
realizarse manualmente:

1.  generar los archivos;

2.  colocarlos en una carpeta;

3.  comprimir la carpeta como ZIP;

4.  cambiar `.zip` por `.atm`.

Una vez comprobada la estructura, el procedimiento puede automatizarse
utilizando JavaScript y JSZip.

## Automatización con JSZip

JSZip permite agregar archivos a un contenedor ZIP y generar el archivo
resultante mediante `generateAsync()` [@jszipGenerate].

Un ejemplo conceptual sería:

``` {style="jsstyle"}
const zip = new JSZip();

zip.file("audio.wav", audio);

zip.file(
    "metadata.json",
    JSON.stringify(metadata)
);

zip.file(
    "frequency-data.json",
    JSON.stringify(frequencyData)
);

const result = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE"
});
```

El código debe adaptarse posteriormente a la estructura real de datos
generada por la aplicación.

# Lectura del archivo .atm

El Reproductor debe realizar el proceso inverso al de creación.

El flujo sería:

::: center
:::

JSZip dispone de `loadAsync()`, que permite cargar un archivo ZIP
existente y acceder a sus entradas [@jszipLoad].

Conceptualmente:

``` {style="jsstyle"}
const zip = await JSZip.loadAsync(file);

const metadataText =
    await zip
        .file("metadata.json")
        .async("text");

const frequencyText =
    await zip
        .file("frequency-data.json")
        .async("text");

const audioBlob =
    await zip
        .file("audio.wav")
        .async("blob");
```

Después de extraer los archivos, el Reproductor puede utilizar el audio
y los datos de frecuencia para reconstruir las visualizaciones.

# Validación

El Reproductor debe validar el archivo antes de comenzar la
reproducción.

Se propone verificar como mínimo:

  **Elemento**   **Regla**
  -------------- ----------------------------------------------------------------------
  Extensión      El archivo debe identificarse como `.atm`.
  Contenedor     Debe poder abrirse correctamente como ZIP.
  Metadatos      Debe existir `metadata.json`.
  Versión        La versión debe ser compatible con el Reproductor.
  Audio          Debe existir el archivo de audio especificado.
  Frecuencia     Debe existir el archivo especificado para los datos de frecuencia.
  Consistencia   Los parámetros declarados deben coincidir con los datos almacenados.

  : Reglas de validación

Esto permite detectar archivos corruptos, incompletos o incompatibles
antes de iniciar la reproducción.

# Decisiones pendientes

Aunque la estructura general puede definirse, existen algunas decisiones
que deben coordinarse con la investigación de Fourier.

1.  Biblioteca de FFT que utilizará el proyecto.

2.  Valor definitivo de `fftSize`.

3.  Frecuencia de muestreo utilizada.

4.  Tipo de datos producido por la FFT.

5.  Si se almacenará magnitud, potencia, decibeles u otra
    representación.

6.  Cantidad de frames que se almacenarán.

7.  Intervalo temporal entre frames.

8.  Formato real del audio generado por `MediaRecorder`.

9.  Necesidad de convertir el audio capturado a WAV.

Estas decisiones deben quedar documentadas para garantizar que el
Reproductor pueda interpretar correctamente los datos almacenados.

# Propuesta final

La primera versión propuesta para el formato Autrum es:

    Autrum.atm
    |
    +-- audio.wav
    |
    +-- metadata.json
    |
    +-- frequency-data.json

La responsabilidad de cada archivo es:

  **Archivo**           **Responsabilidad**
  --------------------- -----------------------------------------------------------------------------------------
  audio.wav             Conservar el audio original asociado al análisis.
  metadata.json         Describir el archivo, su versión y los parámetros utilizados durante el análisis.
  frequency-data.json   Conservar los datos frecuenciales necesarios para reconstruir el gráfico de frecuencia.

  : Estructura propuesta

Esta estructura permite que el archivo `.atm` funcione como una unidad
autocontenida para el Reproductor.

El flujo general sería:

$$\boxed{
\text{Audio}
\rightarrow
\text{FFT}
\rightarrow
\text{Datos frecuenciales}
\rightarrow
\text{ZIP}
\rightarrow
\text{.atm}
}$$

y posteriormente:

$$\boxed{
\text{.atm}
\rightarrow
\text{ZIP}
\rightarrow
\begin{cases}
\text{Audio}\\
\text{Metadatos}\\
\text{Datos FFT}
\end{cases}
\rightarrow
\text{Reproductor}
}$$

::: thebibliography
99

Instituto Tecnológico de Costa Rica,

*Tarea Corta 1: Autrum*,

Documento de especificación del proyecto IC7602, 2026.

Grupo de trabajo de Autrum,

*Findings Fourier Tarea 1*,

Investigación sobre alternativas de implementación de Fourier, 2026.

MDN Web Docs,

*AnalyserNode*,

Mozilla.

Disponible en:

<https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode>

MDN Web Docs,

*AnalyserNode: fftSize property*,

Mozilla.

Disponible en:

<https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize>

MDN Web Docs,

*AnalyserNode: getFloatFrequencyData() method*,

Mozilla.

Disponible en:

<https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatFrequencyData>

Microsoft,

*Resource Interchange File Format (RIFF)*,

Microsoft Learn.

Disponible en:

<https://learn.microsoft.com/en-us/windows/win32/xaudio2/resource-interchange-file-format--riff->

PKWARE,

*ZIP File Format Specification*,

APPNOTE.TXT.

Disponible en:

<https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT>

JSZip,

*generateAsync(options\[, onUpdate\])*,

Documentación oficial.

Disponible en:

<https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html>

JSZip,

*loadAsync(data \[, options\])*,

Documentación oficial.

Disponible en:

<https://stuk.github.io/jszip/documentation/api_jszip/load_async.html>
:::
