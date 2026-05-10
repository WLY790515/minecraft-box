# Minecraft Toolbox (我的世界工具箱)

一个用于监控 Minecraft 服务器状态和游戏进程的桌面应用程序。

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows-green)
![Minecraft](https://img.shields.io/badge/Minecraft-1.20.1-brightgreen)

## 功能特性

### 游戏状态监控
- **实时检测**: 自动检测 Minecraft Java Edition 游戏运行状态
- **服务器识别**: 自动识别当前连接的服务器地址和端口
- **日志监控**: 监听游戏日志文件，实时更新状态

### 服务器状态查询
- **Server List Ping**: 支持查询任意 Minecraft Java Edition 服务器状态
- **实时数据**: 显示在线人数、最大人数、延迟、版本等信息
- **MOTD 解析**: 解析服务器描述信息

### 数据管理
- **历史记录**: 自动记录曾连接过的服务器
- **收藏夹**: 收藏常用服务器，方便快速查看状态
- **本地存储**: 所有数据存储在本地，保护隐私

## 界面预览

### 主页面
- 实时显示游戏运行状态
- 当前连接的服务器信息
- 服务器状态快速查询

### 历史记录
- 查看所有曾连接过的服务器
- 快速重新查询历史服务器
- 一键添加历史服务器到收藏夹

### 收藏夹
- 管理收藏的服务器列表
- 批量刷新服务器状态
- 显示每个服务器的在线状态和延迟

## 技术架构

### 技术栈
- **Electron**: 跨平台桌面应用框架
- **Vue 3**: 前端渐进式框架
- **TypeScript**: 类型安全的 JavaScript 超集
- **mc-server-ping**: Minecraft 协议实现库
- **electron-log**: 日志记录

### 项目结构

```
minecraft-toolbox/
├── electron/
│   ├── main/
│   │   └── index.ts          # Electron 主进程
│   └── preload/
│       └── index.ts          # 预加载脚本
├── src/
│   ├── views/
│   │   ├── Home.vue           # 主页
│   │   ├── History.vue        # 历史记录页
│   │   └── Favorites.vue      # 收藏夹页
│   ├── stores/
│   │   └── app.ts             # Pinia 状态管理
│   ├── router/
│   │   └── index.ts           # Vue Router 配置
│   ├── styles/
│   │   └── main.css           # 全局样式
│   ├── App.vue                # 根组件
│   └── main.ts                # 入口文件
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 安装与运行

### 环境要求
- Node.js 18+
- npm 9+
- Windows 10/11

### 开发模式

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建应用

```bash
# 构建 Windows 安装包
npm run build:win
```

构建完成后，安装包位于 `release/` 目录。

## 使用说明

### 检测游戏状态
1. 启动 Minecraft Java Edition 1.20.1
2. 进入服务器或单人游戏
3. 工具箱将自动检测并显示当前服务器信息

### 查询服务器
1. 在主页输入服务器地址（如 `mc.hypixel.net`）
2. 默认端口为 25565，可自定义
3. 点击"查询"按钮查看服务器状态

### 管理收藏
- 查询服务器后点击"收藏"按钮添加
- 在收藏夹页面查看和管理所有收藏的服务器

## 注意事项

- 本工具仅支持 **Minecraft Java Edition**
- 游戏日志路径: `%APPDATA%\.minecraft\logs\latest.log`
- 需要游戏保持运行状态才能实时检测服务器

## License

MIT License
