# 异地律师协作（PAC Demo）

> 微信小程序高保真演示 Demo。仅使用本地模拟数据，**不连接任何真实后端**；所有身份、案情、平台凭据均为虚构，不采集真实信息。

## 项目简介
本项目用于演示「异地律师协作」的核心流程：发布需求 → 匹配邀请 → 确认连接（1 元连接信息服务费）→ 双方入群沟通 → 协作记录结束。重点展示平台在**隐私保护、资格核验、支付与入群回调对账**等环节的设计边界。

## 技术栈
- 微信小程序原生框架（WXML / WXSS / JS），未引入第三方 UI 框架
- 本地状态管理：`utils/store.js`（schema v2，持久化到 `wx.storage`）
- 模拟后端 API：`utils/mock.js`（约 56KB 虚构数据与流程模拟）
- 演示配置：`utils/config.js`（提前量、TTL、场景文案等，仅供演示）

## 目录结构
```
program/
├── app.js / app.json / app.wxss     # 小程序入口与全局配置
├── utils/
│   ├── store.js                     # 本地状态仓库（含持久化）
│   ├── mock.js                      # 模拟后端数据与流程
│   └── config.js                    # 演示用配置
├── components/                      # 公共组件（navigation-bar / step-bar）
├── pages/                          # 业务页面
└── tests/                          # 静态检查与流程 mock 测试
```

## 主要页面
| 页面 | 说明 |
| --- | --- |
| `pages/index` | 首页，展示当前需求状态与待处理邀请 |
| `pages/publish` | 发布 / 编辑协作需求 |
| `pages/collaboration` | 协作详情与进度（审核、匹配、支付、入群、沟通、结束） |
| `pages/collaboration/list` | 我的协作列表（我发起的 / 我接收的，按状态筛选） |
| `pages/invitation` | 接收方邀请箱与接受 / 拒绝处理 |
| `pages/match` `pages/connection` `pages/rematch` | 匹配 / 连接 / 重新匹配 |
| `pages/pilot` `pages/audit` `pages/demo-console` | 代开庭试点 / 人工审核 / 演示控制台 |
| `pages/vouchers` `pages/orders` `pages/messages` | 补贴券 / 订单 / 消息 |
| `pages/profile` `pages/settings` `pages/feedback` | 我的 / 设置 / 反馈 |
| `pages/help` `pages/about` `pages/privacy` | 帮助 / 关于 / 隐私 |

## 运行方式
1. 使用**微信开发者工具**导入 `program` 目录。
2. 填写自己的 AppID，或使用「测试号」运行。
3. 编译并在模拟器中预览；演示数据在首次启动时由 `store.loadState()` 自动加载。

## 说明与免责
- 本仓库为**演示性质**，所有数据均为虚构，平台不连接真实法律服务或支付系统。
- 平台「不采集群聊内容」，入群与支付均以企微回调或查询对账为准，单纯打开入口不代表已入群。
- 请勿将本 Demo 用于任何真实法律业务场景。
