// 统一的产品事件统计(Vercel Web Analytics 自定义事件)。
//
// 设计目标:
//   1. **唯一入口**:全站所有“操作事件”都走 `AnalyticsEvent` 枚举 + `trackEvent()`,
//      不允许在组件里散落裸字符串 `track("...")`。新增操作时,先往枚举里补一个成员。
//   2. **零敏感数据**:E2E 加密的铁律延伸到统计层 —— 助记词 / 明文内容 / 主密钥 /
//      解锁密码 / 条目标题 / 文件名 / 文件夹名 一律禁止进入事件属性。
//      `trackEvent` 通过 **键白名单 + 标量校验 + 长度上限** 做运行时兜底:任何不在
//      `ALLOWED_PROP_KEYS` 里的键、非标量值、超长字符串都会被静默丢弃,
//      即使调用方手滑也不会把敏感值发出去。
//
// 用法:`trackEvent(AnalyticsEvent.ItemSave, { isNew: true })`
import { track } from "@vercel/analytics";

/**
 * 全站操作事件枚举。值为 snake_case 的稳定事件名(发往 Vercel 的就是这个字符串),
 * 跨重构稳定,改名等于换了一个新事件,谨慎。按业务域分组。
 *
 * 新增任意用户操作时,**必须**在此补一个成员并在对应 handler 里 `trackEvent(...)`。
 */
export enum AnalyticsEvent {
  // —— 保险库生命周期 ——
  VaultCreate = "vault_create",
  VaultSelect = "vault_select",
  VaultUnlock = "vault_unlock", // 本机密码解锁
  VaultRecover = "vault_recover", // 助记词找回 / 首次接入
  VaultPasswordSet = "vault_password_set",
  VaultPasswordChange = "vault_password_change",
  VaultLock = "vault_lock",
  VaultAutolockSet = "vault_autolock_set",

  // —— 条目(文本/文件)——
  ItemCreate = "item_create",
  ItemOpen = "item_open",
  ItemEdit = "item_edit",
  ItemSave = "item_save",
  ItemDelete = "item_delete",
  FileUpload = "file_upload",
  FileDownload = "file_download",
  ItemMove = "item_move",

  // —— 文件夹 ——
  FolderCreate = "folder_create",
  FolderRename = "folder_rename",
  FolderDelete = "folder_delete",

  // —— 版本历史 ——
  VersionHistoryOpen = "version_history_open",
  VersionRestore = "version_restore",

  // —— 备份 / 同步 ——
  MnemonicGenerate = "mnemonic_generate",
  BackupPdfDownload = "backup_pdf_download",
  BackupHtmlDownload = "backup_html_download",
  SyncNow = "sync_now",

  // —— CLI ——
  CliDialogOpen = "cli_dialog_open",
  CliCommandCopy = "cli_command_copy",

  // —— 界面偏好 ——
  ViewModeChange = "view_mode_change",
  SortChange = "sort_change",
  ThemeChange = "theme_change",
  LanguageChange = "language_change",

  // —— 鉴权 / 存储后端 ——
  ConnectGoogle = "connect_google",
  ConnectBaidu = "connect_baidu",
  SignOut = "sign_out",
}

/**
 * 事件属性白名单 —— 只允许这些**非敏感、低基数**的标量描述维度。
 * 不在表内的键一律丢弃,从机制上杜绝把标题/文件名/明文塞进统计。
 */
const ALLOWED_PROP_KEYS = new Set([
  "provider", // "google" | "baidu"
  "view", // 视图模式
  "sort", // 排序方式
  "theme", // 主题
  "locale", // 语言
  "kind", // 条目类别:text | file 等
  "scope", // 操作范围:all | local 等
  "count", // 计数(条目数 / 版本数,纯数字)
  "minutes", // 自动锁定分钟数
  "isNew", // 是否新建
  "recovered", // 是否走找回路径
  "source", // 触发来源:button | menu | idle 等
]);

const MAX_STRING_LEN = 64;

export type EventProps = Record<string, string | number | boolean>;

/**
 * 把任意属性对象收敛成“可安全上报”的子集:键在白名单内、值为标量、字符串不超长。
 * 任何越界项静默丢弃 —— 宁可少报一个维度,也不冒泄露敏感数据的风险。
 */
function sanitize(props?: EventProps): EventProps | undefined {
  if (!props) return undefined;
  const out: EventProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (!ALLOWED_PROP_KEYS.has(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string" && v.length <= MAX_STRING_LEN) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * 上报一个操作事件。统计永远是“尽力而为”:任何异常都吞掉,绝不影响主流程。
 * 仅在浏览器端有效(Vercel Analytics 的 `track` 在服务端是 no-op)。
 */
export function trackEvent(event: AnalyticsEvent, props?: EventProps): void {
  try {
    const safe = sanitize(props);
    if (safe) track(event, safe);
    else track(event);
  } catch {
    /* 统计失败不应中断任何用户操作 */
  }
}
