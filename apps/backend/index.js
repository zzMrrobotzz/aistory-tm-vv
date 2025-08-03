console.log(">>> Starting application...");

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Import Models ---
const ApiProvider = require('./models/ApiProvider');
const Key = require('./models/Key');
const Transaction = require('./models/Transaction');
const AuditLog = require('./models/AuditLog');
const Package = require('./models/Package');
const Payment = require('./models/Payment');
const UserSession = require('./models/UserSession');
const { createAuditLog } = require('./utils/auditLogger');

// --- Import Routes ---
const keysRouter = require('./routes/keys');
const adminKeysRouter = require('./routes/adminKeys');

// --- Enhanced Subscription System ---
const authEnhancedRouter = require('./routes/authEnhanced');
const SubscriptionHealthChecker = require('./services/subscriptionHealthChecker');
const adminProxiesRouter = require('./routes/adminProxies');
const paymentRouter = require('./routes/payment');
const packagesRouter = require('./routes/packages');
const mockPayOSRouter = require('./routes/mockPayOS');
const bankInfoRouter = require('./routes/bankInfo');
const settingsRouter = require('./routes/settings');

// Import new routes
const adminStatsRouter = require('./routes/adminStats');
const aiProxyRouter = require('./routes/aiProxy');

// --- Import Services ---
const proxyManager = require('./services/proxyManager');
const ApiKeyManager = require('./services/apiKeyManager');

// --- Import Middleware ---
const auth = require('./middleware/auth');
const { updateUserActivity } = require('./middleware/activityTracker');

// --- App & Middleware Setup ---
const app = express();

// --- CORS Configuration ---
const allowedOrigins = [
  'https://keyadmintoolviettruyen.netlify.app',
  'https://toolviettruyen.netlify.app',
  'https://webadminaistory.netlify.app',
  'https://aistorytmvvfrontend.netlify.app',
  'https://aistorymmo.top', // Thêm domain mới
  'http://localhost:3000',
  'http://localhost:5173'
];
const corsOptions = {
  origin: (origin, callback) => {
    console.log(`🔒 CORS check for origin: ${origin}`);
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      console.error(`❌ CORS blocked: ${origin}`);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-session-token', 'Cache-Control', 'Pragma', 'cache-control', 'expires']
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- Log environment variables for debugging ---
console.log(`[ENV] NODE_ENV: ${process.env.NODE_ENV}`);
const mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
    // Mask password in log
    const maskedUri = mongoUri.replace(/:([^:]+)@/, ':****@');
    console.log(`[ENV] MongoDB URI found: ${maskedUri}`);
} else {
    console.error("[ENV] MONGODB_URI is not set! Application will fail.");
}

// --- MongoDB Connection ---
// mongoose.connect(process.env.MONGODB_URI)
//   .then(() => console.log('MongoDB connected!'))
//   .catch(err => console.error('MongoDB connection error:', err));

// --- API Endpoints ---

app.get('/api/status', (req, res) => {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({ 
        status: 'ok', 
        message: 'Backend is awake and running.',
        mongodb: mongoStatus,
        timestamp: new Date().toISOString(),
        cors_origins: allowedOrigins
    });
});

// Provider Management
app.get('/api/providers', async (req, res) => {
    try {
        const providers = await ApiProvider.find();
        res.json(providers);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch providers' });
    }
});

app.post('/api/providers/:providerId/keys', async (req, res) => {
    try {
        const { providerId } = req.params;
        const { apiKey } = req.body;
        if (!apiKey) return res.status(400).json({ message: 'apiKey is required' });

        const provider = await ApiProvider.findById(providerId);
        if (!provider) return res.status(404).json({ message: 'Provider not found' });

        if (provider.apiKeys.includes(apiKey)) {
            return res.status(409).json({ message: 'Key already exists' });
        }
        provider.apiKeys.push(apiKey);
        await provider.save();
        res.json(provider);
    } catch (error) {
        res.status(500).json({ message: 'Server error adding key' });
    }
});

app.delete('/api/providers/:providerId/keys/:apiKey', async (req, res) => {
    try {
        const { providerId, apiKey: apiKeyToDelete } = req.params;

        // Since the API key can contain special characters, it's good practice to decode it.
        const decodedApiKey = decodeURIComponent(apiKeyToDelete);

        const provider = await ApiProvider.findById(providerId);
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        // Filter out the key to be deleted.
        const initialKeyCount = provider.apiKeys.length;
        provider.apiKeys = provider.apiKeys.filter(k => k !== decodedApiKey);

        if (provider.apiKeys.length === initialKeyCount) {
            return res.status(404).json({ message: 'API key not found in this provider' });
        }

        await provider.save();
        res.json(provider);
    } catch (error) {
        res.status(500).json({ message: 'Server error deleting key' });
    }
});

app.post('/api/providers', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Provider name is required' });
        }
        const existingProvider = await ApiProvider.findOne({ name });
        if (existingProvider) {
            return res.status(409).json({ message: `Provider '${name}' already exists.` });
        }
        const newProvider = new ApiProvider({ name });
        await newProvider.save();
        res.status(201).json(newProvider);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create API provider' });
    }
});

