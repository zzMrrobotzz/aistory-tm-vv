const axios = require('axios');

// Test script để debug request tracking
const API_URL = 'https://aistory-backend.onrender.com/api';

async function testRequestTracking() {
  try {
    console.log('🧪 Testing Request Tracking System...\n');
    
    // Bạn cần thay USER_TOKEN thật từ localStorage
    const USER_TOKEN = 'YOUR_REAL_TOKEN_HERE';
    
    if (USER_TOKEN === 'YOUR_REAL_TOKEN_HERE') {
      console.log('❌ Vui lòng thay USER_TOKEN thật từ localStorage của browser');
      console.log('1. Mở browser → F12 → Application → Local Storage → userToken');
      console.log('2. Copy token và paste vào script này\n');
      return;
    }
    
    // Test 1: Check current status
    console.log('1. Checking current request status...');
    const statusResponse = await axios.get(`${API_URL}/requests/status`, {
      headers: {
        'x-auth-token': USER_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Current Status:', statusResponse.data);
    console.log('');
    
    // Test 2: Make a request
    console.log('2. Making a test request (rewrite)...');
    const trackResponse = await axios.post(`${API_URL}/requests/check-and-track`, 
      { action: 'rewrite' }, 
      {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': USER_TOKEN
        }
      }
    );
    
    console.log('Track Response:', trackResponse.data);
    console.log('');
    
    // Test 3: Check status again
    console.log('3. Checking status after request...');
    const statusAfter = await axios.get(`${API_URL}/requests/status`, {
      headers: {
        'x-auth-token': USER_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Status After:', statusAfter.data);
    console.log('');
    
    console.log('✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('🔐 Authentication failed - check your token');
    }
    if (error.response?.status === 404) {
      console.log('📡 API endpoint not found - check backend deployment');
    }
  }
}

testRequestTracking();