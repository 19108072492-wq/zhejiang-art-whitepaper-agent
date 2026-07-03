# 上线说明

这个项目上线时，DeepSeek Key 只放后端，不写进前端页面。

## 1. 准备 Supabase Edge Function Secrets

在 Supabase Dashboard 的 Edge Function Secrets 里添加：

```env
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
AI_API_KEY=你的新密钥
```

上线建议重新生成一个新 Key，避免使用已经发在聊天里的旧 Key。

## 2. 部署后端函数

部署 `supabase/functions/analyze/index.ts`，函数名为 `analyze`。

这是给扫码页面公开调用的函数，因此部署时需要关闭 JWT 校验，前端就不需要携带 Supabase 密钥。

```bash
supabase functions deploy analyze --no-verify-jwt
```

项目里也已经写入 `supabase/config.toml`：

```toml
[functions.analyze]
verify_jwt = false
```

## 3. 填写前端函数地址

部署成功后，把 `config.js` 改为：

```js
window.WHITEPAPER_AGENT_API_URL = "https://你的项目ref.supabase.co/functions/v1/analyze";
```

这里是公开函数地址，不是 DeepSeek Key。

## 4. 部署静态网页

把项目静态文件部署到 GitHub Pages、Vercel、Netlify 或对象存储均可。

上线后打开网页填写成绩，生成报告时会先在前端生成基础报告，再请求 Supabase 函数做实时 AI 分析。
