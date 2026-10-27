# 架构与代码地图

## 一条数据链

```text
公开论文 / 专利 / 登记 / 公司披露
        ↓ 使用者的 agent 执行四个 skill
结构化事实 + 来源定位 + 待核实问题
        ↓ atlas.py commit：版本检查、关联校验、事务
本地 SQLite：当前事实 + 修改历史
        ↓ API / 显式材料提交及归档
React：总览、靶点、分子进度、公司合作、问题
```

`collect` 只发现 Europe PMC / ClinicalTrials.gov 候选及真实回执；skill 指导补查专利、产业、方法与原文。网页不自动把候选提升为事实，也不根据统计量生成观察。

## 文件职责

| 路径 | 职责 |
| --- | --- |
| `atlas.py` | CLI 路由、研究事实提交入口 |
| `server/store.py` | SQLite、记录/跨记录校验、原子提交、历史、指纹与审阅闭环 |
| `server/research.py` | 查询计划、有限分页采集与失败/截断回执 |
| `server/http.py` | 本地 HTTP API、静态资源和上传边界 |
| `run.mjs` | 选择 Python，启动/停止 API 与开发前端 |
| `src/main.tsx` | 应用状态、页面切换、分子详情及材料/问题交互 |
| `Overview.tsx` / `summary-data.ts` | 库内观察、统计及上海自然日近期判断 |
| `TargetCatalog.tsx` / `explore.ts` | 靶点目录、过滤与排序 |
| `ProgressBoard.tsx` / `progress.ts` | 分子泳道、谱系、事件和进度锚点 |
| `ComputationalTarget.tsx` / `research-view.ts` | 论文归档及研究分类 |
| `Partnerships.tsx` / `business.ts` | 公司与事件过滤、角色、日期和金额 |
| `src/model.ts` | 前端类型与标签 |
| `.agents/` | 四个 skill 与共享科学/数据约束 |
| `data/pilot.json` | 可审阅、可分发的公开初始基线 |
| `tests/` | 临时库、HTTP边界与纯前端逻辑回归 |
| `scripts/check.mjs` | 全部检查，不访问真实研究库 |
| `package_source.py` | 允许列表源码打包 |

表中前端组件和辅助文件均在 `src/` 下。

## 轻量数据库

没有数据库服务器或 ORM。Python 标准库 sqlite3 管理一个文件，JSON 记录按 `(kind, id)` 存储：

- `documents`：靶点、公司、来源、系列、分子、证据、关系、交易、问题、回执、审阅和观察。
- `history`：每次修改前后记录、提交 ID、执行者与时间。
- `meta`：本地 revision。
- `uploads`：上传任务与指纹；原件存为 `uploads/<sha256>`，不塞进 SQLite。

读取使用同一快照；写入使用 BEGIN IMMEDIATE，检查 baseRevision 后整批校验和提交。失败回滚，旧版本提交拒绝。相关事实修改使未复核观察变为 needs-review。

完整记录替换及引用规则由 store.py 执行；[共享协议](../.agents/references/research-contract.md)解释科学含义。未确认阶段、结构、谱系和合同条款保留未知。UI 不修改事实。

当前前端一次读取本地状态，在客户端筛选。尚未做万级真实资料压测，不宣称支持多人在线编辑；扩大规模前先测量瓶颈。
