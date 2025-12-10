# 幻想迷宫 (Gensokyo Labyrinth)

**项目说明**

这是一个以博丽灵梦为主角的迷宫式 Roguelike Web Demo，使用 Phaser 3 + Vite 开发。

**在线演示**

- GitHub Pages（已配置 CI 自动部署）：`https://WuDuHuange.github.io/gensokyo-labyrinth/`（若演示 URL 不同，请替换为实际地址）

**主要特性（Phase 1）**
- **地图**: 程序化房间+走廊地图生成（128x128 网格）
- **移动**: 格子化移动，镜头跟随，支持八方向移动
- **速度机制**: 基于行动点（AP）的半回合制系统
- **敌人**: 4 类基础敌人（慢速/普通/快速/扇形弹幕）
- **符卡**: 初始实现 2 种符卡（示例技能）
- **UI**: 基础 HUD、小地图与消息日志

**快速开始（本地开发，Windows `cmd.exe`）**
1. 安装依赖：

```cmd
npm install
```

2. 启动开发服务器（热重载）：

```cmd
npm run dev
```

3. 在浏览器打开：

```text
http://localhost:3000
```

**构建与发布**
- 本仓库已配置 GitHub Actions 自动构建并部署到 GitHub Pages（将 `dist` 发布到 `gh-pages`）。
- 如果想本地一次性发布，可安装 `gh-pages` 并添加脚本：

```cmd
npm install --save-dev gh-pages
```

在 `package.json` 的 `scripts` 中添加：

```json
"predeploy": "npm run build",
"deploy": "gh-pages -d dist"
```

然后运行：

```cmd
npm run deploy
```

若要绑定自定义域，请在仓库 Pages 设置或构建产物根放入 `CNAME` 文件，并在域名提供商处添加相应 DNS 记录（A 或 CNAME，详见 GitHub Pages 文档）。

**文件与目录**
- `src/`：游戏源代码（scenes、entities、systems 等）
- `docs/GAME_DESIGN_DOCUMENT.md`：长期设计文档（玩法/系统/里程碑）
- `.github/workflows/deploy.yml`：GitHub Actions Pages 自动部署配置

**Controls（默认）**
- 移动：方向键 / 小键盘 / 八方向支持
- 自由视角：`TAB`（切换）
- 快速回到玩家：`R`
- 面朝方向而不移动（原地转向）：`Q` + 方向键

**贡献**
- 欢迎提交 issue 或 PR：请在 PR 描述中说明改动与测试步骤。

**许可**
- 本项目当前未声明开源许可证；如需公开贡献/发布，请在仓库根添加 `LICENSE` 文件。

---

更多信息请参阅 `docs/GAME_DESIGN_DOCUMENT.md`。如需我把演示链接写入 README 或添加 `CNAME` 文件，告诉我域名即可。
