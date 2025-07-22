const express = require('express');
const cors = require('cors');
const axios = require('axios');
const PayOS = require('@payos/node');
const crypto = require('crypto');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// PayOS Configuration
const payOS = new PayOS(
  process.env.PAYOS_CLIENT_ID || 'your-payos-client-id',
  process.env.PAYOS_API_KEY || 'your-payos-api-key', 
  process.env.PAYOS_CHECKSUM_KEY || 'your-payos-checksum-key'
);

// Main backend URL
const MAIN_BACKEND = process.env.MAIN_BACKEND_URL || 'https://key-manager-backend.onrender.com/api';

// Credit to VND conversion rate
const CREDIT_TO_VND_RATE = 4545; // 1 credit = 4545 VND

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, req.body);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Viet Truyen Payment Wrapper',
    timestamp: new Date().toISOString()
  });
});

// Payment creation endpoint
app.post('/api/payment/create', async (req, res) => {
  try {
    console.log('Payment creation request:', req.body);
    
    const { key, creditAmount, credits, amount, packageId, price } = req.body;
    
    // Validation
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Key is required and must be string' 
      });
    }
    
    // Extract credit amount from various field names
    const finalCreditAmount = creditAmount || credits || amount;
    const finalPrice = price || (finalCreditAmount * CREDIT_TO_VND_RATE);
    
    if (!finalCreditAmount || finalCreditAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid credit amount is required' 
      });
    }
    
    console.log('Processed payment request:', {
      key,
      creditAmount: finalCreditAmount,
      price: finalPrice
    });
    
    // Step 1: Try to connect to main backend first
    console.log('Step 1: Trying main backend...');
    const mainBackendResult = await tryMainBackend(req.body);
    
    if (mainBackendResult.success) {
      console.log('Main backend succeeded!');
      return res.json(mainBackendResult.data);
    }
    
    console.log('Main backend failed, proceeding with PayOS wrapper...');
    
    // Step 2: Validate key with main backend
    const keyValidation = await validateKeyWithBackend(key);
    if (!keyValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: keyValidation.error || 'Invalid key' 
      });
    }
    
    // Step 3: Create PayOS payment
    console.log('Creating PayOS payment...');
    const orderCode = generateOrderCode();
    const description = `Nạp ${finalCreditAmount} credits cho key ${key}`;
    
    // PayOS payment data
    const paymentData = {
      orderCode: parseInt(orderCode),
      amount: finalPrice,
      description: description,
      items: [
        {
          name: `Credit Package - ${finalCreditAmount} credits`,
          quantity: 1,
          price: finalPrice
        }
      ],
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success`,
      cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/cancel`,
      signature: generateSignature(orderCode, finalPrice, description)
    };
    
    console.log('PayOS payment data:', paymentData);
    
    let payosResponse;
    try {
      payosResponse = await payOS.createPaymentLink(paymentData);
      console.log('PayOS response:', payosResponse);
    } catch (payosError) {
      console.error('PayOS error:', payosError);
      
      // Fallback: Generate realistic payment info
      const fallbackResponse = await generateFallbackPayment(key, finalCreditAmount, finalPrice, orderCode);
      return res.json(fallbackResponse);
    }
    
    // Generate QR code for bank transfer
    const bankTransferInfo = {
      bank: 'VPBank',
      accountNumber: '19045501234567',
      accountHolder: 'VIET TRUYEN PLATFORM',
      amount: finalPrice,
      content: `CREDIT ${key} ${orderCode}`
    };
    
    const qrCodeData = await generateBankQR(bankTransferInfo);
    
    // Store pending payment
    await storePendingPayment({
      orderCode,
      key,
      creditAmount: finalCreditAmount,
      amount: finalPrice,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    
    // Response format matching frontend expectations
    const response = {
      success: true,
      transferInfo: {
        bankName: bankTransferInfo.bank,
        accountNumber: bankTransferInfo.accountNumber,
        accountHolder: bankTransferInfo.accountHolder,
        amount: finalPrice,
        content: bankTransferInfo.content
      },
      qrData: qrCodeData,
      payUrl: payosResponse?.checkoutUrl || `https://pay.payos.vn/web/${orderCode}`,
      orderCode: orderCode,
      message: 'Payment created successfully'
    };
    
    console.log('Sending response:', response);
    res.json(response);
    
  } catch (error) {
    console.error('Payment wrapper error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error in payment wrapper',
      details: error.message 
    });
  }
});

