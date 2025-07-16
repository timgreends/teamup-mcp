import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/auth/teamup', (req, res) => {
  const authUrl = req.query.auth_url as string;
  
  if (!authUrl) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>TeamUp Auth - Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          h1 { color: #e74c3c; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Error</h1>
          <p>Missing authentication URL parameter.</p>
        </div>
      </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connecting to TeamUp...</title>
      <meta http-equiv="refresh" content="1;url=${authUrl}">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          text-align: center;
        }
        .logo {
          width: 80px;
          height: 80px;
          background: white;
          border-radius: 20px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
        }
        h1 {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 10px;
        }
        p {
          opacity: 0.9;
          margin: 0;
        }
        .spinner {
          margin: 20px auto;
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255,255,255,0.3);
          border-top: 4px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🏃</div>
        <h1>Connecting to TeamUp</h1>
        <p>Redirecting you to TeamUp for authentication...</p>
        <div class="spinner"></div>
      </div>
      <script>
        setTimeout(() => {
          window.location.href = '${authUrl}';
        }, 1000);
      </script>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'teamup-auth-redirect' });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>TeamUp MCP Connector</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
          color: #333;
          border-bottom: 3px solid #667eea;
          padding-bottom: 10px;
        }
        .feature {
          margin: 20px 0;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        .setup {
          background: #e8f4f8;
          padding: 20px;
          border-radius: 4px;
          margin: 20px 0;
        }
        code {
          background: #272822;
          color: #f8f8f2;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Monaco', 'Menlo', monospace;
        }
        .btn {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 4px;
          margin-top: 20px;
        }
        .btn:hover {
          background: #764ba2;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🏃 TeamUp MCP Connector</h1>
        
        <p>Connect your TeamUp account to AI assistants like Claude using the Model Context Protocol (MCP).</p>
        
        <div class="feature">
          <h3>✨ Features</h3>
          <ul>
            <li>List and manage events/classes</li>
            <li>Customer management</li>
            <li>Membership tracking</li>
            <li>Registration handling</li>
            <li>Secure OAuth 2.0 authentication</li>
          </ul>
        </div>
        
        <div class="setup">
          <h3>🚀 Quick Setup</h3>
          <ol>
            <li>Install the MCP server in Claude Desktop</li>
            <li>Start a conversation and type: <code>Initialize TeamUp</code></li>
            <li>Click the provided link to authenticate</li>
            <li>Start using TeamUp commands!</li>
          </ol>
        </div>
        
        <p><strong>Ready to connect?</strong> Install the MCP server and use the initialization command in your AI assistant.</p>
        
        <a href="https://github.com/your-org/teamup-mcp" class="btn">View on GitHub</a>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`TeamUp Auth Redirect Service running on port ${PORT}`);
  console.log(`Main URL: http://localhost:${PORT}`);
  console.log(`Auth endpoint: http://localhost:${PORT}/auth/teamup`);
});