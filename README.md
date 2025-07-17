# TeamUp MCP OAuth Server

A secure OAuth-only MCP server for TeamUp integration with AI assistants.

## Features

- 🔐 OAuth 2.0 authentication only (no API keys)
- 🚀 One-click setup for users
- 🔄 Automatic token refresh
- 📱 Works with Claude Desktop and other MCP-compatible AI assistants

## Architecture

This project has two components:
1. **Auth Server** (deployed to Railway/Render) - Handles OAuth redirects
2. **MCP Server** (runs locally in Claude Desktop) - Connects to TeamUp API

## Setup Instructions

### Step 1: Deploy Auth Server (Optional but Recommended)

The auth server provides a smoother OAuth flow. Deploy it to Railway:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

Once deployed, note your public URL (e.g., `https://your-app.railway.app`)

### Step 2: Get TeamUp Credentials

1. Log in to TeamUp
2. Go to Settings → Integrations → Customer API
3. Create a new application:
   - Name: Your App Name
   - Redirect URI: `http://localhost:8080/callback`
   - Scopes: read_write
4. Copy Client ID, Client Secret, and Provider ID

### Step 3: Install MCP Server Locally

```bash
# Clone the repo
git clone https://github.com/timgreends/teamup-mcp.git
cd teamup-mcp-server

# Install dependencies
npm install

# Build the server
npm run build
```

### Step 4: Configure Claude Desktop

1. Find your Claude Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/claude/claude_desktop_config.json`

2. Add the TeamUp server configuration:

```json
{
  "mcpServers": {
    "teamup": {
      "command": "node",
      "args": ["/absolute/path/to/teamup-mcp-server/dist/index.js"],
      "env": {
        "TEAMUP_CLIENT_ID": "your-client-id",
        "TEAMUP_CLIENT_SECRET": "your-client-secret",
        "TEAMUP_REDIRECT_URI": "http://localhost:8080/callback",
        "TEAMUP_PROVIDER_ID": "your-provider-id",
        "TEAMUP_AUTO_AUTH_URL": "https://your-railway-app.railway.app/auth/teamup"
      }
    }
  }
}
```

**Important**: 
- Replace `/absolute/path/to/teamup-mcp-server` with the actual path where you cloned the repository
- If you deployed the auth server, set `TEAMUP_AUTO_AUTH_URL` to your Railway app URL + `/auth/teamup`
- If you didn't deploy the auth server, omit the `TEAMUP_AUTO_AUTH_URL` line

### Step 5: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Start Claude Desktop again
3. The TeamUp server should now be available

## Usage

1. In Claude, type: "Initialize TeamUp"
2. Click the authentication link provided
3. Log in to TeamUp and authorize the app
4. Return to Claude - you're now connected!

Example commands:
- "List today's events"
- "Show me customer John Doe"
- "Create a new customer"
- "List available memberships"

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| TEAMUP_CLIENT_ID | Yes | Your TeamUp OAuth Client ID |
| TEAMUP_CLIENT_SECRET | Yes | Your TeamUp OAuth Client Secret |
| TEAMUP_REDIRECT_URI | Yes | OAuth callback URL (default: http://localhost:8080/callback) |
| TEAMUP_PROVIDER_ID | Yes | Your TeamUp Provider ID |
| TEAMUP_REQUEST_MODE | No | 'customer' or 'provider' (default: customer) |
| TEAMUP_CALLBACK_PORT | No | Port for OAuth callback (default: 8080) |
| TEAMUP_AUTO_AUTH_URL | No | Your deployed auth server URL + `/auth/teamup` |

## Troubleshooting

### "Cannot find module" error
- Make sure you've run `npm install` and `npm run build`
- Verify the path in your Claude Desktop config is correct
- Use absolute paths, not relative paths

### "TEAMUP_CLIENT_ID and TEAMUP_CLIENT_SECRET are required" error
- Check that your environment variables are set correctly in Claude Desktop config
- Make sure there are no typos in the variable names

### Authentication fails
- Verify your redirect URI matches exactly what's configured in TeamUp
- Check that your Client ID and Secret are correct
- Ensure your Provider ID is included

### Server disconnects immediately
- Check the MCP logs in Claude Desktop for specific errors
- Verify all required environment variables are set
- Make sure the path to `index.js` is correct

## Development

### Local Development Setup

```bash
# Clone the repo
git clone https://github.com/timgreends/teamup-mcp.git
cd teamup-mcp-server

# Install dependencies
npm install

# Copy env example
cp .env.example .env

# Edit .env with your credentials

# Run the MCP server locally
npm run dev

# Run the auth server locally (in another terminal)
npm run dev:auth
```

### Building

```bash
# Build TypeScript to JavaScript
npm run build

# Run tests (if available)
npm test
```

## Deployment Options

### Railway (Recommended for Auth Server)
- Auto-deploys from GitHub
- Built-in environment variable management
- Free tier available
- Automatic HTTPS

### Render
- Simple deployment
- Auto-SSL
- Good for production

### Local with ngrok (Development)
- For development/testing
- `ngrok http 8080`
- Update redirect URI in TeamUp settings

## Security

- Client Secret is never exposed to users
- Tokens are stored in memory only
- Automatic token refresh
- OAuth 2.0 standard compliance

## Support

- Issues: [GitHub Issues](https://github.com/timgreends/teamup-mcp)
- TeamUp API Docs: https://goteamup.com/api/v2/docs
- MCP Protocol: https://modelcontextprotocol.com

## License

MIT