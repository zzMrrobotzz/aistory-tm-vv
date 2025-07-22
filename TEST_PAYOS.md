# 🧪 TEST PAYOS CREDENTIALS

## 🔍 Kiểm tra PayOS hiện tại

### Test trực tiếp PayOS API:
```bash
curl -X POST https://api-merchant.payos.vn/v2/payment-requests \
  -H "x-client-id: be64263c-d0b5-48c7-a5e4-9e1357786d4c" \
  -H "x-api-key: 6c790eab-3334-4180-bf54-d3071ca7f277" \
  -H "Content-Type: application/json" \
  -d '{
    "orderCode": 123456789,
    "amount": 50000,
    "description": "Test payment",
    "returnUrl": "https://toolviettruyen.netlify.app/success",
    "cancelUrl": "https://toolviettruyen.netlify.app/cancel"
  }'
```

### Test qua backend:
```bash
curl -X POST https://key-manager-backend.onrender.com/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "key": "KEY-LXDWOZBA",
    "creditAmount": 50
  }'
```

## 📋 Expected Results:

### ✅ PayOS Working (credentials hợp lệ):
```json
{
  "success": true,
  "payUrl": "https://pay.payos.vn/web/xxx",
  "qrData": "real-qr-code-data",
  "transferInfo": {
    "accountNumber": "real-bank-account",
    "amount": 227250,
    "content": "real-transfer-content"
  }
}
```

### ❌ PayOS Failed (credentials test/invalid):
```json
{
  "success": true,
  "payUrl": "https://your-manual-payment-page.com",
  "qrData": "fallback-qr-code",
  "transferInfo": {
    "accountNumber": "0123456789",
    "accountName": "NGUYEN VAN A"
  }
}
```

## 🎯 NEXT STEPS:

### Nếu PayOS working:
- ✅ Credentials đã hợp lệ
- ✅ Payment sẽ hoạt động tự động
- ✅ User có thể thanh toán thật

### Nếu PayOS failed:
- 🔑 Cần credentials PayOS thật
- 📝 Update Render environment variables
- 🚀 Redeploy backend

## 💡 LƯU Ý:

Credentials hiện tại trong backend có thể là:
1. **Test credentials** - chỉ dùng để dev
2. **Expired credentials** - cần refresh
3. **Real credentials** - nhưng cần config thêm

Hãy test với curl commands trên để biết chính xác!