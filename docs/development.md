# 开发与重新打包

[返回 README](../README.md) · [English](development.en.md)

扩展使用原生 HTML、CSS、JavaScript / ES modules，直接加载源文件，无需前端构建。维护依赖建议使用 Node.js 22.13+；打包脚本使用 Python 3.9+ 标准库。普通用户无需安装这些工具。

```bash
# 安装开发依赖并运行测试
npm ci --ignore-scripts
npm test

# 仅在更新文档解析器或 OCR 依赖时重新复制运行文件
npm run vendor:resume

# 打包当前源文件，生成 ZIP 和 SHA-256 校验文件
npm run package

# 也可直接运行，并固定发布日期
python3 scripts/package.py --date 20260925
```

安装包输出到 `dist/`，格式为 `online-application-assistant-v<版本>-<日期>.zip`。脚本检查版本声明、依赖校验和、字体引用及压缩包内容，包含完整运行资源、许可证与使用说明，排除开发依赖、设计草图和临时文件。相同文件与日期在同一工具环境下可重复生成相同内容的包。

主要目录：`src/` 为扩展页面与逻辑，`src/resume/` 为简历解析，`src/applications/` 为投递记录，`vendor/` 为本地运行依赖，`tests/` 为自动化测试，`scripts/` 为依赖维护与打包工具。测试覆盖简历映射与合并、OCR 处理、资料字段保留、投递记录和状态管理；真实网站的表单兼容性仍需按站点验证。
