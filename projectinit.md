// ===== DEPLOYMENT GUIDE =====
/*
TeamUp MCP OAuth Server - Complete Package

This is a ready-to-deploy OAuth-only MCP server for TeamUp integration.

We will deploy via Render.com
   - I will Create Web Service
   - I will Connect GitHub
   - I will Set environment variables just tell me what to add (render.yaml does not set vars)
   - Auto-deploys on push

STRUCTURE:
- src/
  - index.ts (main OAuth server)
  - auth-server.ts (redirect service)
  - errors.ts
  - utils.ts
- package.json
- tsconfig.json
- .env.example
- README.md

Copy this entire code block to a new directory and follow setup instructions below.
*/

// ===== FILE: package.json =====
const packageJson = `{
  "name": "teamup-mcp-oauth-server",
  "version": "1.0.0",
  "description": "OAuth-only MCP server for TeamUp integration",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "start:auth": "node dist/auth-server.js",
    "dev": "tsx src/index.ts",
    "dev:auth": "tsx src/auth-server.ts",
    "deploy": "npm run build && npm start"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "axios": "^1.7.2",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/express": "^4.17.17",
    "tsx": "^4.15.0",
    "typescript": "^5.4.5"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}`;

// ===== FILE: tsconfig.json =====
const tsconfigJson = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`;

// ===== FILE: .env.example =====
const envExample = `# TeamUp OAuth Configuration
TEAMUP_CLIENT_ID=your-client-id
TEAMUP_CLIENT_SECRET=your-client-secret
TEAMUP_REDIRECT_URI=http://localhost:8080/callback
TEAMUP_CALLBACK_PORT=8080
TEAMUP_PROVIDER_ID=your-provider-id
TEAMUP_REQUEST_MODE=customer

# Optional - for smoother auth flow
TEAMUP_AUTO_AUTH_URL=https://your-domain.com/auth/teamup

# Optional - for persistent tokens (implement secure storage)
# TEAMUP_STORED_ACCESS_TOKEN=
# TEAMUP_STORED_REFRESH_TOKEN=`;

// ===== FILE: src/errors.ts =====
const errorsTsContent = `import { AxiosError } from 'axios';

export interface TeamUpError {
  code: string;
  message: string;
  details?: any;
}

export class TeamUpAPIError extends Error {
  public code: string;
  public statusCode?: number;
  public details?: any;

  constructor(message: string, code: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'TeamUpAPIError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static fromAxiosError(error: AxiosError): TeamUpAPIError {
    if (error.response) {
      const data = error.response.data as any;
      return new TeamUpAPIError(
        data.message || error.message,
        data.code || 'API_ERROR',
        error.response.status,
        data
      );
    } else if (error.request) {
      return new TeamUpAPIError(
        'No response received from TeamUp API',
        'NO_RESPONSE',
        undefined,
        { request: error.request }
      );
    } else {
      return new TeamUpAPIError(
        error.message,
        'REQUEST_ERROR',
        undefined,
        { error: error.message }
      );
    }
  }
}

export function handleAPIError(error: any): TeamUpAPIError {
  if (error instanceof TeamUpAPIError) {
    return error;
  } else if (error instanceof AxiosError) {
    return TeamUpAPIError.fromAxiosError(error);
  } else {
    return new TeamUpAPIError(
      error.message || 'Unknown error',
      'UNKNOWN_ERROR',
      undefined,
      error
    );
  }
}`;

// ===== FILE: src/utils.ts =====
const utilsTsContent = `export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

export function buildQueryParams(params: any): Record<string, any> {
  const cleanParams: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      cleanParams[key] = value;
    }
  }
  
  return cleanParams;
}

export function expandFields(fields: string | string[]): string {
  if (Array.isArray(fields)) {
    return fields.join(',');
  }
  return fields;
}`;

