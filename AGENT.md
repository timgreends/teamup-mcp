# AGENT.md - TeamUp MCP Server

## Build & Commands
- Build: `npm run build` (TypeScript compilation)
- Start local MCP server: `npm run dev` (runs index.ts with tsx)
- Start remote server for ChatGPT: `npm run dev:remote` (runs remote-server.ts)
- Start auth server: `npm run dev:auth` (runs auth-server.ts)
- Production build: `npm run build && npm start`
- No test commands configured

## Architecture
- **Main MCP Server**: `src/index.ts` - Stdio-based MCP server for Claude Desktop
- **Remote Server**: `src/remote-server.ts` - HTTP/SSE-based server for ChatGPT Actions
- **Auth Server**: `src/auth-server.ts` - OAuth flow handler
- **API Layer**: `src/api-implementations.ts` - TeamUp API wrapper implementations
- **Tools**: `src/tools.ts` - Tool definitions for extended TeamUp functionality
- **Error Handling**: `src/errors.ts` - Centralized error handling
- **Utilities**: `src/utils.ts` - Helper functions for validation and query building
- Built with TypeScript, Express, Axios, and @modelcontextprotocol/sdk

## Code Style & Conventions
- TypeScript with strict mode enabled
- camelCase for variables and functions, PascalCase for classes/interfaces
- Import style: ES6 imports with .js extensions for local files
- Environment variables prefixed with `TEAMUP_`
- Error responses include structured error objects with code, message, statusCode
- API responses wrapped in JSON with consistent structure
- Console logging for debugging with structured objects
- Authorization headers use `Token ${accessToken}` format
- Request/response interceptors for logging and auth
- Async/await pattern for API calls
