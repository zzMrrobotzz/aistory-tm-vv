const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { findUserByUsernameVariations, suggestAvailableUsername, normalizeUsername } = require('../utils/usernameUtils');

// Enhanced login endpoint with username variations support
router.post('/login-enhanced', async (req, res) => {
    const { username, email, password } = req.body;
    
    try {
        let user = null;
        let matchInfo = null;
        
        // Try to find user by email first (most reliable)
        if (email) {
            user = await User.findOne({ email });
        }
        
        // If not found by email, try username variations
        if (!user && username) {
            matchInfo = await findUserByUsernameVariations(User, username);
            if (matchInfo) {
                user = matchInfo.user;
            }
        }
        
        if (!user) {
            // Provide helpful error message
            let errorMessage = 'Invalid credentials';
            if (username) {
                const suggestion = await suggestAvailableUsername(User, username);
                errorMessage = `User not found. Did you mean to register as "${suggestion}"? Or try logging in with your email address.`;
            }
            
            return res.status(400).json({ 
                msg: errorMessage,
                suggestion: username ? await suggestAvailableUsername(User, username) : null,
                helpText: 'Try using your email address to login, or contact support if you need help finding your username.'
            });
        }
        
        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid password' });
        }
        
        // Check if user account is active
        if (!user.isActive) {
            return res.status(403).json({ 
                msg: 'Account is deactivated. Please contact support.',
                support: true
            });
        }
        
        // Generate JWT token
        const payload = {
            user: {
                id: user.id,
            },
        };
        
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                
                // Successful login response with additional info
                const response = {
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        subscriptionType: user.subscriptionType || 'free',
                        subscriptionExpiresAt: user.subscriptionExpiresAt,
                        remainingCredits: user.remainingCredits || 0
                    },
                    loginInfo: {
                        success: true,
                        message: 'Login successful'
                    }
                };
                
                // If username was different from input, inform user
                if (matchInfo && matchInfo.originalInput !== matchInfo.matchedUsername) {
                    response.loginInfo.usernameNote = `You logged in as "${matchInfo.matchedUsername}" (you entered "${matchInfo.originalInput}")`;
                    response.loginInfo.actualUsername = matchInfo.matchedUsername;
                }
                
                // Check subscription status and provide helpful info
                if (user.subscriptionType && user.subscriptionType !== 'free') {
                    if (user.subscriptionExpiresAt) {
                        const now = new Date();
                        const expiryDate = new Date(user.subscriptionExpiresAt);
                        const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        
                        if (daysLeft > 0) {
                            response.loginInfo.subscriptionStatus = `Your ${user.subscriptionType} subscription is active with ${daysLeft} days remaining.`;
                        } else {
                            response.loginInfo.subscriptionStatus = 'Your subscription has expired. Please renew to continue using premium features.';
                            response.loginInfo.subscriptionExpired = true;
                        }
                    } else {
                        response.loginInfo.subscriptionStatus = `You have a ${user.subscriptionType} subscription.`;
                    }
                } else {
                    response.loginInfo.subscriptionStatus = 'You have a free account. Upgrade to access premium features.';
                }
                
                res.json(response);
            }
        );
        
    } catch (err) {
        console.error('Enhanced login error:', err.message);
        res.status(500).json({ 
            msg: 'Server error during login',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
});

// Enhanced registration with username normalization
router.post('/register-enhanced', async (req, res) => {
    const { username, email, password } = req.body;
    
    try {
        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ 
                msg: 'Please provide username, email, and password' 
            });
        }
        
        // Check if user already exists
        let existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ 
                    msg: 'User with this email already exists',
                    field: 'email'
                });
            } else {
                return res.status(400).json({ 
                    msg: 'Username already taken',
                    field: 'username',
                    suggestion: await suggestAvailableUsername(User, username)
                });
            }
        }
        
        // Normalize username
        const normalizedUsername = normalizeUsername(username);
        
        // Check if normalized username is different and available
        if (normalizedUsername !== username) {
            const normalizedExists = await User.findOne({ username: normalizedUsername });
            if (normalizedExists) {
                const suggestion = await suggestAvailableUsername(User, username);
                return res.status(400).json({
                    msg: `Username "${username}" normalizes to "${normalizedUsername}" which is taken`,
                    suggestion,
                    field: 'username'
                });
            }
        }
        
        // Create new user
        const user = new User({
            username: normalizedUsername,
            email,
            password,
            subscriptionType: 'free',
            isActive: true,
            createdAt: new Date()
        });
        
        await user.save();
        
        // Generate token
        const payload = {
            user: {
                id: user.id,
            },
        };
        
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                
                res.status(201).json({
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        subscriptionType: user.subscriptionType
                    },
                    registrationInfo: {
                        success: true,
                        message: 'Registration successful',
                        finalUsername: user.username,
                        originalUsername: username !== user.username ? username : null
                    }
                });
            }
        );
        
    } catch (err) {
        console.error('Enhanced registration error:', err.message);
        res.status(500).json({ 
            msg: 'Server error during registration',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
});

// Utility endpoint to check username availability
router.get('/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const normalized = normalizeUsername(username);
        
        const existingUser = await User.findOne({ username: normalized });
        
        if (existingUser) {
            const suggestion = await suggestAvailableUsername(User, username);
            res.json({
                available: false,
                suggested: suggestion,
                normalized
            });
        } else {
            res.json({
                available: true,
                normalized
            });
        }
    } catch (err) {
        console.error('Username check error:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
