# Backend Payment API Fix Guide

## 🚨 Vấn đề hiện tại
Frontend gửi payload nhưng backend trả về lỗi "Key and credit amount are required" và "Invalid credit amount"

## ✅ Format API phải hỗ trợ
Backend cần accept một trong các format sau:

### Format 1 (Đơn giản nhất):
```json
POST /api/payment/create
{
  "key": "KEY-LXDWOZBA",
  "creditAmount": 220
}
```

### Format 2 (Với package info):
```json
POST /api/payment/create
{
  "key": "KEY-LXDWOZBA", 
  "packageId": "default-2",
  "amount": 1000000,
  "credits": 220
}
```

## 🔧 Backend Code Fix (Node.js/Express)

```javascript
// /routes/payment.js
app.post('/payment/create', async (req, res) => {
  try {
    const { key, creditAmount, credits, amount, packageId } = req.body;
    
    // Validation
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Key is required' 
      });
    }
    
    // Accept multiple credit field formats
    const finalCreditAmount = creditAmount || credits || amount;
    if (!finalCreditAmount || finalCreditAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid credit amount is required' 
      });
    }
    
    // Validate key exists
    const keyInfo = await validateKey(key);
    if (!keyInfo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid key' 
      });
    }
    
    // Create PayOS payment
    const paymentData = await createPayOSPayment({
      amount: packageId ? getPackagePrice(packageId) : finalCreditAmount * 1000, // VNĐ
      description: `Nạp ${finalCreditAmount} credits cho key ${key}`,
      orderCode: generateOrderCode(),
      returnUrl: `${process.env.FRONTEND_URL}/payment/success`,
      cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel`
    });
    
    // Save pending payment to database
    await savePendingPayment({
      key,
      creditAmount: finalCreditAmount,
      orderCode: paymentData.orderCode,
      amount: paymentData.amount
    });
    
    res.json({
      success: true,
      transferInfo: {
        bankName: 'PayOS',
        accountNumber: paymentData.qrCode,
        amount: paymentData.amount,
        content: paymentData.description
      },
      qrData: paymentData.qrCode,
      payUrl: paymentData.checkoutUrl
    });
    
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});
```

## 🧪 Test với Postman/Curl

```bash
curl -X POST https://key-manager-backend.onrender.com/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "key": "KEY-LXDWOZBA",
    "creditAmount": 220
  }'
```

## ⚡ Triển khai ngay
1. Copy code trên vào backend
2. Deploy backend 
3. Test với frontend
4. Xóa fallback UI trong frontend

Priority: HIGH - Cần fix ngay để hoạt động thực tế