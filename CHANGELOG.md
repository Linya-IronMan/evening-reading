# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.1.2](https://github.com/Linya-IronMan/evening-reading/compare/v0.1.1...v0.1.2) (2026-08-06)

### Bug Fixes

* **tauri:** 生成应用全平台图标以修复打包缺少 IconType 的错误 ([851add2](https://github.com/Linya-IronMan/evening-reading/commit/851add2d63718326506815661a796cb13c79f3ac))
## 0.1.1 (2026-08-06)

### Features

* **importer:** 实现 GBK/UTF-8 智能探针与多平台换行符兼容 ([82d7bf3](https://github.com/Linya-IronMan/evening-reading/commit/82d7bf3dd65e02bbac3f1d5e5f68ef0d743c8f31))
* **reader:** 增加小说目录领域模型与正则解析器 ([812ef58](https://github.com/Linya-IronMan/evening-reading/commit/812ef58eade5fe4a72fab0a9b095a15a0b74d4e1))
* **reader:** 实现自动跟读生命周期锁、快速定位与侧边栏目录导航 ([fb755a0](https://github.com/Linya-IronMan/evening-reading/commit/fb755a08bf729e3728fb889d7024fba6f9e31cc7))
* **tts:** 实现基于 Rust 的 Edge-TTS 代理服务以绕过反爬 ([08b3c7f](https://github.com/Linya-IronMan/evening-reading/commit/08b3c7f0a77346a3ec594ea98884af592a014ca5))
* 初始化 React + Tauri 客户端底座 ([ccd8c8c](https://github.com/Linya-IronMan/evening-reading/commit/ccd8c8c2c94fbbc883af5f15c48c92d818e4b6d6))

### Bug Fixes

* **reader:** 修复短段落右侧操作栏悬浮触控盲区 ([d390713](https://github.com/Linya-IronMan/evening-reading/commit/d39071341bcf12d676cec81f4b99a4a4768bffbb))
* **tts:** 修复切换音色与切段时的音频重叠竞态条件 ([61d6e79](https://github.com/Linya-IronMan/evening-reading/commit/61d6e79fae99d1d5b0f63a90b63403d3201edb1d))
