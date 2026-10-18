---
name: ifast-charts
description: 按统一金融研究图表规范生成 HTML、SVG 和原生可编辑 XLSX，支持 iFAST 或自定义配色主题、三档厘米尺寸、年度日期刻度、双轴和中文大数单位。用于有数据的图表制作与批量导出；不负责取数、投资判断或 PPTX。
---

# iFAST Charts

把用户提供的数据整理成可追溯、可编辑的图表。默认同时输出 HTML、逐图 SVG 和 XLSX。自带便携生成器支持折线图、分组柱状图和非负堆积柱状图；其他图型另选工具，不能把图片插入 Excel 后称为原生图表。

## 数据处理

先读取表头、单位、频率、日期、空值、公式及截止时点，再选择图型和左右轴。遵守用户确认的数据口径，不重新取数或替换序列，除非用户要求。

- 未提供真实数据时，只能使用明确标注的模拟数据。
- 不将缺失值补为 0，不静默插值或回填，不从截图猜出精确数据。
- 按月份对齐不同交易日/日历月末时，说明对齐规则，保留输入文件。整理不等于求均值或换算单位。
- 未确认的单位显示“未注明”；未来日期、未完结月份、源表公式缓存等疑点保留说明。不要默认认为原表标签就证明完整统计期。
- 同单位且可比较的系列优先共轴；不同单位或量级导致信息无法辨认时合理分左右轴，并在图例说明归属。两轴都包含 0，不用双轴暗示相关性。

## 统一格式

规范来源为 [assets/standards.json](assets/standards.json)，配色为 [assets/themes/ifast.json](assets/themes/ifast.json)。用户明确要求优先。

- HarmonyOS Sans SC 或其 Light 体；正文通常 9 磅，标题 12 磅加粗。SVG/HTML 对应 12/16 px。不打包或擅自下载字体；缺少字体时说明并确认替代，不能把声明字体当成实际渲染验证。
- 大号 19×9 cm、中号 13×9 cm、小号 9×6 cm，默认中号。尺寸是图表外框，不是工作表或页面尺寸；保持字体物理大小。
- 图例位于底部、居中对齐，系列名称、颜色、线型和顺序正确；宽度不足时换行，不缩小字体硬塞。
- 日期轴使用真实日期，每年 1 月 1 日显示主刻度线；不能用每 12 行代替一年。类别图按类别显示。小号可用两位年份标签，每年刻度仍保留。
- 所有纵轴包含 0，按当前数据自适应 min/max/step，标签 4–7 个、目标 6 个。柱状图保留零基线，合计 100% 的配置图固定 0–100%。
- 纵轴轴名只有单位，如“倍”“%”“点/Pts”。单位横排放在对应纵轴上方，与刻度同色。Excel 内可用跟随图表的可编辑文本框实现。
- 最大绝对轴值超过 10 万时，从万/百万/亿/万亿选择显示单位，只缩放显示，不修改绘图数据。左右轴独立处理。
- XLSX 只包含成图工作表；每页有原生图表和它直接引用的可编辑绘图数据，不额外复制原始数据源 Sheet。
- 保留来源、截止时点及必要的口径说明；白底、浅灰网格、克制配色，无三维和装饰渐变。

## 执行

1. 将整理后的数据写为规范 JSON，见 [references/input-spec.md](references/input-spec.md)。以源数据复核每个序列的日期、数值和单位。不得把示例模拟值混入真实输出。
2. 运行生成器（Node.js 18+，Python 3.10+；导出 XLSX 需要 XlsxWriter）：

   ```text
   python -m pip install -r <skill>/requirements.txt
   node <skill>/scripts/render.mjs --spec <chart-spec.json> --out <output-directory>
   ```

   可选 `--size large|medium|small`、`--theme <theme-id-or-json-path>`、`--formats html,svg,xlsx`、`--python <python-executable>`。已有目标文件时，在用户授权修改范围内使用 `--overwrite`。
3. 有 Windows Excel 时，运行 [scripts/polish-excel.ps1](scripts/polish-excel.ps1)，精确设置单位、厘米尺寸和标题位置，并导出原生预览：

   ```text
   powershell -NoProfile -File <skill>/scripts/polish-excel.ps1 -OutputDirectory <output-directory>
   ```

   不需要管理员权限，由宿主处理运行权限。其他系统可保留便携导出的原生图表，须在目标 Office/LibreOffice 中验收，不能声称完成了 Excel 实机验证。
4. 运行结构与数据检查，再按 [references/acceptance.md](references/acceptance.md) 验收显示效果：

   ```text
   python <skill>/scripts/verify.py <output-directory>
   ```

   结构检查不证明字体、排版或 Office 显示效果。
5. 交付文件与验证结论，说明尚未验证项。HTML/SVG 是快照；Excel 曲线随绘图数据更新，数据量级大变后需重新计算步长以保持 4–7 个标签。不能宣称三格式无损互转或自动同步。

## 扩展主题

复制 `assets/themes/ifast.json` 为新主题 JSON，修改名称、颜色和来源说明。保留 iFAST 主题。颜色改变不应悄悄改变统一的尺寸、字体、轴与数据规则。

使用本 Skill 不包含把输入数据、输出图表或字体上传到公共服务的授权。
