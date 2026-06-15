import type { PostLocale } from "../blog";

// German (de) — machine-translated blog content, pending human review.
const de: Record<string, PostLocale> = {
  "the-name-keysark": {
    title: "Woher der Name KeysArk kommt",
    description: "Keys plus Ark — ein kleines Wort mit einer bewussten Idee dahinter.",
    body: [
      {
        k: "p",
        t: "KeysArk besteht aus zwei Wörtern: Keys und Ark. Der Name ist klein, doch die Idee dahinter ist das ganze Produkt.",
      },
      { k: "h2", t: "Die Arche" },
      {
        k: "p",
        t: "Eine Arche ist ein Gefäß, das gebaut wurde, um etwas Kostbares sicher durch Gefahr zu tragen — Noahs Arche durch die Flut, die Bundeslade, die das Wichtigste bewahrte. Eine Arche ist kein Tresor, den man besucht; sie ist ein Fahrzeug, das deine Wertsachen durch Zeit und Not trägt.",
      },
      { k: "h2", t: "Deine Schlüssel, getragen" },
      {
        k: "p",
        t: "Deine Schlüssel — die Wiederherstellungsphrase, die alles entsperrt — sind genau diese Art kostbarer Fracht. KeysArk ist die Arche, die sie trägt: über Geräte hinweg, über Cloud-Anbieter hinweg, über Jahre hinweg, ohne jemals preiszugeben, was darin liegt.",
      },
      { k: "h2", t: "Von außen versiegelt" },
      {
        k: "p",
        t: "Im Wort verbirgt sich eine zweite Bedeutung: `ark` teilt eine Wurzel mit `arca`, dem lateinischen Wort für eine Truhe oder einen Geldschrank. Eine versiegelte Truhe, die nur der Besitzer öffnen kann, ist die buchstäbliche Gestalt der Zero-Knowledge-Verschlüsselung. Die Arche ist verschlossen; nur du hältst den Schlüssel.",
      },
      { k: "h2", t: "Das Logo" },
      {
        k: "p",
        t: "Deshalb ist das Zeichen ein schildförmiger Archenrumpf mit einem Schlüsselloch in der Mitte und einem bernsteinfarbenen Schlüssel darin. Das Schild ist die Arche, die deine Schlüssel trägt; das Schlüsselloch ist der eine Weg hinein; die Farbe ist die Wärme von etwas, das sicher verwahrt wird. Der Name und das Bild sagen dasselbe — deine Schlüssel, in einer Arche, die nur du öffnen kannst.",
      },
    ],
  },
  "open-source-and-provenance": {
    title: "Warum KeysArk Open Source sein muss — und warum Backups eine Versionsnummer tragen",
    description:
      "Ende-zu-Ende-Verschlüsselung ist nur ein Versprechen, solange du sie nicht überprüfen kannst. Hier ist, warum der Code offen ist und warum jedes exportierte Backup genau die Software festhält, die es erstellt hat.",
    body: [
      {
        k: "p",
        t: "„Ende-zu-Ende-verschlüsselt“ ist eine Behauptung. Open Source ist das, was sie in etwas verwandelt, das du tatsächlich überprüfen kannst.",
      },
      { k: "h2", t: "Vertraue, aber überprüfe" },
      {
        k: "p",
        t: "Wenn du den Code nicht lesen kannst, ist „wir sehen deine Daten nie“ nur Marketing. Open Source erlaubt jedem zu bestätigen, dass es keine Hintertür gibt: dass der Schlüssel wirklich im Browser abgeleitet wird, dass Klartext wirklich nie den Server erreicht. Sicherheit, die nicht geprüft werden kann, ist keine Sicherheit — sie ist Glaube.",
      },
      { k: "h2", t: "Das Problem, über das niemand spricht" },
      {
        k: "p",
        t: "Selbstverwahrung hat ein Long-Tail-Problem. Du verschlüsselst heute ein Backup und willst es dann in fünf oder zehn Jahren öffnen — doch bis dahin ist die Website vielleicht verschwunden, die Bibliotheken haben sich geändert, die Algorithmen wurden angepasst. Ein Backup, das du nicht mehr entschlüsseln kannst, ist kein Backup.",
      },
      { k: "h2", t: "Deshalb tragen Backups ihre eigene Herkunft" },
      {
        k: "p",
        t: "Jedes Mnemonic-Backup, das KeysArk exportiert (PDF und HTML), bettet ein Herkunfts-Manifest ein, das genau beschreibt, was es erzeugt hat:",
      },
      {
        k: "ul",
        items: [
          "Die ark CLI-Version sowie das Quell-Repository + Commit-Hash.",
          "Die Build-Zeit und die Node.js-Version.",
          "Die exakten Krypto-Bibliotheksversionen (`hash-wasm`, `@scure/bip39`, `@noble/hashes`).",
          "Die vollständige Krypto-Spezifikation: BIP39 24-Wort-Phrase, seed → HKDF-SHA256 → AES-256-GCM und die Argon2id-Parameter.",
        ],
      },
      { k: "h2", t: "Warum die Versionsnummer wichtig ist" },
      {
        k: "p",
        t: "Mit diesem Manifest kann das zukünftige Du genau den Commit auschecken, der das Backup erstellt hat, die Build-Umgebung reproduzieren und entschlüsseln — selbst Jahrzehnte später, selbst wenn keysark.com nicht mehr existiert. Die Versionsnummer ist keine Buchhaltung; sie ist die Karte zurück zur Laufzeitumgebung, die deinen Tresor noch öffnen kann.",
      },
      {
        k: "quote",
        t: "Open Source beweist, dass es heute keine Hintertür gibt. Herkunft beweist, dass du morgen noch hineinkommst.",
      },
    ],
  },
  "encryption-design": {
    title: "Wie KeysArk verschlüsselt: das Design",
    description:
      "Ein Rundgang durch die Ende-zu-Ende-Verschlüsselung von KeysArk — von einer BIP39-Phrase bis zum AES-256-GCM-Chiffretext, den nur du öffnen kannst.",
    body: [
      {
        k: "p",
        t: "Jede Designentscheidung in KeysArk folgt einer Regel: Der Schlüssel verlässt nie deinen Browser. Hier ist die Kette, von den Wörtern, die du aufschreibst, bis zum Chiffretext in deiner Cloud.",
      },
      { k: "h2", t: "Eine Phrase, die alles hält" },
      {
        k: "p",
        t: "Dein Hauptgeheimnis ist eine BIP39-Wiederherstellungsphrase — 24 englische Wörter (256 Bit Entropie) für neue Tresore. Sie ist ein Standard, sodass du sie in MetaMask oder jede beliebige BIP39-Wallet importieren kannst. Nichts sonst herunterzuladen, keine Schlüsseldatei, auf die man aufpassen muss.",
      },
      { k: "h2", t: "Von Wörtern zu einem Schlüssel" },
      {
        k: "p",
        t: "Die Phrase wird deterministisch in einen Schlüssel verwandelt, vollständig im Browser: dieselbe Phrase, derselbe Schlüssel, jedes Mal, auf jedem Gerät — ohne dass ein Server beteiligt ist.",
      },
      {
        k: "code",
        t: "BIP39 phrase\n  → seed   (PBKDF2-HMAC-SHA512)\n  → HKDF-SHA256\n  → AES-256 key",
      },
      { k: "h2", t: "Deine Inhalte verschlüsseln" },
      {
        k: "p",
        t: "Jedes Element wird mit `AES-256-GCM` versiegelt, einer authentifizierten Chiffre: Sie verbirgt den Inhalt und erkennt zugleich Manipulationen. Jede Verschlüsselung verwendet einen frischen, zufälligen 96-Bit-IV, der nie wiederverwendet wird — einen GCM-Nonce wiederzuverwenden wäre katastrophal, deshalb tun wir es nie.",
      },
      { k: "h2", t: "Der Server ist eine dumme Leitung" },
      {
        k: "p",
        t: "Unsere API und die Storage-Clients sind bytes-in, bytes-out: Sie bewegen undurchsichtigen base64-Chiffretext und sind völlig inhaltsagnostisch. Der Klartext, die Phrase und der abgeleitete Schlüssel sind in jeglichem Server-Code, jeder Anfrage, URL, jedem Cookie, Log oder jeder Datenbank verboten.",
      },
      { k: "h2", t: "Entsperren auf deinem Rechner" },
      {
        k: "p",
        t: "Wenn du deine Phrase lokal speicherst (in der Web-App oder der ark CLI), wird sie mit einem Entsperrpasswort umhüllt, das `Argon2id` (512 MB, t=4, p=1) verwendet — eine bewusst speicherharte Funktion, die das Brute-Forcing des Passworts teuer macht. Die Parameter reisen mit dem Anmeldenachweis mit, sodass sie mit der Zeit erhöht werden können.",
      },
      { k: "h2", t: "Der Kompromiss, den wir eingehen" },
      {
        k: "quote",
        t: "Echte Ende-zu-Ende-Verschlüsselung bedeutet, dass selbst wir dir nicht helfen können, deine Daten wiederherzustellen. Verlierst du die Wiederherstellungsphrase, ist sie weg. Das ist der Preis dafür, dass niemand — auch wir nicht — sie lesen kann.",
      },
    ],
  },
};

export default de;
