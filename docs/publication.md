# 本地维护，在线浏览

在线地址：[ivandon15.github.io/peptide-atlas/](https://ivandon15.github.io/peptide-atlas/)。无需部署、登录或安装 Codex。网页提供筛选、时间轴、论文、合作和来源；补充资料通过 GitHub Issue，文件上传、归档及核验留在本地。

## 数据更新

1. 在本地按四个 skill 核对资料，通过 CLI commit 更新 SQLite。
2. 整理可以公开的记录及其全部引用到 `data/pilot.json`。这是发布范围，不是把本地 state 整体复制出来。范围外实体不会被自动带出。
3. 导出快照。默认不带观察；逐项确认可以公开时再指定 ID：

```sh
.venv/bin/python atlas.py export-public data/public/snapshot.json \
  --observation az-discovery-delivery-platforms \
  --observation design-outcomes-are-method-specific \
  --observation design-to-invivo-requires-context
```

4. 审阅 `git diff -- data/`，确认只有允许公开的研究内容。运行 `npm test`、`npm run build:public`，再提交并推送项目仓库。

线上界面获取项目 main 分支的最新快照，无需每次重新部署博客。新打开页面或点击“读取最新数据”即可读取；GitHub 的 CDN 可能需要几分钟刷新。远端暂不可用时回退到部署时的快照，并显示提示和发布时间。

## 隐私边界

`export-public` 只读取数据库，不写回事实。它按公开基线限定实体，再按字段及嵌套字段白名单导出，校验引用闭合，排除：

- SQLite、查询回执/响应、上传原件、核验记录和修订历史；
- 本地路径、文件指纹、个人备注、作者身份与本地 revision；
- 未明确选定的观察，以及已归档或已解决的问题。

来源必须为无凭据的 HTTPS URL；疑似个人地址、路径、密钥或内部内容会中止导出。自动检查不保证能识别所有商业机密；维护者仍需审阅文本和来源。不要将内部资料或任职背景写进公共研究记录。

## 界面更新与首次部署

`npm run build:public` 构建到忽略 Git 的 `dist-public/`，默认路径 `/peptide-atlas/`。公开界面不会请求 `/api/`，不提供上传、归档和私人修订历史。

个人博客仓库的 Pages workflow 在 Jekyll 构建后检出 PeptideAtlas 的 main 分支，构建公开版并放入已构建站点的 `/peptide-atlas/`。博客原有页面、配置与文章保留，侧栏新增项目入口。

界面代码更新后，在个人博客仓库 Actions 运行 **Build and Deploy**，或推送博客更改以触发部署。普通数据更新只推送 PeptideAtlas 中经审阅的快照即可。

构建环境可设 `ATLAS_PUBLIC_BASE` 指定子路径、`VITE_ATLAS_DATA_URL` 指定公开快照 URL；两者不应指向私有服务或带密钥的地址。不设数据 URL 时读取构建附带的同目录 snapshot.json，便于离线预览。
