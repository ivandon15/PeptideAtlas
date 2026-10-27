# 多肽公开基线扩展 · 2026-10-26

当前本地库 revision 62：40 个靶点/靶点组、87 个分子身份、22 项商业事件。新增 70 个分子和 16 项商业事件。

这是首轮扩展与候选发现，不是全球全量调研已完成。靶点中的SSTR/Amylin等为明确注明的受体家族/复合物组；跨靶点药物只有一个稳定分子ID。

## 本轮已执行

- 41项定向药品名检索，39个活性成分完成美国SPL标签的身份、机制与获批基线核查；一项检索未找到合适标签、一项机制未定不强行映射。不同品牌/剂型和生物类似药不重复计核心分子。
- 40个靶点各执行Europe PMC与ClinicalTrials.gov查询，窗口为近36500天（约1926年至今），每接口最多3页×100。不是论文全历史穷尽，也不是所有登记都与多肽有关。
- 原80条接口回执：{'partial': 31, 'success': 47, 'failed': 2}；其中31条有后续页。GIPR登记请求400后改英文成功取回第一页；PTH1R文献503单次重试另记，原失败不删除。
- 原始候选按DOI/来源ID及NCT号去重：7673条文献、4459条登记。它们仍待相关性与原文核验，未直接写成新药或实验事实。
- 读取美国标签、原始论文/XML、具名临床记录、公司公告和SEC相关段落；补入RFpeptides计算起源+SPR/晶体、TK7筛选与生化活性、ATSP动物递送及BMS-986189 800g API工艺等证据。
- 交易包括Roche–Zealand、Roche–Carmot、Bicycle–Novartis/Bayer/Genentech、翰森–Regeneron、石药–AstraZeneca、Protagonist–Takeda、Apellis–Sobi、恒瑞–Kailera、Gubra–AbbVie与联邦–Novo。原始签约/公告、实付、修订及收购价分开；未读完的后续合同留缺口。
- 四项专利家族/制剂线索保留pending；未因同公司/靶点而强行映射到临床代码。SYH2086原公告明确非肽小分子，作为排除记录，不进入多肽资产/交易计数。
- 同名大小写重复的Apellis、Eli Lilly、Novo主体按精确名称归一；历史导入ID保留canonicalCompanyId与审计，未把集团与法律子公司合并。

## 尚未完成

- 全球靶点与公司宇宙仍需扩展：本轮40组不是多肽可作用靶点的总数，美国标签也不涵盖中国及其他地区全部获批肽。
- 批量候选尚未全部分类/阅读；截断查询剩余页、专利申请人反查、会议/SI编号和失败分子、序列/桥连/动物/SAR、CMC及2026年全部商务后续仍待逐项补齐。
- RFpeptides正文已取得并阅读相关段落，Supplementary Tables 1–4的全部设计/合成失败/实验候选还未逐行枚举。未知发现路线保留unknown，不推断为计算或筛选。
- ALRN-6924记录的是直接核实的I期和2023年公司终止；原I/II研究扩展部分的实际最高阶段尚未核实，不能用RP2D推定已完成II期。
- GtoPdb下载入口需要登录，官方REST也明确需要API key，实际请求401；没有导入其全库或绕过限制。Jev仍未配置，科学判断来自本轮Codex原文核查。
- 无定时任务或脱离当前会话继续审阅的服务。后续运行应优先消费候选/截断回执与现有gaps，避免重复采集。

## 靶点覆盖（已入库分子下界，不是全球总量）

| 靶点/组 | 已入库分子 | 本轮新增 |
|---|---:|---:|
| Amylin receptors | 5 | 5 |
| BDKRB2 | 1 | 1 |
| CD137 / TNFRSF9 | 1 | 1 |
| CXCR4 | 1 | 1 |
| CaSR | 1 | 1 |
| CaV2.2 / CACNA1B | 1 | 1 |
| Complement C3 | 1 | 1 |
| Complement C5 | 1 | 1 |
| EPHA2 | 1 | 1 |
| Ferroportin / SLC40A1 | 1 | 1 |
| GABARAP | 2 | 2 |
| GABARAPL1 | 1 | 1 |
| GCGR | 5 | 5 |
| GHRHR | 1 | 1 |
| GIPR | 8 | 8 |
| GLP1R | 15 | 15 |
| GLP2R | 4 | 4 |
| GNRHR | 5 | 5 |
| GUCY2C / GC-C | 2 | 2 |
| IL23R | 9 | 0 |
| INSR | 2 | 2 |
| Integrin α4β7 | 1 | 1 |
| Integrin αIIbβ3 | 1 | 1 |
| KRAS / RAS | 6 | 0 |
| Kv1.3 / KCNA3 | 2 | 2 |
| MC1R | 1 | 1 |
| MC4R | 2 | 2 |
| MCL1 | 1 | 1 |
| MDM2 | 3 | 3 |
| MDM4 / MDMX | 2 | 2 |
| NECTIN4 | 2 | 2 |
| NPR2 / NPR-B | 1 | 1 |
| OPRK1 / KOR | 1 | 1 |
| PCSK9 | 2 | 0 |
| PD-L1 / CD274 | 2 | 2 |
| PTH1R | 3 | 3 |
| RbtA（A. baumannii） | 1 | 1 |
| Somatostatin receptors | 3 | 3 |
| TNIK | 1 | 1 |
| Thrombin / F2 | 1 | 1 |

公共种子只合入本轮公开事实与短摘要；原有私有上传、审阅、数据库和候选原始响应均不进入源码包。每条来源的readScope注明本次实际阅读范围。
