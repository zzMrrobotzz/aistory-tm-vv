const https = require('https');
const http = require('http');

exports.handler = async (event, context) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { queryStringParameters, httpMethod, body, headers: requestHeaders } = event;
    
    // Get API path from query parameter or construct from event
    const apiPath = queryStringParameters?.path || '/auth/register';
    
    // Forward request to original backend
    const backendUrl = `https://key-manager-backend.onrender.com/api${apiPath}`;
    
    console.log(`Proxying ${httpMethod} to ${backendUrl}`);
    
    // Use node-fetch alternative for Netlify Functions
    const fetch = require('node-fetch');
    
    const response = await fetch(backendUrl, {
      method: httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': requestHeaders.authorization || '',
        'x-auth-token': requestHeaders['x-auth-token'] || ''
      },
      body: httpMethod !== 'GET' && httpMethod !== 'HEAD' ? body : undefined
    });

    const data = await response.text();
    
    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: data
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Proxy error: ' + error.message })
    };
  }
};