# 开发说明 · 0.4.5（正式名称与 README 待定）

独立 Electron 桌面伴侣：经典悬浮球、小龙娘桌宠、右键动作、启动招手、33 句可编辑台词与 Codex 额度气泡。当前动作触发规则与自然招手见 [RELEASE-0.4.4.md](RELEASE-0.4.4.md)，吸附修正见 [RELEASE-0.4.1.md](RELEASE-0.4.1.md)，主要功能说明见 [RELEASE-0.4.0.md](RELEASE-0.4.0.md)。

## 运行

安装 Node.js 22.12 或更新版本后，在项目目录执行：

```sh
npm ci
npm start
```

本包是 Windows / macOS 共用源码，不含 Electron 运行时或 Windows EXE。package-lock.json 固定依赖。登录启动需要打包版。Mac 平台适配、构建流程与未验证项目见 [MACOS.md](MACOS.md)。

## 操作

- 单击打开/隐藏 ChatGPT；双击从额度气泡切到台词；再次双击可选择下一句或返回额度。气泡默认 5 秒，可自定义。
- 拖动移动，右键菜单选动作或进入设置。单击和右键在气泡显示期间正常工作。
- 左侧“形象 / 样式 / 设置 / 关于”管理素材、动态外观、交互、台词和制作者信息。
- 额度气泡需要已安装 Codex 并用 ChatGPT 账号登录；不需要 API Key。数据是 Codex 额度，不代表 ChatGPT 全部模型额度。

## 检查

```sh
npm test
```

功能、使用细节和验证范围见 [RELEASE-0.4.0.md](RELEASE-0.4.0.md)。Windows 本机已完成更新并保留原偏好，旧版已备份。

## 目录

- src/：Electron 主进程、桥接、桌宠、设置、动作调度与气泡逻辑。
- src/vendor/gpt-niang/：MIT 许可的只读额度解析和查询模块及其许可。
- assets/：界面、角色、眨眼/扇翅/探头 GIF，以及新增招手与打盹姿态。
- test/：偏好、几何、动作、气泡边界和额度测试。
- tools/assemble-peek.py：原有探头素材合成脚本。

## 来源

原项目基于 https://github.com/mini-yifan/dsh-orb-cordis 的透明窗口结构思路。本版结合 GPT-Niang 的额度实现与 bailong-desktop-pet 的交互设计；代码、素材来源及使用边界见 [THIRD-PARTY.md](THIRD-PARTY.md)。

这是非官方独立伴侣，不读取聊天记录，不创建模型会话。偏好仅保存在本机。ChatGPT 名称及图标属于 OpenAI。
