const Payment = require('../models/Payment');
const User = require('../models/User');
const CreditPackage = require('../models/CreditPackage');
const { findUserByUsernameVariations } = require('../utils/usernameUtils');

class EnhancedPaymentService {
    constructor(paymentService) {
        this.paymentService = paymentService;
    }
    
    // Enhanced subscription payment with better user resolution
    async createSubscriptionPaymentEnhanced(userIdentifier, plan, metadata = {}) {
        try {
            console.log('🚀 Enhanced subscription payment creation:', { userIdentifier, planId: plan.planId });
            
            // Step 1: Find user with multiple methods
            const user = await this.findUserReliably(userIdentifier);
            if (!user) {
                throw new Error(`User not found: ${userIdentifier}`);
            }
            
            console.log(`✅ User found: ${user.username} (${user.email})`);
            
            // Step 2: Validate subscription eligibility
            await this.validateSubscriptionEligibility(user, plan);
            
            // Step 3: Create payment using original service
            const paymentResult = await this.paymentService.createSubscriptionPayment(user._id, plan, {
                ...metadata,
                userResolutionMethod: 'enhanced',
                originalIdentifier: userIdentifier,
                resolvedUsername: user.username
            });
            
            // Step 4: Add enhanced tracking
            if (paymentResult.success) {
                await this.addPaymentTracking(paymentResult.payment, user, plan);
            }
            
            return paymentResult;
            
        } catch (error) {
            console.error('Enhanced payment creation error:', error);
            throw error;
        }
    }
    
    // Find user with multiple fallback methods
    async findUserReliably(identifier) {
        // Method 1: Direct ID lookup
        if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
            const user = await User.findById(identifier);
            if (user) return user;
        }
        
        // Method 2: Email lookup
        if (identifier.includes('@')) {
            const user = await User.findOne({ email: identifier });
            if (user) return user;
        }
        
        // Method 3: Exact username lookup
        let user = await User.findOne({ username: identifier });
        if (user) return user;
        
        // Method 4: Username variations lookup
        const usernameMatch = await findUserByUsernameVariations(User, identifier);
        if (usernameMatch) {
            console.log(`🔍 Found user via username variation: ${identifier} → ${usernameMatch.matchedUsername}`);
            return usernameMatch.user;
        }
        
        // Method 5: Case-insensitive email lookup
        user = await User.findOne({ 
            email: { $regex: new RegExp(`^${identifier}$`, 'i') }
        });
        if (user) return user;
        
