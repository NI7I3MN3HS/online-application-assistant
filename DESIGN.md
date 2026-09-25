---
name: 网申助手
description: 沿用用户指定 HTML 的米白纸面、墨色文字与紧凑操作工作台。
colors:
  paper: "#F8F6F0"
  paper-light: "#FDFCFA"
  white: "#FFFFFF"
  line: "#F0ECE1"
  edge: "#E5DFCE"
  ink: "#181715"
  ink-hover: "#282623"
  ink-soft: "#3D3A35"
  muted: "#6E6A62"
  terracotta: "#A8523A"
  moss: "#556B4F"
  sand: "#B38B4D"
  indigo: "#38485C"
  stone: "#807C75"
typography:
  display:
    fontFamily: "Cormorant Garamond, Noto Serif SC, Songti SC, serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.025em"
  headline:
    fontFamily: "Cormorant Garamond, Noto Serif SC, Songti SC, serif"
    fontSize: "21px"
    fontWeight: 400
  title:
    fontFamily: "Cormorant Garamond, Noto Serif SC, Songti SC, serif"
    fontSize: "18px"
    fontWeight: 400
  body:
    fontFamily: "Plus Jakarta Sans, Noto Sans SC, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Plus Jakarta Sans, Noto Sans SC, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  metadata:
    fontFamily: "Plus Jakarta Sans, Noto Sans SC, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
rounded:
  seal: "2px"
  control: "4px"
  dot: "50%"
spacing:
  small-gap: "6px"
  control-gap: "8px"
  compact: "12px"
  regular: "16px"
  inset: "20px"
  panel: "24px"
  inspector: "28px"
  section: "32px"
  workspace: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-light}"
    rounded: "{rounded.control}"
    padding: "7px 16px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
    textColor: "{colors.paper-light}"
  button-secondary:
    backgroundColor: "rgba(255,255,255,0.7)"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.control}"
    padding: "7px 16px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    padding: "5px 8px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.terracotta}"
    rounded: "{rounded.control}"
    padding: "7px 16px"
  input:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  navigation-active:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  status:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
  record-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "24px"
  record-row:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    padding: "16px 10px"
---

# Design System: 网申助手

## Overview

**Creative North Star: "纸面工作台"**

米白工作区承载紧凑的资料和记录；墨色文字、衬线标题、细线与白色详情面板提供清晰层次。操作保持熟悉，视觉表达服从填写、核对与保存任务。

此系统记录已实现的米白纸面与墨色工作台方向。颜色、字体与基本控件以 [src/ui.css](src/ui.css) 为代码依据；本文件记录响应式规则及可读性要求，功能范围由 [PRODUCT.md](PRODUCT.md) 约束。品牌使用用户提供的[网申助手 Logo](assets/logo.png)，工具栏与页面导航使用同一图形的[图标](icons/icon.png)。

**Key Characteristics:**

- 米白底、墨色操作、暖灰细线，白底标记选中与详情。
- 衬线标题搭配紧凑无衬线表单，数字等宽对齐。
- 四像素控件圆角，列表与分栏承担信息组织。
- 来源文字、未保存状态和待补全提示保持可读。

## Colors

配色继承参考 HTML 的 linen、sumi 与 clay 色系；前置 token 是实际使用值，代码中的 `--danger` 对应 `terracotta`。

### Primary

`ink` 是主文字、主按钮和选中标记；`ink-hover` 是深色按钮悬停；`ink-soft` 用于标签、普通链接与焦点轮廓。

### Secondary

`terracotta` 用于危险操作、错误与状态圆点；`moss`、`sand`、`indigo`、`stone` 提供受约束的状态色。状态始终有文字，不仅依赖圆点辨识。原网页字段填写标记仍保留自身的功能反馈颜色，不扩展为工作台配色。

### Neutral

`paper` 是工作区底色；`paper-light` 是表单与侧栏浅底；`white` 用于选中项、详情和浮层。`line` 分隔结构，`edge` 描述控件边界，`muted` 承担辅助文字、占位文字、日期、未保存和待补全提示。

**The Readable Metadata Rule.** 辅助文字使用 muted；sand 保留给状态圆点，不用于浅底上的细小状态文案。源稿较浅的 sumi-400/sumi-300 不作为新增辅助文字的默认值。

## Typography

标题采用 Cormorant Garamond 与 Noto Serif SC，正文采用 Plus Jakarta Sans；中文正文回退到系统无衬线。该组合由用户指定参考决定，不重新选择展示字体。

[本地字体](vendor/fonts/)包含 Cormorant Garamond 400/600、Plus Jakarta Sans 400/500/600、Noto Serif SC 400；页面从扩展包加载，不请求远程字体。注入招聘网页的资料面板、进度和记录卡使用系统字体隔离宿主页，标题用可用衬线回退。

