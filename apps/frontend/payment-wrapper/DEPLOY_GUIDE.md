# 🚀 DEPLOY PAYMENT WRAPPER - HƯỚNG DẪN NHANH

## ⚡ OPTION 1: Railway (Khuyến nghị - MIỄN PHÍ)

### Bước 1: Chuẩn bị
1. Tạo tài khoản [Railway.app](https://railway.app) (miễn phí)
2. Link GitHub account
3. Có sẵn PayOS credentials (hoặc dùng mock)

### Bước 2: Deploy
```bash
# Upload folder payment-wrapper lên GitHub repo mới
git init
git add .
git commit -m "Payment wrapper service"
git remote add origin https://github.com/your-username/payment-wrapper
git push -u origin main
```

### Bước 3: Railway Deploy
1. Vào [Railway.app](https://railway.app) → **New Project**
2. Chọn **Deploy from GitHub repo**
3. Chọn repo `payment-wrapper` 
4. Railway sẽ tự detect Node.js và deploy

### Bước 4: Set Environment Variables
Trong Railway dashboard → **Variables**:
```
PAYOS_CLIENT_ID=your-payos-client-id
PAYOS_API_KEY=your-payos-api-key
PAYOS_CHECKSUM_KEY=your-payos-checksum-key
MAIN_BACKEND_URL=https://key-manager-backend.onrender.com/api
FRONTEND_URL=https://your-frontend-domain.com
PORT=3001
NODE_ENV=production
```

### Bước 5: Lấy URL
Railway sẽ cung cấp URL như: `https://payment-wrapper-production.up.railway.app`

---

## ⚡ OPTION 2: Vercel (MIỄN PHÍ)

```bash
# Install Vercel CLI
npm i -g vercel

# In payment-wrapper folder
cd payment-wrapper
vercel --prod

# Follow prompts and set environment variables
```

---

## ⚡ OPTION 3: Heroku (Có phí sau 2022)

```bash
# Install Heroku CLI
heroku login
heroku create viet-truyen-payment-wrapper

# Set environment variables
heroku config:set PAYOS_CLIENT_ID=your-id
heroku config:set PAYOS_API_KEY=your-key
heroku config:set PAYOS_CHECKSUM_KEY=your-checksum
heroku config:set MAIN_BACKEND_URL=https://key-manager-backend.onrender.com/api

# Deploy
git push heroku main
```

---

## 🧪 TEST DEPLOYMENT

### Health Check
```bash
curl https://your-wrapper-url.com/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "Viet Truyen Payment Wrapper", 
  "timestamp": "2024-..."
}
```

### Payment Test
```bash
curl -X POST https://your-wrapper-url.com/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "key": "KEY-LXDWOZBA",
    "creditAmount": 220
  }'
```

---

## 🔑 PayOS Credentials (Nếu chưa có)

### Option 1: Đăng ký PayOS thật
1. Vào [PayOS.vn](https://payos.vn)
2. Đăng ký tài khoản business
3. Lấy API credentials

### Option 2: Dùng mock values (test only)
```
PAYOS_CLIENT_ID=mock-client-id
PAYOS_API_KEY=mock-api-key
PAYOS_CHECKSUM_KEY=mock-checksum-key
```

Service sẽ fallback về bank transfer info khi PayOS fail.

---

## 🎯 NEXT STEPS

1. **Deploy wrapper** (5 phút)
2. **Get wrapper URL** 
3. **Update frontend** để point tới wrapper
4. **Test payment** với user thật

**Railway URL sẽ có dạng:**
`https://payment-wrapper-production-xxxx.up.railway.app`

Copy URL này để cập nhật frontend config!