        return null;
    }
    
    // Validate if user can purchase this subscription
    async validateSubscriptionEligibility(user, plan) {
        // Check if user is active
        if (!user.isActive) {
            throw new Error('User account is deactivated');
        }
        
        // Check for existing active payments for same plan
        const existingPayment = await Payment.findOne({
            userId: user._id,
            planId: plan.planId,
            status: 'pending',
            expiredAt: { $gt: new Date() }
        });
        
        if (existingPayment) {
            console.log(`⚠️ User already has pending payment for ${plan.planId}`);
            // Don't throw error, just log - they might want to pay again
        }
        
        // Check current subscription status
        if (user.subscriptionType && user.subscriptionType !== 'free') {
            console.log(`📋 User currently has: ${user.subscriptionType}`);
            
            if (user.subscriptionExpiresAt) {
                const now = new Date();
                const daysLeft = Math.ceil((user.subscriptionExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                console.log(`📅 Current subscription expires in ${daysLeft} days`);
            }
        }
        
        return true;
    }
    
    // Add enhanced tracking to payment
    async addPaymentTracking(payment, user, plan) {
        try {
            // Add metadata to payment
            payment.enhancedMetadata = {
                userResolution: {
                    resolvedUserId: user._id,
                    resolvedUsername: user.username,
                    resolvedEmail: user.email
                },
                subscriptionContext: {
                    currentSubscription: user.subscriptionType,
                    currentExpiry: user.subscriptionExpiresAt,
                    planToUpgrade: plan.planId
                },
                timestamp: new Date()
            };
            
            await payment.save();
            console.log(`📝 Enhanced tracking added to payment ${payment._id}`);
            
        } catch (error) {
            console.warn('Failed to add enhanced tracking:', error.message);
        }
    }
    
    // Enhanced payment completion with atomic operations
    async completePaymentEnhanced(paymentId, transactionId = null) {
        const session = await User.startSession();
        
        try {
            await session.withTransaction(async () => {
                console.log(`🔄 Enhanced payment completion for: ${paymentId}`);
                
                // Find payment with user populated
                const payment = await Payment.findById(paymentId).populate('userId').session(session);
                if (!payment) {
                    throw new Error('Payment not found');
                }
                
                if (payment.status === 'completed') {
                    console.log('⚠️ Payment already completed');
                    return { success: true, message: 'Payment already completed' };
                }
                
                // Find plan
                const plan = await CreditPackage.findOne({ planId: payment.planId }).session(session);
                if (!plan) {
                    throw new Error(`Plan not found: ${payment.planId}`);
                }
                
                // Get user
                const user = payment.userId;
                if (!user) {
                    throw new Error('User not found for this payment');
                }
                
                // Calculate new subscription
                const subscriptionUpdate = this.calculateSubscriptionUpdate(user, plan, payment);
                
                // Update user subscription atomically
                await User.findByIdAndUpdate(
                    user._id,
                    {
                        subscriptionType: subscriptionUpdate.newType,
                        subscriptionExpiresAt: subscriptionUpdate.newExpiry,
                        $push: {
                            subscriptionHistory: {
                                planId: plan.planId,
                                startDate: new Date(),
                                endDate: subscriptionUpdate.newExpiry,
                                paymentId: payment._id,
                                status: 'active'
                            }
                        }
                    },
                    { session }
                );
                
                // Mark payment as completed
                payment.status = 'completed';
                payment.transactionId = transactionId || `ENH_${Date.now()}`;
                payment.completedAt = new Date();
                payment.completionMetadata = {
                    subscriptionUpdate: subscriptionUpdate,
                    enhancedProcessing: true
                };
                
                await payment.save({ session });
                
                console.log(`✅ Enhanced payment completion successful:`, {
                    userId: user._id,
                    username: user.username,
                    oldSubscription: user.subscriptionType,
                    newSubscription: subscriptionUpdate.newType,
                    newExpiry: subscriptionUpdate.newExpiry
                });
                
                return {
                    success: true,
                    payment,
                    user,
                    subscriptionUpdate
                };
            });
            
        } catch (error) {
            console.error('Enhanced payment completion failed:', error);
            throw error;
        } finally {
            await session.endSession();
        }
    }
    
    // Calculate subscription update logic
    calculateSubscriptionUpdate(user, plan, payment) {
        const now = new Date();
        let newExpiryDate;
        
        // Get current expiry or start from now
        const currentExpiry = user.subscriptionExpiresAt;
        const startDate = (currentExpiry && currentExpiry > now) ? currentExpiry : now;
        
        // Calculate new expiry based on plan
        if (plan.durationType === 'days') {
            newExpiryDate = new Date(startDate);
            newExpiryDate.setDate(newExpiryDate.getDate() + plan.durationValue);
        } else if (plan.durationType === 'months') {
            if (plan.durationValue >= 999) {
                // Lifetime plan
                newExpiryDate = new Date('2099-12-31');
            } else {
                newExpiryDate = new Date(startDate);
                newExpiryDate.setMonth(newExpiryDate.getMonth() + plan.durationValue);
            }
        } else {
            throw new Error('Invalid plan duration configuration');
        }
        
        return {
            newType: plan.planId,
            newExpiry: newExpiryDate,
            extendedFrom: currentExpiry,
            planDuration: plan.durationValue,
            planDurationType: plan.durationType
        };
    }
    
    // Health check for payment-subscription sync
    async checkPaymentSubscriptionHealth() {
        console.log('🏥 Checking payment-subscription health...');
        
        const issues = [];
        
        // Find completed payments without proper subscription updates
        const completedPayments = await Payment.find({
            status: 'completed',
            userId: { $exists: true },
            planId: { $exists: true }
        }).populate('userId');
        
        for (const payment of completedPayments) {
            if (!payment.userId) {
                issues.push({
                    type: 'MISSING_USER',
                    paymentId: payment._id,
                    description: 'Completed payment has no user'
                });
                continue;
            }
            
            const user = payment.userId;
            
            // Check if subscription type matches payment
            if (user.subscriptionType !== payment.planId) {
                issues.push({
                    type: 'SUBSCRIPTION_MISMATCH',
                    paymentId: payment._id,
                    userId: user._id,
                    username: user.username,
                    paymentPlan: payment.planId,
                    userSubscription: user.subscriptionType,
                    description: `Payment for ${payment.planId} but user has ${user.subscriptionType}`
                });
            }
        }
        
        return {
            totalPayments: completedPayments.length,
            issues: issues,
            healthScore: ((completedPayments.length - issues.length) / completedPayments.length * 100).toFixed(2)
        };
    }
}

module.exports = EnhancedPaymentService;
