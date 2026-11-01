# Decisif Shelf

轻量文件空间。通过 GitHub Pages 提供网页，通过 GitHub REST API 将文件直接写入同一个仓库的 `storage/`，并在网页中浏览、搜索、下载。

## 目录

界面采用私人藏架风格：纸白底色、墨色按钮、灰绿细线和顶部分类导航。字标使用 Georgia 衬线体；右上角可在宋体标题和现代细体标题之间切换，并在本机记住选择。支持顶部搜索、列表或图标视图、名称和大小排序、拖拽上传，以及可收起的上传记录。分类计数、搜索和大小合计针对当前文件夹；文件夹始终优先显示。

```text
decisif-shelf/
├── docs/              网站程序，GitHub Pages 只发布此目录
│   ├── index.html
│   ├── styles.css
│   ├── app.js         页面交互
│   ├── github.js      文件读写 API 模块（运行在浏览器）
│   └── .nojekyll
├── storage/           用户上传文件，与网站程序分开
├── scripts/           本地预览工具
└── tests/             API 行为测试
```

GitHub Pages 不能运行服务端程序。本版使用“静态前端 + GitHub API”，没有单独运行的后端。`github.js` 是浏览器 API 客户端，不是服务器。后续若需免令牌登录或多人上传，可另加独立托管的后端。

## 上传到 GitHub 并开启 Pages

1. 将本文件夹里的 **docs、storage 和其他文件** 上传到目标仓库的根目录。不要把外层 `decisif-shelf` 文件夹也包进去。
2. 打开仓库 Settings → Pages，Source 选择 **Deploy from a branch**。
3. 选择 `main`（或实际分支）和 **/docs**，保存。等待 GitHub 显示网站地址。
4. 打开网站，点击“连接设置”，填写用户名、仓库名和存储分支。
5. 只读浏览公开仓库可以不填令牌；上传文件需要细粒度 Personal Access Token。
6. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token：选择仓库所属账号、Only select repositories → 目标仓库；Repository permissions → **Contents: Read and write**；设置合理有效期，生成后只填入网页的密码输入框。组织仓库可能需要管理员批准。
7. 点击“连接仓库”，之后选择文件或拖入上传区。上传成功才会显示“已保存到仓库”，可在下方直接下载。

存储分支必须已初始化。默认 `main`，请与仓库实际分支一致。分支保护规则可能禁止直接写入。

## 当前行为与限制

- 支持多文件顺序上传；每个成功文件产生一次 Git 提交。单文件限制 **25 MiB** 是本站设置，避免浏览器 Base64 编码造成过大内存开销。
- 同名文件跳过，不自动覆盖。当前不提供删除功能。
- 上传至当前浏览的 `storage/` 子文件夹；支持浏览仓库已有子文件夹，第一版不提供新建文件夹或整目录上传。
- 搜索和分类作用于当前文件夹。GitHub Contents API 最多返回每目录 1000 项，大量文件请分子文件夹。
- 上传完成即已存入仓库，列表通过 API 获取，不依赖 Pages 重新部署。
- 令牌只在当前页面内存中使用，不保存到 localStorage、文件或仓库；刷新后要重新输入。浏览器只记住用户名、仓库名和分支。
- **公开仓库中的文件也公开。** 密码输入框不会改变仓库可见性。私有仓库需有权限的令牌，且 Pages 可用性取决于 GitHub 套餐。
- `docs/` 单独发布使 `storage/` 不作为网站静态资源发布，但公开仓库仍可直接查看存储文件。
- GitHub 仓库适合小型资料归档，不适合无限容量网盘、大视频或高频备份。每次上传都会留有 Git 历史，占用仓库空间。
- GitHub 访问速度取决于网络；失败会给出提示，超时后请先刷新确认是否已提交，避免重复操作。
- 不要将令牌粘贴进源码、README、截图或提交。细粒度令牌的 Contents 权限覆盖所选仓库，不会只限于 storage 文件夹；网页自身会约束写入路径。

## 本地预览与检查

安装 Node.js 后在此目录运行 `npm run preview`，浏览器打开 http://127.0.0.1:8765。退出预览按 Ctrl+C。无需安装依赖。

运行 `npm test` 验证路径隔离、上传编码、同名冲突、下载、错误处理等。测试使用模拟 API，不向真实仓库写入文件。真实上传下载需要填写仓库和令牌后验证。

官方参考：[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Contents API](https://docs.github.com/en/rest/repos/contents)。
