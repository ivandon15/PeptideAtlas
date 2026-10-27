# 运行、备份与发布

## 配置

先按 [README](../README.md) 安装和构建。`npm start` 提供构建后的界面及 API；`npm run dev` 启动 Vite 和同一本地 API。退出用 Ctrl+C。

| 配置 | 默认 | 作用 |
| --- | --- | --- |
| ATLAS_PYTHON | python3 | 安装了 pypdf 的 Python |
| ATLAS_API_PORT | 8766 | API 与开发代理端口 |
| PEPTIDE_DATA_DIR | 仓库内 .data/ | 私有数据库、原始响应和上传 |

CLI 的 --data-dir 在子命令之前：

```sh
.venv/bin/python atlas.py --data-dir /absolute/private/path state
```

Windows PowerShell：

```powershell
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
npm ci
npm run build
$env:ATLAS_PYTHON = '.venv\Scripts\python.exe'
npm start
```

访问 http://127.0.0.1:8766/api/health 应返回 ok: true。健康状态不证明资料已更新到今天。

## 数据与更新

```text
.data/
  atlas.sqlite3       当前记录与修改历史
  raw/                查询原始响应
  uploads/<sha256>    人工补充材料
```

agent 还可在私有目录保存临时查询结果。整个目录均不进入 Git。

首次运行导入公开基线；已有库不被新版种子覆盖。代码更新后，如需同步事实，让自己的 agent 比对公共记录与当前库，核对差异后通过带本地 revision 的更新包提交。没有自动跨用户同步。

“重新读取”只重载本地库；研究须显式调用 skill。近五天按上海时区今天及前四个自然日的事件/公开日期计算，不按核查或录入日。

## 备份与恢复

先停服务、等待研究提交完成，再将**整个数据目录**复制到私有备份位置，包括 SQLite、上传和原始响应。源码包不能替代备份。

恢复时保留原目录作为退路，将备份复制到新的私有目录，用 PEPTIDE_DATA_DIR 指向它启动；核对 revision、资料和问题状态后再用。不要删除正在使用的原库。

## 发布范围

- GitHub 提供源码、研究流程、公开基线及协作入口，个人博客托管只读界面。
- package_source.py 按允许列表生成源码包，不含私有数据、依赖或构建产物。
- dist/ 是依赖本地 API 的维护版；`npm run build:public` 生成无需 API 的 dist-public/，读取经过筛选的 JSON 快照，详见[发布说明](publication.md)。
- 在线版无上传或写库，本地 API 不作为公网可写服务；见 [SECURITY.md](../SECURITY.md)。

## 常见问题

**前端尚未构建**：执行 npm run build；开发模式访问 5180。

**端口占用**：关闭自己的旧实例，或在同次启动中设置 ATLAS_API_PORT；不要停止不属于本项目的进程。

**PDF 无法检查**：服务需使用安装了 requirements.txt 的 Python。格式通过仍不是身份/科学核验通过。

**版本冲突**：重新读取 state，核对受影响记录并重做更新包。不能只改 revision 就强行提交。

**新安装没有当前观察**：私人观察不随种子分发；让综合 skill 根据自己的库生成即可。
