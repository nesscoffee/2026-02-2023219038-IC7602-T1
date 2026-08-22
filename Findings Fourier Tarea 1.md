
Primer finding:

https://www.npmjs.com/package/fft-js
https://github.com/lvillasen/FFT.js/
https://github.com/trekhleb/javascript-algorithms/tree/master/src/algorithms/math/fourier-transform
paquete de npm que se podria usar


**Que es la transformacion de Fourier?**
La transformacion de fourier lo que hace es que convierte una señal en las frecuencias que la forman
![[Pasted image 20260813175634.png]]
Esta es la formula basica de fourier

La version discreta es un poco mas compleja, ya que convierte unos samples(ejemplos?)  en samples pero de la transformacion de fourier discreta-tiempo, esto no tiene sentido mas que nada porque es tecnico, entonces de forma mas practica

Las señales que se reciben son un producto final, que es lo que hace la transformacion discreta de fourier? Convertirlo de los numeros  o muestras que se nos dan de input a algo mas realista
![[Pasted image 20260813185900.png]]
![[Pasted image 20260813185958.png]]

Aca hay una mejor relacion entre la señal y las frecuencias, si cambian las frecuencias, la señal tambien cambia

![[Pasted image 20260813174413.png]]

Para resumir, hay tres tipos de transformaciones

DTFT: Discreta-tiempo que es teorica
DFT: Discreta Fourier, practica porque solo revisa una cantidad N definida
FFT: Fourier Rapido, mismo que DFT pero es mas rapido