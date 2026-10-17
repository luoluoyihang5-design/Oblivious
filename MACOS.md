# macOS 适配

## 已实现

- 共享右键休眠、可选自动休眠、桌宠、按文本自适应尺寸的透明气泡、四栏设置和台词编辑界面。招手暂时停用，代码保留。
- ChatGPT 打开/隐藏：本地 JXA 调用 AppKit 的 NSRunningApplication，未运行时通过系统 open 启动。参数以数组传递，不拼接脚本。
- 自动定位 com.openai.chat 或名为 ChatGPT 的运行应用，也可以在设置中选择自己的 ChatGPT.app。
- 原生菜单栏“知知”入口、Dock 中的设置窗口、Spaces / 全屏空间中的桌宠与气泡。
- 原生应用/编辑/窗口菜单，保留 Cmd+Q、复制粘贴等系统快捷键，界面字体优先采用系统字体。
- 打包版登录启动，采用 macOS 自己的登录项设置。
- 额度读取自动寻找 /Applications/Codex.app、/Applications/ChatGPT.app、用户 Applications 中的对应应用以及 PATH 中的 Codex CLI；无需 Windows PowerShell。
- 偏好使用 Electron 的用户数据目录，Windows 与 Mac 各自保存。

## 本地运行

安装 Node.js 22.12 或更新版本，在本目录执行：

```sh
npm ci
npm start
```

## 生成 .app 与 ZIP

在 Mac 上运行：

```sh
bash macOS-build.command
```

默认构建当前机器架构。也可分别运行：

```sh
npm run build:mac -- arm64
npm run build:mac -- x64
```

输出在 dist 中，包括 .app 和相应架构的 ZIP。把 .app 放到“应用程序”后打开；配额需要安装并登录 Codex。程序选择、登录启动和本地窗口控制无需填入 API Key。

构建脚本执行本地 ad-hoc 签名和签名验证，并用 ditto 打包以保留 .app 权限及符号链接。没有 Developer ID 或 Apple 公证，不是已公证发行版。首次打开遵循 macOS 的系统确认流程，不要关闭系统安全保护。

源码还提供 .github/workflows/build-macos.yml，只允许手动运行，分别生成 arm64 / x64 构建产物。保存项目到仓库不会自动构建或发布版本；本次不触发远端工作流。

项目源码：https://github.com/luoluoyihang5-design/Oblivious 。正式项目名称和 README 尚待确定。

登录启动需将打包应用放入“应用程序”。系统可能拒绝未正确签名/公证的登录项，程序会回读结果并提示失败，不声称 ad-hoc 包必然可登录启动。

参考：[Electron 登录项](https://www.electronjs.org/docs/latest/api/app#appsetloginitemsettingssettings-macos-windows)、[跨工作区窗口](https://www.electronjs.org/docs/latest/api/browser-window#winsetvisibleonallworkspacesvisible-options-macos-linux)。

## 验证边界

### 用户提供的 Mac 补丁记录（非本机复测）

随 Oblivious-mac-local-fixes.patch 提供的记录称：2026-10-17 在 macOS 26.7 / Apple Silicon 上运行了28项测试，完成 arm64 .app 打包与本地签名验证，并验证启动、设置窗口、桌宠/经典球切换及右键菜单；JXA 唤起返回成功，从 ChatGPT.app 内的 CLI 取得两个额度窗口。本次合并保留该记录的来源说明，不将它当作本机实测结果。

### 本次合并验证

已在 Windows 合并并测试 CLI 查找、JXA 分支和自动休眠的共享逻辑。新增休眠功能仍需在 Mac 实机回归；补丁记录对应其原始版本，不自动证明新版的多屏/Spaces、登录项或完整显示/隐藏行为通过。

当前执行环境是 Windows。跨平台参数传递、平台分支、台词/点击/气泡等共享逻辑已经测试，Windows 实机已验证。Mac 适配包含代码和构建流程，**尚未在真实 Mac 上运行，也没有在本机产出或验收 Mac .app**。

在 Mac 交付前仍需验证：AppKit 实际桥接、ChatGPT 激活/隐藏、菜单栏、多屏/Spaces、登录项和签名后的启动。Windows 上不伪造这些结果。
