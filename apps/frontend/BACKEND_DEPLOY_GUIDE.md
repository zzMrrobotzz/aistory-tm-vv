# 🚀 BACKEND DEPLOY GUIDE - Payment Fix

## ✅ Fix đã hoàn thành trong backend

### 🔧 Files đã fix:
- `routes/payment.js` - Accept multiple field formats
- `services/paymentService.js` - Flexible validation & pricing

### 🎯 Changes:
- ✅ Accept `creditAmount`, `credit`, `credits`, `amount` fields
- ✅ Allow any credit amount 1-10,000 (not just database packages)
- ✅ Fallback price calculation: 1 credit = 4545 VNĐ
- ✅ Better error messages and logging

## 🚀 DEPLOY BACKEND

### Option 1: Render (Hiện tại)

1. **Auto-deploy from Git:**
   ```bash
   # Backend đã được push lên GitHub
   # Render sẽ auto-deploy từ main branch
   ```

2. **Manual deploy trên Render.com:**
   - Vào Render dashboard
   - Chọn service `key-manager-backend`
   - Bấm **"Manual Deploy"** → **"Deploy latest commit"**
   - Đợi 2-3 phút để deploy

3. **Check deployment:**
   ```bash
   curl https://key-manager-backend.onrender.com/api/health
   ```

### Option 2: Local test trước

```bash
cd key-manager-backend
npm install
npm start

# Test payment endpoint
curl -X POST http://localhost:3000/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "key": "KEY-LXDWOZBA",
    "creditAmount": 220
  }'
```

## ✅ TEST PAYMENT ENDPOINT

### Frontend test:
1. **Đảm bảo `USE_PAYMENT_WRAPPER = false`** trong config.ts
2. **Deploy frontend** với config mới  
3. **Test thanh toán** với user

### API test trực tiếp:
```bash
# Test with creditAmount (frontend format)
curl -X POST https://key-manager-backend.onrender.com/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "key": "KEY-LXDWOZBA", 
    "creditAmount": 220
  }'

# Should return PayOS payment info
```

Expected response:
```json
{
  "success": true,
  "payUrl": "https://pay.payos.vn/web/...",
  "qrData": "...",
  "transferInfo": {
    "accountNumber": "...",
    "amount": 999900,
    "content": "..."
  }
}
```

## 🎯 RESULT

Sau khi deploy backend:
- ✅ Frontend gọi `creditAmount: 220` → Backend accept
- ✅ Tính price: 220 × 4545 = 999,900 VNĐ  
- ✅ Tạo PayOS payment thành công
- ✅ User nhận QR code + bank info thật
- ✅ Payment flow hoạt động 100%

## 🚨 Troubleshooting

### Backend deploy fail:
- Check Render logs
- Verify environment variables
- Ensure MongoDB connection

### Payment vẫn lỗi:
```bash
# Check backend logs on Render
# Look for "Payment request received:" logs
# Verify PayOS credentials
```

### Frontend vẫn gọi wrapper:
- Ensure `USE_PAYMENT_WRAPPER = false`
- Clear browser cache
- Check Network tab in DevTools

## 🎉 COMPLETION

**Estimated deploy time: 2-5 phút**

Backend sẽ auto-deploy trong vài phút và payment sẽ hoạt động ngay lập tức!