// OS keystore 接入:把敏感/需抗篡改的小值存进操作系统安全存储,而非 ~/.keysark 明文文件。
//   - macOS  : 登录钥匙串(security generic-password,受登录密码保护)。
//   - Linux  : Secret Service / libsecret(secret-tool;GNOME Keyring、KWallet 等)。
//   - Windows: DPAPI(ProtectedData,CurrentUser 绑定;受保护 blob 仍落盘但仅本用户可解)。
//   - 其它/工具缺失:无可用 keystore → 上层各自降级(禁缓存 / 退回仅缓存比较)。
// 用途:① device key(解锁缓存的对称密钥);② 每库已接受的最新 index rev(回滚锚点)。
// 零原生依赖:只 shell out 到各 OS 自带 CLI。后端值统一为字符串。
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RevAnchor } from "@keysark/vault";

const SERVICE = "keysark";
const KEY_LEN = 32;
const DEVICE_KEY_ACCOUNT = "device-key";

export type KeystoreBackend = "keychain" | "secret-service" | "dpapi";

/** 后端工具不存在(spawn ENOENT)时抛此错 → 调用方据此判定「无可用 keystore」。 */
class KeystoreUnavailable extends Error {}

/** 字符串值的 keystore 后端(按 account 区分条目)。 */
interface Backend {
  name: KeystoreBackend;
  get(): string | null; // 命中返回存的字符串;不存在 null;工具缺失抛 KeystoreUnavailable
  set(value: string): void;
  remove(): void;
}

/** execFileSync 包装:ENOENT(工具缺失)→ KeystoreUnavailable;其它非零退出 → 原样抛。
 *  silent=true:连 stdout 也丢弃(写入类命令不读输出),彻底挡住 `security` 的
 *  "password data for new item" 交互提示等冒到终端。 */