// ===== FILE: src/index.ts =====
const indexTsContent = `#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import { createServer } from 'http';
import { URL } from 'url';
import { handleAPIError } from './errors.js';
import { validateEmail, buildQueryParams } from './utils.js';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  autoAuthUrl?: string;
}

interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

interface TeamUpConfig {
  oauth: OAuthConfig;
  providerId?: string;
  baseUrl: string;
  requestMode: 'customer' | 'provider';
  callbackPort: number;
}

class TeamUpOAuthMCPServer {
  private server: Server;
  private axios: AxiosInstance;
  private config: TeamUpConfig;
  private tokens?: OAuthTokens;
  private authState: 'uninitialized' | 'waiting_for_auth' | 'authenticated' = 'uninitialized';
  private callbackServer?: any;

  constructor() {
    this.config = {
      oauth: {
        clientId: process.env.TEAMUP_CLIENT_ID!,
        clientSecret: process.env.TEAMUP_CLIENT_SECRET!,
        redirectUri: process.env.TEAMUP_REDIRECT_URI || 'http://localhost:8080/callback',
        scope: process.env.TEAMUP_OAUTH_SCOPE || 'read_write',
        autoAuthUrl: process.env.TEAMUP_AUTO_AUTH_URL
      },
      providerId: process.env.TEAMUP_PROVIDER_ID,
      baseUrl: process.env.TEAMUP_BASE_URL || 'https://goteamup.com/api/v2',
      requestMode: (process.env.TEAMUP_REQUEST_MODE as 'customer' | 'provider') || 'customer',
      callbackPort: parseInt(process.env.TEAMUP_CALLBACK_PORT || '8080')
    };

    if (!this.config.oauth.clientId || !this.config.oauth.clientSecret) {
      console.error('Error: TEAMUP_CLIENT_ID and TEAMUP_CLIENT_SECRET are required');
      process.exit(1);
    }

    this.axios = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(this.config.providerId && { 'TeamUp-Provider-ID': this.config.providerId }),
        'TeamUp-Request-Mode': this.config.requestMode
      },
      timeout: 30000
    });

    this.axios.interceptors.request.use(
      async (config) => {
        if (this.tokens?.accessToken) {
          config.headers.Authorization = \`Bearer \${this.tokens.accessToken}\`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry && this.tokens?.refreshToken) {
          originalRequest._retry = true;
          
          try {
            await this.refreshAccessToken();
            return this.axios(originalRequest);
          } catch (refreshError) {
            this.authState = 'uninitialized';
            this.tokens = undefined;
            return Promise.reject(error);
          }
        }
        
        return Promise.reject(error);
      }
    );

    this.server = new Server(
      {
        name: 'teamup-oauth-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.checkStoredTokens();
  }

  private checkStoredTokens() {
    const storedAccessToken = process.env.TEAMUP_STORED_ACCESS_TOKEN;
    const storedRefreshToken = process.env.TEAMUP_STORED_REFRESH_TOKEN;
    
    if (storedAccessToken) {
      this.tokens = {
        accessToken: storedAccessToken,
        refreshToken: storedRefreshToken
      };
      this.authState = 'authenticated';
      console.error('Loaded stored OAuth tokens');
    }
  }

  private async refreshAccessToken() {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(
        \`\${this.config.baseUrl}/auth/refresh_access_token\`,
        {
          refresh_token: this.tokens.refreshToken,
          scope: [this.config.oauth.scope]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'TeamUp-Provider-ID': this.config.providerId,
            'TeamUp-Request-Mode': this.config.requestMode
          }
        }
      );

      this.tokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + (response.data.expires_in * 1000))
      };

      console.error('OAuth token refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh OAuth token:', error);
      throw error;
    }
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (this.authState !== 'authenticated') {
        return {
          tools: [{
            name: 'initialize_teamup',
            description: 'Initialize TeamUp connection and start OAuth authentication flow',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }]
        };
      }

      return { tools: this.getAuthenticatedTools() };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        if (name === 'initialize_teamup') {
          return await this.initializeTeamUp();
        }

        if (this.authState !== 'authenticated') {
          return {
            content: [{
              type: 'text',
              text: 'TeamUp is not authenticated. Please use the "initialize_teamup" tool first to connect your TeamUp account.'
            }]
          };
        }

        switch (name) {
          case 'list_events':
            return await this.listEvents(args);
          case 'get_event':
            return await this.getEvent(args);
          case 'register_for_event':
            return await this.registerForEvent(args);
          case 'list_customers':
            return await this.listCustomers(args);
          case 'get_customer':
            return await this.getCustomer(args);
          case 'create_customer':
            return await this.createCustomer(args);
          case 'list_memberships':
            return await this.listMemberships(args);
          case 'get_membership':
            return await this.getMembership(args);
          default:
            throw new Error(\`Unknown tool: \${name}\`);
        }
      } catch (error: any) {
        const apiError = handleAPIError(error);
        return {
          content: [{
            type: 'text',
            text: \`Error: \${apiError.message}\\nCode: \${apiError.code}\\nStatus: \${apiError.statusCode || 'N/A'}\`
          }]
        };
      }
    });
  }

  private async initializeTeamUp() {
    if (this.authState === 'authenticated') {
      return {
        content: [{
          type: 'text',
          text: 'TeamUp is already connected and authenticated!'
        }]
      };
    }

    if (this.authState === 'waiting_for_auth') {
      return {
        content: [{
          type: 'text',
          text: 'Already waiting for authentication. Please complete the OAuth flow in your browser.'
        }]
      };
    }

    this.authState = 'waiting_for_auth';
    
    await this.startCallbackServer();

    const state = Math.random().toString(36).substring(2, 15);
    
    const params = new URLSearchParams({
      client_id: this.config.oauth.clientId,
      redirect_uri: this.config.oauth.redirectUri,
      response_type: 'code',
      scope: this.config.oauth.scope,
      state: state
    });

    const authUrl = \`\${this.config.baseUrl.replace('/api/v2', '')}/api/auth/authorize?\${params.toString()}\`;

    const clickUrl = this.config.oauth.autoAuthUrl 
      ? \`\${this.config.oauth.autoAuthUrl}?auth_url=\${encodeURIComponent(authUrl)}\`
      : authUrl;

    return {
      content: [{
        type: 'text',
        text: \`🔐 **TeamUp Authentication Required**

Please click the link below to connect your TeamUp account:

🔗 **[Connect TeamUp Account](\${clickUrl})**

This will:
1. Open TeamUp login in your browser
2. Ask you to authorize this integration
3. Automatically complete the setup

⏳ Waiting for authentication...

(The integration will automatically continue once you've authorized it)\`
      }]
    };
  }

  private async startCallbackServer(): Promise<void> {
    if (this.callbackServer) {
      return;
    }

    return new Promise((resolve) => {
      this.callbackServer = createServer(async (req, res) => {
        const url = new URL(req.url!, \`http://localhost:\${this.config.callbackPort}\`);
        
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(\`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1>❌ Authentication Failed</h1>
                  <p>Error: \${error}</p>
                  <p>Please close this window and try again.</p>
                </body>
              </html>
            \`);
            return;
          }

          if (code) {
            try {
              await this.exchangeCodeForTokens(code);
              
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(\`
                <html>
                  <body style="font-family: system-ui; padding: 40px; text-align: center;">
                    <h1>✅ Successfully Connected!</h1>
                    <p>TeamUp has been connected to your AI assistant.</p>
                    <p>You can close this window and return to your conversation.</p>
                    <script>
                      setTimeout(() => window.close(), 3000);
                    </script>
                  </body>
                </html>
              \`);
              
              this.callbackServer.close();
              this.callbackServer = null;
            } catch (error: any) {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(\`
                <html>
                  <body style="font-family: system-ui; padding: 40px; text-align: center;">
                    <h1>❌ Authentication Failed</h1>
                    <p>\${error.message}</p>
                    <p>Please close this window and try again.</p>
                  </body>
                </html>
              \`);
            }
          }
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.callbackServer.listen(this.config.callbackPort, () => {
        console.error(\`OAuth callback server listening on port \${this.config.callbackPort}\`);
        resolve();
      });
    });
  }

  private async exchangeCodeForTokens(code: string) {
    try {
      const formData = new URLSearchParams();
      formData.append('client_id', this.config.oauth.clientId);
      formData.append('client_secret', this.config.oauth.clientSecret);
      formData.append('code', code);

      const response = await axios.post(
        \`\${this.config.baseUrl.replace('/api/v2', '')}/api/auth/access_token\`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.tokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: response.data.expires_in 
          ? new Date(Date.now() + (response.data.expires_in * 1000))
          : undefined
      };

      this.authState = 'authenticated';
      console.error('OAuth authentication successful!');
    } catch (error: any) {
      this.authState = 'uninitialized';
      throw new Error(\`Failed to exchange code for token: \${error.message}\`);
    }
  }

  private getAuthenticatedTools(): Tool[] {
    return [
      {
        name: 'list_events',
        description: 'List all events with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', description: 'Page number for pagination' },
            page_size: { type: 'number', description: 'Number of results per page' },
            starts_after: { type: 'string', description: 'Filter events starting after this date (ISO 8601)' },
            starts_before: { type: 'string', description: 'Filter events starting before this date (ISO 8601)' },
            expand: { type: 'string', description: 'Comma-separated list of fields to expand' }
          }
        }
      },
      {
        name: 'get_event',
        description: 'Get details of a specific event',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Event ID' },
            expand: { type: 'string', description: 'Comma-separated list of fields to expand' }
          },
          required: ['id']
        }
      },
      {
        name: 'register_for_event',
        description: 'Register a customer for an event',
        inputSchema: {
          type: 'object',
          properties: {
            event_id: { type: 'number', description: 'Event ID' },
            customer_id: { type: 'number', description: 'Customer ID' },
            customer_membership_id: { type: 'number', description: 'Customer membership ID' }
          },
          required: ['event_id', 'customer_id']
        }
      },
      {
        name: 'list_customers',
        description: 'List all customers',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            page_size: { type: 'number' },
            query: { type: 'string', description: 'Search query' }
          }
        }
      },
      {
        name: 'get_customer',
        description: 'Get customer details',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Customer ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'create_customer',
        description: 'Create a new customer',
        inputSchema: {
          type: 'object',
          properties: {
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            email: { type: 'string' }
          },
          required: ['first_name', 'last_name', 'email']
        }
      },
      {
        name: 'list_memberships',
        description: 'List all memberships',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            page_size: { type: 'number' }
          }
        }
      },
      {
        name: 'get_membership',
        description: 'Get membership details',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Membership ID' }
          },
          required: ['id']
        }
      }
    ];
  }

  // API implementations
  private async listEvents(args: any) {
    const response = await this.axios.get('/events', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async getEvent(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(\`/events/\${id}\`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async registerForEvent(args: any) {
    const { event_id, customer_id, customer_membership_id } = args;
    const response = await this.axios.post(\`/events/\${event_id}/register\`, {
      customer: customer_id,
      customer_membership: customer_membership_id,
      event: event_id
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async listCustomers(args: any) {
    const response = await this.axios.get('/customers', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async getCustomer(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(\`/customers/\${id}\`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async createCustomer(args: any) {
    if (!validateEmail(args.email)) {
      throw new Error('Invalid email format');
    }
    const response = await this.axios.post('/customers', args);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async listMemberships(args: any) {
    const response = await this.axios.get('/memberships', { params: args });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async getMembership(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(\`/memberships/\${id}\`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('TeamUp OAuth MCP Server started');
    console.error(\`Callback URL: \${this.config.oauth.redirectUri}\`);
    
    if (this.authState === 'authenticated') {
      console.error('Using stored authentication tokens');
    } else {
      console.error('Authentication required - use "initialize_teamup" tool to begin');
    }
  }
}

const server = new TeamUpOAuthMCPServer();
server.start().catch(console.error);`;

