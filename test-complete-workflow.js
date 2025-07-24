const https = require('https');

// Test configuration
const BACKEND_URL = 'https://aistory-backend.onrender.com';
const FRONTEND_URL = 'https://aistorytmvvfrontend.netlify.app';
const ADMIN_URL = 'https://webadminaistory.netlify.app';

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (err) => reject(err));
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Test functions
async function testBackendHealth() {
  log('\n🔍 Testing Backend Health...', 'blue');
  
  try {
    const response = await makeRequest(`${BACKEND_URL}/api/packages`);
    
    if (response.status === 200 && response.data.success) {
      log('✅ Backend API is healthy', 'green');
      log(`📦 Found ${response.data.packages.length} packages`, 'green');
      return true;
    } else {
      log(`❌ Backend unhealthy: Status ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Backend error: ${error.message}`, 'red');
    return false;
  }
}

async function testUserRegistration() {
  log('\n👤 Testing User Registration...', 'blue');
  
  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123!'
  };
  
  try {
    const response = await makeRequest(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: testUser
    });
    
    if (response.status === 201 || response.status === 200) {
      log('✅ User registration successful', 'green');
      log(`👤 Created user: ${testUser.username}`, 'green');
      return { success: true, user: testUser };
    } else {
      log(`❌ Registration failed: Status ${response.status}`, 'red');
      log(`Response: ${JSON.stringify(response.data)}`, 'yellow');
      return { success: false };
    }
  } catch (error) {
    log(`❌ Registration error: ${error.message}`, 'red');
    return { success: false };
  }
}

async function testUserLogin(user) {
  log('\n🔑 Testing User Login...', 'blue');
  
  try {
    const response = await makeRequest(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        email: user.email,
        password: user.password
      }
    });
    
    if (response.status === 200 && response.data.token) {
      log('✅ User login successful', 'green');
      log(`🎫 Token received (length: ${response.data.token.length})`, 'green');
      return { success: true, token: response.data.token };
    } else {
      log(`❌ Login failed: Status ${response.status}`, 'red');
      return { success: false };
    }
  } catch (error) {
    log(`❌ Login error: ${error.message}`, 'red');
    return { success: false };
  }
}

async function testUserProfile(token) {
  log('\n📋 Testing User Profile...', 'blue');
  
  try {
    const response = await makeRequest(`${BACKEND_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'x-auth-token': token
      }
    });
    
    if (response.status === 200) {
      log('✅ User profile fetch successful', 'green');
      log(`📊 Subscription: ${response.data.subscriptionType || 'free'}`, 'green');
      return { success: true, profile: response.data };
    } else {
      log(`❌ Profile fetch failed: Status ${response.status}`, 'red');
      return { success: false };
    }
  } catch (error) {
    log(`❌ Profile error: ${error.message}`, 'red');
    return { success: false };
  }
}

async function testPricingPage() {
  log('\n💸 Testing Pricing Integration...', 'blue');
  
  try {
    const response = await makeRequest(`${BACKEND_URL}/api/packages`);
    
    if (response.status === 200 && response.data.packages) {
      log('✅ Pricing packages available', 'green');
      response.data.packages.forEach(pkg => {
        log(`💰 ${pkg.name}: ${pkg.price.toLocaleString()} VND`, 'green');
      });
      return true;
    } else {
      log(`❌ Pricing unavailable: Status ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Pricing error: ${error.message}`, 'red');
    return false;
  }
}

async function testFrontendAccess() {
  log('\n🌐 Testing Frontend Access...', 'blue');
  
  try {
    const response = await makeRequest(FRONTEND_URL);
    
    if (response.status === 200) {
      log('✅ Frontend is accessible', 'green');
      return true;
    } else {
      log(`❌ Frontend error: Status ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Frontend error: ${error.message}`, 'red');
    return false;
  }
}

async function testAdminAccess() {
  log('\n🔧 Testing Admin Panel Access...', 'blue');
  
  try {
    const response = await makeRequest(ADMIN_URL);
    
    if (response.status === 200) {
      log('✅ Admin panel is accessible', 'green');
      return true;
    } else {
      log(`❌ Admin panel error: Status ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Admin panel error: ${error.message}`, 'red');
    return false;
  }
}

// Main test execution
async function runCompleteWorkflowTest() {
  log('🚀 Starting Complete End-to-End Workflow Test', 'yellow');
  log('=' .repeat(60), 'yellow');
  
  const results = {
    backend: false,
    frontend: false,
    admin: false,
    registration: false,
    login: false,
    profile: false,
    pricing: false
  };
  
  // Test 1: Backend Health
  results.backend = await testBackendHealth();
  
  // Test 2: Frontend Access
  results.frontend = await testFrontendAccess();
  
  // Test 3: Admin Access
  results.admin = await testAdminAccess();
  
  // Test 4: Pricing
  results.pricing = await testPricingPage();
  
  // Test 5: User Registration
  const regResult = await testUserRegistration();
  results.registration = regResult.success;
  
  if (regResult.success) {
    // Test 6: User Login
    const loginResult = await testUserLogin(regResult.user);
    results.login = loginResult.success;
    
    if (loginResult.success) {
      // Test 7: User Profile
      const profileResult = await testUserProfile(loginResult.token);
      results.profile = profileResult.success;
    }
  }
  
  // Summary
  log('\n📊 Test Results Summary', 'yellow');
  log('=' .repeat(40), 'yellow');
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? 'green' : 'red';
    log(`${test.padEnd(20)}: ${status}`, color);
  });
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const successRate = Math.round((passedTests / totalTests) * 100);
  
  log(`\n🎯 Overall Success Rate: ${passedTests}/${totalTests} (${successRate}%)`, 
       successRate >= 80 ? 'green' : successRate >= 60 ? 'yellow' : 'red');
  
  if (successRate >= 80) {
    log('\n🎉 End-to-End Workflow is HEALTHY!', 'green');
  } else if (successRate >= 60) {
    log('\n⚠️ End-to-End Workflow has some issues', 'yellow');
  } else {
    log('\n🚨 End-to-End Workflow needs attention', 'red');
  }
  
  log('\n' + '='.repeat(60), 'yellow');
  log('Test completed at: ' + new Date().toLocaleString(), 'blue');
}

// Execute the test
runCompleteWorkflowTest().catch(error => {
  log(`\n💥 Test execution failed: ${error.message}`, 'red');
  process.exit(1);
});