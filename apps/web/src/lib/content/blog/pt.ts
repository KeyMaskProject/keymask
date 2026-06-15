import type { PostLocale } from "../blog";

// Portuguese (pt) — machine-translated blog content, pending human review.
const pt: Record<string, PostLocale> = {
  "the-name-keysark": {
    title: "De onde vem o nome KeysArk",
    description: "Keys mais Ark — uma palavra pequena com uma ideia deliberada por trás.",
    body: [
      {
        k: "p",
        t: "KeysArk são duas palavras: Keys (chaves) e Ark (arca). O nome é pequeno, mas a ideia por trás dele é o produto inteiro.",
      },
      { k: "h2", t: "A arca" },
      {
        k: "p",
        t: "Uma arca é uma embarcação construída para transportar algo precioso com segurança através do perigo — a arca de Noé atravessando o dilúvio, a arca da aliança guardando o que mais importava. Uma arca não é um cofre que você visita; é uma embarcação que carrega seus bens valiosos através do tempo e das adversidades.",
      },
      { k: "h2", t: "Suas chaves, transportadas" },
      {
        k: "p",
        t: "Suas chaves — a frase de recuperação que desbloqueia tudo — são exatamente esse tipo de carga preciosa. A KeysArk é a arca que as transporta: entre dispositivos, entre provedores de nuvem, ao longo dos anos, sem nunca expor o que há dentro.",
      },
      { k: "h2", t: "Selada por fora" },
      {
        k: "p",
        t: "Há um segundo significado escondido na palavra: `ark` compartilha uma raiz com `arca`, do latim para um baú ou cofre. Um baú selado que só o dono consegue abrir é a forma literal da criptografia de conhecimento zero. A arca está fechada; só você tem a chave.",
      },
      { k: "h2", t: "O logotipo" },
      {
        k: "p",
        t: "É por isso que a marca é um casco de arca em formato de escudo com um buraco de fechadura no centro e uma chave âmbar dentro dele. O escudo é a arca carregando suas chaves; o buraco da fechadura é a única entrada; a cor é o calor de algo mantido em segurança. O nome e a imagem dizem a mesma coisa — suas chaves, em uma arca que só você pode abrir.",
      },
    ],
  },
  "open-source-and-provenance": {
    title: "Por que a KeysArk precisa ser de código aberto — e por que os backups carregam um número de versão",
    description:
      "A criptografia de ponta a ponta é apenas uma promessa até que você possa verificá-la. Veja por que o código é aberto e por que cada backup exportado registra exatamente o software que o gerou.",
    body: [
      {
        k: "p",
        t: "“Criptografado de ponta a ponta” é uma afirmação. O código aberto é o que a transforma em algo que você pode de fato verificar.",
      },
      { k: "h2", t: "Confie, mas verifique" },
      {
        k: "p",
        t: "Se você não consegue ler o código, “nós nunca vemos seus dados” é apenas marketing. O código aberto permite que qualquer pessoa confirme que não há backdoor: que a chave é realmente derivada no navegador, que o texto em claro realmente nunca chega ao servidor. Segurança que não pode ser auditada não é segurança — é fé.",
      },
      { k: "h2", t: "O problema de que ninguém fala" },
      {
        k: "p",
        t: "A autocustódia tem um problema de cauda longa. Você criptografa um backup hoje e depois vai abri-lo daqui a cinco ou dez anos — mas até lá o site pode já não existir, as bibliotecas podem ter mudado, os algoritmos podem ter sido ajustados. Um backup que você não consegue mais descriptografar não é um backup.",
      },
      { k: "h2", t: "Por isso os backups carregam sua própria proveniência" },
      {
        k: "p",
        t: "Cada backup de frase mnemônica que a KeysArk exporta (PDF e HTML) incorpora um manifesto de proveniência descrevendo exatamente o que o produziu:",
      },
      {
        k: "ul",
        items: [
          "A versão do ark CLI, e o repositório de origem + hash do commit.",
          "O horário da compilação e a versão do Node.js.",
          "As versões exatas das bibliotecas de criptografia (`hash-wasm`, `@scure/bip39`, `@noble/hashes`).",
          "A especificação criptográfica completa: frase BIP39 de 24 palavras, seed → HKDF-SHA256 → AES-256-GCM, e os parâmetros do Argon2id.",
        ],
      },
      { k: "h2", t: "Por que o número de versão importa" },
      {
        k: "p",
        t: "Com esse manifesto, o você do futuro pode fazer checkout do commit exato que gerou o backup, reproduzir o ambiente de compilação e descriptografar — mesmo décadas depois, mesmo que keysark.com já não exista. O número de versão não é burocracia; é o mapa de volta ao ambiente de execução que ainda consegue abrir seu cofre.",
      },
      {
        k: "quote",
        t: "O código aberto prova que não há backdoor hoje. A proveniência prova que você ainda conseguirá entrar amanhã.",
      },
    ],
  },
  "encryption-design": {
    title: "Como a KeysArk criptografa: o design",
    description:
      "Um percurso pela criptografia de ponta a ponta da KeysArk — de uma frase BIP39 a um texto cifrado AES-256-GCM que só você pode abrir.",
    body: [
      {
        k: "p",
        t: "Cada escolha de design na KeysArk segue uma regra: a chave nunca sai do seu navegador. Aqui está a cadeia, das palavras que você anota até o texto cifrado na sua nuvem.",
      },
      { k: "h2", t: "Uma frase para guardar tudo" },
      {
        k: "p",
        t: "Seu segredo mestre é uma frase de recuperação BIP39 — 24 palavras em inglês (256 bits de entropia) para novos cofres. É um padrão, então você pode importá-la para o MetaMask ou qualquer carteira BIP39. Nada mais para baixar, nenhum arquivo de chave para cuidar.",
      },
      { k: "h2", t: "Das palavras a uma chave" },
      {
        k: "p",
        t: "A frase é transformada em uma chave de forma determinística, inteiramente no navegador: mesma frase, mesma chave, todas as vezes, em qualquer dispositivo — sem nenhum servidor envolvido.",
      },
      {
        k: "code",
        t: "BIP39 phrase\n  → seed   (PBKDF2-HMAC-SHA512)\n  → HKDF-SHA256\n  → AES-256 key",
      },
      { k: "h2", t: "Criptografando seu conteúdo" },
      {
        k: "p",
        t: "Cada item é selado com `AES-256-GCM`, uma cifra autenticada: ela ao mesmo tempo oculta o conteúdo e detecta adulteração. Cada criptografia usa um IV de 96 bits novo e aleatório que nunca é reutilizado — reutilizar um nonce GCM seria catastrófico, então nunca o fazemos.",
      },
      { k: "h2", t: "O servidor é um cano burro" },
      {
        k: "p",
        t: "Nossa API e os clientes de armazenamento são bytes entram, bytes saem: eles movem texto cifrado base64 opaco e são totalmente agnósticos ao conteúdo. O texto em claro, a frase e a chave derivada são proibidos em qualquer código de servidor, requisição, URL, cookie, log ou banco de dados.",
      },
      { k: "h2", t: "Desbloqueando na sua máquina" },
      {
        k: "p",
        t: "Quando você armazena sua frase localmente (no aplicativo web ou no ark CLI), ela é envolvida com uma senha de desbloqueio usando `Argon2id` (512 MB, t=4, p=1) — uma função deliberadamente memory-hard que torna caro fazer força bruta na senha. Os parâmetros viajam junto com a credencial, de modo que podem ser aumentados com o tempo.",
      },
      { k: "h2", t: "O compromisso que aceitamos" },
      {
        k: "quote",
        t: "A verdadeira criptografia de ponta a ponta significa que nem mesmo nós podemos ajudá-lo a recuperar seus dados. Perca a frase de recuperação e ela se foi. Esse é o preço de ninguém — incluindo nós — conseguir lê-la.",
      },
    ],
  },
};

export default pt;
