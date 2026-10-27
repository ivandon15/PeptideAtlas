---
name: peptide-intelligence-synthesis
description: 综合本仓库已核实的多肽靶点与公司合作事实，对比历史形成方向观察、可迁移技术和机会假设，并保存带依据与限制的观察；不代替原始资料调研或材料核验。
---

# 多肽情报综合与观察

回答：哪些信息放在一起改变了我们对多肽技术和产业方向的理解？结论在哪些条件下成立，接下来查什么？先读[共享数据协议](../../references/research-contract.md)，在含 atlas.py 的根目录工作。

## 输入与边界

读取 `python3 atlas.py state`，限定本次截止日期、主题/对象和实际覆盖范围；读取相关 active / needs-review / superseded 观察，以及 `python3 atlas.py history observations ID`。首次综合建立基线，增量综合对照上一次观察和关联事实的 history；没有可比历史就描述当前结构，不制造“增长”或“转向”。

只把 reviewed + reported 的 evidence 及有原始来源的 deals 当事实支点。读来源实际范围、同文多靶点与负面/失败结果，先检查来源是否同事件转载或同论文版本。聚合数量可以辅助理解，但不把收录密度当市场份额、不把未收录当机会空白、不把潜在交易额当实际支出。

需要补查新的技术或商业事实时，分别交给[靶点调研](../peptide-target-research/SKILL.md)或[公司合作调研](../peptide-company-research/SKILL.md)。有用户新材料先交给[材料核验](../peptide-evidence-update/SKILL.md)。不是为了写一条观察强制重跑两个完整专题。

## 综合方法与输出

围绕证据中真正发生的联系选择问题，不要求凑齐固定数量或每个主题：
- 技术：发现/设计、验证、递送和CMC哪些环节限制转化；其他领域的方法具备哪些迁移前提，实验和计算证据是否支持？
- 产业：公司是在获取具体资产、持续发现能力、制造或递送能力？签约、履行、资本参与、权利回归及停止研发是否改变先前解释？
- 机会：把潜在空隙写成可检验假设，列出另一种解释、反证和最有区分力的下一条证据；不因漂亮论文或单笔交易推断必然临床/商业成功。

每条 observation 使用简洁中文，默认展示标题和已知事实 summary；interpretation 明确是推断，uncertainty 写关键限制/反证，nextCheck 写可执行验证问题，coverage 写本轮边界。所有具体断言能沿 sourceIds + evidenceIds/dealIds 回到来源与定位；同一观察更新原ID，推翻则保留历史并置 withdrawn，被更具体观察替代则 superseded，不反复新增同义结论。

按数据协议的 observations 格式，经 `atlas.py commit .data/patch.json` 保存；basedOnRevision 为实际读取的数据库版本，author 写实际执行者，不冒充用户审核。更新后读 state/history，确认只改预期观察。相关事实被修改时系统将旧观察标 needs-review；复核后更新同ID、截止日期与依据，才能恢复 active。无足够依据可不发表结论，保留待验证问题，不能生成无引用的“当前观察”。

## 与网页的关系

网页只读已保存的 observations，做排序、展开和引用跳转；不由卡片数量自动编出行业判断。本 skill 不启动定时任务、不自动调用外部agent，也不修改科学阶段来迎合结论。完成时报告新增/修订/撤回的观察ID、依据和仍未覆盖的部分。
