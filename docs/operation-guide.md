# Agent Trace Studio 操作文档

## 1. 环境要求

- Node.js 22.x
- npm 10.x 或更高

当前项目在本地已验证通过的版本：

- `node -v` -> `v22.12.0`
- `npm -v` -> `10.9.0`

## 2. 安装依赖

在项目根目录 `C:\work\workspaces\codex\sseformat` 下执行：

```powershell
npm install
```

首次安装完成后，会生成 `node_modules` 和 `package-lock.json`。

## 3. 启动开发环境

执行：

```powershell
npm run dev
```

启动后，Vite 会输出一个本地地址，通常类似：

```text
http://localhost:5173/
```

用浏览器打开这个地址即可进入页面。

## 4. 页面怎么用

启动后，首页顶部有两个主要入口：

- `Upload trace JSON`
- `Load example trace`

### 4.1 加载内置示例

如果只是想快速看效果，点击：

```text
Load example trace
```

页面会展示一份内置的语义化样例，包括：

- 顶部摘要指标
- `Agent / HTTP / LLM` 三泳道
- 右侧详情抽屉
- 底部 Raw JSON inspector

### 4.2 上传真实 JSON

如果要测试真实数据，点击：

```text
Upload trace JSON
```

然后选择本地文件。

当前仓库里已经有一份可直接测试的真实请求样本：

```text
C:\work\workspaces\codex\sseformat\docs\demo.json
```

这个文件不是理想化的展示 schema，而是真实的 agent 请求体。页面会自动做本地适配，把它转换成可读的叙事视图。

## 5. 页面里能看到什么

### 5.1 顶部摘要区

显示本次 trace 的关键概览，例如：

- Model
- Latency
- Usage
- Outcome

### 5.2 三泳道主舞台

页面中间是三条主泳道：

- `Agent`
- `HTTP`
- `LLM`

点击任意阶段卡片，右侧会切换对应详情。

### 5.3 右侧详情抽屉

右侧抽屉会按类型渲染内容：

- `Markdown`：保留标题、列表、引用、表格、代码块和换行
- `JSON`：自动格式化并高亮
- `Code`：保留缩进、换行和语言标识
- `Text`：按多行文本原样保留

### 5.4 底部 Raw Inspector

底部的 `Raw JSON inspector` 用于查看原始数据，不影响首屏主叙事。

## 6. 常用命令

### 启动开发服务器

```powershell
npm run dev
```

### 运行测试

```powershell
npm test
```

### 运行代码检查

```powershell
npm run lint
```

### 构建生产包

```powershell
npm run build
```

构建成功后，产物会输出到：

```text
C:\work\workspaces\codex\sseformat\dist
```

### 本地预览生产包

```powershell
npm run preview
```

## 7. 常见问题

### 7.1 上传后提示 JSON 解析失败

说明文件内容不是合法 JSON。先检查：

- 是否缺少括号或逗号
- 是否包含非法注释
- 是否被截断

### 7.2 上传后提示 schema 不完整

说明这个文件既不符合语义化 trace schema，也不符合当前支持的 raw agent request 结构。

优先检查是否包含这些关键字段：

- 语义化 trace：`meta`、`summary`、`stages`、`metrics`
- 原始请求体：`model`、`messages`

### 7.3 构建时看到 chunk size warning

这是 Vite 的体积提示，不是构建失败。当前主要是代码高亮依赖较大，但不影响启动和使用。

## 8. 推荐使用方式

如果你要验证这个页面是否正常工作，建议按下面顺序操作：

1. 执行 `npm install`
2. 执行 `npm run dev`
3. 打开浏览器访问 Vite 输出的本地地址
4. 先点击 `Load example trace` 看标准展示效果
5. 再上传 `docs/demo.json` 看真实请求适配效果
6. 如需回归检查，执行 `npm test`
