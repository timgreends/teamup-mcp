const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true }));

// Serve the OAuth test page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'oauth-test.html'));
});

// OAuth callback handler
app.get('/callback', async (req, res) => {
    const { code, state, error } = req.query;
    
    if (error) {
        res.send(`
            <h1>OAuth Error</h1>
            <p>Error: ${error}</p>
            <a href="/">Try again</a>
        `);
        return;
    }
    
    res.send(`
        <h1>Authorization Complete!</h1>
        <p>Code received: ${code}</p>
        <p>State: ${state}</p>
        <p>Now go back to the OAuth test page and paste this URL in Step 3:</p>
        <pre>${req.protocol}://${req.get('host')}${req.originalUrl}</pre>
        <a href="/">Back to OAuth Test</a>
    `);
});

// Token exchange endpoint (proxies to TeamUp to avoid CORS)
app.post('/exchange-token', async (req, res) => {
    const { client_id, client_secret, code } = req.body;
    
    try {
        // TeamUp expects multipart/form-data
        const formData = new URLSearchParams();
        formData.append('client_id', client_id);
        formData.append('client_secret', client_secret);
        formData.append('code', code);
        
        const response = await axios.post(
            'https://goteamup.com/api/auth/access_token',
            formData,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        res.json({
            success: true,
            data: response.data,
            testCommands: {
                customer: `curl -H "Authorization: Token ${response.data.access_token}" -H "TeamUp-Provider-ID: 54664" -H "TeamUp-Request-Mode: customer" https://goteamup.com/api/v2/events?page_size=1`,
                provider: `curl -H "Authorization: Token ${response.data.access_token}" -H "TeamUp-Provider-ID: 54664" -H "TeamUp-Request-Mode: provider" https://goteamup.com/api/v2/events?page_size=1`
            }
        });
        
        // Also test the token immediately
        console.log('\n=== Testing OAuth Token ===');
        console.log('Token:', response.data.access_token);
        
        // Test provider mode
        try {
            const testResponse = await axios.get('https://goteamup.com/api/v2/events', {
                headers: {
                    'Authorization': `Token ${response.data.access_token}`,
                    'TeamUp-Provider-ID': '54664',
                    'TeamUp-Request-Mode': 'provider'
                },
                params: { page_size: 1 }
            });
            console.log('Provider mode: SUCCESS');
        } catch (error) {
            console.log('Provider mode: FAILED -', error.response?.data || error.message);
        }
        
        // Test customer mode
        try {
            const testResponse = await axios.get('https://goteamup.com/api/v2/events', {
                headers: {
                    'Authorization': `Token ${response.data.access_token}`,
                    'TeamUp-Provider-ID': '54664',
                    'TeamUp-Request-Mode': 'customer'
                },
                params: { page_size: 1 }
            });
            console.log('Customer mode: SUCCESS');
        } catch (error) {
            console.log('Customer mode: FAILED -', error.response?.data || error.message);
        }
        
    } catch (error) {
        console.error('Token exchange error:', error.response?.data || error.message);
        res.status(400).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`OAuth test server running at http://localhost:${PORT}`);
    console.log('1. Open http://localhost:8080 in your browser');
    console.log('2. Enter your OAuth credentials');
    console.log('3. Complete the OAuth flow');
    console.log('4. The server will test if OAuth tokens work in provider mode');
});