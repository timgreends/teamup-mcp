# TeamUp MCP Server

A Model Context Protocol (MCP) server for TeamUp integration, available as both a hosted remote server and local installation.

## Features

- 🔐 OAuth 2.0 authentication
- 🌐 Remote hosted server (no local installation needed)
- 🚀 Easy setup for end users
- 🔄 Automatic token refresh
- 📱 Works with Claude Desktop

## For End Users

### Quick Setup (Remote Server)

If you're using a hosted TeamUp MCP server, setup is simple:

1. **Get the server URL** from your provider
2. **Configure Claude Desktop** by adding to your config file:

```json
{
  "mcpServers": {
    "teamup": {
      "url": "https://your-teamup-mcp-server.com/mcp/sse"
    }
  }
}
```

3. **Restart Claude Desktop**
4. **Type "Initialize TeamUp"** in Claude to connect your account

That's it! No local installation or OAuth credentials needed.

### Finding Your Config File

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

## For Developers

### Architecture

This project includes three server modes:

1. **Remote Server** (`remote-server.ts`) - Hosted MCP server with SSE transport
2. **Local Server** (`index.ts`) - Traditional stdio-based MCP server
3. **Auth Server** (`auth-server.ts`) - OAuth redirect handler

### Deploy Your Own Remote Server

#### Prerequisites

- Node.js 20+
- TeamUp OAuth credentials
- Hosting platform (Railway, Render, etc.)

#### Environment Variables

```env
# Required
TEAMUP_CLIENT_ID=your-client-id
TEAMUP_CLIENT_SECRET=your-client-secret
TEAMUP_PROVIDER_ID=your-provider-id

# Optional
TEAMUP_REDIRECT_URI=https://your-domain.com/callback
TEAMUP_REQUEST_MODE=customer
TEAMUP_BASE_URL=https://goteamup.com/api/v2
```

#### Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

1. Click the button above
2. Add your environment variables
3. Deploy!

#### Deploy to Render

1. Fork this repository
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Add environment variables
5. Deploy

### Local Development

```bash
# Clone the repository
git clone https://github.com/timgreends/teamup-mcp.git
cd teamup-mcp-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run remote server locally
npm run dev:remote

# Run local MCP server
npm run dev

# Run auth redirect server
npm run dev:auth
```

### API Endpoints (Remote Server)

- `GET /` - Landing page with setup instructions
- `POST /mcp/sse` - MCP SSE endpoint for Claude Desktop
- `GET /callback` - OAuth callback handler

### Security Considerations

- Sessions are isolated per user
- OAuth tokens are stored in memory (use Redis/DB for production)
- Automatic session cleanup after 1 hour of inactivity
- CORS enabled for Claude Desktop compatibility

## Usage Examples

Once connected, you can use these commands in Claude:

- "List today's events"
- "Show me customer John Doe"
- "Create a new customer named Jane Smith with email jane@example.com"
- "List available memberships"
- "Get details for event ID 123"
- "Register customer 456 for event 789"

## Troubleshooting

### Remote Server Issues

1. **"Cannot connect to MCP server"**
   - Verify the server URL is correct
   - Check if the server is running
   - Ensure Claude Desktop is fully restarted

2. **"Authentication failed"**
   - Check TeamUp OAuth credentials on server
   - Verify redirect URI matches TeamUp settings
   - Try clearing browser cookies and re-authenticating

### Local Server Issues

1. **"Cannot find module"**
   - Run `npm install` and `npm run build`
   - Use absolute paths in Claude config

2. **"TEAMUP_CLIENT_ID required"**
   - Set all required environment variables
   - Check for typos in variable names

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Support

- Issues: [GitHub Issues](https://github.com/timgreends/teamup-mcp)
- TeamUp API: https://goteamup.com/api/v2/docs
- MCP Protocol: https://modelcontextprotocol.io