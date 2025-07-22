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
    const { path, httpMethod, body, headers: requestHeaders } = event;
    const apiPath = path.replace('/.netlify/functions/api-proxy', '');
    
    // Forward request to original backend
    const backendUrl = `https://key-manager-backend.onrender.com/api${apiPath}`;
    
    const response = await fetch(backendUrl, {
      method: httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': requestHeaders.authorization || '',
        'x-auth-token': requestHeaders['x-auth-token'] || ''
      },
      body: httpMethod !== 'GET' ? body : undefined
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Proxy error: ' + error.message })
    };
  }
};