主标题使用 `display`，窄屏降为 24px；分节标题使用 `headline`/`title`。记录详情岗位标题为 24px；品牌名称“网申助手”为衬线 18px/600，配 36px 图标。表单标签与列表正文为 12px，表头、计数、时间和帮助为 11px。日期、计数使用 `tabular-nums`。

## Layout

桌面为固定左导航与可收缩工作区，整体无外框圆角。导航宽 240px；1100px 以下为 190px；720px 以下改为顶部横向导航。桌面页头与主区水平留白 40px，中等屏幕为 24px，手机为 20px。交互行允许换行，主内容列使用 `minmax(0,1fr)`。

- **资料工作台：** 分类、编辑器、提示栏三列；1200px 以下隐藏提示栏；720px 以下使用包含全部 19 类的下拉选择器。常用字段优先，其余字段可展开；重复经历与自定义字段始终可访问。420px 以下字段改单列。见 [options.css](src/options.css) 与 [options.js](src/options.js)。
- **记录工作区：** 详情栏宽 390px，1300px 以下为 330px；1050px 以下放到列表下方。桌面详情独立滚动，表格自身容纳横向溢出。见 [applications.css](src/applications.css)。
- **导入/API 核对：** 右侧白色原文或说明栏分别在 1050px/1100px 以下移到表单下方；保存操作在长内容底部保持可达。见 [import-ui.mjs](src/resume/import-ui.mjs)。
- **插件弹窗：** 400px 常规宽度、320px 最小宽度，24px 内边距；以分隔线组织区域。见 [popup.css](src/popup.css)。
- **网页浮层：** 最大宽 390px，与视口边缘留 16px。记录卡出现时，进度卡依据记录卡实测高度向上避让；视口高度不超过 900px 时隐藏重叠进度卡。宽度不超过 840px 时，打开资料面板暂时隐藏记录卡；关闭面板后恢复。见 [content.js](src/content.js) 与 [capture.js](src/applications/capture.js)。

## Elevation & Depth

页面层次主要来自底色、细线、留白和选中竖线。阴影集中于活动导航、记录详情、浮层、提示与对话框；普通列表不加悬浮卡片阴影。精确阴影值、焦点轮廓和断点以 [src/ui.css](src/ui.css) 及各页面样式为准。

状态切换使用短促背景/边线过渡；仅填写进度条过渡宽度。遵从 `prefers-reduced-motion`，关闭过渡，内容默认可见。

## Shapes

控件与弹窗采用 `control` 圆角，公司首字方印采用 `seal` 圆角；品牌图标保持原图形轮廓，状态点为正圆。导航、白色详情栏和分组列表依赖一像素暖灰边线，不将每条内容包成圆角卡片。

## Components

- **按钮：** 主操作墨底浅字；次操作白色半透明底与细边；文字操作透明底。危险操作使用 terracotta 文字。常规最小高度 34px，手机为 38px；禁用降低透明度并禁用指针操作。
- **输入：** 浅纸底、edge 边线、四像素角；焦点边线与轮廓使用 ink-soft。标签始终可见，帮助文字不替代标签。搜索/筛选可用无填充下划线输入。
- **导航：** 激活项白底细边、墨色文字和圆点；资料分类与记录选中项用左侧墨色短竖线。页签用下划线，无胶囊底色。路由由 [shell.js](src/shell.js) 管理。
- **状态：** 紧凑文字加小圆点，不使用整块彩色徽章；真实状态名称来自记录数据与用户设置。
- **记录行与详情：** 方印、岗位、公司、状态、来源与时间构成扫描顺序；选中行白底，右侧可编辑详情保留保存/删除/关闭反馈。
- **导入核对：** 字段逐项选择和修正，原文保持可查看；合并方式、保存与撤销清楚可达，不把预览当成已保存资料。
- **浮层与对话框：** 白色记录卡、纸色资料/进度面板复用细线与紧凑控件；关闭控件和键盘焦点可见。记录冲突与失败保留重新加载/重试入口。

## Do's and Don'ts

### Do:

- **Do** 沿用用户指定 HTML 的字体、纸面配色与四像素控件语言。
- **Do** 使用 muted 呈现辅助、未保存和待补全文字，并保留可见焦点。
- **Do** 让全部资料类别、原文核对和长表单操作在窄屏可达。
- **Do** 保持记录卡、进度卡与资料面板之间的避让规则。

### Don't:

- **Don't** 增加渐变、大圆角、装饰插画或大面积彩色卡片。
- **Don't** 为遵从通用样式检测而改换用户明确指定的字体和配色；已有豁免只适用于配置中的文件。
- **Don't** 从参考 HTML 的示例内容推导新功能或真实用户资料。
- **Don't** 让视觉重构改变本地存储、备份、字段映射、记录修订或提交行为。
