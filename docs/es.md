# Tdarr

Su servidor [Tdarr](https://tdarr.io) en Gladys, a través de su red local: las
colas de transcodificación y de comprobación, los archivos en curso y con
error, el espacio ahorrado, el estado de cada nodo, un interruptor de pausa y
escenas que reaccionan cuando todo está procesado, cuando un archivo falla o
cuando un nodo se desconecta.

La integración se ha probado con un servidor Tdarr 3.01 real (la imagen Docker
oficial, con su nodo interno), todavía no en una instalación real de Gladys:
sus comentarios son bienvenidos en el
[foro de Gladys](https://community.gladysassistant.com) o en las
[issues](https://github.com/guim31/gladys-tdarr/issues).

## Qué necesita

- Gladys Assistant 5.1.0 o posterior.
- Un servidor **Tdarr** (versión 2 o 3), accesible desde Gladys (misma red), en
  el puerto de su interfaz web (`8265` por defecto).
- Si la autenticación de Tdarr está activada (Tdarr 2.24 o posterior; activada
  por defecto en Tdarr 3), una **clave de API**: en Tdarr, **Tools** → **API
  keys**, o el `seededApiKey` de la configuración del servidor.

## Puesta en marcha

1. Instale la integración desde el catálogo de Gladys.
2. En **Configuración**, introduzca la **Dirección** del servidor Tdarr (por
   ejemplo `192.168.1.2:8265`; sin puerto, se usa `8265`) y, si la
   autenticación está activada, su **Clave de API**.
3. Guarde y haga clic en **Probar la conexión**: el mensaje bajo el botón da la
   versión de Tdarr, los nodos en línea, las bibliotecas y la cola.
4. Abra la pestaña **Descubrir**: un dispositivo para el servidor, uno por
   nodo, uno por biblioteca. Haga clic en **Añadir** en los que desee, elija una
   habitación y guarde.

Opciones:

- **Permitir pausa y reanudación** (activado por defecto): Gladys puede pausar
  y reanudar los nodos (interruptores, escenas, botón del widget) y lanzar un
  escaneo de biblioteca. Desactivado, la integración solo lee.
- **Intervalo de actualización**: de 30 segundos a 5 minutos (1 minuto por
  defecto).
- **Idioma de los nombres de funciones**: los nombres de las funciones al añadir
  un dispositivo y el idioma de la frase de resumen.

## Los dispositivos

**El servidor Tdarr**

| Función                          | Qué indica                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------ |
| **En línea**                     | 1 mientras el servidor responde.                                               |
| **Todos los nodos en pausa**     | Interruptor: pausa o reanuda todos los nodos (el «Pause all» de Tdarr).        |
| **Cola de transcodificación**    | Archivos que esperan una transcodificación.                                    |
| **Cola de comprobación**         | Archivos que esperan una comprobación de estado.                               |
| **Archivos en curso**            | Archivos que se procesan ahora mismo, en todos los nodos.                      |
| **Pendientes de revisión**       | Archivos transcodificados que esperan su aprobación (pestaña Staged).          |
| **Transcodificados**             | Archivos transcodificados con éxito (página de inicio de Tdarr).               |
| **Transcodificaciones fallidas** | Archivos cuya transcodificación ha fallado.                                    |
| **Comprobaciones fallidas**      | Archivos cuya comprobación de estado ha fallado.                               |
| **Espacio ahorrado**             | Espacio ahorrado por las transcodificaciones, en GB (negativo si han crecido). |
| **Nodos en línea**               | Nodos conectados al servidor.                                                  |
| **Versión**                      | Versión de Tdarr.                                                              |

**Cada nodo** (con el nombre de nodo definido en Tdarr)

| Función                  | Qué indica                                         |
| ------------------------ | -------------------------------------------------- |
| **En línea**             | 1 mientras el nodo está conectado al servidor.     |
| **Trabajadores activos** | Trabajadores que procesan un archivo en este nodo. |
| **En pausa**             | Interruptor: pausa o reanuda este nodo.            |

**Cada biblioteca**

| Función              | Qué indica                                                        |
| -------------------- | ----------------------------------------------------------------- |
| **Archivos**         | Archivos de la biblioteca.                                        |
| **Por procesar**     | Archivos que esperan una transcodificación o una comprobación.    |
| **Con error**        | Archivos de la biblioteca con error (transcodificación o estado). |
| **Espacio ahorrado** | Espacio ahorrado en esta biblioteca, en GB.                       |

Un nodo en pausa termina los archivos en curso y no empieza ninguno nuevo: no se
pierde nada. Un nodo que se desconecta permanece en Gladys, sin conexión, hasta
que vuelve.

## Panel

El widget **Tdarr** muestra cuatro mosaicos (archivos en cola, en curso, con
error, espacio ahorrado), una fila por nodo (trabajadores activos, en pausa, sin
conexión) y un botón: **Pausar todo** mientras Tdarr trabaja, **Reanudar todo**
una vez en pausa. Sin botón cuando las órdenes están desactivadas en la
configuración.

## Escenas

### Disparadores

- **Cola de Tdarr vacía**: todo está procesado, las colas de transcodificación y
  de comprobación están vacías y ningún trabajador está ocupado. Variables: los
  archivos transcodificados, las transcodificaciones y comprobaciones fallidas
  (totales), el espacio ahorrado.
- **Archivo de Tdarr fallido**: un archivo acaba de fallar en su
  transcodificación o en su comprobación. Filtros: la biblioteca, la etapa
  (transcodificación o comprobación de estado). Variables: el nombre del
  archivo, su ruta completa, la biblioteca.
- **Nodo de Tdarr sin conexión**: un nodo conectado se ha desconectado (parada,
  fallo, red). Filtro: el nodo. Variable: el nombre del nodo.

### Acciones

- **Pausar Tdarr**: un nodo, o todos si no se elige ningún nodo.
- **Reanudar Tdarr**: la misma elección.
- **Escanear una biblioteca de Tdarr**: busca archivos nuevos en una biblioteca,
  o en todas (el «Scan → Find new» de Tdarr). Salida: el número de bibliotecas
  escaneadas.
- **Leer el resumen de Tdarr**: una frase para un mensaje o un aviso de voz
  («Tdarr: 12 archivo(s) en cola, 2 en curso, 1 con error, 35,2 GB
  ahorrados.»), y la cola, los archivos en curso y los errores como números.

### Ideas de escenas

- A las 18:00, **Pausar Tdarr** para reservar el procesador y los discos a la
  película de la noche; a la 1:00, **Reanudar Tdarr**.
- **Archivo de Tdarr fallido** → un mensaje de Telegram con el nombre del
  archivo y la biblioteca.
- **Cola de Tdarr vacía** → una notificación: «Tdarr ha terminado, espacio
  ahorrado: …».
- Tras una descarga importada por Sonarr o Radarr, **Escanear una biblioteca de
  Tdarr** para que el nuevo episodio se procese enseguida.

## Solución de problemas

- **«Tdarr no responde»**: compruebe la dirección y el puerto (`8265`, el de la
  interfaz web, no el `8266` de los nodos), y que Gladys llega al servidor
  (cortafuegos, red Docker).
- **«Clave de API rechazada o ausente»**: la autenticación de Tdarr está
  activada. Cree una clave en **Tools** → **API keys** y péguela en la
  configuración.
- **«No hay ningún servidor Tdarr en esta dirección»**: otra aplicación responde
  en este puerto.
- **Un nodo aparece dos veces**: Tdarr reconoce un nodo por su nombre.
  Renombrar un nodo en su configuración (`nodeName`) crea un dispositivo nuevo
  en Gladys; elimine el antiguo.
- **El interruptor no hace nada**: compruebe **Permitir pausa y reanudación** en
  la configuración.
- Más detalles en los registros de la integración (**Integraciones** → Tdarr →
  registros), en el nivel `debug` si hace falta.

## Límites

- Un solo servidor Tdarr por integración.
- Las cifras se leen en cada intervalo de actualización: una transcodificación
  corta puede terminar entre dos lecturas, y **Archivo de Tdarr fallido** avisa
  como máximo de diez archivos por lectura. Los errores de más de una hora no se
  avisan.
- **Pendientes de revisión** cuenta los archivos que Tdarr guarda en la pestaña
  Staged hasta que usted los acepta (cuando «Auto accept successful transcodes»
  está desactivado).
- La integración no modifica los ajustes de transcodificación, los plugins ni
  los flujos de Tdarr, y no elimina nada.
- Sin relación con Tdarr ni con sus autores.
