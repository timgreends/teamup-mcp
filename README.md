# TeamUp MCP Server

Connect Claude Desktop and ChatGPT to TeamUp for managing events, customers, and memberships directly from your AI assistant.

## Features

- 📅 List and manage TeamUp events
- 👥 Manage customer information
- 💳 Track memberships
- 🎟️ Register customers for events
- 🔐 Multiple authentication modes (Token & OAuth)
- 🤖 Works with Claude Desktop (MCP) and ChatGPT (Actions)
- 🚀 Provider/Admin mode support

## Quick Start

### 1. Get Your TeamUp Credentials

1. Log in to your TeamUp account
2. Go to Settings → API → Access Tokens
3. Create a new access token
   - For customer tokens: Use default settings (customer mode)
   - For provider tokens: Ensure admin permissions are granted
4. Note your Provider ID (in your account settings)

### 2. Deploy to Railway (Recommended)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/teamup-mcp)

Or deploy manually:
1. Fork this repo
2. Create a new project on Railway
3. Deploy from GitHub
4. Add environment variables
5. Your server will be live at `https://your-app.up.railway.app`

### Local Development

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

### Token Mode (Simple)
| Variable | Required | Description |
|----------|----------|-------------|
| TEAMUP_AUTH_MODE | No | Set to 'TOKEN' (default) |
| TEAMUP_ACCESS_TOKEN | Yes | Your TeamUp API access token |
| TEAMUP_PROVIDER_ID | Yes | Your TeamUp Provider ID |
| TEAMUP_REQUEST_MODE | No | 'customer' or 'provider' (default: provider) |

### OAuth Mode (Advanced)
| Variable | Required | Description |
|----------|----------|-------------|
| TEAMUP_AUTH_MODE | Yes | Set to 'OAUTH' |
| TEAMUP_CLIENT_ID | Yes | Your TeamUp OAuth Client ID |
| TEAMUP_CLIENT_SECRET | Yes | Your TeamUp OAuth Client Secret |
| TEAMUP_REDIRECT_URI | Yes | OAuth callback URL (e.g., https://your-app.up.railway.app/callback) |
| TEAMUP_PROVIDER_ID | Yes | Your TeamUp Provider ID |
| TEAMUP_REQUEST_MODE | No | 'customer' or 'provider' (default: provider) |

## Getting TeamUp Credentials

### For Token Mode
1. Log in to TeamUp
2. Go to Settings → API → Access Tokens
3. Create a new access token with appropriate permissions
4. Find your Provider ID in account settings

### For OAuth Mode (Generates Provider Tokens)
1. Log in to TeamUp
2. Go to Settings → Integrations → Customer API
3. Create a new application:
   - Name: Your App Name
   - Redirect URI: `https://your-app.up.railway.app/callback`
   - Scopes: read_write
4. Copy Client ID and Client Secret
5. Use the OAuth flow at `/oauth-test` to generate provider tokens

## Integration Setup

### Claude Desktop Configuration

Find your Claude Desktop configuration file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

Add the TeamUp server configuration:

```json
{
  "mcpServers": {
    "teamup": {
      "command": "node",
      "args": ["/path/to/teamup-mcp-server/dist/index.js"],
      "env": {
        "TEAMUP_AUTH_MODE": "TOKEN",
        "TEAMUP_ACCESS_TOKEN": "your-teamup-access-token",
        "TEAMUP_PROVIDER_ID": "your-provider-id",
        "TEAMUP_REQUEST_MODE": "provider"
      }
    }
  }
}
```

### ChatGPT Actions Setup

1. Deploy server to Railway or another hosting service
2. In ChatGPT:
   - Go to Settings → Actions
   - Click "Create new action"
   - Import schema from: `https://your-app.up.railway.app/openapi.json`
   - Authentication: None (server handles auth)
   - Save the action

### Remote Server (For ChatGPT/Web Access)

Deploy the remote server by running:
```bash
npm run start:remote
```

Or use the main start command which runs the remote server:
```bash
npm start
```

## Usage

Once connected, you can ask your AI assistant to:

- "List today's TeamUp events"
- "Show me customer John Doe in TeamUp"
- "Create a new TeamUp customer named Jane Smith with email jane@example.com"
- "List available TeamUp memberships"
- "Get details for TeamUp event ID 123"
- "Register customer 456 for event 789 in TeamUp"

### Available Tools

- `list_events` - List all events with optional filters
- `get_event` - Get details for a specific event
- `list_customers` - List all customers
- `get_customer` - Get details for a specific customer
- `create_customer` - Create a new customer
- `update_customer` - Update customer information
- `list_memberships` - List all available memberships
- `register_for_event` - Register a customer for an event

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

## Troubleshooting

### "mode_not_allowed" Error
- This means your token doesn't have provider/admin permissions
- Solution 1: Create a new token with provider permissions in TeamUp
- Solution 2: Use OAuth mode to generate provider tokens through `/oauth-test`

### Authentication Issues
- Visit `/debug/config` to check server configuration
- Visit `/debug/test-api` to test API connectivity
- Check Railway logs for detailed error messages

### ChatGPT Connection Issues
- Ensure you're using the OpenAPI endpoint: `/openapi.json`
- Check that environment variables are set in Railway
- Verify the server is accessible at your Railway URL

## Debug Endpoints

- `/debug/config` - View current server configuration
- `/debug/test-api` - Test API connectivity
- `/oauth-test` - Generate OAuth tokens with provider permissions

## Security

- API tokens and client secrets are never exposed to end users
- All credentials are stored server-side only
- OAuth tokens are stored in memory (not persisted)
- HTTPS required for production deployments

## Support

- Issues: [GitHub Issues](https://github.com/your-org/teamup-mcp)
- TeamUp API Docs: https://goteamup.com/api/v2/docs
- MCP Protocol: https://modelcontextprotocol.com

## License

MIT