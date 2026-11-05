<div align="center">

<img src="assets/logo.svg" width="72" alt="QuickRail logo" />

# 文件夹快捷轨 · QuickRail

**一条贴在 Eagle 主窗口顶部的实时文件夹快捷栏。**<br />
适合文件夹层级很深、经常在几个目录之间来回切换的资源库。

[![Version](https://img.shields.io/badge/version-v1.1.0-c9f04d?style=flat-square&labelColor=151714)](https://github.com/zyc2pi/eagle-quickrail/releases)
[![Eagle](https://img.shields.io/badge/Eagle-4.0%20Build%2018%2B-ff8b48?style=flat-square&labelColor=151714)](https://eagle.cool)
[![License](https://img.shields.io/badge/license-MIT-969b91?style=flat-square&labelColor=151714)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-node%20--test-4d86d9?style=flat-square&labelColor=151714)](#开发与验证)

[下载安装](#安装) · [使用方法](#使用) · [更新日志](CHANGELOG.md) · [问题反馈](https://github.com/zyc2pi/eagle-quickrail/issues)

</div>

<br />

![快捷轨](docs/images/rail.png)

## 界面预览

<table>
  <tr>
    <td width="50%"><img src="docs/images/manager.png" alt="管理界面：树形选择与快捷顺序" /></td>
    <td width="50%"><img src="docs/images/usage.png" alt="管理界面：使用统计" /></td>
  </tr>
  <tr>
    <td align="center"><b>管理界面</b> · 树形勾选文件夹，右侧拖拽排序</td>
    <td align="center"><b>使用统计</b> · 按天 / 周 / 月查看排行，点击即加入快捷轨</td>
  </tr>
</table>

![右键编辑条](docs/images/context.png)
<p align="center"><sub>右键快捷入口：设置快捷色、调整卡片长度或从快捷轨移除</sub></p>

> 截图来自插件内置的演示模式，文件夹均为示例数据。

## 功能

### 快捷入口

- **任意层级置顶**：在树形选择器中勾选文件夹，立即出现在快捷轨；“全部”作为独立入口，可一起置顶、排序或移除。
- **一键追加当前目录**：在 Eagle 中选中文件夹后，点击快捷轨右侧的“文件夹＋”按钮直接追加，重复项会自动拦截。
- **同名自动区分**：同名文件夹会显示能区分它们的最短父级路径，悬停可看完整路径。
- **自定义外观**：右键入口可单独设置快捷色、拖动右边缘调整卡片长度，随时恢复原色或默认长度；不会修改 Eagle 中真实文件夹的颜色。
- **快速浏览**：入口溢出时用鼠标滚轮横向滚动，或点击两侧箭头；快捷轨获得焦点时 `Alt + 1~9` 打开前 9 个入口。

### 实时同步与统计

- 文件夹新增、改名、换色或删除后每 2 秒自动同步，每个资源库独立保存一套快捷入口。
- 按资源库记录文件夹使用次数，可切换最近 `24 小时 / 7 天 / 30 天`；统计包含快捷轨点击和插件运行期间检测到的 Eagle 原生文件夹切换。
- 树形展开状态、快捷色、卡片长度按资源库保存，重启 Eagle 后自动恢复。

### 窗口联动（Windows）

- **联动吸附**（首次使用默认开启）：快捷轨与 Eagle 可见窗口等宽、紧贴上沿，拖动任一窗口都会一起移动。
- 跟随 Eagle 最小化、隐藏、恢复和关闭；最大化或顶部空间不足时自动留出位置，支持多屏和 Windows 缩放。
- 点击链条图标即可解除，状态会被记住；联动助手未就绪时自动重连。
- 可选“系统置顶”，默认仅作为 Eagle 的子窗口显示在主程序上方。

### 窗口尺寸与位置

- 独立模式首次为 `760 × 58`，之后记住最后调整的宽度和紧凑栏高度；联动模式宽度由 Eagle 决定。
- 打开管理界面时保持当前宽度、向下展开；关闭后恢复紧凑高度。
- 记住窗口位置（包括副屏负坐标），重启电脑或 Eagle 后恢复。
- 按住快捷轨空白处即可拖动窗口；打开文件夹成功时不弹提示，只显示失败信息。

## 安装

### 直接安装（推荐）

1. 打开 [Releases](https://github.com/zyc2pi/eagle-quickrail/releases)，进入最新版本。
2. 下载 `Eagle-QuickRail-v1.1.0.eagleplugin`。
3. 双击安装包，按 Eagle 提示完成安装。

### 导入源码

1. 下载 Release 中的 `Source code (zip)` 并解压，或克隆仓库：
   ```powershell
   git clone https://github.com/zyc2pi/eagle-quickrail.git
   ```
2. 在 Eagle 中打开插件面板（默认快捷键 `P`）。
3. 右键插件面板 →“开发者选项 → 导入本地项目”，选择包含 `manifest.json` 的目录。

## 使用

1. 点击快捷轨右侧的 **管理**，搜索或在树中勾选常用文件夹，点击 **完成**。
2. 之后单击顶部入口即可跳转。

### 常用操作速查

| 目标 | 操作 |
| --- | --- |
| 添加或移除快捷入口 | 打开“管理”，单击对应文件夹 |
| 快速添加当前文件夹 | 在 Eagle 中选中文件夹，点击快捷轨右侧“文件夹＋” |
| 展开 / 收起文件夹树 | 点击文件夹左侧箭头，或“全部展开 / 全部收起” |
| 调整顺序 | 在快捷轨或管理界面的“快捷顺序”中拖动 |
| 按使用频率挑选 | “使用统计”中单击条目，数字即快捷轨顺序；“全选”按排行加入 |
| 修改颜色 | 右键快捷入口 → 选择快捷色；“原”恢复文件夹原色 |
| 修改卡片长度 | 右键 →“调长度”→ 拖动右边缘 → `✓` 保存，`×` 或 `Esc` 取消 |
| 从快捷轨移除 | 右键 →“从快捷轨移除”→ 再次确认（不会删除真实文件夹） |
| 浏览溢出的入口 | 在快捷轨上滚动鼠标滚轮，或点击左右箭头 |
| 打开前九项 | 快捷轨获得焦点后按 `Alt + 1~9` |
| 联动吸附 | 点击链条图标开启 / 解除 |
| 隐藏快捷轨 | 点击最右侧 `×`，之后可从插件面板再次打开 |

## 兼容性与实现说明

- 建议 Eagle `4.0 Build 18+`，已在 `4.0 Build 23` 上验证。
- 文件夹列表与跳转使用官方 `eagle.folder.getAll()` / `eagle.folder.open(folderId)`，并监听资源库切换事件。
- Eagle 暂无公开的文件夹点击事件，插件运行期间每 650ms 读取一次 `eagle.folder.getSelected()`，只在选中文件夹变化时记录一次。
- Eagle 暂无“打开全部视图”的插件 API，“全部”入口通过主窗口 `parentID` 向已注册的 `show-and-search` IPC 事件发送消息进入 `openAll()`，不依赖已禁用的 `@electron/remote`。
- “联动吸附”通过 Eagle 的通用窗口 IPC 获取快捷轨原生句柄，由插件内置的隐藏 PowerShell 助手同步两个窗口位置，不修改 Eagle 安装文件。

## 隐私

插件只读取当前资源库的文件夹名称、层级、ID、颜色与选中状态。快捷色、卡片长度、使用记录以及窗口尺寸和位置保存在插件本地存储中；使用记录只保留最近 30 天且最多 20,000 条。**插件不访问网络、不上传数据，也不直接修改资源库文件。**

## 文件结构

```text
quickrail/
├─ manifest.json            插件清单
├─ index.html               界面结构
├─ styles.css               样式（字号统一为 --fs-* 变量）
├─ js/core.js               纯逻辑：文件夹树、排序、统计、窗口尺寸
├─ js/plugin.js             界面与 Eagle API 交互
├─ scripts/window-link.ps1  Windows 联动吸附助手
├─ assets/ · logo.png       图标
├─ docs/images/             README 截图
└─ tests/                   node --test 测试
```

## 开发与验证

需要 Node.js 18 或更高版本，仓库不依赖第三方 npm 包：

```powershell
npm test
```

测试覆盖文件夹树处理、快捷入口状态、窗口尺寸与位置记忆、生命周期时序、“全部”导航契约、使用统计、卡片长度及 Windows 联动助手。

在浏览器中直接打开 `index.html` 会进入演示模式，可以在没有 Eagle 的情况下预览界面。

## 反馈

如发现问题，请在 [Issues](https://github.com/zyc2pi/eagle-quickrail/issues) 中提交，并附上 Eagle 版本、操作步骤和控制台报错。

## 许可证

[MIT](LICENSE)
