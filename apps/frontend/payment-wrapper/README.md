# Viet Truyen Payment Wrapper

Payment API wrapper service with PayOS integration for Viet Truyen platform.

## 🚀 Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/dBHJHm)

1. **Click "Deploy on Railway" button above**
2. **Set environment variables:**
   ```
   PAYOS_CLIENT_ID=your-payos-client-id
   PAYOS_API_KEY=your-payos-api-key  
   PAYOS_CHECKSUM_KEY=your-payos-checksum-key
   MAIN_BACKEND_URL=https://key-manager-backend.onrender.com/api
   FRONTEND_URL=https://your-frontend-domain.com
   ```
3. **Deploy** and get your wrapper URL

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your PayOS credentials
nano .env

# Start development server
npm run dev

# Test health check
curl http://localhost:3001/health
```

## 📝 API Endpoints

### POST /api/payment/create
Create payment with multiple format support:

```json
{
  "key": "KEY-LXDWOZBA",
  "creditAmount": 220
}
```

Response:
```json
{
  "success": true,
  "transferInfo": {
    "bankName": "VPBank",
    "accountNumber": "19045501234567",
    "accountHolder": "VIET TRUYEN PLATFORM", 
    "amount": 1000000,
    "content": "CREDIT KEY-LXDWOZBA ORD..."
  },
  "qrData": "data:image/png;base64,...",
  "payUrl": "https://pay.payos.vn/web/ORD...",
  "orderCode": "ORD..."
}
```

### POST /api/payment/verify
Verify payment status:

```json
{
  "orderCode": "ORD1234567890"
}
```

### GET /health
Health check endpoint

## 🎯 Features

- ✅ **Multi-format payload support** - Accepts creditAmount, credits, amount fields
- ✅ **Main backend fallback** - Tries original backend first
- ✅ **PayOS integration** - Real payment processing
- ✅ **QR code generation** - Vietnamese banking QR codes
- ✅ **Payment verification** - Status checking and credit addition
- ✅ **Error handling** - Comprehensive fallback mechanisms
- ✅ **CORS enabled** - Frontend integration ready

## 🔄 How it works

1. **Try main backend** with multiple formats
2. **If main backend fails** → Use PayOS wrapper
3. **Validate user key** with main backend
4. **Create PayOS payment** with real bank integration
5. **Generate QR code** for manual bank transfer
6. **Store pending payment** for verification
7. **Return payment info** to frontend

## 🏦 PayOS Integration

This wrapper integrates with PayOS (Vietnamese payment gateway):
- Real bank transfers
- QR code payments  
- Mobile banking support
- Automatic payment verification

## 📊 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYOS_CLIENT_ID` | Yes | PayOS client ID |
| `PAYOS_API_KEY` | Yes | PayOS API key |
| `PAYOS_CHECKSUM_KEY` | Yes | PayOS checksum key |
| `MAIN_BACKEND_URL` | No | Original backend URL |
| `FRONTEND_URL` | No | Frontend domain for redirects |
| `PORT` | No | Server port (default 3001) |

## 🚦 Deployment Options

### Railway (Recommended)
1. Connect GitHub repo
2. Set environment variables
3. Deploy automatically

### Heroku
```bash
heroku create viet-truyen-payment
heroku config:set PAYOS_CLIENT_ID=your-id
heroku config:set PAYOS_API_KEY=your-key
heroku config:set PAYOS_CHECKSUM_KEY=your-checksum
git push heroku main
```

### Vercel
```bash
vercel --prod
```

## 🔒 Security

- Input validation and sanitization
- Environment variable protection
- Rate limiting ready
- Error message sanitization
- CORS properly configured

## 📞 Support

For issues or questions:
1. Check logs with `docker logs` or platform logs
2. Verify PayOS credentials
3. Test with health check endpoint
4. Contact development team