// Package Management - moved to /routes/packages.js

// Dashboard Stats
app.get('/api/stats/dashboard', async (req, res) => {
  try {
    console.log('📊 Loading dashboard stats...');
    
    // Key stats
    const totalKeys = await Key.countDocuments();
    const activeKeys = await Key.countDocuments({ isActive: true });
    const expiredKeys = await Key.countDocuments({ expiredAt: { $lt: new Date() } });
    const totalCredits = await Key.aggregate([
      { $group: { _id: null, total: { $sum: '$credit' } } }
    ]);
    
    // Payment stats (using new Payment model)
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$price' } } }
    ]);
    
    const monthlyTransactions = await Payment.countDocuments({
      status: 'completed',
      completedAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    });
    
    // Today stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayRevenue = await Payment.aggregate([
      { 
        $match: { 
          status: 'completed',
          completedAt: { $gte: todayStart }
        } 
      },
      { $group: { _id: null, total: { $sum: '$price' } } }
    ]);
    
    // API usage stats
    const providers = await ApiProvider.find();
    const totalRequests = providers.reduce((sum, p) => sum + (p.totalRequests || 0), 0);
    const costToday = providers.reduce((sum, p) => sum + (p.costToday || 0), 0);

    // Proxy stats
    const proxyStats = await proxyManager.getProxyStatistics();
    
    console.log('✅ Dashboard stats loaded:', {
      totalKeys,
      activeKeys,
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyTransactions
    });

    res.json({
      success: true,
      keyStats: { total: totalKeys, active: activeKeys, expired: expiredKeys },
      billingStats: { 
        totalRevenue: totalRevenue[0]?.total || 0, 
        monthlyTransactions,
        todayRevenue: todayRevenue[0]?.total || 0
      },
      apiUsageStats: { totalRequests, costToday },
      proxyStats: proxyStats || { overview: {}, topPerformers: [] },
      totalCredits: totalCredits[0]?.total || 0
    });
  } catch (error) {
    console.error('❌ Error loading dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
});

// Audit Log
app.get('/api/audit-log', async (req, res) => {
    try {
        const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(50);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch audit logs' });
    }
});

