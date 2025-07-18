const axios = require('axios');
const https = require('https');

const TOKEN = 'remfL0wvErjyH4h8exivgdxeSmUfWC';
const PROVIDER_ID = '54664';
const BASE_URL = 'https://goteamup.com/api/v2';

// Create axios instance with request/response interceptors
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  httpsAgent: new https.Agent({ rejectUnauthorized: true })
});

// Log full request details
axiosInstance.interceptors.request.use(
  (config) => {
    console.log('\n=== FULL REQUEST DETAILS ===');
    console.log('Method:', config.method?.toUpperCase());
    console.log('Full URL:', config.baseURL + config.url + (config.params ? '?' + new URLSearchParams(config.params).toString() : ''));
    console.log('Headers:', JSON.stringify(config.headers, null, 2));
    console.log('Params:', config.params || 'none');
    console.log('Data:', config.data || 'none');
    console.log('===========================\n');
    return config;
  },
  (error) => Promise.reject(error)
);

// Log full response details
axiosInstance.interceptors.response.use(
  (response) => {
    console.log('=== RESPONSE ===');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', response.headers);
    console.log('================\n');
    return response;
  },
  (error) => {
    if (error.response) {
      console.log('=== ERROR RESPONSE ===');
      console.log('Status:', error.response.status, error.response.statusText);
      console.log('Headers:', error.response.headers);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
      console.log('====================\n');
    }
    return Promise.reject(error);
  }
);

async function testDetailedAPI() {
  console.log('Testing TeamUp API with full request details...\n');

  // Test 1: Provider mode with all headers
  console.log('TEST 1: Provider mode with all headers');
  try {
    await axiosInstance.get('/events', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${TOKEN}`,
        'TeamUp-Provider-ID': PROVIDER_ID,
        'TeamUp-Request-Mode': 'provider'
      },
      params: { 
        page: 1,
        page_size: 10 
      }
    });
    console.log('✓ Success\n');
  } catch (error) {
    console.log('✗ Failed\n');
  }

  // Test 2: Customer mode with all headers
  console.log('TEST 2: Customer mode with all headers');
  try {
    await axiosInstance.get('/events', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${TOKEN}`,
        'TeamUp-Provider-ID': PROVIDER_ID,
        'TeamUp-Request-Mode': 'customer'
      },
      params: { 
        page: 1,
        page_size: 10 
      }
    });
    console.log('✓ Success\n');
  } catch (error) {
    console.log('✗ Failed\n');
  }

  // Test 3: Raw request using Node's https module
  console.log('TEST 3: Raw HTTPS request (no axios)');
  const rawRequest = () => {
    return new Promise((resolve, reject) => {
      const url = new URL(`${BASE_URL}/events?page=1&page_size=10`);
      
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Token ${TOKEN}`,
          'TeamUp-Provider-ID': PROVIDER_ID,
          'TeamUp-Request-Mode': 'provider'
        }
      };

      console.log('Raw request options:', JSON.stringify(options, null, 2));

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log('Status:', res.statusCode);
          console.log('Response:', data);
          resolve(data);
        });
      });

      req.on('error', reject);
      req.end();
    });
  };

  try {
    await rawRequest();
    console.log('✓ Success\n');
  } catch (error) {
    console.log('✗ Failed:', error.message, '\n');
  }
}

testDetailedAPI().catch(console.error);