// ===== FILE: src/auth-server.ts =====
const authServerTsContent = `import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/auth/teamup', (req, res) => {
  const authUrl = req.query.auth_url as string;
  
  if (!authUrl) {
    return res.status(400).send(\`
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
    \`);
  }

  res.send(\`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connecting to TeamUp...</title>
      <meta http-equiv="refresh" content="1;url=\${authUrl}">
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
          window.location.href = '\${authUrl}';
        }, 1000);
      </script>
    </body>
    </html>
  \`);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'teamup-auth-redirect' });
});

app.get('/', (req, res) => {
  res.send(\`
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
  \`);
});

app.listen(PORT, () => {
  console.log(\`TeamUp Auth Redirect Service running on port \${PORT}\`);
  console.log(\`Main URL: http://localhost:\${PORT}\`);
  console.log(\`Auth endpoint: http://localhost:\${PORT}/auth/teamup\`);
});`;

// ===== FILE: README.md =====
const readmeContent = `# TeamUp MCP OAuth Server

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

\`\`\`bash
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
\`\`\`

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

Add to your \`claude_desktop_config.json\`:

\`\`\`json
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
\`\`\`

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
- \`ngrok http 8080\`
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

MIT`;

// ===== DEPLOYMENT FILES =====

// Railway deployment
const railwayJson = `{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}`;

