const Payment = require('../models/Payment');
const Key = require('../models/Key');
const User = require('../models/User'); // Import User model
const CreditPackage = require('../models/CreditPackage');
const BankInfo = require('../models/BankInfo');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const axios = require('axios');

// Import PayOS SDK
let PayOS;
try {
    PayOS = require('@payos/node');
} catch (error) {
    console.warn('PayOS SDK not installed, using fallback mode');
}

class PaymentService {
    constructor() {
        // PayOS Configuration
        this.payos = {
            clientId: process.env.PAYOS_CLIENT_ID || 'be64263c-d0b5-48c7-a5e4-9e1357786d4c',
            apiKey: process.env.PAYOS_API_KEY || '6c790eab-3334-4180-bf54-d3071ca7f277',
            checksumKey: process.env.PAYOS_CHECKSUM_KEY || '271d878407a1020d240d9064d0bfb4300bfe2e02bf997bb28771dea73912bd55',
            baseUrl: 'https://api-merchant.payos.vn'
        };

        // Initialize PayOS SDK if available
        if (PayOS) {
            try {
                this.payOSClient = new PayOS(
                    this.payos.clientId,
                    this.payos.apiKey,
                    this.payos.checksumKey
                );
                console.log('✅ PayOS SDK initialized successfully');
            } catch (error) {
                console.error('❌ PayOS SDK initialization failed:', error.message);
                this.payOSClient = null;
            }
        } else {
            console.warn('❌ PayOS SDK not available');
        }

        // Default bank info (ONLY used if database is empty)
        this.defaultBankInfo = {
            accountNumber: '0123456789',
            accountName: 'NGUYEN VAN A', 
            bankName: 'Vietcombank',
            branchName: 'CN Ho Chi Minh'
        };
        
        console.log('🔧 Environment bank variables:', {
            hasAccountNumber: !!process.env.BANK_ACCOUNT_NUMBER,
            hasAccountName: !!process.env.BANK_ACCOUNT_NAME,
            hasBankName: !!process.env.BANK_NAME,
            accountNumber: process.env.BANK_ACCOUNT_NUMBER || 'not set',
            accountName: process.env.BANK_ACCOUNT_NAME || 'not set',
            bankName: process.env.BANK_NAME || 'not set'
        });
    }

