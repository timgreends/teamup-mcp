# TeamUp MCP Server

Connect Claude Desktop and ChatGPT to TeamUp for managing events, customers, and memberships directly from your AI assistant.

## Features

- List and view TeamUp events
- Manage customer information
- Track memberships
- Register customers for events
- Simple token-based authentication

## Quick Start

### 1. Get Your TeamUp Credentials

1. Log in to your TeamUp account
2. Go to Settings → API → Access Tokens
3. Create a new access token
   - For customer tokens: Use default settings (customer mode)
   - For provider tokens: Ensure admin permissions are granted
4. Note your Provider ID (in your account settings)

### 2. Install the Server

```bash
git clone https://github.com/timgreends/teamup-mcp.git
cd teamup-mcp-server
npm install
npm run build
```

### 3. Configure Claude Desktop

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
        "TEAMUP_PROVIDER_ID": "your-provider-id"
      }
    }
  }
}
```

Replace:
- `/path/to/teamup-mcp-server` with the actual path where you cloned the repo
- `your-teamup-access-token` with your TeamUp access token
- `your-provider-id` with your TeamUp Provider ID

### 4. Restart Claude Desktop

Quit Claude Desktop completely and restart it. The TeamUp integration should now be available.

## Usage

Once connected, you can ask Claude to:

- "List today's TeamUp events"
- "Show me customer John Doe in TeamUp"
- "Create a new TeamUp customer named Jane Smith with email jane@example.com"
- "List available TeamUp memberships"
- "Get details for TeamUp event ID 123"
- "Register customer 456 for event 789 in TeamUp"

## Configuration Options

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| TEAMUP_AUTH_MODE | No | Authentication mode: `TOKEN` (default) or `OAUTH` |
| TEAMUP_ACCESS_TOKEN | Yes | Your TeamUp API access token |
| TEAMUP_PROVIDER_ID | Yes | Your TeamUp Provider ID |
| TEAMUP_REQUEST_MODE | No | Request mode: `customer` (default) or `provider` |

### Provider Mode Configuration

For full API access, ensure you're using provider mode:

```json
"env": {
  "TEAMUP_AUTH_MODE": "TOKEN",
  "TEAMUP_ACCESS_TOKEN": "your-access-token",
  "TEAMUP_PROVIDER_ID": "your-provider-id",
  "TEAMUP_REQUEST_MODE": "provider"
}
```

**Note**: The TeamUp API base URL (`https://goteamup.com/api/v2`) is consistent across all accounts and doesn't need to be changed.

### OAuth Mode (Advanced)

If you prefer OAuth authentication:

1. Create an OAuth app in TeamUp Settings → Integrations → Customer API
2. Set `TEAMUP_AUTH_MODE=OAUTH`
3. Add these additional variables:
   - `TEAMUP_CLIENT_ID`
   - `TEAMUP_CLIENT_SECRET`
   - `TEAMUP_REDIRECT_URI`

## ChatGPT Support (Remote Server)

ChatGPT uses OpenAPI Actions, not MCP. To use with ChatGPT:

1. Deploy to a hosting service (Railway, Render, etc.)
2. Set environment variables in your hosting platform:
   - `TEAMUP_ACCESS_TOKEN` - Your TeamUp API token
   - `TEAMUP_PROVIDER_ID` - Your Provider ID
   - `TEAMUP_REQUEST_MODE=provider` - For full access
3. In ChatGPT:
   - Go to Settings → Actions
   - Click "Create new action"
   - Import schema from: `https://your-domain.com/openapi.json`
   - Authentication: None (server handles auth)

## Remote Server Deployment

For deployment:
1. Set these environment variables in your hosting platform:
   - `TEAMUP_ACCESS_TOKEN` - Your TeamUp API token
   - `TEAMUP_PROVIDER_ID` - Your Provider ID
   - `TEAMUP_REQUEST_MODE` - Set to "provider"

## Development

### Running Locally

```bash
# Development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start

# Run remote server (for ChatGPT)
npm run start:remote
```

### Project Structure

```
teamup-mcp-server/
├── src/
│   ├── index.ts          # Main MCP server
│   ├── errors.ts         # Error handling
│   └── utils.ts          # Utility functions
├── dist/                 # Compiled JavaScript
├── package.json
└── tsconfig.json
```

## Troubleshooting

### "Cannot find module" error
- Make sure you've run `npm install` and `npm run build`
- Verify the path in your Claude Desktop config is absolute, not relative

### "TEAMUP_ACCESS_TOKEN is required" error
- Check that your token is correctly set in the Claude Desktop config
- Ensure there are no typos or extra spaces

### "mode_not_allowed" or 403 errors
- **Most common cause**: Your access token doesn't have provider permissions
  - In TeamUp, create a new access token with admin/provider permissions
  - Customer-level tokens cannot access provider mode endpoints
- Verify your access token is valid and active
- Ensure `TEAMUP_REQUEST_MODE` is set to `provider` for full access
- Confirm your Provider ID is correct

### Authentication issues
- The server now logs detailed request/response information to help debug
- Check Claude Desktop's logs for API request details
- Verify the Authorization header shows `Token [your-token]` format

### Server doesn't appear in Claude
- Make sure Claude Desktop is completely quit and restarted
- Check that the configuration file is valid JSON
- Look for errors in Claude Desktop's logs

## Contributing

Pull requests are welcome! Please feel free to submit issues or enhance the functionality.

## License

MIT