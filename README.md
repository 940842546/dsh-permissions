# dsh-permissions

中文 | [English](./README.en.md)

[![Awesome DSH Plugin](https://beancookie.github.io/awesome-dsh-plugin/badge.svg)](https://beancookie.github.io/awesome-dsh-plugin)
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）的 **Claude Code 风格权限规则引擎**。双面 Cordis 插件：宿主侧在 `tools/pre-execute` 瀑布上做拦截判定，浏览器侧提供 **设置 → 权限** 可视化编辑器。

## 亮点

- **四级规则、严格优先级**：`hard` > `deny` > `ask` > `allow`。
- **`hard` 高于全访问**：即使会话处于全访问档（审批策略 `never`），hard 规则依然拦截、不可豁免；`ask` 规则跟随会话策略，全访问下自动放行。
- **作用域**：`global` 规则全局生效；按 `workspace` 的规则叠加合并（冲突时 deny 永远胜出）。
- **通配符匹配**（文件类工具 `read`/`write`/`edit`/`glob`/`grep`/`read_image`）：
  - `write(*.pem)` —— 路径以 `.pem` 结尾
  - `write(*secret*)` —— 路径包含 `secret`
  - `write(.ssh)` —— 路径任意位置出现 `.ssh` 片段（大小写不敏感，`\`/`/` 统一归一化）
  - `write(C:\users\*)` —— 绝对路径前缀
  - 裸 `write` —— 该工具全部调用
- **持久化**：规则存于 `dsh-permissions` 设置命名空间，跨重启保留（`<harness home>/settings.yaml`）。
- **模型透明**：生效规则注入系统提示（`[active-permission-rules]` 段）。
- **可视化编辑器**：草稿式（staged）编辑——所有修改点「保存并应用」后才生效，附一键预设（保护敏感目录 / 密钥文件 / 拦截危险命令）。

## 规则语法

| 规则 | 含义 |
|---|---|
| `pwsh` | 该工具的全部调用 |
| `pwsh(npm run)` | 首参以 `npm run` 开头 |
| `write(*.pem)` | 文件路径以 `.pem` 结尾 |
| `write(*secret*)` | 文件路径包含 `secret` |
| `write(.ssh)` | 路径任意位置出现 `.ssh` 片段 |
| `pwsh(*)` | 全部调用（显式写法） |

非文件工具按首参原文做前缀匹配；`grep` 额外匹配其 `path` 参数。

## 安装

**方式 A —— 官方安装器（推荐）：**

```bash
dsh plugin add dsh-permissions
```

**方式 B —— 手工补丁行：** 把本仓库 [`cordis.patch.yml`](./cordis.patch.yml) 中的 `insert` 列表追加到你的 profile 补丁（`~/.dsh/cordis.patch.yml` 或 `~/.dsh/profiles/<profile>/cordis.patch.yml`），并确保包已安装到 profile 可解析的位置（`~/.dsh/node_modules/dsh-permissions`）：

```yaml
- insert:
    - id: permissions
      name: dsh-permissions
```

然后重启应用。**设置 → 权限** 页自动出现；引擎自带安全默认值（16 条 hard 规则保护 `.ssh` / `.aws` / `.gnupg` / `AppData` / `*.pem` / `*.key` / `*.env` / `*.htpasswd`，以及 `deny: pwsh(rm -rf *)`）。

## 权限设置页

- 引擎开关、三张一键预设卡、点选式规则构建器（动作 × 工具 × 匹配方式 × 参数 → 实时预览）、四个彩色规则面板。
- 所有修改先进入**草稿**：点「保存并应用」前不影响 AI 行为；「放弃修改」恢复上次保存状态。

## 安全说明

- 引擎只会**收窄**会话现有的沙箱/审批姿态：`allow` 只跳过本插件的询问，绝不绕过 DSH 沙箱或 `tools.guard` 守卫。
- 拦截以工具错误呈现给模型（`Error: 权限规则拒绝…`；hard 为 `硬规则拒绝（高于 full access，不可豁免）…`），模型可见完整规则原文，可据此改道。
- 设置页路由（`GET/POST /api/dperm/rules`）是命名空间所有者自建的端点——DSH api-proxy 的 settings 白名单刻意不暴露第三方命名空间。

## 开发与发布

见 [PUBLISH.md](./PUBLISH.md)：发布清单与本插件踩过的坑（客户端包 `exports` 必须含 `./package.json`；bundle 模块 id 必须等于包名；`useSyncExternalStore` 不能传未绑定方法引用等）。

## License

MIT