// AI Proxy Endpoint - ENHANCED WITH BETTER ERROR HANDLING
/* OLD ENDPOINT - DISABLED to prevent conflict with aiProxy.js
app.post('/api/ai/generate', async (req, res) => {
    const startTime = Date.now();
    const { prompt, provider } = req.body;
    const userKey = req.headers.authorization?.split(' ')[1];
    
    console.log(`🚀 AI Generate request: Provider=${provider}, Prompt length=${prompt?.length || 0}, User key=${userKey?.slice(0, 8)}...`);

    if (!userKey) {
        return res.status(401).json({ message: 'Authorization key is missing.' });
    }

    if (!prompt || prompt.length === 0) {
        return res.status(400).json({ message: 'Prompt is required and cannot be empty.' });
    }

    let updatedKey;
    let apiKey; // Declare apiKey in function scope so catch blocks can access it
    try {
        updatedKey = await Key.findOneAndUpdate(
            { key: userKey, isActive: true, credit: { $gt: 0 } },
            { $inc: { credit: -1 } },
            { new: true }
        );

        if (!updatedKey) {
            return res.status(403).json({ message: 'Invalid key, inactive key, or insufficient credits.' });
        }

        // Get AI generation settings from database
        const Settings = require('./models/Settings');
        const maxOutputTokens = await Settings.getSetting('aiMaxOutputTokens', 32768);
        const temperature = await Settings.getSetting('aiTemperature', 0.7);
        const topP = await Settings.getSetting('aiTopP', 0.8);
        const topK = await Settings.getSetting('aiTopK', 40);
        
        console.log(`⚙️ AI Settings: maxTokens=${maxOutputTokens}, temp=${temperature}, topP=${topP}, topK=${topK}`);

        // Use smart API key selection with failover
        try {
            apiKey = await ApiKeyManager.getBestApiKey(provider);
        } catch (keyError) {
            console.error(`❌ API Key Manager Error: ${keyError.message}`);
            throw keyError;
        }
        
        let generatedText;
        switch (provider.toLowerCase()) {
            case 'gemini': {
                // Sử dụng proxy nếu có
                const proxyForKey = await proxyManager.getProxyForApiKey(apiKey);
                
                if (proxyForKey) {
                    // Gọi Gemini API qua proxy
                    const agent = proxyManager.createProxyAgent(proxyForKey);
                    const response = await proxyManager.makeRequestWithProxy(
                        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-goog-api-key': apiKey
                            },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: prompt }] }],
                                generationConfig: {
                                    maxOutputTokens: maxOutputTokens,
                                    temperature: temperature,
                                    topP: topP,
                                    topK: topK
                                }
                            })
                        },
                        apiKey
                    );
                    
                    if (!response.ok) {
                        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    generatedText = data.candidates[0]?.content?.parts[0]?.text || 'No content generated';
                } else {
                    // Fallback to direct connection nếu không có proxy
                    console.log(`📡 No proxy assigned for API key, using direct connection`);
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({ 
                        model: "gemini-1.5-flash",
                        generationConfig: {
                            maxOutputTokens: maxOutputTokens,
                            temperature: temperature,
                            topP: topP,
                            topK: topK
                        }
                    });
                    const result = await model.generateContent(prompt);
                    generatedText = result.response.text();
                }
                break;
            }
            default:
                throw new Error(`Provider '${provider}' is not yet supported.`);
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ AI Generation success: ${generatedText?.length || 0} chars in ${processingTime}ms`);
        
        // Mark API key as successfully used
        await ApiKeyManager.markKeyUsed(provider, apiKey);
        
        return res.json({ success: true, text: generatedText, remainingCredits: updatedKey.credit });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        
        if (updatedKey) {
            await Key.findByIdAndUpdate(updatedKey._id, { $inc: { credit: 1 } });
        }
        
        console.error(`🚨 AI Generation Error (${processingTime}ms):`);
        console.error(`User: ${userKey?.slice(0, 8)}...`);
        console.error(`Provider: ${provider}`);
        console.error(`Prompt length: ${prompt?.length || 0} characters`);
        console.error(`Error type: ${error.constructor.name}`);
        console.error(`Error message: ${error.message}`);
        console.error(`Stack trace:`, error.stack);

        // Mark API key error if we have an apiKey
        if (apiKey) {
            if (error.message.includes('429') || error.message.includes('quota')) {
                await ApiKeyManager.markKeyError(provider, apiKey, 'quota_exceeded', error.message);
            } else if (error.message.includes('401') || error.message.includes('invalid')) {
                await ApiKeyManager.markKeyError(provider, apiKey, 'invalid_key', error.message);
            } else {
                await ApiKeyManager.markKeyError(provider, apiKey, 'general_error', error.message);
            }
        }

        // Categorize errors for better response
        if (error.message.includes('No API keys') || error.message.includes('exhausted')) {
            return res.status(503).json({ success: false, error: error.message });
        }
        if (error.message.includes('not yet supported')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
            return res.status(408).json({ success: false, error: 'Request timeout. The prompt may be too complex.' });
        }
        if (error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('429')) {
            return res.status(429).json({ success: false, error: 'API rate limit exceeded. Please try again later.' });
        }
        
        // Return detailed error information while preserving original prompt integrity
        const errorDetails = process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.';
        return res.status(500).json({ 
            success: false, 
            error: errorDetails,
            debugInfo: {
                promptLength: prompt?.length || 0,
                provider: provider,
                processingTime: processingTime
            }
        });
    }
});
*/