function run(
  cmd: string,
  args: string[],
  opts: { input?: Buffer; env?: NodeJS.ProcessEnv; silent?: boolean } = {},
): Buffer {
  try {
    return execFileSync(cmd, args, {
      input: opts.input,
      env: opts.env ?? process.env,
      stdio: ["pipe", opts.silent ? "ignore" : "pipe", "ignore"],
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new KeystoreUnavailable(cmd);
    throw e;
  }
}

// ---------- macOS 登录钥匙串 ----------
function macKeychain(account: string): Backend {
  const self: Backend = {
    name: "keychain",
    get() {
      try {
        const out = run("security", ["find-generic-password", "-s", SERVICE, "-a", account, "-w"]);
        const s = out.toString("utf8").trim();
        return s || null;
      } catch (e) {
        if (e instanceof KeystoreUnavailable) throw e;
        return null; // 退出码 44 = item not found
      }
    },
    set(value) {
      // -U:已存在则更新。-w 不带值 → security 交互式读「值 + 重输」两行;从 stdin 喂两遍,
      // 让值绝不出现在 argv(否则同机其它用户能在那一瞬用 `ps` 抓到 device key)。
      // 值不含换行(base64 / 十进制),故 "v\nv\n" 解析无歧义。
      run("security", ["add-generic-password", "-U", "-s", SERVICE, "-a", account, "-w"], {
        input: Buffer.from(`${value}\n${value}\n`, "utf8"),
        silent: true, // 丢弃 security 的交互提示输出,不冒到终端
      });
      // security 即便「两次不一致」也返回 0(什么都没存),故写后回读校验。
      if (self.get() !== value) throw new KeystoreUnavailable("keychain write unverified");
    },
    remove() {
      try {
        run("security", ["delete-generic-password", "-s", SERVICE, "-a", account]);
      } catch (e) {
        if (e instanceof KeystoreUnavailable) throw e;
        /* 不存在即无需删 */
      }
    },
  };
  return self;
}

// ---------- Linux Secret Service (libsecret) ----------
function linuxSecretService(account: string): Backend {
  return {
    name: "secret-service",
    get() {
      try {
        const out = run("secret-tool", ["lookup", "service", SERVICE, "account", account]);
        return out.toString("utf8").trim() || null;
      } catch (e) {
        if (e instanceof KeystoreUnavailable) throw e;
        return null; // lookup 未命中 → 非零退出
      }
    },
    set(value) {
      // secret-tool store 从 stdin 读 secret(非 TTY 时不回显提示)。
      run("secret-tool", ["store", `--label=keysark ${account}`, "service", SERVICE, "account", account], {
        input: Buffer.from(value, "utf8"),
        silent: true,
      });
    },
    remove() {
      try {
        run("secret-tool", ["clear", "service", SERVICE, "account", account]);
      } catch (e) {
        if (e instanceof KeystoreUnavailable) throw e;
      }
    },
  };
}

// ---------- Windows DPAPI(受保护 blob 落盘,绑定当前用户) ----------
// 没有合适的纯 CLI 存储,故用 PowerShell ProtectedData 加密后写 <account>.dpapi。
// blob 仍在 ~/.keysark,但只有同一 Windows 用户能 Unprotect → 拷到别处/别人解不开。
function winDpapi(blobPath: string): Backend {
  const ps = (script: string, env: NodeJS.ProcessEnv) =>
    run("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { env }).toString("utf8").trim();
  return {
    name: "dpapi",
    get() {
      if (!existsSync(blobPath)) return null;
      const blob = readFileSync(blobPath, "utf8").trim();
      if (!blob) return null;
      const b64 = ps(
        "Add-Type -AssemblyName System.Security;" +
          "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect(" +
          "[Convert]::FromBase64String($env:KS_BLOB),$null,'CurrentUser'))",
        { ...process.env, KS_BLOB: blob },
      );
      return Buffer.from(b64, "base64").toString("utf8") || null;
    },
    set(value) {
      const blob = ps(
        "Add-Type -AssemblyName System.Security;" +
          "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect(" +
          "[Convert]::FromBase64String($env:KS_VAL),$null,'CurrentUser'))",
        { ...process.env, KS_VAL: Buffer.from(value, "utf8").toString("base64") },
      );
      writeFileSync(blobPath, blob, { mode: 0o600 });
    },
    remove() {
      rmSync(blobPath, { force: true });
    },
  };
}

/** 某 account 在当前平台的后端;不支持的平台返回 null(无可用 keystore)。
 *  blobDir:Windows DPAPI 的受保护 blob 落点目录(其它平台忽略)。 */
function backendFor(account: string, blobDir: string): Backend | null {
  switch (process.platform) {
    case "darwin":
      return macKeychain(account);
    case "linux":
      return linuxSecretService(account);
    case "win32":
      return winDpapi(join(blobDir, `${account}.dpapi`));
    default:
      return null;
  }
}

/**
 * 取(或首次创建)device key,仅经 OS keystore。命中即返回,否则新建随机 key 存入。
 * 无可用 keystore(不支持的平台 / 工具缺失)→ 返回 null,调用方据此禁用解锁缓存。
 * 不再落明文文件回退:避免 key 与它保护的缓存同处 ~/.keysark、被「拷目录」一并带走。
 */
export function loadOrCreateDeviceKey(blobDir: string): { key: Buffer; backend: KeystoreBackend } | null {
  const backend = backendFor(DEVICE_KEY_ACCOUNT, blobDir);
  if (!backend) return null;
  try {
    const existing = backend.get();
    if (existing) {
      const buf = Buffer.from(existing, "base64");
      if (buf.length === KEY_LEN) return { key: buf, backend: backend.name };
      // 长度异常(损坏)→ 重建
    }
    const key = randomBytes(KEY_LEN);
    backend.set(key.toString("base64"));
    return { key, backend: backend.name };
  } catch (e) {
    if (e instanceof KeystoreUnavailable) return null; // 如无 libsecret 的精简 Linux
    throw e;
  }
}

/** 彻底清除 device key:keystore 条目 + 历史遗留明文文件都删。 */
export function deleteDeviceKey(blobDir: string, legacyFilePath: string): void {
  const backend = backendFor(DEVICE_KEY_ACCOUNT, blobDir);
  if (backend) {
    try {
      backend.remove();
    } catch {
      /* 工具缺失或条目不存在,忽略 */
    }
  }
  rmSync(legacyFilePath, { force: true }); // 清掉旧版本可能留下的明文 device.key
}

/**
 * 每库「已接受的最新 index rev」可信锚点(存 OS keystore)。
 * CLI 的本地缓存是内存级(进程退出即清),靠它无法跨进程检出回滚;keystore 锚点持久且抗篡改,
 * 是 CLI 唯一的回滚检测来源。keystore 不可用 → get 返回 null、bump 静默(退回无锚点)。
 * 仍堵不住「全新机器首次就被喂旧版本」(无基线)——这是固有限制。
 */
export function makeRevAnchor(vaultId: string, blobDir: string): RevAnchor {
  const backend = backendFor(`rev-${vaultId}`, blobDir);
  const read = (): number | null => {
    if (!backend) return null;
    try {
      const s = backend.get();
      if (!s) return null;
      const n = Number.parseInt(s, 10);
      return Number.isInteger(n) && n >= 0 ? n : null;
    } catch {
      return null; // KeystoreUnavailable 等 → 视为无锚点
    }
  };
  return {
    get: read,
    bump(rev) {
      if (!backend) return;
      const cur = read();
      if (cur !== null && rev <= cur) return; // 单调:只增不减
      try {
        backend.set(String(rev));
      } catch {
        /* keystore 不可用 → 静默(回退仅缓存比较) */
      }
    },
  };
}
