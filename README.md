# TeamUp MCP Server

Connect Claude Desktop to TeamUp for managing events, customers, and memberships directly from your AI assistant.

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
| TEAMUP_BASE_URL | No | API base URL (default: `https://goteamup.com/api/v2`) |

### Important: Custom Subdomains

If your TeamUp account uses a custom subdomain (e.g., `https://yourbusiness.goteamup.com`), you must set the base URL:

```json
"env": {
  "TEAMUP_BASE_URL": "https://yourbusiness.goteamup.com/api/v2",
  // ... other settings
}
```

### OAuth Mode (Advanced)

If you prefer OAuth authentication:

1. Create an OAuth app in TeamUp Settings → Integrations → Customer API
2. Set `TEAMUP_AUTH_MODE=OAUTH`
3. Add these additional variables:
   - `TEAMUP_CLIENT_ID`
   - `TEAMUP_CLIENT_SECRET`
   - `TEAMUP_REDIRECT_URI`

## Development

### Running Locally

```bash
# Development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start
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
- Verify your access token is valid and active
- Check if you're using a custom subdomain and set `TEAMUP_BASE_URL` accordingly
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