# 来源与素材

## GPT-Niang

来源：https://github.com/T7moris/GPT-Niang

参考版本：v1.3.4，提交 b92159a93c131bd5ba4722d7f507ee04d633d5db。

src/vendor/gpt-niang/usage.mjs 与 plan.mjs 来自该版本的 runtime 目录，使用 MIT 许可。原始完整声明位于 src/vendor/gpt-niang/LICENSE。metadata.mjs 为本项目版本适配。0.4.0 按用户要求复用 assets/quotes.json 中全部 33 句台词，并保留 assets/quotes-LICENSE.txt 中的来源与 MIT 声明（其中 7 句上游文本来自 MeteorNOX / DeepSeek-Balance-Whale-Widget）。未复制该项目角色图片、音效或安装/更新程序。

本项目使用其只读额度请求与窗口解析，通过本地 Codex 的 initialize、account/read、account/rateLimits/read 查询；不调用模型，不创建会话。UI 只接收额度公开字段，不持久化账号信息或额度缓存。

## bailong-desktop-pet

参考：https://github.com/jingh12312-rgb/bailong-desktop-pet/releases/tag/v0.3.3

参考单击互动、双击额度、拖拽落地和右键选动作的产品交互。该发布页注明源码与美术素材未另行指定开放许可；本项目没有复制其源码、美术或音效。

## 本项目新增美术

dragon-wave.png 和 dragon-sleep.png 使用内置 imagegen 工具生成，以本项目原有 dragon-idle.png 为角色参考，保留银白长发、淡紫眼睛、白色龙角、小翅膀、白裙及原发饰，分别生成单个招手姿态和闭眼坐姿，透明背景。生成日期：2026-10-17。

提示词摘要：单个完整透明桌宠 sprite；保持原角色、服装和绘画风格；招手姿态一手举在脸旁、张手微笑；打盹姿态闭眼坐下、双手置于膝上、翅膀收拢；不添加文字、背景或地面投影。

0.4.4 的历史招手 dragon-wave.gif 使用内置 imagegen 生成8帧手臂/上半身动作，0.4.6 已停用，保留代码与历史素材等待新版替换。完整提示词见 generated_images/wave-natural-prompt.json。眨眼、拖拽扇翅和边缘探头沿用原项目 GIF。历史生成素材保留作来源记录，被移除的动作不再播放。

其余原素材及原项目许可沿用 LICENSE 与原项目来源声明。ChatGPT 名称及图标属于 OpenAI，本项目非官方。
