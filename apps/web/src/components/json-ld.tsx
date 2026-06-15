// 统一的 JSON-LD 注入组件:输出 <script type="application/ld+json">(数据块,非可执行脚本,
// 与现有 CSP 兼容,无需 nonce —— 落地页已用同一写法上线)。server/client 均可用(无 hook)。
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // 数据来自本应用常量/内容,非用户输入;JSON.stringify 转义,无 XSS 面。
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
