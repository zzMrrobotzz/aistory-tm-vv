# 🏢 PAYOS PRODUCTION SETUP - 100% AUTO CREDIT

## 🎯 PayOS Production (Thật 100%)

### Bước 1: Đăng ký PayOS Business
1. **Vào [PayOS.vn](https://payos.vn/dang-ky-merchant)**
2. **Đăng ký tài khoản merchant với:**
   - Thông tin doanh nghiệp (GPKD)
   - CMND/CCCD chủ doanh nghiệp
   - Tài khoản ngân hàng doanh nghiệp
3. **Chờ duyệt: 1-3 ngày làm việc**

### Bước 2: Lấy Production Credentials
Sau khi được duyệt:
1. **Login PayOS dashboard**
2. **API Management** → **Keys**
3. **Copy credentials:**
   - Client ID
   - API Key
   - Checksum Key

### Bước 3: Update Render với Production Keys
```
PAYOS_CLIENT_ID=your-real-client-id
PAYOS_API_KEY=your-real-api-key
PAYOS_CHECKSUM_KEY=your-real-checksum-key
```

### Bước 4: Configure Webhook URL
Trong PayOS dashboard:
- **Webhook URL:** `https://key-manager-backend.onrender.com/api/payment/webhook/payos`
- **Events:** Payment Success

## 🎉 KẾT QUẢ 100% AUTO

Với PayOS Production:
1. ✅ **User thanh toán** qua QR/transfer
2. ✅ **PayOS auto detect** payment
3. ✅ **Webhook auto sent** to backend
4. ✅ **Credits auto added** instantly
5. ✅ **User can use credits** immediately

**HOÀN TOÀN TỰ ĐỘNG - KHÔNG CẦN MANUAL!**

## 💰 Chi phí PayOS

- **Phí giao dịch:** 1.5% - 2.5% per transaction
- **Phí tích hợp:** Miễn phí
- **Phí duy trì:** Miễn phí

## 📋 Giấy tờ cần thiết

### Doanh nghiệp:
- ✅ Giấy phép kinh doanh
- ✅ CMND/CCCD người đại diện
- ✅ Tài khoản ngân hàng doanh nghiệp

### Cá nhân kinh doanh:
- ✅ CMND/CCCD
- ✅ Giấy đăng ký kinh doanh cá thể
- ✅ Tài khoản ngân hàng cá nhân

## 🚀 TIMELINE

- **Ngày 1:** Submit đăng ký PayOS
- **Ngày 2-3:** PayOS review hồ sơ
- **Ngày 4:** Nhận credentials, setup backend
- **Ngày 5:** Test với user thật → **100% AUTO CREDIT!**