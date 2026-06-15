import type { PostLocale } from "../blog";

// French (fr) — machine-translated blog content, pending human review.
const fr: Record<string, PostLocale> = {
  "the-name-keysark": {
    title: "D'où vient le nom KeysArk",
    description: "Keys plus Ark — un petit mot avec une idée délibérée derrière lui.",
    body: [
      {
        k: "p",
        t: "KeysArk, c'est deux mots : Keys et Ark. Le nom est petit, mais l'idée qui se cache derrière, c'est tout le produit.",
      },
      { k: "h2", t: "L'arche" },
      {
        k: "p",
        t: "Une arche est un vaisseau construit pour transporter en sécurité quelque chose de précieux à travers le danger — l'arche de Noé à travers le déluge, l'arche d'alliance gardant ce qui comptait le plus. Une arche n'est pas un coffre-fort que l'on visite ; c'est une embarcation qui transporte vos biens précieux à travers le temps et les épreuves.",
      },
      { k: "h2", t: "Vos clés, transportées" },
      {
        k: "p",
        t: "Vos clés — la phrase de récupération qui déverrouille tout — sont exactement ce genre de cargaison précieuse. KeysArk est l'arche qui les transporte : d'un appareil à l'autre, d'un fournisseur cloud à l'autre, au fil des années, sans jamais exposer ce qu'elle contient.",
      },
      { k: "h2", t: "Scellée de l'extérieur" },
      {
        k: "p",
        t: "Il y a un second sens caché dans le mot : `ark` partage une racine avec `arca`, le latin pour coffre ou cassette. Un coffre scellé que seul le propriétaire peut ouvrir est la forme littérale du chiffrement à divulgation nulle de connaissance. L'arche est fermée ; vous seul détenez la clé.",
      },
      { k: "h2", t: "Le logo" },
      {
        k: "p",
        t: "C'est pourquoi le symbole est une coque d'arche en forme de bouclier, avec un trou de serrure en son centre et une clé ambrée à l'intérieur. Le bouclier est l'arche qui transporte vos clés ; le trou de serrure est l'unique entrée ; la couleur est la chaleur de quelque chose gardé en sécurité. Le nom et l'image disent la même chose — vos clés, dans une arche que vous seul pouvez ouvrir.",
      },
    ],
  },
  "open-source-and-provenance": {
    title: "Pourquoi KeysArk doit être open source — et pourquoi les sauvegardes portent un numéro de version",
    description:
      "Le chiffrement de bout en bout n'est qu'une promesse jusqu'à ce que vous puissiez le vérifier. Voici pourquoi le code est ouvert, et pourquoi chaque sauvegarde exportée enregistre le logiciel exact qui l'a produite.",
    body: [
      {
        k: "p",
        t: "« Chiffré de bout en bout » est une affirmation. L'open source est ce qui la transforme en quelque chose que vous pouvez réellement vérifier.",
      },
      { k: "h2", t: "Faire confiance, mais vérifier" },
      {
        k: "p",
        t: "Si vous ne pouvez pas lire le code, « nous ne voyons jamais vos données » n'est que du marketing. L'open source permet à quiconque de confirmer qu'il n'y a pas de porte dérobée : que la clé est réellement dérivée dans le navigateur, que le texte en clair n'atteint réellement jamais le serveur. Une sécurité qui ne peut pas être auditée n'est pas de la sécurité — c'est de la foi.",
      },
      { k: "h2", t: "Le problème dont personne ne parle" },
      {
        k: "p",
        t: "L'auto-conservation a un problème de longue traîne. Vous chiffrez une sauvegarde aujourd'hui, puis vous allez l'ouvrir dans cinq ou dix ans — mais d'ici là le site web aura peut-être disparu, les bibliothèques auront changé, les algorithmes auront été modifiés. Une sauvegarde que vous ne pouvez plus déchiffrer n'est pas une sauvegarde.",
      },
      { k: "h2", t: "Les sauvegardes portent donc leur propre provenance" },
      {
        k: "p",
        t: "Chaque sauvegarde de mnémonique que KeysArk exporte (PDF et HTML) intègre un manifeste de provenance décrivant exactement ce qui l'a produite :",
      },
      {
        k: "ul",
        items: [
          "La version du CLI ark, ainsi que le dépôt source + le hash du commit.",
          "L'heure de build et la version de Node.js.",
          "Les versions exactes des bibliothèques de chiffrement (`hash-wasm`, `@scure/bip39`, `@noble/hashes`).",
          "La spécification cryptographique complète : phrase BIP39 de 24 mots, seed → HKDF-SHA256 → AES-256-GCM, et les paramètres Argon2id.",
        ],
      },
      { k: "h2", t: "Pourquoi le numéro de version compte" },
      {
        k: "p",
        t: "Avec ce manifeste, le vous du futur peut récupérer le commit exact qui a produit la sauvegarde, reproduire l'environnement de build et déchiffrer — même des décennies plus tard, même si keysark.com n'existe plus. Le numéro de version n'est pas de la comptabilité ; c'est la carte qui ramène à l'environnement d'exécution capable d'ouvrir encore votre coffre.",
      },
      {
        k: "quote",
        t: "L'open source prouve qu'il n'y a pas de porte dérobée aujourd'hui. La provenance prouve que vous pourrez encore entrer demain.",
      },
    ],
  },
  "encryption-design": {
    title: "Comment KeysArk chiffre : la conception",
    description:
      "Une visite guidée du chiffrement de bout en bout de KeysArk — d'une phrase BIP39 à un texte chiffré AES-256-GCM que vous seul pouvez ouvrir.",
    body: [
      {
        k: "p",
        t: "Chaque choix de conception dans KeysArk suit une règle : la clé ne quitte jamais votre navigateur. Voici la chaîne, depuis les mots que vous notez jusqu'au texte chiffré dans votre cloud.",
      },
      { k: "h2", t: "Une seule phrase pour tout contenir" },
      {
        k: "p",
        t: "Votre secret maître est une phrase de récupération BIP39 — 24 mots anglais (256 bits d'entropie) pour les nouveaux coffres. C'est un standard, vous pouvez donc l'importer dans MetaMask ou n'importe quel portefeuille BIP39. Rien d'autre à télécharger, aucun fichier de clé à surveiller.",
      },
      { k: "h2", t: "Des mots à une clé" },
      {
        k: "p",
        t: "La phrase est transformée en clé de façon déterministe, entièrement dans le navigateur : même phrase, même clé, à chaque fois, sur n'importe quel appareil — sans aucun serveur impliqué.",
      },
      {
        k: "code",
        t: "BIP39 phrase\n  → seed   (PBKDF2-HMAC-SHA512)\n  → HKDF-SHA256\n  → AES-256 key",
      },
      { k: "h2", t: "Chiffrer votre contenu" },
      {
        k: "p",
        t: "Chaque élément est scellé avec `AES-256-GCM`, un chiffrement authentifié : il cache à la fois le contenu et détecte toute altération. Chaque chiffrement utilise un IV de 96 bits frais et aléatoire qui n'est jamais réutilisé — réutiliser un nonce GCM serait catastrophique, alors nous ne le faisons jamais.",
      },
      { k: "h2", t: "Le serveur est un simple tuyau" },
      {
        k: "p",
        t: "Notre API et les clients de stockage sont des octets en entrée, des octets en sortie : ils déplacent un texte chiffré base64 opaque et sont totalement indépendants du contenu. Le texte en clair, la phrase et la clé dérivée sont interdits dans tout code serveur, requête, URL, cookie, journal ou base de données.",
      },
      { k: "h2", t: "Déverrouiller sur votre machine" },
      {
        k: "p",
        t: "Lorsque vous stockez votre phrase localement (dans l'application web ou le CLI ark), elle est enveloppée avec un mot de passe de déverrouillage à l'aide d'`Argon2id` (512 Mo, t=4, p=1) — une fonction délibérément gourmande en mémoire qui rend coûteuse la force brute sur le mot de passe. Les paramètres voyagent avec l'identifiant, ce qui permet de les relever au fil du temps.",
      },
      { k: "h2", t: "Le compromis que nous acceptons" },
      {
        k: "quote",
        t: "Un véritable chiffrement de bout en bout signifie que même nous ne pouvons pas vous aider à récupérer vos données. Perdez la phrase de récupération et elle est perdue. C'est le prix à payer pour que personne — y compris nous — ne puisse la lire.",
      },
    ],
  },
};

export default fr;