// Render deployment
const renderYaml = `services:
  - type: web
    name: teamup-mcp-oauth
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: TEAMUP_CLIENT_ID
        sync: false
      - key: TEAMUP_CLIENT_SECRET
        sync: false
      - key: TEAMUP_REDIRECT_URI
        sync: false
      - key: TEAMUP_PROVIDER_ID
        sync: false`;

// Google Cloud Run deployment
const dockerfileContent = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 8080

CMD ["npm", "start"]`;

// Simple setup script
const setupScript = `#!/bin/bash
echo "🏃 TeamUp MCP OAuth Server Setup"
echo "================================"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install Node.js 18 or later."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build
echo "🔨 Building server..."
npm run build

# Check for .env
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your TeamUp credentials"
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your TeamUp OAuth credentials"
echo "2. Run 'npm start' to start the server"
echo "3. Configure Claude Desktop (see README.md)"`;

console.log("TeamUp MCP OAuth Server - Complete Package");
console.log("==========================================");
console.log("");
console.log("This artifact contains all files needed for deployment.");
console.log("");
console.log("Quick deployment options:");
console.log("1. Railway - Click deploy button, add env vars, done!");
console.log("2. Render - Connect GitHub, auto-deploy on push");
console.log("3. Local - npm install && npm start");
console.log("");
console.log("Files included:");
console.log("- Complete TypeScript source code");
console.log("- Package.json with all dependencies");
console.log("- README with deployment instructions");
console.log("- Environment variable template");
console.log("- Deployment configurations");