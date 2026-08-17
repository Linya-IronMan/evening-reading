# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.2.3](https://github.com/Linya-IronMan/evening-reading/compare/v0.2.2...v0.2.3) (2026-08-17)

### Features

* 增加章节划分段落的大号字体与排版样式 ([5a3d40b](https://github.com/Linya-IronMan/evening-reading/commit/5a3d40b830cfdb93e47c15480bc6ca453198569d))
* 支持评论就地编辑、追加子评论与卡片界面精简 ([61fffa6](https://github.com/Linya-IronMan/evening-reading/commit/61fffa6b0f03930db2e5aae417abc4fec534bdd5))
* 评论定位时增加正文段落与划线文本高亮闪烁效果 ([e85cb78](https://github.com/Linya-IronMan/evening-reading/commit/e85cb787503a363b00488d5b48078d1c7f7efd26))

### Bug Fixes

* 优化划线评论弹窗点击外部自动关闭并消除划选点击事件冲突 ([7dc2810](https://github.com/Linya-IronMan/evening-reading/commit/7dc2810efcdd4dd763e96167db9660738354e4a1))
* 修复 Hooks 调用顺序导致的页面黑屏并添加全局错误边界 ([c72c416](https://github.com/Linya-IronMan/evening-reading/commit/c72c416b96548e31b99d14328174121b74ce019a))
## [0.2.2](https://github.com/Linya-IronMan/evening-reading/compare/v0.2.1...v0.2.2) (2026-08-17)

### Features

* 新增设置面板、Cmd+, 快捷键支持与局域网 Web 访问健康检查 ([1cf006b](https://github.com/Linya-IronMan/evening-reading/commit/1cf006b767c6694e6746d566822a7a9fd151a184))
* 新增设置面板音色一键测试功能并重构朗读段落高亮样式 ([60f1697](https://github.com/Linya-IronMan/evening-reading/commit/60f1697070b2b81cdbc6010d7b952b26fb1c8504))
## [0.2.1](https://github.com/Linya-IronMan/evening-reading/compare/v0.2.0...v0.2.1) (2026-08-17)

### Features

* **updater:** 接入 Tauri 2 原地热更新与 Minisign 签名验签体系 ([17184d1](https://github.com/Linya-IronMan/evening-reading/commit/17184d1452dc4408b14386af8a5f107a1d12c671))
## [0.2.0](https://github.com/Linya-IronMan/evening-reading/compare/v0.1.0...v0.2.0) (2026-08-06)

### Bug Fixes

* **tts:** 修复 Edge TTS 音色下架导致的播放失败问题，并移除不可用音色 ([bca93d8](https://github.com/Linya-IronMan/evening-reading/commit/bca93d8c02dfa0ac87c25a84b7a2b6be1c5b02f8))
## 0.1.0 (2026-08-06)

### Features

* **importer:** 实现 GBK/UTF-8 智能探针与多平台换行符兼容 ([82d7bf3](https://github.com/Linya-IronMan/evening-reading/commit/82d7bf3dd65e02bbac3f1d5e5f68ef0d743c8f31))
* **reader:** 增加小说目录领域模型与正则解析器 ([812ef58](https://github.com/Linya-IronMan/evening-reading/commit/812ef58eade5fe4a72fab0a9b095a15a0b74d4e1))
* **reader:** 实现自动跟读生命周期锁、快速定位与侧边栏目录导航 ([fb755a0](https://github.com/Linya-IronMan/evening-reading/commit/fb755a08bf729e3728fb889d7024fba6f9e31cc7))
* **tts:** 实现基于 Rust 的 Edge-TTS 代理服务以绕过反爬 ([08b3c7f](https://github.com/Linya-IronMan/evening-reading/commit/08b3c7f0a77346a3ec594ea98884af592a014ca5))
* 初始化 React + Tauri 客户端底座 ([ccd8c8c](https://github.com/Linya-IronMan/evening-reading/commit/ccd8c8c2c94fbbc883af5f15c48c92d818e4b6d6))

### Bug Fixes

* **reader:** 修复短段落右侧操作栏悬浮触控盲区 ([d390713](https://github.com/Linya-IronMan/evening-reading/commit/d39071341bcf12d676cec81f4b99a4a4768bffbb))
* **tauri:** 生成应用全平台图标以修复打包缺少 IconType 的错误 ([851add2](https://github.com/Linya-IronMan/evening-reading/commit/851add2d63718326506815661a796cb13c79f3ac))
* **tts:** 修复切换音色与切段时的音频重叠竞态条件 ([61d6e79](https://github.com/Linya-IronMan/evening-reading/commit/61d6e79fae99d1d5b0f63a90b63403d3201edb1d))
# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.
