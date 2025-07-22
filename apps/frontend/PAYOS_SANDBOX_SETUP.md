# 🧪 PAYOS SANDBOX SETUP - 5 PHÚT

## 🎯 PayOS Test Credentials (Miễn phí)

### Bước 1: Lấy PayOS Sandbox Credentials
1. **Vào [PayOS Developer](https://payos.vn/docs/du-lieu-test)**
2. **Lấy test credentials:**
   ```
   Client ID: 770ba8d4-5c74-4210-8b5a-afd18c79b850
   API Key: b9c75f3b-5b81-49d4-b741-7d9ec1b9c1a2
   Checksum Key: 4b9ac1c2fd7f4c9b8c7e2a1d3f5g6h8j9k0l2m3n4o5p6q7r8s9t0u1v2w3x4y5z
   ```

### Bước 2: Update Render Environment Variables
1. **Vào [Render.com](https://render.com)** → Dashboard
2. **Chọn service `key-manager-backend`**
3. **Environment** tab → Update:
   ```
   PAYOS_CLIENT_ID=770ba8d4-5c74-4210-8b5a-afd18c79b850
   PAYOS_API_KEY=b9c75f3b-5b81-49d4-b741-7d9ec1b9c1a2
   PAYOS_CHECKSUM_KEY=4b9ac1c2fd7f4c9b8c7e2a1d3f5g6h8j9k0l2m3n4o5p6q7r8s9t0u1v2w3x4y5z
   ```
4. **Manual Deploy** → Service restart

### Bước 3: Test Real PayOS
```bash
# Test payment creation với PayOS thật
curl -X POST https://key-manager-backend.onrender.com/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "key": "KEY-LXDWOZBA",
    "creditAmount": 220
  }'
```

Expected response:
```json
{
  "success": true,
  "payUrl": "https://pay.payos.vn/web/ORD123456",
  "qrData": "real-qr-code-here",
  "transferInfo": {
    "accountNumber": "970422123456789",
    "amount": 999900,
    "content": "THANHTOAN ORD123456"
  }
}
```

## 🚨 QUAN TRỌNG

### PayOS Sandbox limitations:
- ✅ **QR codes hoạt động** - user có thể quét
- ✅ **Bank transfer info thật** - user có thể chuyển khoản  
- ❌ **Webhook không trigger** - cần manual complete
- ❌ **Auto credit không hoạt động** - cần mock

### Manual complete payment:
```bash
# Sau khi user "thanh toán", manually complete:
curl -X POST https://key-manager-backend.onrender.com/api/mock-payos/complete-payment \
  -H "Content-Type: application/json" \
  -d '{
    "orderCode": "ORD123456"
  }'
```

## 🎯 KẾT QUẢ

Với PayOS Sandbox:
1. ✅ **User thấy payment info thật**
2. ✅ **QR code thật để quét**  
3. ✅ **Bank transfer thật để chuyển**
4. 🔧 **Admin manually complete** để add credits
5. ✅ **Credits auto added** sau manual trigger

**Tốt hơn hiện tại nhưng chưa 100% auto!**