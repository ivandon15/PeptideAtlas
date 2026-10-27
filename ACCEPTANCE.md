# 发布检查

适用于 GitHub 分发的本地版本；不等同于公网多用户服务验收。

- `npm ci` 从 lockfile 安装依赖，`npm run build` 完成类型检查和生产构建。
- `ATLAS_PYTHON=.venv/bin/python npm test` 执行全部 Python / JavaScript 检查。
- 公开种子在临时库中通过同一事务与引用校验；不包含原始响应、上传、私人观察或审阅记录。
- 新安装可浏览公开基线；已有库启动不覆盖研究、上传、归档和历史。
- HTTP 仅监听回环地址，拒绝外部 Host / 跨站请求，路径穿越不能读取源码和数据库。
- PDF 格式检查不代替身份与科学核验；关闭问题仍须审阅依据。
- 源码包和 Git 只含公开文件；SQLite、原文、密钥和构建产物不入库。
- 启动示例可执行；网页总览、计算论文、分子时间轴、合作筛选和问题可访问。

CI 见 [.github/workflows/ci.yml](.github/workflows/ci.yml)。旧版实现过程保存在[历史记录](docs/history/implementation-notes.md)，其中数量和界面说明仅适用于对应历史版本。
