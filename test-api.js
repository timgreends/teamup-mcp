const axios = require('axios');

const TOKEN = 'BUR9st2urCIWUz3Rcr8PB7xwucCeIO';
const PROVIDER_ID = '54664';
const BASE_URL = 'https://goteamup.com/api/v2';

async function testAPI() {
  console.log('Testing TeamUp API with provided credentials...\n');

  // Test 1: Customer mode
  console.log('Test 1: Customer mode (should fail)');
  try {
    const response = await axios.get(`${BASE_URL}/events`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${TOKEN}`,
        'TeamUp-Provider-ID': PROVIDER_ID,
        'TeamUp-Request-Mode': 'customer'
      },
      params: { page_size: 1 }
    });
    console.log('✓ Success:', response.status);
  } catch (error) {
    console.log('✗ Failed:', error.response?.data || error.message);
  }

  console.log('\nTest 2: Provider mode (should work)');
  try {
    const response = await axios.get(`${BASE_URL}/events`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${TOKEN}`,
        'TeamUp-Provider-ID': PROVIDER_ID,
        'TeamUp-Request-Mode': 'provider'
      },
      params: { page_size: 1 }
    });
    console.log('✓ Success:', response.status);
    console.log('Data received:', !!response.data);
  } catch (error) {
    console.log('✗ Failed:', error.response?.data || error.message);
  }

  console.log('\nTest 3: Provider info');
  try {
    const response = await axios.get(`${BASE_URL}/providers/${PROVIDER_ID}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${TOKEN}`,
        'TeamUp-Provider-ID': PROVIDER_ID,
        'TeamUp-Request-Mode': 'provider'
      }
    });
    console.log('✓ Success:', response.status);
    console.log('Provider name:', response.data?.name);
  } catch (error) {
    console.log('✗ Failed:', error.response?.data || error.message);
  }

  console.log('\nTest 4: Without Provider ID header');
  try {
    const response = await axios.get(`${BASE_URL}/events`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${TOKEN}`,
        'TeamUp-Request-Mode': 'provider'
      },
      params: { page_size: 1 }
    });
    console.log('✓ Success:', response.status);
  } catch (error) {
    console.log('✗ Failed:', error.response?.data || error.message);
  }

  console.log('\nTest 5: Create a test customer');
  try {
    const response = await axios.post(`${BASE_URL}/customers`, {
      first_name: 'Test',
      last_name: 'User',
      email: `test-${Date.now()}@example.com`
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${TOKEN}`,
        'TeamUp-Provider-ID': PROVIDER_ID,
        'TeamUp-Request-Mode': 'provider'
      }
    });
    console.log('✓ Success:', response.status);
    console.log('Customer created with ID:', response.data?.id);
  } catch (error) {
    console.log('✗ Failed:', error.response?.data || error.message);
  }
}

testAPI().catch(console.error);