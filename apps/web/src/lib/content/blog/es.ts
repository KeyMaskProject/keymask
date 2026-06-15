import type { PostLocale } from "../blog";

// Spanish (es) — machine-translated blog content, pending human review.
const es: Record<string, PostLocale> = {
  "the-name-keysark": {
    title: "De dónde viene el nombre KeysArk",
    description: "Keys más Ark: una palabra pequeña con una idea deliberada detrás.",
    body: [
      {
        k: "p",
        t: "KeysArk son dos palabras: Keys (llaves) y Ark (arca). El nombre es pequeño, pero la idea que hay detrás es el producto entero.",
      },
      { k: "h2", t: "El arca" },
      {
        k: "p",
        t: "Un arca es una nave construida para transportar algo valioso a salvo a través del peligro: el arca de Noé a través del diluvio, el arca de la alianza que guardaba lo más importante. Un arca no es una bóveda que visitas; es una embarcación que lleva tus bienes preciados a través del tiempo y las tormentas.",
      },
      { k: "h2", t: "Tus llaves, transportadas" },
      {
        k: "p",
        t: "Tus llaves —la frase de recuperación que lo desbloquea todo— son exactamente esa clase de carga preciosa. KeysArk es el arca que las transporta: entre dispositivos, entre proveedores de nube, a lo largo de los años, sin exponer jamás lo que hay dentro.",
      },
      { k: "h2", t: "Sellada desde fuera" },
      {
        k: "p",
        t: "Hay un segundo significado oculto en la palabra: `ark` comparte raíz con `arca`, el término latino para un cofre o caja fuerte. Un cofre sellado que solo el dueño puede abrir es la forma literal del cifrado de conocimiento cero. El arca está cerrada; solo tú tienes la llave.",
      },
      { k: "h2", t: "El logotipo" },
      {
        k: "p",
        t: "Por eso la marca es un casco de arca con forma de escudo, con un ojo de cerradura en su centro y una llave ámbar dentro. El escudo es el arca que lleva tus llaves; el ojo de la cerradura es la única vía de entrada; el color es la calidez de algo bien resguardado. El nombre y la imagen dicen lo mismo: tus llaves, en un arca que solo tú puedes abrir.",
      },
    ],
  },
  "open-source-and-provenance": {
    title: "Por qué KeysArk debe ser de código abierto, y por qué las copias de seguridad llevan un número de versión",
    description:
      "El cifrado de extremo a extremo no es más que una promesa hasta que puedes verificarlo. Aquí explicamos por qué el código es abierto, y por qué cada copia de seguridad exportada registra el software exacto que la creó.",
    body: [
      {
        k: "p",
        t: "«Cifrado de extremo a extremo» es una afirmación. El código abierto es lo que la convierte en algo que realmente puedes comprobar.",
      },
      { k: "h2", t: "Confía, pero verifica" },
      {
        k: "p",
        t: "Si no puedes leer el código, «nunca vemos tus datos» es solo marketing. El código abierto permite que cualquiera confirme que no hay puerta trasera: que la clave realmente se deriva en el navegador, que el texto plano realmente nunca llega al servidor. La seguridad que no puede auditarse no es seguridad: es fe.",
      },
      { k: "h2", t: "El problema del que nadie habla" },
      {
        k: "p",
        t: "La autocustodia tiene un problema de cola larga. Cifras una copia de seguridad hoy, y luego vas a abrirla dentro de cinco o diez años, pero para entonces el sitio web quizá ya no exista, las librerías hayan cambiado, los algoritmos se hayan ajustado. Una copia de seguridad que ya no puedes descifrar no es una copia de seguridad.",
      },
      { k: "h2", t: "Por eso las copias de seguridad llevan su propia procedencia" },
      {
        k: "p",
        t: "Cada copia de seguridad del mnemónico que KeysArk exporta (PDF y HTML) incrusta un manifiesto de procedencia que describe exactamente qué la produjo:",
      },
      {
        k: "ul",
        items: [
          "La versión de la CLI ark, y el repositorio de origen + el hash del commit.",
          "La hora de compilación y la versión de Node.js.",
          "Las versiones exactas de las librerías de criptografía (`hash-wasm`, `@scure/bip39`, `@noble/hashes`).",
          "La especificación criptográfica completa: frase BIP39 de 24 palabras, seed → HKDF-SHA256 → AES-256-GCM, y los parámetros de Argon2id.",
        ],
      },
      { k: "h2", t: "Por qué importa el número de versión" },
      {
        k: "p",
        t: "Con ese manifiesto, el tú del futuro puede hacer checkout del commit exacto que creó la copia de seguridad, reproducir el entorno de compilación y descifrarla, incluso décadas después, incluso si keysark.com ya no existe. El número de versión no es papeleo; es el mapa de regreso al entorno de ejecución que aún puede abrir tu bóveda.",
      },
      {
        k: "quote",
        t: "El código abierto demuestra que hoy no hay puerta trasera. La procedencia demuestra que mañana todavía podrás entrar.",
      },
    ],
  },
  "encryption-design": {
    title: "Cómo cifra KeysArk: el diseño",
    description:
      "Un recorrido por el cifrado de extremo a extremo de KeysArk: desde una frase BIP39 hasta texto cifrado con AES-256-GCM que solo tú puedes abrir.",
    body: [
      {
        k: "p",
        t: "Cada decisión de diseño en KeysArk sigue una regla: la clave nunca sale de tu navegador. Esta es la cadena, desde las palabras que anotas hasta el texto cifrado en tu nube.",
      },
      { k: "h2", t: "Una frase para guardarlo todo" },
      {
        k: "p",
        t: "Tu secreto maestro es una frase de recuperación BIP39: 24 palabras en inglés (256 bits de entropía) para las bóvedas nuevas. Es un estándar, así que puedes importarla en MetaMask o en cualquier monedero BIP39. Nada más que descargar, ningún archivo de clave que cuidar.",
      },
      { k: "h2", t: "De las palabras a una clave" },
      {
        k: "p",
        t: "La frase se convierte en una clave de forma determinista, enteramente en el navegador: la misma frase, la misma clave, cada vez, en cualquier dispositivo, sin que intervenga ningún servidor.",
      },
      {
        k: "code",
        t: "BIP39 phrase\n  → seed   (PBKDF2-HMAC-SHA512)\n  → HKDF-SHA256\n  → AES-256 key",
      },
      { k: "h2", t: "Cifrar tu contenido" },
      {
        k: "p",
        t: "Cada elemento se sella con `AES-256-GCM`, un cifrado autenticado: oculta el contenido y a la vez detecta cualquier manipulación. Cada cifrado usa un IV de 96 bits nuevo y aleatorio que nunca se reutiliza; reutilizar un nonce de GCM sería catastrófico, así que nunca lo hacemos.",
      },
      { k: "h2", t: "El servidor es una tubería tonta" },
      {
        k: "p",
        t: "Nuestra API y los clientes de almacenamiento son de bytes que entran y bytes que salen: mueven texto cifrado opaco en base64 y son completamente ajenos al contenido. El texto plano, la frase y la clave derivada tienen prohibido aparecer en cualquier código de servidor, petición, URL, cookie, registro o base de datos.",
      },
      { k: "h2", t: "Desbloquear en tu máquina" },
      {
        k: "p",
        t: "Cuando guardas tu frase localmente (en la aplicación web o en la CLI ark), se envuelve con una contraseña de desbloqueo usando `Argon2id` (512 MB, t=4, p=1), una función deliberadamente exigente en memoria que encarece el ataque por fuerza bruta de la contraseña. Los parámetros viajan junto con la credencial, de modo que pueden elevarse con el tiempo.",
      },
      { k: "h2", t: "El compromiso que aceptamos" },
      {
        k: "quote",
        t: "El verdadero cifrado de extremo a extremo significa que ni siquiera nosotros podemos ayudarte a recuperar tus datos. Pierde la frase de recuperación y desaparecerá. Ese es el precio de que nadie —incluidos nosotros— pueda leerla.",
      },
    ],
  },
};

export default es;