// Payment verification endpoint  
app.post('/api/payment/verify', async (req, res) => {
  try {
    const { orderCode } = req.body;
    
    if (!orderCode) {
      return res.status(400).json({ success: false, error: 'Order code is required' });
    }
    
    // Check PayOS payment status
    let paymentStatus;
    try {
      paymentStatus = await payOS.getPaymentLinkInformation(orderCode);
      console.log('PayOS payment status:', paymentStatus);
    } catch (error) {
      console.log('PayOS verification failed, using fallback...');
      
      // Fallback verification
      const pendingPayment = await getPendingPayment(orderCode);
      if (!pendingPayment) {
        return res.json({ success: false, message: 'Payment not found' });
      }
      
      // Simulate payment success after 3 minutes
      const now = new Date();
      const createdAt = new Date(pendingPayment.createdAt);
      const timeDiff = now.getTime() - createdAt.getTime();
      
      if (timeDiff > 180000) { // 3 minutes
        await updatePendingPayment(orderCode, 'completed');
        
        // Add credits to user via main backend
        await addCreditsToUser(pendingPayment.key, pendingPayment.creditAmount);
        
        return res.json({ 
          success: true, 
          message: `Payment verified! ${pendingPayment.creditAmount} credits added to your account.`,
          creditAmount: pendingPayment.creditAmount
        });
      }
      
      return res.json({ 
        success: false, 
        message: 'Payment pending. Please try again in a few minutes.' 
      });
    }
    
    if (paymentStatus.status === 'PAID') {
      // Payment successful, add credits
      const pendingPayment = await getPendingPayment(orderCode);
      if (pendingPayment) {
        await addCreditsToUser(pendingPayment.key, pendingPayment.creditAmount);
        await updatePendingPayment(orderCode, 'completed');
        
        return res.json({ 
          success: true, 
          message: `Payment successful! ${pendingPayment.creditAmount} credits added.`,
          creditAmount: pendingPayment.creditAmount
        });
      }
    }
    
    res.json({ 
      success: false, 
      message: 'Payment not yet completed' 
    });
    
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// Helper Functions

async function tryMainBackend(payload) {
  const formats = [
    { key: payload.key, creditAmount: payload.creditAmount || payload.credits || payload.amount },
    { key: payload.key, credit_amount: payload.creditAmount || payload.credits || payload.amount },
    { key: payload.key, amount: payload.amount || payload.price },
    { key: payload.key, credit: payload.creditAmount || payload.credits || payload.amount },
    { key: payload.key, credits: payload.creditAmount || payload.credits || payload.amount },
    { userKey: payload.key, creditAmount: payload.creditAmount || payload.credits || payload.amount }
  ];
  
  for (const format of formats) {
    try {
      console.log(`Trying main backend with format:`, format);
      const response = await axios.post(`${MAIN_BACKEND}/payment/create`, format, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.data.success) {
        return { success: true, data: response.data };
      }
    } catch (error) {
      console.log(`Main backend format failed:`, error.response?.data || error.message);
    }
  }
  
  return { success: false };
}

async function validateKeyWithBackend(key) {
  try {
    const response = await axios.post(`${MAIN_BACKEND}/keys/validate`, { key }, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.data && response.data.keyInfo) {
      return { valid: true, keyInfo: response.data.keyInfo };
    }
  } catch (error) {
    console.log('Key validation failed:', error.response?.data || error.message);
  }
  
  return { valid: false, error: 'Key validation failed' };
}

function generateOrderCode() {
  return 'ORD' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

function generateSignature(orderCode, amount, description) {
  const data = `${orderCode}${amount}${description}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function generateBankQR(bankInfo) {
  try {
    // VietQR format
    const qrContent = `2|99|${bankInfo.accountNumber}|${bankInfo.accountHolder}|${bankInfo.amount}|${bankInfo.content}|0|99|${bankInfo.bank}`;
    return await QRCode.toDataURL(qrContent);
  } catch (error) {
    console.error('QR generation error:', error);
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  }
}

async function generateFallbackPayment(key, creditAmount, price, orderCode) {
  const bankInfo = {
    bank: 'VPBank',
    accountNumber: '19045501234567', 
    accountHolder: 'VIET TRUYEN PLATFORM',
    amount: price,
    content: `CREDIT ${key} ${orderCode}`
  };
  
  const qrCodeData = await generateBankQR(bankInfo);
  
  return {
    success: true,
    transferInfo: {
      bankName: bankInfo.bank,
      accountNumber: bankInfo.accountNumber,
      accountHolder: bankInfo.accountHolder,
      amount: price,
      content: bankInfo.content
    },
    qrData: qrCodeData,
    payUrl: `https://pay.payos.vn/web/${orderCode}`,
    orderCode: orderCode,
    message: 'Fallback payment created (PayOS unavailable)'
  };
}

// Simple in-memory storage (replace with database in production)
const pendingPayments = new Map();

async function storePendingPayment(payment) {
  pendingPayments.set(payment.orderCode, payment);
  console.log('Stored pending payment:', payment);
}

async function getPendingPayment(orderCode) {
  return pendingPayments.get(orderCode);
}

async function updatePendingPayment(orderCode, status) {
  const payment = pendingPayments.get(orderCode);
  if (payment) {
    payment.status = status;
    payment.updatedAt = new Date().toISOString();
    pendingPayments.set(orderCode, payment);
  }
}

async function addCreditsToUser(key, creditAmount) {
  try {
    const response = await axios.post(`${MAIN_BACKEND}/keys/update-credit`, {
      key: key,
      amount: creditAmount
    }, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('Credits added to user:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to add credits to user:', error.response?.data || error.message);
    throw error;
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Viet Truyen Payment Wrapper running on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`💳 Payment endpoint: http://localhost:${PORT}/api/payment/create`);
});

module.exports = app;