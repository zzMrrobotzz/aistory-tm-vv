# 🔑 PAYOS SETUP GUIDE - AUTO CREDIT SYSTEM

## 🎯 MỤC TIÊU
User thanh toán → Credit tự động cộng vào tài khoản (HOÀN TOÀN TỰ ĐỘNG)

## ✅ BACKEND ĐÃ SẴN SÀNG
- ✅ PayOS webhook endpoint: `/api/payment/webhook/payos`
- ✅ Auto credit addition: `$inc: { credit: payment.creditAmount }`
- ✅ Payment completion flow
- ✅ Audit logging

## 🔑 BƯỚC 1: LẤY PAYOS CREDENTIALS

### Option A: Đăng ký PayOS mới (Khuyến nghị)
1. **Vào [PayOS.vn](https://payos.vn)**
2. **Đăng ký tài khoản merchant**
3. **Upload giấy tờ doanh nghiệp** (GPKD, CMND/CCCD)
4. **Đợi duyệt** (1-3 ngày làm việc)
5. **Lấy credentials:**
   - Client ID
   - API Key  
   - Checksum Key

### Option B: Dùng PayOS Sandbox (Test)
1. **Vào [PayOS Developer](https://payos.vn/docs)**
2. **Đăng ký sandbox account**
3. **Lấy test credentials** ngay lập tức

## 🔧 BƯỚC 2: UPDATE BACKEND CREDENTIALS

### Render Environment Variables:
1. **Vào Render.com** → Dashboard → `key-manager-backend`
2. **Environment** tab → Add/Update:
   ```
   PAYOS_CLIENT_ID=your-real-client-id
   PAYOS_API_KEY=your-real-api-key
   PAYOS_CHECKSUM_KEY=your-real-checksum-key
   ```
3. **Deploy** → Service restart với credentials mới

### Webhook URL Setup:
Trong PayOS dashboard, set webhook URL:
```
https://key-manager-backend.onrender.com/api/payment/webhook/payos
```

## 🎯 BƯỚC 3: TEST AUTO PAYMENT

### Test Flow:
1. **User chọn gói credit** (ví dụ: 220 credits)
2. **Frontend gọi** `/api/payment/create`
3. **Backend tạo PayOS payment** 
4. **User thanh toán** qua PayOS
5. **PayOS gửi webhook** → Backend
6. **Backend tự động cộng credit** → User account
7. **✅ HOÀN THÀNH!**

### Test Commands:
```bash
# 1. Tạo payment
curl -X POST https://key-manager-backend.onrender.com/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "key": "KEY-LXDWOZBA",
    "creditAmount": 220
  }'

# 2. Check user credit trước
curl -X POST https://key-manager-backend.onrender.com/api/keys/validate \
  -H "Content-Type: application/json" \
  -d '{"key": "KEY-LXDWOZBA"}'

# 3. User thanh toán qua PayOS UI

# 4. Check user credit sau (should be +220)
curl -X POST https://key-manager-backend.onrender.com/api/keys/validate \
  -H "Content-Type: application/json" \
  -d '{"key": "KEY-LXDWOZBA"}'
```

## 🚨 MOCK PayOS (TẠM THỜI)

Nếu chưa có PayOS thật, tôi có thể tạo mock PayOS endpoint để test:

```javascript
// Mock PayOS webhook để test
app.post('/mock-payos-webhook', (req, res) => {
  const { orderCode } = req.body;
  
  // Gửi webhook tới backend
  axios.post('https://key-manager-backend.onrender.com/api/payment/webhook/payos', {
    code: '00',
    data: {
      status: 'PAID',
      orderCode: orderCode,
      transactions: [{
        reference: `MOCK_${orderCode}`
      }]
    }
  });
  
  res.json({ success: true });
});
```

## 📋 EXPECTED AUTO FLOW

### Complete User Journey:
1. **User select package** → "Gói Phổ Biến: 220 credits - 1,000,000 VNĐ"
2. **Click "Nạp gói này"** → Frontend calls backend
3. **Backend creates PayOS payment** → Returns payment URL + QR
4. **User pays via PayOS** → Bank transfer/QR scan
5. **PayOS confirms payment** → Sends webhook to backend
6. **Backend receives webhook** → Auto adds 220 credits
7. **User sees updated credit** → Can use immediately!

## 🎉 RESULT

**100% AUTOMATED PAYMENT SYSTEM:**
- ✅ No manual intervention needed
- ✅ Instant credit addition
- ✅ Audit trail for all payments
- ✅ Error handling and retries
- ✅ Webhook verification

**Estimated setup time: 30 phút** (chờ PayOS approve: 1-3 ngày)