    /**
     * Setup PayOS webhook URL
     */
    async setupWebhook(webhookUrl) {
        try {
            if (this.payOSClient && this.payOSClient.confirmWebhook) {
                console.log('Setting up PayOS webhook:', webhookUrl);
                const result = await this.payOSClient.confirmWebhook(webhookUrl);
                console.log('PayOS webhook setup result:', result);
                return result;
            } else {
                console.warn('PayOS SDK not available or confirmWebhook method not found');
                return { success: false, message: 'PayOS SDK not available' };
            }
        } catch (error) {
            console.error('Setup webhook error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get active bank info from database
     */
    async getBankInfo() {
        try {
            const bankInfo = await BankInfo.getActiveBankInfo();
            console.log('🏦 Bank info from database:', bankInfo ? {
                bankName: bankInfo.bankName,
                accountNumber: bankInfo.accountNumber,
                accountName: bankInfo.accountName
            } : 'No bank info found');
            
            if (!bankInfo) {
                console.log('📝 Using default bank info:', this.defaultBankInfo);
                return this.defaultBankInfo;
            }
            
            return bankInfo;
        } catch (error) {
            console.error('❌ Error getting bank info:', error);
            console.log('📝 Fallback to default bank info:', this.defaultBankInfo);
            return this.defaultBankInfo;
        }
    }

    /**
     * Get price for credit amount from database (with fallback calculation)
     */
    async getPriceForCredit(creditAmount) {
        try {
            console.log('💰 Getting price for credit amount:', creditAmount);
            
            // First check if exact package exists
            const creditPackage = await CreditPackage.findOne({ 
                credits: creditAmount, 
                isActive: { $ne: false } 
            });
            
            if (creditPackage) {
                console.log('✅ Found exact package:', { name: creditPackage.name, price: creditPackage.price });
                return creditPackage.price;
            }
            
            // ✅ FIXED: Fallback price calculation for flexible amounts
            // Use rate: 1 credit = 4545 VNĐ (approximately)
            const fallbackRate = 4545;
            const calculatedPrice = creditAmount * fallbackRate;
            console.log('⚡ Using fallback rate calculation:', { creditAmount, fallbackRate, price: calculatedPrice });
            return calculatedPrice;
        } catch (error) {
            console.error('❌ Error getting price for credit:', error);
            // Emergency fallback
            const emergencyPrice = creditAmount * 4545;
            console.log('🆘 Using emergency fallback:', emergencyPrice);
            return emergencyPrice;
        }
    }

    /**
     * Validate credit amount from database (with fallback for flexible amounts)
     */
    async isValidCreditAmount(creditAmount) {
        try {
            // First check if exact package exists
            const creditPackage = await CreditPackage.findOne({ 
                credits: creditAmount, 
                isActive: { $ne: false } 
            });
            
            if (creditPackage) {
                return true;
            }
            
            // ✅ FIXED: Allow any positive credit amount as fallback
            // This enables frontend default packages (100, 220, 800 credits)
            return creditAmount > 0 && creditAmount <= 10000; // Max 10k credits
        } catch (error) {
            console.error('Error validating credit amount:', error);
            return false;
        }
    }

    /**
     * Generate transfer content
     */
    generateTransferContent(userKey, paymentId) {
        // Use last 8 chars of userKey and payment ID for uniqueness
        const keyShort = userKey.slice(-8);
        const paymentShort = paymentId.slice(-8);
        return `NAPCREDIT ${keyShort} ${paymentShort}`;
    }

    /**
     * Generate PayOS signature
     */
    generatePayOSSignature(data) {
        const sortedKeys = Object.keys(data).sort();
        const dataString = sortedKeys.map(key => {
            const value = data[key];
            if (typeof value === 'object') {
                return `${key}=${JSON.stringify(value)}`;
            }
            return `${key}=${value}`;
        }).join('&');
        return crypto.createHmac('sha256', this.payos.checksumKey).update(dataString).digest('hex');
    }

    /**
     * Create PayOS payment link for Subscriptions
     */
    async createPayOSSubscriptionPayment(orderCode, plan, returnUrl = '', cancelUrl = '') {
        try {
            if (this.payOSClient) {
                const paymentData = {
                    orderCode: parseInt(orderCode),
                    amount: parseInt(plan.price),
                    description: plan.planId === 'monthly_premium' ? 'Goi Hang Thang' : 'Goi Vinh Vien',
                    items: [{
                        name: plan.name,
                        quantity: 1,
                        price: parseInt(plan.price)
                    }],
                    returnUrl: returnUrl || 'https://aistorytmvvfrontend.netlify.app/pricing?status=success',
                    cancelUrl: cancelUrl || 'https://aistorytmvvfrontend.netlify.app/pricing?status=cancelled'
                };

                console.log('Using PayOS SDK to create subscription payment:', paymentData);
                const paymentLinkRes = await this.payOSClient.createPaymentLink(paymentData);
                
                return {
                    success: true,
                    paymentLinkId: paymentLinkRes.paymentLinkId,
                    checkoutUrl: paymentLinkRes.checkoutUrl,
                    qrCode: paymentLinkRes.qrCode
                };
            } else {
                throw new Error('PayOS SDK not available');
            }
        } catch (error) {
            console.error('PayOS subscription payment creation error:', error.message || error);
            throw new Error(`Failed to create PayOS subscription payment: ${error.message || error}`);
        }
    }

    /**
     * Create PayOS payment link
     */
    async createPayOSPayment(orderCode, amount, description, returnUrl = '', cancelUrl = '') {
        try {
            // Use PayOS SDK if available
            if (this.payOSClient) {
                const paymentData = {
                    orderCode: parseInt(orderCode),
                    amount: parseInt(amount),
                    description: description,
                    items: [
                        {
                            name: "Nạp credit",
                            quantity: 1,
                            price: parseInt(amount)
                        }
                    ],
                    returnUrl: returnUrl || 'https://aistorytmvvfrontend.netlify.app/pricing?status=success',
                    cancelUrl: cancelUrl || 'https://aistorytmvvfrontend.netlify.app/pricing?status=cancelled'
                };

                console.log('Using PayOS SDK to create payment:', paymentData);
                const paymentLinkRes = await this.payOSClient.createPaymentLink(paymentData);
                
                return {
                    success: true,
                    paymentLinkId: paymentLinkRes.paymentLinkId,
                    checkoutUrl: paymentLinkRes.checkoutUrl,
                    qrCode: paymentLinkRes.qrCode
                };
            } else {
                throw new Error('PayOS SDK not available');
            }

        } catch (error) {
            console.error('PayOS payment creation error:', error.message || error);
            throw new Error(`Failed to create PayOS payment: ${error.message || error}`);
        }
    }

    /**
     * Generate payment URL (fallback to manual transfer if PayOS fails)
     */
    generatePaymentUrl(paymentData, bankInfo) {
        // Fallback manual transfer URL
        const params = new URLSearchParams({
            amount: paymentData.amount,
            content: paymentData.transferContent,
            account: bankInfo.accountNumber,
            bank: bankInfo.bankName
        });
        
        return `https://your-manual-payment-page.com/pay?${params.toString()}`;
    }

    /**
     * Generate QR code data (fallback for manual transfer)
     */
    generateQRData(paymentData, bankInfo) {
        // Vietnam QR Pay format for manual transfer
        return `2|010|${bankInfo.accountNumber}|${bankInfo.accountName}|${bankInfo.bankName}|${paymentData.amount}|${paymentData.transferContent}|VN`;
    }

    /**
     * Create Subscription Payment
     */
    async createSubscriptionPayment(userId, plan, metadata = {}) {
        try {
            console.log('🚀 Creating subscription payment:', { userId, planId: plan.planId, metadata });
            
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const bankInfo = await this.getBankInfo();

            const existingPayment = await Payment.findActiveSubscriptionPayment(userId, plan.planId);
            if (existingPayment) {
                console.log('🔄 Found existing active subscription payment:', existingPayment._id);
                return {
                    success: true,
                    payment: existingPayment,
                    payUrl: existingPayment.paymentData.payUrl,
                    qrData: existingPayment.paymentData.qrCode,
                    transferInfo: {
                        accountNumber: bankInfo.accountNumber,
                        accountName: bankInfo.accountName,
                        bankName: bankInfo.bankName,
                        amount: existingPayment.price,
                        content: existingPayment.paymentData.transferContent
                    }
                };
            }

            const paymentId = uuidv4();
            const orderCode = Date.now();
            const transferContent = `TT ${user.username.slice(0,10)} ${orderCode.toString().slice(-6)}`;
            
            const paymentData = {
                amount: plan.price,
                transferContent,
                bankAccount: bankInfo.accountNumber,
                payUrl: '',
qrCode: '',
                orderCode: orderCode,
                payosPaymentLinkId: null
            };

            const payosResult = await this.createPayOSSubscriptionPayment(orderCode, plan);
            paymentData.payUrl = payosResult.checkoutUrl;
            paymentData.qrCode = payosResult.qrCode;
            paymentData.payosPaymentLinkId = payosResult.paymentLinkId;

            const payment = new Payment({
                userId,
                planId: plan.planId,
                price: plan.price,
                paymentData,
                metadata,
                status: 'pending'
            });

            await payment.save();

            console.log(`💳 Subscription payment created: ${payment._id} for user ${userId}`);

            return {
                success: true,
                payment,
                payUrl: paymentData.payUrl,
                qrData: paymentData.qrCode,
                transferInfo: {
                    accountNumber: bankInfo.accountNumber,
                    accountName: bankInfo.accountName,
                    bankName: bankInfo.bankName,
                    amount: plan.price,
                    content: transferContent
                }
            };

        } catch (error) {
            console.error('Subscription payment creation error:', error);
            throw error;
        }
    }

    /**
     * Create payment
     */
    async createPayment(userKey, creditAmount, metadata = {}) {
        try {
            console.log('🚀 Creating payment:', { userKey: userKey.substring(0, 10) + '...', creditAmount, metadata });
            
            // Validate inputs
            if (!userKey || !creditAmount) {
                throw new Error('User key and credit amount are required');
            }

            if (!(await this.isValidCreditAmount(creditAmount))) {
                throw new Error('Invalid credit amount');
            }

            // Check if user key exists and is active
            const keyDoc = await Key.findOne({ key: userKey, isActive: true });
            if (!keyDoc) {
                throw new Error('Invalid or inactive user key');
            }
            
            console.log('✅ User key validated:', userKey.substring(0, 10) + '...');

            const price = await this.getPriceForCredit(creditAmount);
            if (!price) {
                throw new Error('Unable to get price for credit amount');
            }

            // Get bank info from database - ALWAYS fresh from DB
            const bankInfo = await this.getBankInfo();
            console.log('💳 Using bank info for payment:', {
                bankName: bankInfo.bankName,
                accountNumber: bankInfo.accountNumber,
                accountName: bankInfo.accountName
            });

            // ⚡ TEMPORARILY DISABLED: Skip existing payment check to always use fresh bank info
            // const existingPayment = await Payment.findActivePayment(userKey, creditAmount);
            // if (existingPayment && existingPayment.paymentData.payosPaymentLinkId) {
            //     console.log('🔄 Found existing payment, but will use current bank info');
            //     return {
            //         success: true,
            //         payment: existingPayment,
            //         payUrl: existingPayment.paymentData.payUrl,
            //         qrData: existingPayment.paymentData.qrCode,
            //         transferInfo: {
            //             accountNumber: bankInfo.accountNumber,
            //             accountName: bankInfo.accountName,
            //             bankName: bankInfo.bankName,
            //             amount: existingPayment.price,
            //             content: existingPayment.paymentData.transferContent
            //         }
            //     };
            // }
            console.log('🆕 Creating new payment with fresh bank info');

            // Create new payment
            const paymentId = uuidv4();
            const orderCode = Date.now(); // Unique order code for PayOS
            const transferContent = this.generateTransferContent(userKey, paymentId);
            const description = `Credit ${creditAmount}`.substring(0, 25); // Max 25 chars for PayOS
            
            const paymentData = {
                amount: price,
                transferContent,
                bankAccount: bankInfo.accountNumber,
                payUrl: '',
                qrCode: '',
                orderCode: orderCode,
                payosPaymentLinkId: null
            };

            try {
                // Try to create PayOS payment first
                console.log('Creating PayOS payment...', { orderCode, amount: price, description });
                const payosResult = await this.createPayOSPayment(orderCode, price, description);
                
                if (payosResult.success) {
                    paymentData.payUrl = payosResult.checkoutUrl;
                    paymentData.qrCode = payosResult.qrCode;
                    paymentData.payosPaymentLinkId = payosResult.paymentLinkId;
                    console.log('PayOS payment created successfully:', payosResult.paymentLinkId);
                } else {
                    throw new Error('PayOS payment creation failed');
                }
            } catch (payosError) {
                console.warn('PayOS payment creation failed, falling back to manual transfer:', payosError.message);
                // Fallback to manual transfer
                paymentData.payUrl = this.generatePaymentUrl(paymentData, bankInfo);
                paymentData.qrCode = this.generateQRData(paymentData, bankInfo);
            }

            const payment = new Payment({
                userKey,
                creditAmount,
                price,
                paymentData,
                metadata,
                status: 'pending'
            });

            await payment.save();

            console.log(`💳 Payment created: ${payment._id} for user ${userKey.substring(0, 10)}... Amount: ${price} VND`);

            return {
                success: true,
                payment,
                payUrl: paymentData.payUrl,
                qrData: paymentData.qrCode,
                transferInfo: {
                    accountNumber: bankInfo.accountNumber,
                    accountName: bankInfo.accountName,
                    bankName: bankInfo.bankName,
                    amount: price,
                    content: transferContent
                }
            };

        } catch (error) {
            console.error('Payment creation error:', error);
            throw error;
        }
    }

    /**
     * Check PayOS payment status
     */
    async checkPayOSPaymentStatus(orderCode) {
        try {
            const response = await axios.get(`${this.payos.baseUrl}/v2/payment-requests/${orderCode}`, {
                headers: {
                    'x-client-id': this.payos.clientId,
                    'x-api-key': this.payos.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.code === '00') {
                return {
                    success: true,
                    status: response.data.data.status, // PENDING, PAID, CANCELLED
                    data: response.data.data
                };
            } else {
                return {
                    success: false,
                    error: response.data.desc || 'Unknown error'
                };
            }

        } catch (error) {
            console.error('PayOS status check error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.desc || error.message
            };
        }
    }

    /**
     * Refund PayOS payment
     */
    async refundPayOSPayment(orderCode, refundAmount, reason = 'Admin refund') {
        try {
            if (!this.payOSClient) {
                console.warn('PayOS SDK not available, refund simulation only');
                return {
                    success: true,
                    refundId: `sim_refund_${Date.now()}`,
                    message: 'Refund simulated (PayOS SDK not available)',
                    amount: refundAmount,
                    reason
                };
            }

            console.log(`🔄 Processing PayOS refund for orderCode: ${orderCode}, amount: ${refundAmount}`);
            
            // PayOS refund API call
            // Note: PayOS may not have a direct refund API, this is a placeholder
            // In practice, you might need to use cancelPaymentLink or contact PayOS support
            let refundResult;
            
            try {
                // Try to cancel the payment link if it's still pending
                if (this.payOSClient.cancelPaymentLink) {
                    refundResult = await this.payOSClient.cancelPaymentLink(orderCode, reason);
                    console.log('✅ PayOS payment link cancelled:', refundResult);
                } else {
                    // If no cancel method, log for manual processing
                    console.warn('⚠️ PayOS refund requires manual processing');
                    refundResult = {
                        success: true,
                        message: 'Refund marked for manual processing',
                        requiresManualProcessing: true
                    };
                }
            } catch (cancelError) {
                console.error('❌ PayOS cancel/refund error:', cancelError);
                // Return success but mark as requiring manual processing
                refundResult = {
                    success: true,
                    message: `Refund requires manual processing: ${cancelError.message}`,
                    requiresManualProcessing: true
                };
            }

            return {
                success: true,
                refundId: refundResult.refundId || `manual_${orderCode}_${Date.now()}`,
                message: refundResult.message || 'Refund processed successfully',
                amount: refundAmount,
                reason,
                requiresManualProcessing: refundResult.requiresManualProcessing || false,
                gatewayResponse: refundResult
            };

        } catch (error) {
            console.error('PayOS refund error:', error);
            return {
                success: false,
                error: error.message || 'Refund processing failed',
                orderCode,
                amount: refundAmount
            };
        }
    }

    /**
     * Complete payment (manual verification for now)
     */
    async completePayment(paymentId, transactionId = null) {
        try {
            console.log('🔄 Starting payment completion for:', paymentId);
            
            const payment = await Payment.findById(paymentId).populate('userId');
            if (!payment) {
                throw new Error('Payment not found');
            }
            
            console.log('📋 Payment details:', {
                id: payment._id,
                userKey: payment.userKey ? payment.userKey.substring(0, 10) + '...' : null,
                userId: payment.userId ? payment.userId._id : null,
                planId: payment.planId,
                creditAmount: payment.creditAmount,
                status: payment.status
            });

            if (payment.status !== 'pending') {
                throw new Error('Payment is not in pending status');
            }

            if (payment.isExpired()) {
                await payment.markAsFailed();
                throw new Error('Payment has expired');
            }

            // --- Handle Subscription Payment ---
            if (payment.userId && payment.planId) {
                const user = payment.userId; // Already populated
                const plan = await CreditPackage.findOne({ planId: payment.planId });

                if (!user || !plan) {
                    throw new Error(`User or Plan not found for this payment. User: ${!!user}, Plan: ${!!plan}`);
                }

                const now = new Date();
                let newExpiryDate;

                // If user has an existing subscription, extend it. Otherwise, start from now.
                const currentExpiry = user.subscriptionExpiresAt;
                const startDate = (currentExpiry && currentExpiry > now) ? currentExpiry : now;
                
                // Handle new duration system
                if (plan.durationType === 'days') {
                    // Add days to subscription
                    newExpiryDate = new Date(startDate);
                    newExpiryDate.setDate(newExpiryDate.getDate() + plan.durationValue);
                } else if (plan.durationType === 'months' || plan.durationMonths) {
                    // Handle months (new system or backward compatibility)
                    const monthsToAdd = plan.durationValue || plan.durationMonths;
                    
                    if (monthsToAdd >= 999) { // Lifetime plan
                        newExpiryDate = new Date('2099-12-31');
                    } else {
                        newExpiryDate = new Date(startDate);
                        newExpiryDate.setMonth(newExpiryDate.getMonth() + monthsToAdd);
                    }
                } else {
                    throw new Error('Invalid plan duration configuration');
                }

                user.subscriptionType = plan.planId;
                user.subscriptionExpiresAt = newExpiryDate;
                await user.save();
                
                await payment.markAsCompleted(transactionId || `SUB_${Date.now()}`);
                console.log(`✅ Subscription for user ${user._id} updated to ${plan.name}. Expires: ${newExpiryDate.toISOString()}`);
                
                return {
                    success: true,
                    payment,
                    user: user
                };
            }

            // --- Handle Legacy Credit Payment ---
            if (payment.userKey && payment.creditAmount) {
                const key = await Key.findOne({ key: payment.userKey });
                if (!key) {
                    throw new Error('User key not found for credit payment');
                }
                
                const updateResult = await Key.findByIdAndUpdate(key._id, {
                    $inc: { credit: payment.creditAmount }
                }, { new: true });
                
                await payment.markAsCompleted(transactionId || `CREDIT_${Date.now()}`);
                console.log(`✅ Legacy credit payment completed for key ${key.key.substring(0,10)}...`);

                return {
                    success: true,
                    payment,
                    newCreditBalance: updateResult.credit
                };
            }

            throw new Error('Payment type could not be determined. No userId/planId or userKey/creditAmount found.');

        } catch (error) {
            console.error('❌ Payment completion error:', error);
            const payment = await Payment.findById(paymentId);
            if (payment) await payment.markAsFailed();
            throw error;
        }
    }

    /**
     * Get payment status
     */
    async getPaymentStatus(paymentId) {
        try {
            const payment = await Payment.findById(paymentId);
            if (!payment) {
                throw new Error('Payment not found');
            }

            return {
                success: true,
                payment,
                isExpired: payment.isExpired()
            };

        } catch (error) {
            console.error('Get payment status error:', error);
            throw error;
        }
    }

    /**
     * Get user payments
     */
    async getUserPayments(userKey, limit = 10) {
        try {
            const payments = await Payment.find({ userKey })
                .sort({ createdAt: -1 })
                .limit(limit);

            return {
                success: true,
                payments
            };

        } catch (error) {
            console.error('Get user payments error:', error);
            throw error;
        }
    }

    /**
     * Cleanup expired payments
     */
    async cleanupExpiredPayments() {
        try {
            const result = await Payment.cleanup();
            console.log(`🧹 Cleaned up ${result.modifiedCount} expired payments`);
            return result;
        } catch (error) {
            console.error('Cleanup expired payments error:', error);
            throw error;
        }
    }
}

const paymentServiceInstance = new PaymentService();

// Export both the instance and class
module.exports = paymentServiceInstance;
module.exports.PaymentService = PaymentService;