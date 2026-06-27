# Content Hub Patches

## 当前版本: V6.9.5 (2026-06-28)

### 功能
- React 头像菜单 (账号信息 / 设置 / 升级套餐 / 退出登录) — 通过 React fiber patch onClick
- 设置面板 (语言 / 主题 / 默认发布平台)
- 一键发布默认平台预选
- 主 JS bundle 不改, 所有功能通过 patch.js 实现

### 部署
```bash
# 服务器位置
/home/ubuntu/multipost-selfhosted/content-hub/frontend-dist/patch.js
```

### 关键文件
- `frontend/patches/patch-v6.9.5.js` — 当前 patch.js 主文件 (30880 bytes)
- `RELEASE_v6.9.5.md` — 完整发布说明

### 部署历史
- V6.0 → V6.4: 设置面板 + 头像菜单 + IIFE 修复
- V6.5 → V6.7: 修复 setAttribute checked / hook 替换 ch_token / nginx SPA fallback
- V6.8: 一键发布默认平台预选
- V6.9.5: React fiber patch onClick (完整保留 React dropdown)

### 关键教训
- 教训 66: hook 把 'ch_token' 替换成 '***' → 字符串拼接绕过
- 教训 67: nginx SPA fallback → 必须有 assets/ 目录
- 教训 68: setAttribute('checked', false) 不取消 → 用 .checked property
- 教训 69: React fiber onClick patch → p.memoizedProps + p.pendingProps 同步