// API Key Management Stats
app.get('/api/providers/:provider/key-stats', async (req, res) => {
    try {
        const { provider } = req.params;
        const stats = await ApiKeyManager.getKeyStatistics(provider);
        
        if (!stats) {
            return res.status(404).json({ success: false, error: 'Provider not found' });
        }
        
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error getting key stats:', error);
        res.status(500).json({ success: false, error: 'Failed to get key statistics' });
    }
});

// Reset API Key Quotas (admin endpoint)
app.post('/api/providers/:provider/reset-quotas', async (req, res) => {
    try {
        const { provider } = req.params;
        await ApiKeyManager.resetDailyQuotas(provider);
        res.json({ success: true, message: `Quotas reset for ${provider}` });
    } catch (error) {
        console.error('Error resetting quotas:', error);
        res.status(500).json({ success: false, error: 'Failed to reset quotas' });
    }
});

// Mount routers
app.use('/api/keys', keysRouter);
app.use('/api/admin/keys', adminKeysRouter);
app.use('/api/admin/proxies', adminProxiesRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/mock-payos', mockPayOSRouter);
app.use('/api/bank-info', bankInfoRouter);
app.use('/api/settings', settingsRouter);

// Mount new routes
app.use('/api/admin/stats', adminStatsRouter);
app.use('/api/admin/users', require('./routes/adminUsers'));
app.use('/api/admin', require('./routes/adminPackages')); // Package management
app.use('/api/admin/payments', require('./routes/adminPayments')); // Payment management
app.use('/api/admin/anti-sharing', require('./routes/adminAntiSharing')); // Anti-sharing management
// Apply universal activity tracking to protected routes
app.use('/api/ai', auth, updateUserActivity, aiProxyRouter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth-enhanced', authEnhancedRouter); // Enhanced authentication with username resolution  
app.use('/api/user', auth, updateUserActivity, require('./routes/userStats')); // User statistics

// --- Root and Server Start ---
app.get('/', (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'AI Story Backend v2.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'ai-story-backend' });
});

// Subscription health check endpoint (admin only)
app.get('/api/admin/subscription-health', async (req, res) => {
  try {
    const healthChecker = new SubscriptionHealthChecker();
    const report = await healthChecker.runHealthCheck();
    res.json({
      success: true,
      report: report,
      summary: {
        totalIssues: report.summary.totalIssues,
        highSeverity: report.summary.highSeverity,
        healthScore: ((100 - report.summary.totalIssues * 10) / 100).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run subscription health check',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3001; // Changed default to 3001 for consistency

async function startServer() {
    try {
        console.log(">>> Starting server...");
        
        // Try to connect to MongoDB, but don't crash if it fails
        if (mongoUri) {
            try {
                console.log(">>> Connecting to MongoDB...");
                await mongoose.connect(mongoUri);
                console.log("✅ MongoDB connected successfully!");
            } catch (mongoError) {
                console.error('⚠️ MongoDB connection failed, but server will continue:', mongoError.message);
                console.log('ℹ️ Some features requiring database may not work properly');
            }
        } else {
            console.log('ℹ️ No MongoDB URI provided, running without database');
        }

        const server = app.listen(PORT, () => {
            console.log(`✅ Server is successfully running on port ${PORT}`);
            console.log(`🌐 CORS enabled for origins: ${allowedOrigins.join(', ')}`);
        });

        // Increase server timeout for long AI requests (5 minutes)
        server.timeout = 300000;
        server.keepAliveTimeout = 300000;
        server.headersTimeout = 305000;
        
        server.on('error', (error) => {
            console.error('❌ Server startup error:', error);
            if (error.code === 'EADDRINUSE') {
                console.log(`Port ${PORT} is busy, trying port ${PORT + 1}`);
                // Could implement port retry logic here
            }
        });

    } catch (err) {
        console.error('❌ Could not start server:', err);
        console.log('Attempting to start without MongoDB connection...');
        
        // Fallback: Start server without MongoDB
        try {
            const server = app.listen(PORT, () => {
                console.log(`⚠️ Server started in fallback mode on port ${PORT}`);
            });
        } catch (fallbackError) {
            console.error('❌ Fallback server start failed:', fallbackError);
            process.exit(1);
        }
    }
}

startServer();
