# Prime Agent JupyterLab 扩展

> **中文说明。English version is in `README.md` (default language).**

参考 [jupyter-chat](https://github.com/jupyterlab/jupyter-chat) 架构的 JupyterLab 侧边栏聊天面板，支持 `IRenderMimeRegistry` Markdown 渲染、消息气泡、代码块复制、打字指示器和自动滚动容器。

## 新增内容指引

### Jupyter-Chat 模式升级
- **Markdown 渲染**（`IRenderMimeRegistry`）：欢迎消息与助手回复支持语法高亮、列表、LaTeX。
- **消息气泡**：用户（蓝色）与助手（灰色）不同样式的圆角气泡。
- **代码工具栏**：每个代码块显示语言标签 + 一键复制按钮（SVG 图标）。
- **打字指示器**：流式输出时显示动画三点 + "Assistant is typing..."。
- **停止按钮**：生成过程中显示红色停止按钮，可取消后端子进程。
- **滚动容器**：`MutationObserver` 自动滚动到最新消息。
- **主题变量**：全部使用 `--jp-*` CSS 变量，与 JupyterLab 主题原生兼容。

### WebSocket 协议
客户端 → 服务器：`{"type":"prompt","text":"用户消息"}`  
服务器 → 客户端：`{"type":"event","kind":"text","data":{"text":"..."}}`

### 参考
- [jupyter-chat GitHub](https://github.com/jupyterlab/jupyter-chat) — 组件模式参考
- [jupyterlab/rendermime](https://github.com/jupyterlab/jupyterlab) — `IRenderMimeRegistry` 文档
