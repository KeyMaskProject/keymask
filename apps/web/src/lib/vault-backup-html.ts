// 加密 HTML 备份 —— 纯客户端生成的自解密单文件。
//
// 文件内嵌:Argon2id(m=64MB/t=3/p=1,与解锁密码同参)+ AES-256-GCM 加密的助记词密文
// + 内联 argon2 wasm(hash-wasm UMD,从 /argon2.umd.min.js 取)+ 解密 UI。
// 恢复:离线双击用任意浏览器打开(file:// 是安全上下文,WebCrypto 可用),输备份密码即见助记词。
// 不依赖 KeysArk 在线、不发任何网络请求;加密复用 @keysark/crypto 同一套实现。
import {
  DEFAULT_ARGON2ID_PARAMS,
  deriveWrappingKey,
  encrypt,
  generateWrappingSalt,
} from "@keysark/crypto";
import { translate, type Locale } from "@/lib/i18n";

export type EncryptedBackupInput = {
  mnemonic: string;
  vaultName: string;
  url: string;
  locale: Locale;
  password: string;
};

function b64(u: Uint8Array): string {
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 生成自解密 HTML 字符串(导出供测试;下载入口用 exportEncryptedBackupHtml)。 */
export async function buildEncryptedBackupHtml(input: EncryptedBackupInput): Promise<string> {
  const t = (key: Parameters<typeof translate>[1], ...args: unknown[]) =>
    translate(input.locale, key, ...args);

  // 加密:与保险库解锁密码同一套 KDF + 信封。
  const salt = generateWrappingSalt();
  const params = DEFAULT_ARGON2ID_PARAMS;
  const key = await deriveWrappingKey(input.password, salt, params);
  const { iv, ct } = await encrypt(key, new TextEncoder().encode(input.mnemonic));
  const payload = {
    v: 1,
    kdf: "argon2id",
    salt: b64(salt),
    params,
    iv: b64(iv),
    ct: b64(ct),
    vault: input.vaultName,
    url: input.url,
    createdAt: new Date().toISOString(),
  };

  // 内联 argon2 wasm bundle(同源静态文件,hash-wasm UMD,~29KB)。
  const res = await fetch("/argon2.umd.min.js");
  if (!res.ok) throw new Error(`argon2 bundle fetch failed: HTTP ${res.status}`);
  const argon2Src = await res.text();

  const S = {
    title: t("bk_title"),
    vaultLabel: t("pdf_name_label"),
    urlLabel: t("pdf_url_label"),
    phraseLabel: t("pdf_phrase_label"),
    prompt: t("bk_prompt"),
    btn: t("bk_btn"),
    decrypting: t("bk_decrypting"),
    wrong: t("bk_wrong"),
    offline: t("bk_offline_note"),
    risk: t("pdf_risk_1"),
  };

  // 模板:无外链、无网络请求;</script> 经 JSON 转义不会提前闭合。
  return `<!doctype html>
<html lang="${input.locale === "zh" ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(S.title)} · ${escapeHtml(input.vaultName)}</title>
<style>
  body { font: 16px/1.6 system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
         background: #111827; color: #E5E7EB; display: flex; justify-content: center; padding: 48px 16px; }
  main { width: 100%; max-width: 560px; }
  h1 { font-size: 20px; color: #fff; }
  .meta { color: #9CA3AF; font-size: 13px; margin: 4px 0 24px; }
  .card { background: #1F2937; border: 1px solid #374151; border-radius: 12px; padding: 20px; }
  input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px;
          border: 1px solid #4B5563; background: #111827; color: #fff; font-size: 15px; }
  button { margin-top: 12px; width: 100%; padding: 10px; border: 0; border-radius: 8px;
           background: #4F46E5; color: #fff; font-size: 15px; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  .err { color: #F87171; font-size: 13px; margin-top: 10px; }
  .note { color: #6B7280; font-size: 12px; margin-top: 16px; }
  ol { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 0; margin: 16px 0 0;
       list-style: none; counter-reset: w; }
  li { background: #111827; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px;
       font: 600 14px ui-monospace, Menlo, monospace; counter-increment: w; }
  li::before { content: counter(w) ". "; color: #6B7280; font-weight: 400; }
  .risk { color: #FCA5A5; font-size: 13px; margin-top: 16px; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(S.title)}</h1>
  <p class="meta">${escapeHtml(S.vaultLabel)}:${escapeHtml(input.vaultName)} · ${escapeHtml(S.urlLabel)}:${escapeHtml(input.url)}</p>
  <div class="card">
    <p style="margin-top:0">${escapeHtml(S.prompt)}</p>
    <input id="pw" type="password" autocomplete="off">
    <button id="go">${escapeHtml(S.btn)}</button>
    <p id="msg" class="err" hidden></p>
    <div id="out" hidden>
      <p style="margin:16px 0 0;color:#9CA3AF;font-size:13px">${escapeHtml(S.phraseLabel)}</p>
      <ol id="words"></ol>
      <p class="risk">${escapeHtml(S.risk)}</p>
    </div>
  </div>
  <p class="note">${escapeHtml(S.offline)}</p>
</main>
<script id="payload" type="application/json">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>
<script>${argon2Src}</script>
<script>
(function () {
  "use strict";
  var data = JSON.parse(document.getElementById("payload").textContent);
  var pw = document.getElementById("pw"), go = document.getElementById("go");
  var msg = document.getElementById("msg"), out = document.getElementById("out");
  var words = document.getElementById("words");
  var decryptingText = ${JSON.stringify(S.decrypting)};
  var wrongText = ${JSON.stringify(S.wrong)};
  function unb64(s) {
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  async function run() {
    if (!pw.value) return;
    go.disabled = true;
    msg.hidden = false;
    msg.textContent = decryptingText;
    try {
      var keyBytes = await hashwasm.argon2id({
        password: pw.value.normalize("NFKC"),
        salt: unb64(data.salt),
        memorySize: data.params.m,
        iterations: data.params.t,
        parallelism: data.params.p,
        hashLength: 32,
        outputType: "binary",
      });
      var key = await crypto.subtle.importKey("raw", keyBytes.slice().buffer, "AES-GCM", false, ["decrypt"]);
      var pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(data.iv).slice().buffer }, key, unb64(data.ct).slice().buffer);
      var mnemonic = new TextDecoder().decode(pt);
      words.innerHTML = "";
      mnemonic.split(" ").forEach(function (w) {
        var li = document.createElement("li");
        li.textContent = w;
        words.appendChild(li);
      });
      msg.hidden = true;
      out.hidden = false;
    } catch (e) {
      msg.textContent = wrongText;
    } finally {
      go.disabled = false;
    }
  }
  go.addEventListener("click", run);
  pw.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
})();
</script>
</body>
</html>`;
}

/** 加密并触发下载(浏览器事件回调中调用)。 */
export async function exportEncryptedBackupHtml(input: EncryptedBackupInput): Promise<void> {
  const html = await buildEncryptedBackupHtml(input);
  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  a.download = `keysark-backup-${input.vaultName || "vault"}-${date}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
