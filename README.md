# TeamUp MCP OAuth Server

A secure OAuth-only MCP server for TeamUp integration with AI assistants.

## Features

- 🔐 OAuth 2.0 authentication only (no API keys)
- 🚀 One-click setup for users
- 🔄 Automatic token refresh
- 📱 Works with Claude Desktop and other MCP-compatible AI assistants

## Quick Start

### 1. Deploy to Railway (Recommended)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

1. Click the button above
2. Add your TeamUp OAuth credentials as environment variables
3. Deploy!

### 2. Deploy to Render

1. Fork this repo
2. Create a new Web Service on Render
3. Connect your GitHub repo
4. Add environment variables
5. Deploy

### 3. Local Development

```bash
# Clone the repo
git clone <your-repo>
cd teamup-mcp-oauth-server

# Install dependencies
npm install

# Copy env example
cp .env.example .env

# Edit .env with your credentials
# Build and run
npm run build
npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| TEAMUP_CLIENT_ID | Yes | Your TeamUp OAuth Client ID |
| TEAMUP_CLIENT_SECRET | Yes | Your TeamUp OAuth Client Secret |
| TEAMUP_REDIRECT_URI | Yes | OAuth callback URL (default: http://localhost:8080/callback) |
| TEAMUP_PROVIDER_ID | Yes | Your TeamUp Provider ID |
| TEAMUP_REQUEST_MODE | No | 'customer' or 'provider' (default: customer) |
| TEAMUP_CALLBACK_PORT | No | Port for OAuth callback (default: 8080) |
| TEAMUP_AUTO_AUTH_URL | No | Optional auth redirect service URL |

## Getting TeamUp Credentials

1. Log in to TeamUp
2. Go to Settings → Integrations → Customer API
3. Create a new application:
   - Name: Your App Name
   - Redirect URI: Your callback URL
   - Scopes: read_write
4. Copy Client ID, Client Secret, and Provider ID

## Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "teamup": {
      "command": "node",
      "args": ["/path/to/teamup-mcp-oauth-server/dist/index.js"],
      "env": {
        "TEAMUP_CLIENT_ID": "your-client-id",
        "TEAMUP_CLIENT_SECRET": "your-client-secret",
        "TEAMUP_REDIRECT_URI": "http://localhost:8080/callback",
        "TEAMUP_PROVIDER_ID": "your-provider-id"
      }
    }
  }
}
```

## Usage

1. Start Claude Desktop
2. Type: "Initialize TeamUp"
3. Click the authentication link
4. Authorize in your browser
5. Start using TeamUp commands!

Example commands:
- "List today's events"
- "Show me customer John Doe"
- "Create a new customer"
- "List available memberships"

## Deployment Options

### Railway (Easiest)
- Auto-deploys from GitHub
- Built-in environment variable management
- Free tier available

### Render
- Simple deployment
- Auto-SSL
- Good for production

### Google Cloud Run
- Serverless
- Auto-scaling
- Pay per use

### Local with ngrok
- For development/testing
- `ngrok http 8080`
- Update redirect URI

## Security

- Client Secret is never exposed to users
- Tokens are stored in memory only
- Automatic token refresh
- OAuth 2.0 standard compliance

## Support

- Issues: [GitHub Issues](https://github.com/your-org/teamup-mcp)
- TeamUp API Docs: https://goteamup.com/api/v2/docs
- MCP Protocol: https://modelcontextprotocol.com

## License

MIT