# 健身助手

基于 [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) 构建的私人健身动作库，1324 个健身动作，含 GIF 演示和中文说明。纯前端，无需数据库，双击即用。

## 功能

- 1324 个健身动作，覆盖全身 10 个部位
- 中文动作步骤说明
- 按身体部位、器械筛选，支持关键词搜索
- GIF 动作演示（本地优先，CDN 自动回退）
- 收藏功能，数据存浏览器本地
- 随机推荐动作
- PWA 支持，可添加到手机桌面

## 使用方法

### 直接打开

下载项目后，双击 `index.html` 即可在浏览器中使用。

### 下载 GIF（可选）

GIF 演示图默认从 CDN 在线加载。如需离线使用，运行下载脚本：

**Windows：**
```powershell
.\download_gifs.ps1 -DryRun   # 预览
.\download_gifs.ps1           # 下载全部
.\download_gifs.ps1 -Category chest  # 只下载某个部位
```

**Mac / Linux：**
```bash
python download_gifs.py --dry-run
python download_gifs.py
```

### 部署到 GitHub Pages

1. Fork 本仓库
2. Settings → Pages → Source: `main` → Save
3. 访问 `https://<你的用户名>.github.io/<仓库名>/`

## 项目结构

```
├── index.html            # 主页面
├── manifest.json         # PWA 配置
├── sw.js                 # Service Worker
├── css/style.css         # 样式
├── js/app.js             # 应用逻辑
├── data/
│   ├── exercises.js      # 动作数据（双击打开用）
│   └── exercises.json    # 动作数据（HTTP 服务用）
├── gifs/                 # GIF 存放目录（需下载）
│   ├── chest/
│   ├── back/
│   └── ...
├── download_gifs.ps1     # Windows GIF 下载脚本
└── download_gifs.py      # 跨平台 GIF 下载脚本
```

## GIF 加载策略

```
本地 gifs/{部位}/{media_id}.gif → 本地 gifs/{media_id}.gif → CDN 在线加载
```

未下载 GIF 也能正常使用，自动从 CDN 加载。

## 数据来源

动作数据来自 [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)，基于 [ExerciseDB](https://oss.exercisedb.dev/)。GIF 演示通过 ExerciseDB CDN 提供。