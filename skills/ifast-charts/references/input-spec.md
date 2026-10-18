# 输入 JSON

完整、可运行的三图示例见 [examples/mock-data.json](../examples/mock-data.json)。示例全部是模拟数据。

顶层包含 `charts` 数组，可选 `theme`（默认 `ifast`）、`size`（默认 `medium`）。命令行参数覆盖这两个顶层默认值。

每张图的字段：

| 字段 | 含义 |
|---|---|
| `id` | 不重复的小写英文、数字、连字符；用于 SVG 文件名 |
| `sheet` | 可选工作表名，最多 31 字符，不能含 Excel 禁用字符 |
| `type` | `line`、`column`、`stacked_column` |
| `title` | 标题 |
| `x.type` | `date` 或 `category` |
| `x.values` | 日期为升序且不重复的 `YYYY-MM-DD`；类别为字符串。至少两个点 |
| `axes` | 1–2 个轴对象，每个有 `unit`；缺失单位显式写 `null` |
| `axes[].percent_fraction` | `true` 表示 0.05 要显示成 5%；默认 `false` 表示保留原数值（例如 5.0 表示 5%） |
| `series` | 每个序列有 `name`、`values`；可选 `axis`（0 左/1 右）、`color`（十六进制） |
| `source.label` | 来源简称，不要公开写入客户隐私或凭据 |
| `source.as_of` | 数据截止时点，未知写“未注明”；模拟数据写“不适用（模拟）” |
| `note` / `warning` | 必要口径说明 / 短提示 |

约束：

- 数值保持 JSON number。缺失值为 `null`，不写字符串 `"N/A"`、百分号或格式化千分位数字。
- 每个序列长度必须与横轴一致。列图只使用一个可比较的值轴。
- 堆积柱状图目前支持非负、完整数据；缺失值和负值应另选图型或由 Agent 明确处理，生成器会拒绝。
- 权重用小数并指定 `percent_fraction: true`；合计为 1 时自动采用 0–100% 范围。不会为了凑满 100% 偷改权重。
- 日期轴按真实日期间隔定位。月度对齐由 Agent 在输入 JSON 前完成并说明，生成器不静默求平均、排序或填充。
- 双轴应先写左轴序列、再写右轴序列，保持原生 Excel 分组与图例顺序一致。
- 超过默认配色数量时先分图；确需更多序列，逐条指定可区分颜色。
- 字体和图表规范归 `assets/standards.json`；新增配色仅创建 `assets/themes/<id>.json`。

输出 `normalized.json` 保存整理后的绘图数据与计算出的坐标轴，便于复核和重现；`manifest.json` 记录输入摘要和产物哈希。它们是本地输出，不会自动上传。
