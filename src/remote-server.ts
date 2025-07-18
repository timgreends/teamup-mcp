#!/usr/bin/env node

import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { handleAPIError } from './errors.js';
import { validateEmail, buildQueryParams } from './utils.js';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

interface TeamUpConfig {
  authMode: 'TOKEN' | 'OAUTH';
  oauth: OAuthConfig;
  accessToken?: string;
  providerId?: string;
  baseUrl: string;
  requestMode: 'customer' | 'provider';
}

interface UserSession {
  id: string;
  tokens?: OAuthTokens;
  userProvidedToken?: string;
  authState: 'uninitialized' | 'waiting_for_auth' | 'authenticated';
  createdAt: Date;
  lastAccess: Date;
}

// In-memory session store (replace with Redis/Database in production)
const sessions = new Map<string, UserSession>();

// Handle MCP tool calls
async function handleToolCall(toolName: string, args: any, config: TeamUpConfig): Promise<any> {
  if (!config.accessToken) {
    throw new Error('No authentication token available. Server needs TEAMUP_ACCESS_TOKEN environment variable.');
  }

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Token ${config.accessToken}`,
    ...(config.providerId && { 'TeamUp-Provider-ID': config.providerId }),
    'TeamUp-Request-Mode': config.requestMode
  };
  
  console.log(`[TeamUp API] Making ${toolName} request with headers:`, {
    ...headers,
    'Authorization': `Token ${config.accessToken ? '[REDACTED]' : 'missing'}`
  });
  
  const axiosInstance = axios.create({
    baseURL: config.baseUrl,
    headers
  });

  switch (toolName) {
    case 'list_events':
      const eventsResponse = await axiosInstance.get('/events', {
        params: args
      });
      return eventsResponse.data;

    case 'get_event':
      if (!args.event_id) throw new Error('event_id is required');
      const eventResponse = await axiosInstance.get(`/events/${args.event_id}`);
      return eventResponse.data;

    case 'list_customers':
      const customersResponse = await axiosInstance.get('/customers', {
        params: args
      });
      return customersResponse.data;

    case 'get_customer':
      if (!args.customer_id) throw new Error('customer_id is required');
      const customerResponse = await axiosInstance.get(`/customers/${args.customer_id}`);
      return customerResponse.data;

    case 'create_customer':
      const createResponse = await axiosInstance.post('/customers', args);
      return createResponse.data;

    case 'update_customer':
      if (!args.customer_id) throw new Error('customer_id is required');
      const { customer_id, ...updateData } = args;
      const updateResponse = await axiosInstance.put(`/customers/${customer_id}`, updateData);
      return updateResponse.data;

    case 'list_memberships':
      const membershipsResponse = await axiosInstance.get('/memberships', {
        params: args
      });
      return membershipsResponse.data;

    case 'register_for_event':
      if (!args.event_id) throw new Error('event_id is required');
      if (!args.customer_id) throw new Error('customer_id is required');
      const registerResponse = await axiosInstance.post(
        `/events/${args.event_id}/register`,
        { 
          customer: args.customer_id,
          customer_membership: args.customer_membership_id,
          event: args.event_id
        }
      );
      return registerResponse.data;

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Debug environment variables
console.log('=== Environment Debug ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('TEAMUP_AUTH_MODE:', process.env.TEAMUP_AUTH_MODE);
console.log('TEAMUP_ACCESS_TOKEN exists:', !!process.env.TEAMUP_ACCESS_TOKEN);
console.log('TEAMUP_ACCESS_TOKEN length:', process.env.TEAMUP_ACCESS_TOKEN?.length);
console.log('TEAMUP_PROVIDER_ID:', process.env.TEAMUP_PROVIDER_ID);
console.log('TEAMUP_REQUEST_MODE:', process.env.TEAMUP_REQUEST_MODE);
console.log('All TEAMUP env vars:', Object.keys(process.env).filter(k => k.startsWith('TEAMUP')));
console.log('All RAILWAY env vars:', Object.keys(process.env).filter(k => k.includes('RAILWAY')));
console.log('Total env vars count:', Object.keys(process.env).length);
console.log('All env var keys:', Object.keys(process.env).sort());
console.log('========================');

// Environment configuration
const config: TeamUpConfig = {
  authMode: (process.env.TEAMUP_AUTH_MODE as 'TOKEN' | 'OAUTH') || 'TOKEN',
  oauth: {
    clientId: process.env.TEAMUP_CLIENT_ID || '',
    clientSecret: process.env.TEAMUP_CLIENT_SECRET || '',
    redirectUri: process.env.TEAMUP_REDIRECT_URI || 'https://your-domain.com/callback',
    scope: process.env.TEAMUP_OAUTH_SCOPE || 'read_write'
  },
  accessToken: process.env.TEAMUP_ACCESS_TOKEN,
  providerId: process.env.TEAMUP_PROVIDER_ID,
  baseUrl: 'https://goteamup.com/api/v2',
  requestMode: (process.env.TEAMUP_REQUEST_MODE as 'customer' | 'provider') || 'provider', // Default to provider mode
};

// Log the configuration (without sensitive data)
console.log('=== TeamUp Configuration ===');
console.log('Auth Mode:', config.authMode);
console.log('Request Mode:', config.requestMode);
console.log('Provider ID:', config.providerId);
console.log('Provider ID type:', typeof config.providerId);
console.log('Access Token exists:', !!config.accessToken);
console.log('Base URL:', config.baseUrl);
console.log('===========================');

// Validate configuration based on auth mode
if (config.authMode === 'OAUTH') {
  if (!config.oauth.clientId || !config.oauth.clientSecret) {
    console.error('Error: TEAMUP_CLIENT_ID and TEAMUP_CLIENT_SECRET are required for OAUTH mode');
    process.exit(1);
  }
} else if (config.authMode === 'TOKEN') {
  if (!config.accessToken) {
    console.warn('Warning: TEAMUP_ACCESS_TOKEN not set. Users will need to provide their own tokens.');
    console.warn('To use a server-wide token, set TEAMUP_ACCESS_TOKEN in environment variables.');
    console.warn('');
    console.warn('If you have set these in Railway, please check:');
    console.warn('1. Variables are in the "Variables" tab (not "Shared Variables")');
    console.warn('2. The service has been redeployed after adding variables');
    console.warn('3. Variable names exactly match (case-sensitive)');
  }
}

// Express app setup
const app = express();
app.use(express.json());

// Enable CORS for Claude Desktop
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.header('Access-Control-Expose-Headers', 'X-Session-Id');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Session middleware
app.use((req, res, next) => {
  let sessionId = req.headers['x-session-id'] as string;
  
  if (!sessionId || !sessions.has(sessionId)) {
    sessionId = crypto.randomBytes(32).toString('hex');
    const session: UserSession = {
      id: sessionId,
      authState: 'uninitialized',
      createdAt: new Date(),
      lastAccess: new Date()
    };
    sessions.set(sessionId, session);
  }
  
  const session = sessions.get(sessionId)!;
  session.lastAccess = new Date();
  
  res.setHeader('X-Session-Id', sessionId);
  req.session = session;
  next();
});

// Clean up old sessions periodically
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, session] of sessions.entries()) {
    if (session.lastAccess < oneHourAgo) {
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000); // Every 10 minutes

// Landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>TeamUp MCP Server</title>
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
        .info {
          background: #e8f4f8;
          padding: 20px;
          border-radius: 4px;
          margin: 20px 0;
        }
        .setup {
          background: #f0f0f0;
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
        pre {
          background: #272822;
          color: #f8f8f2;
          padding: 20px;
          border-radius: 4px;
          overflow-x: auto;
        }
        pre code {
          background: none;
          padding: 0;
        }
        .button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 4px;
          margin-top: 20px;
        }
        .button:hover {
          background: #5a67d8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🏃 TeamUp MCP Server</h1>
        
        <div class="info">
          <h3>Connect AI Assistants to TeamUp</h3>
          <p>This MCP server enables Claude and ChatGPT to manage your TeamUp events, customers, and memberships.</p>
        </div>
        
        <div class="setup">
          <h3>🤖 For ChatGPT (OpenAI)</h3>
          <p>To add TeamUp to ChatGPT:</p>
          <ol>
            <li>Open ChatGPT Settings → Actions</li>
            <li>Click "Create new action"</li>
            <li>Import from URL: <code>${req.protocol}://${req.get('host')}/.well-known/mcp.json</code></li>
            <li>Save the action</li>
          </ol>
          <p>ChatGPT will then have access to all TeamUp management tools.</p>
        </div>
        
        <div class="setup">
          <h3>📦 Installation Instructions</h3>
          <p>TeamUp MCP requires local installation. Follow these steps:</p>
          
          <h4>1. Clone and Install</h4>
          <pre><code>git clone https://github.com/timgreends/teamup-mcp.git
cd teamup-mcp-server
npm install
npm run build</code></pre>
          
          <h4>2. Get TeamUp Credentials</h4>
          <ul>
            <li>Log in to TeamUp</li>
            <li>Go to Settings → API → Access Tokens</li>
            <li>Create a new access token</li>
            <li>Note your Provider ID</li>
          </ul>
          
          <h4>3. Configure Claude Desktop</h4>
          <p>Add to your <code>claude_desktop_config.json</code>:</p>
          <pre><code>{
  "mcpServers": {
    "teamup": {
      "command": "node",
      "args": ["/path/to/teamup-mcp-server/dist/index.js"],
      "env": {
        "TEAMUP_AUTH_MODE": "TOKEN",
        "TEAMUP_ACCESS_TOKEN": "your-token",
        "TEAMUP_PROVIDER_ID": "your-provider-id"
      }
    }
  }
}</code></pre>
          
          <h4>4. Restart Claude Desktop</h4>
          <p>Quit and restart Claude Desktop to load the integration.</p>
        </div>
        
        <a href="https://github.com/timgreends/teamup-mcp" class="button">View on GitHub</a>
      </div>
    </body>
    </html>
  `);
});


// Log all requests to help debug ChatGPT
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  next();
});

// OpenAPI specification for ChatGPT Actions
// Handle both GET and POST requests (ChatGPT sends both)
app.all(['/.well-known/mcp.json', '/openapi.json'], (req, res) => {
  // Log POST body if present for debugging
  if (req.method === 'POST' && req.body) {
    console.log('ChatGPT POST to OpenAPI endpoint:', JSON.stringify(req.body, null, 2));
  }
  
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    "openapi": "3.1.0",
    "info": {
      "title": "TeamUp API",
      "description": "Manage TeamUp events, customers, and memberships",
      "version": "1.0.0"
    },
    "servers": [
      {
        "url": baseUrl
      }
    ],
    "paths": {
      "/api/events": {
        "get": {
          "operationId": "listEvents",
          "summary": "List events with optional filters",
          "parameters": [
            {
              "name": "page",
              "in": "query",
              "schema": { "type": "integer" },
              "description": "Page number for pagination"
            },
            {
              "name": "page_size",
              "in": "query",
              "schema": { "type": "integer" },
              "description": "Number of results per page"
            },
            {
              "name": "starts_after",
              "in": "query",
              "schema": { "type": "string", "format": "date-time" },
              "description": "Filter events starting after this date"
            },
            {
              "name": "starts_before",
              "in": "query",
              "schema": { "type": "string", "format": "date-time" },
              "description": "Filter events starting before this date"
            }
          ],
          "responses": {
            "200": {
              "description": "List of events",
              "content": {
                "application/json": {
                  "schema": { "type": "object" }
                }
              }
            }
          }
        }
      },
      "/api/events/{id}": {
        "get": {
          "operationId": "getEvent",
          "summary": "Get details of a specific event",
          "parameters": [
            {
              "name": "id",
              "in": "path",
              "required": true,
              "schema": { "type": "integer" },
              "description": "Event ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Event details",
              "content": {
                "application/json": {
                  "schema": { "type": "object" }
                }
              }
            }
          }
        }
      },
      "/api/events/{event_id}/register": {
        "post": {
          "operationId": "registerForEvent",
          "summary": "Register a customer for an event",
          "parameters": [
            {
              "name": "event_id",
              "in": "path",
              "required": true,
              "schema": { "type": "integer" },
              "description": "Event ID"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "customer_id": {
                      "type": "integer",
                      "description": "Customer ID"
                    },
                    "customer_membership_id": {
                      "type": "integer",
                      "description": "Customer membership ID (optional)"
                    }
                  },
                  "required": ["customer_id"]
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Registration successful",
              "content": {
                "application/json": {
                  "schema": { "type": "object" }
                }
              }
            }
          }
        }
      },
      "/api/customers": {
        "get": {
          "operationId": "listCustomers",
          "summary": "List customers with search",
          "parameters": [
            {
              "name": "page",
              "in": "query",
              "schema": { "type": "integer" },
              "description": "Page number for pagination"
            },
            {
              "name": "page_size",
              "in": "query",
              "schema": { "type": "integer" },
              "description": "Number of results per page"
            },
            {
              "name": "query",
              "in": "query",
              "schema": { "type": "string" },
              "description": "Search query"
            }
          ],
          "responses": {
            "200": {
              "description": "List of customers",
              "content": {
                "application/json": {
                  "schema": { "type": "object" }
                }
              }
            }
          }
        },
        "post": {
          "operationId": "createCustomer",
          "summary": "Create a new customer",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "first_name": {
                      "type": "string",
                      "description": "Customer's first name"
                    },
                    "last_name": {
                      "type": "string",
                      "description": "Customer's last name"
                    },
                    "email": {
                      "type": "string",
                      "format": "email",
                      "description": "Customer's email address"
                    }
                  },
                  "required": ["first_name", "last_name", "email"]
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "Customer created successfully",
              "content": {
                "application/json": {
                  "schema": { "type": "object" }
                }
              }
            }
          }
        }
      },
      "/api/customers/{id}": {
        "get": {
          "operationId": "getCustomer",
          "summary": "Get specific customer details",
          "parameters": [
            {
              "name": "id",
              "in": "path",
              "required": true,
              "schema": { "type": "integer" },
              "description": "Customer ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Customer details",
              "content": {
                "application/json": {
                  "schema": { "type": "object" }
                }
              }
            }
          }
        }
      },
      "/api/memberships": {
        "get": {
          "operationId": "listMemberships",
          "summary": "List memberships",
          "parameters": [
            {
              "name": "page",
              "in": "query",
              "schema": { "type": "integer" },
              "description": "Page number for pagination"
            },
            {
              "name": "page_size",
              "in": "query",
              "schema": { "type": "integer" },
              "description": "Number of results per page"
            }
          ],
          "responses": {
            "200": {
              "description": "List of memberships",
              "content": {
                "application/json": {
                  "schema": { "type": "object" }
                }
              }
            }
          }
        }
      }
    }
  });
});


// OpenAI MCP tools endpoint
app.get('/mcp/tools', (req, res) => {
  // For testing, return tools without auth requirement
  res.json({
    tools: getAuthenticatedTools()
  });
});

// OpenAI MCP endpoint (disabled due to connection issues)
// app.get('/mcp/messages', async (req, res) => {
//   res.status(501).json({
//     error: 'OpenAI MCP endpoint temporarily disabled',
//     message: 'Use the ChatGPT Actions API endpoints instead'
//   });
// });


// MCP SSE endpoint (supports both GET and POST for OpenAI and Claude)
app.all('/mcp/sse', async (req, res) => {
  const session = req.session!;
  
  // Create axios instance for this session
  const axiosInstance = axios.create({
    baseURL: config.baseUrl,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(config.providerId && { 'TeamUp-Provider-ID': String(config.providerId) }),
      'TeamUp-Request-Mode': config.requestMode
    },
    timeout: 30000
  });
  
  // Add auth interceptor
  axiosInstance.interceptors.request.use(
    async (reqConfig) => {
      // In TOKEN mode, use server token or user-provided token
      if (config.authMode === 'TOKEN') {
        const token = session.userProvidedToken || config.accessToken;
        if (token) {
          reqConfig.headers.Authorization = `Token ${token}`;
        }
      } 
      // In OAUTH mode, use OAuth tokens
      else if (session.tokens?.accessToken) {
        reqConfig.headers.Authorization = `Token ${session.tokens.accessToken}`;
      }
      return reqConfig;
    },
    (error) => Promise.reject(error)
  );
  
  // Create MCP server for this session
  const server = new Server(
    {
      name: 'teamup-remote-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  
  // Set up handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // In TOKEN mode with server token, no initialization needed
    if (config.authMode === 'TOKEN' && config.accessToken) {
      session.authState = 'authenticated';
      return { tools: getAuthenticatedTools() };
    }
    
    // In TOKEN mode without server token, need user to provide token
    if (config.authMode === 'TOKEN' && !config.accessToken && !session.userProvidedToken) {
      return {
        tools: [{
          name: 'set_teamup_token',
          description: 'Set your TeamUp access token for API access',
          inputSchema: {
            type: 'object',
            properties: {
              token: {
                type: 'string',
                description: 'Your TeamUp access token (get from TeamUp Settings → API → Access Tokens)'
              }
            },
            required: ['token']
          }
        }]
      };
    }
    
    // In TOKEN mode with user-provided token, authenticated
    if (config.authMode === 'TOKEN' && session.userProvidedToken) {
      session.authState = 'authenticated';
      return { tools: getAuthenticatedTools() };
    }
    
    // In OAUTH mode, show initialize tool if not authenticated
    if (config.authMode === 'OAUTH' && session.authState !== 'authenticated') {
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
    
    return { tools: getAuthenticatedTools() };
  });
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    try {
      // Handle token setting for TOKEN mode
      if (name === 'set_teamup_token') {
        const tokenArgs = args as any;
        if (!tokenArgs.token) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Token is required'
            }]
          };
        }
        
        session.userProvidedToken = tokenArgs.token;
        session.authState = 'authenticated';
        
        return {
          content: [{
            type: 'text',
            text: '✅ **TeamUp Token Set Successfully!**\n\nYour access token has been configured. You can now use all TeamUp tools.'
          }]
        };
      }
      
      // Handle OAuth initialization
      if (name === 'initialize_teamup') {
        if (config.authMode !== 'OAUTH') {
          return {
            content: [{
              type: 'text',
              text: 'This server is configured for TOKEN authentication. Use the "set_teamup_token" tool instead.'
            }]
          };
        }
        
        if (session.authState === 'authenticated') {
          return {
            content: [{
              type: 'text',
              text: 'TeamUp is already connected and authenticated!'
            }]
          };
        }
        
        session.authState = 'waiting_for_auth';
        
        const params = new URLSearchParams({
          client_id: config.oauth.clientId,
          redirect_uri: config.oauth.redirectUri,
          response_type: 'code',
          scope: config.oauth.scope,
          state: session.id
        });
        
        const authUrl = `${config.baseUrl.replace('/api/v2', '')}/api/auth/authorize?${params.toString()}`;
        
        return {
          content: [{
            type: 'text',
            text: `🔐 **TeamUp Authentication Required**

Please click the link below to connect your TeamUp account:

🔗 **[Connect TeamUp Account](${authUrl})**

This will:
1. Open TeamUp login in your browser
2. Ask you to authorize this integration
3. Automatically complete the setup

⏳ Waiting for authentication...

(The integration will automatically continue once you've authorized it)`
          }]
        };
      }
      
      if (session.authState !== 'authenticated') {
        const authMessage = config.authMode === 'TOKEN' 
          ? 'TeamUp is not authenticated. Please use the "set_teamup_token" tool first to provide your TeamUp access token.'
          : 'TeamUp is not authenticated. Please use the "initialize_teamup" tool first to connect your TeamUp account.';
        return {
          content: [{
            type: 'text',
            text: authMessage
          }]
        };
      }
      
      // Handle authenticated tools using the shared handleToolCall function
      try {
        // For TOKEN mode, pass the session's token if available
        const effectiveConfig = { ...config };
        if (config.authMode === 'TOKEN' && session.userProvidedToken) {
          effectiveConfig.accessToken = session.userProvidedToken;
        } else if (config.authMode === 'OAUTH' && session.tokens?.accessToken) {
          effectiveConfig.accessToken = session.tokens.accessToken;
        }
        
        const result = await handleToolCall(name, args, effectiveConfig);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        // If it's not a supported tool in handleToolCall, continue with the old implementation
        console.log(`Tool ${name} not found in handleToolCall, using legacy handler`);
      }
      
      // Legacy handlers for tools not in handleToolCall
      switch (name) {
        case 'list_events':
          const eventsRes = await axiosInstance.get('/events', { params: buildQueryParams(args as any) });
          return {
            content: [{ type: 'text', text: JSON.stringify(eventsRes.data, null, 2) }],
          };
          
        case 'get_event':
          const eventArgs = args as any;
          const { id: eventId, ...eventParams } = eventArgs;
          const eventRes = await axiosInstance.get(`/events/${eventId}`, { params: eventParams });
          return {
            content: [{ type: 'text', text: JSON.stringify(eventRes.data, null, 2) }],
          };
          
        case 'register_for_event':
          const regArgs = args as any;
          const regRes = await axiosInstance.post(`/events/${regArgs.event_id}/register`, {
            customer: regArgs.customer_id,
            customer_membership: regArgs.customer_membership_id,
            event: regArgs.event_id
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(regRes.data, null, 2) }],
          };
          
        case 'list_customers':
          const customersRes = await axiosInstance.get('/customers', { params: buildQueryParams(args as any) });
          return {
            content: [{ type: 'text', text: JSON.stringify(customersRes.data, null, 2) }],
          };
          
        case 'get_customer':
          const customerArgs = args as any;
          const { id: customerId, ...customerParams } = customerArgs;
          const customerRes = await axiosInstance.get(`/customers/${customerId}`, { params: customerParams });
          return {
            content: [{ type: 'text', text: JSON.stringify(customerRes.data, null, 2) }],
          };
          
        case 'create_customer':
          const createArgs = args as any;
          if (!validateEmail(createArgs.email)) {
            throw new Error('Invalid email format');
          }
          const createRes = await axiosInstance.post('/customers', createArgs);
          return {
            content: [{ type: 'text', text: JSON.stringify(createRes.data, null, 2) }],
          };
          
        case 'list_memberships':
          const membershipsRes = await axiosInstance.get('/memberships', { params: args as any });
          return {
            content: [{ type: 'text', text: JSON.stringify(membershipsRes.data, null, 2) }],
          };
          
        case 'get_membership':
          const membershipArgs = args as any;
          const { id: membershipId, ...membershipParams } = membershipArgs;
          const membershipRes = await axiosInstance.get(`/memberships/${membershipId}`, { params: membershipParams });
          return {
            content: [{ type: 'text', text: JSON.stringify(membershipRes.data, null, 2) }],
          };
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      const apiError = handleAPIError(error);
      return {
        content: [{
          type: 'text',
          text: `Error: ${apiError.message}\nCode: ${apiError.code}\nStatus: ${apiError.statusCode || 'N/A'}`
        }]
      };
    }
  });
  
  // Create SSE transport
  const transport = new SSEServerTransport('/mcp/sse', res);
  await server.connect(transport);
  
  // Keep connection alive
  req.on('close', () => {
    transport.close();
  });
});

// Removed handleOpenAIMCP function - was causing connection issues

function getAuthenticatedTools(): Tool[] {
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

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      session?: UserSession;
    }
  }
}

// API endpoints for ChatGPT Actions
app.get('/api/events', async (req, res) => {
  try {
    // Use server token if available, otherwise return error
    if (!config.accessToken) {
      return res.status(400).json({
        error: 'No authentication token available',
        message: 'Server needs TEAMUP_ACCESS_TOKEN environment variable'
      });
    }

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Token ${config.accessToken}`,
      ...(config.providerId && { 'TeamUp-Provider-ID': String(config.providerId) }),
      'TeamUp-Request-Mode': config.requestMode
    };
    
    console.log('[API] /api/events headers:', {
      ...headers,
      'Authorization': `Token ${config.accessToken ? '[REDACTED]' : 'missing'}`
    });
    
    const axiosInstance = axios.create({
      baseURL: config.baseUrl,
      headers
    });
    
    // Add request interceptor to log full request details
    axiosInstance.interceptors.request.use(
      (config) => {
        console.log('[TeamUp API Request]', {
          method: config.method?.toUpperCase(),
          url: `${config.baseURL}${config.url}`,
          headers: {
            ...config.headers,
            'Authorization': config.headers['Authorization'] ? 'Token [REDACTED]' : 'missing'
          },
          params: config.params,
          data: config.data
        });
        return config;
      },
      (error) => {
        console.error('[TeamUp API Request Error]', error);
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor to log responses
    axiosInstance.interceptors.response.use(
      (response) => {
        console.log('[TeamUp API Response]', {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data
        });
        return response;
      },
      (error) => {
        console.error('[TeamUp API Error Response]', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          headers: error.response?.headers,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(error);
      }
    );

    const response = await axiosInstance.get('/events', {
      params: {
        page: req.query.page,
        page_size: req.query.page_size,
        starts_after: req.query.starts_after,
        starts_before: req.query.starts_before
      }
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching events:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

app.get('/api/customers', async (req, res) => {
  try {
    if (!config.accessToken) {
      return res.status(400).json({
        error: 'No authentication token available',
        message: 'Server needs TEAMUP_ACCESS_TOKEN environment variable'
      });
    }

    const axiosInstance = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${config.accessToken}`,
        ...(config.providerId && { 'TeamUp-Provider-ID': String(config.providerId) }),
        'TeamUp-Request-Mode': config.requestMode
      }
    });

    const response = await axiosInstance.get('/customers', {
      params: {
        page: req.query.page,
        page_size: req.query.page_size,
        query: req.query.query
      }
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching customers:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

app.get('/api/memberships', async (req, res) => {
  try {
    if (!config.accessToken) {
      return res.status(400).json({
        error: 'No authentication token available',
        message: 'Server needs TEAMUP_ACCESS_TOKEN environment variable'
      });
    }

    const axiosInstance = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${config.accessToken}`,
        ...(config.providerId && { 'TeamUp-Provider-ID': String(config.providerId) }),
        'TeamUp-Request-Mode': config.requestMode
      }
    });

    const response = await axiosInstance.get('/memberships', {
      params: {
        page: req.query.page,
        page_size: req.query.page_size
      }
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching memberships:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

// Get specific event
app.get('/api/events/:id', async (req, res) => {
  try {
    if (!config.accessToken) {
      return res.status(400).json({
        error: 'No authentication token available',
        message: 'Server needs TEAMUP_ACCESS_TOKEN environment variable'
      });
    }

    const result = await handleToolCall('get_event', { event_id: req.params.id }, config);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching event:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

// Register for event
app.post('/api/events/:event_id/register', async (req, res) => {
  try {
    if (!config.accessToken) {
      return res.status(400).json({
        error: 'No authentication token available',
        message: 'Server needs TEAMUP_ACCESS_TOKEN environment variable'
      });
    }

    const result = await handleToolCall('register_for_event', {
      event_id: req.params.event_id,
      customer_id: req.body.customer_id,
      customer_membership_id: req.body.customer_membership_id
    }, config);
    res.json(result);
  } catch (error: any) {
    console.error('Error registering for event:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

// Get specific customer
app.get('/api/customers/:id', async (req, res) => {
  try {
    if (!config.accessToken) {
      return res.status(400).json({
        error: 'No authentication token available',
        message: 'Server needs TEAMUP_ACCESS_TOKEN environment variable'
      });
    }

    const result = await handleToolCall('get_customer', { customer_id: req.params.id }, config);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching customer:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

// Create customer
app.post('/api/customers', async (req, res) => {
  try {
    if (!config.accessToken) {
      return res.status(400).json({
        error: 'No authentication token available',
        message: 'Server needs TEAMUP_ACCESS_TOKEN environment variable'
      });
    }

    const result = await handleToolCall('create_customer', req.body, config);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error creating customer:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

// Debug endpoint to check configuration
app.get('/debug/config', (req, res) => {
  res.json({
    config: {
      authMode: config.authMode,
      requestMode: config.requestMode,
      providerId: config.providerId,
      providerIdType: typeof config.providerId,
      accessTokenExists: !!config.accessToken,
      baseUrl: config.baseUrl
    },
    env: {
      TEAMUP_REQUEST_MODE: process.env.TEAMUP_REQUEST_MODE,
      TEAMUP_PROVIDER_ID: process.env.TEAMUP_PROVIDER_ID,
      TEAMUP_AUTH_MODE: process.env.TEAMUP_AUTH_MODE,
      NODE_ENV: process.env.NODE_ENV
    },
    testHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': config.accessToken ? 'Token [REDACTED]' : 'missing',
      'TeamUp-Provider-ID': config.providerId ? String(config.providerId) : 'missing',
      'TeamUp-Request-Mode': config.requestMode || 'missing'
    }
  });
});

// Diagnostic endpoint to test API connection
app.get('/debug/test-api', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    config: {
      requestMode: config.requestMode,
      providerId: config.providerId,
      hasToken: !!config.accessToken
    },
    tests: [] as any[]
  };

  // Test 1: Basic events list
  try {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Token ${config.accessToken}`,
      ...(config.providerId && { 'TeamUp-Provider-ID': String(config.providerId) }),
      'TeamUp-Request-Mode': config.requestMode
    };
    
    const axiosInstance = axios.create({
      baseURL: config.baseUrl,
      headers,
      timeout: 10000
    });
    
    const response = await axiosInstance.get('/events', {
      params: { page_size: 1 }
    });
    
    results.tests.push({
      test: 'GET /events',
      success: true,
      status: response.status,
      dataReceived: !!response.data
    });
  } catch (error: any) {
    results.tests.push({
      test: 'GET /events',
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
      headers: error.config?.headers ? {
        ...error.config.headers,
        'Authorization': error.config.headers['Authorization'] ? 'Token [REDACTED]' : 'missing'
      } : {}
    });
  }

  // Test 2: Provider info (if provider mode)
  if (config.requestMode === 'provider' && config.providerId) {
    try {
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${config.accessToken}`,
        'TeamUp-Provider-ID': String(config.providerId),
        'TeamUp-Request-Mode': 'provider'
      };
      
      const axiosInstance = axios.create({
        baseURL: config.baseUrl,
        headers,
        timeout: 10000
      });
      
      const response = await axiosInstance.get(`/providers/${config.providerId}`);
      
      results.tests.push({
        test: `GET /providers/${config.providerId}`,
        success: true,
        status: response.status,
        providerName: response.data?.name
      });
    } catch (error: any) {
      results.tests.push({
        test: `GET /providers/${config.providerId}`,
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      });
    }
  }

  res.json(results);
});

// OAuth test page
app.get('/oauth-test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>TeamUp OAuth Test</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .section { margin: 20px 0; padding: 20px; border: 1px solid #ccc; border-radius: 5px; }
            input, select { width: 100%; padding: 5px; margin: 5px 0; }
            button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
            button:hover { background: #0056b3; }
            pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
            .error { color: red; }
            .success { color: green; }
        </style>
    </head>
    <body>
        <h1>TeamUp OAuth Token Generator</h1>
        
        <div class="section">
            <h2>OAuth Application Settings</h2>
            <p><strong>Redirect URI:</strong> ${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}/callback</p>
            <p>Make sure this matches EXACTLY in your TeamUp OAuth app settings!</p>
            <p style="color: #666; font-size: 0.9em;">
              Protocol: ${req.get('x-forwarded-proto') || req.protocol}<br>
              Host: ${req.get('host')}<br>
              Headers: x-forwarded-proto=${req.get('x-forwarded-proto')}, protocol=${req.protocol}
            </p>
        </div>
        
        <div class="section">
            <h2>Start Authorization</h2>
            <form action="/oauth-start" method="get">
                <label>Client ID:</label>
                <input type="text" name="client_id" required placeholder="your-client-id">
                
                <label>Scope:</label>
                <select name="scope">
                    <option value="read">read</option>
                    <option value="read_write" selected>read_write</option>
                </select>
                
                <button type="submit">Start OAuth Flow</button>
            </form>
        </div>
        
        <div class="section">
            <h2>Recent Results</h2>
            <div id="results">Check console logs after completing OAuth flow</div>
        </div>
    </body>
    </html>
  `);
});

// OAuth start endpoint
app.get('/oauth-start', (req, res) => {
  const { client_id, scope } = req.query;
  
  // Build redirect URI - handle potential protocol issues
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  const redirect_uri = `${protocol}://${host}/callback`;
  
  console.log('[OAuth] Starting OAuth flow');
  console.log('[OAuth] Protocol:', protocol);
  console.log('[OAuth] Host:', host);
  console.log('[OAuth] Redirect URI:', redirect_uri);
  
  const state = crypto.randomBytes(16).toString('hex');
  
  // Store state for verification (in production, use a proper session store)
  sessions.set(`oauth_${state}`, {
    id: state,
    clientId: client_id as string,
    createdAt: new Date(),
    lastAccess: new Date(),
    authState: 'waiting_for_auth'
  } as any);
  
  const params = new URLSearchParams({
    client_id: client_id as string,
    redirect_uri,
    response_type: 'code',
    scope: scope as string || 'read_write',
    state
  });
  
  const authUrl = `https://goteamup.com/api/auth/authorize?${params.toString()}`;
  console.log('[OAuth] Redirecting to:', authUrl);
  res.redirect(authUrl);
});

// OAuth callback with token exchange
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    res.send(`<h1>OAuth Error</h1><p>${error}</p><a href="/oauth-test">Try again</a>`);
    return;
  }
  
  const session = sessions.get(`oauth_${state}`);
  if (!session) {
    res.send(`<h1>Invalid state</h1><a href="/oauth-test">Try again</a>`);
    return;
  }
  
  try {
    // Exchange code for token
    const formData = new URLSearchParams();
    formData.append('client_id', (session as any).clientId || config.oauth.clientId);
    formData.append('client_secret', config.oauth.clientSecret);
    formData.append('code', code as string);
    
    console.log('[OAuth] Exchanging code for token...');
    
    const tokenResponse = await axios.post(
      'https://goteamup.com/api/auth/access_token',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token } = tokenResponse.data;
    console.log('[OAuth] Token received:', access_token);
    
    // Test the token immediately
    const testResults = {
      token: access_token,
      tests: [] as any[]
    };
    
    // Test provider mode
    try {
      await axios.get('https://goteamup.com/api/v2/events', {
        headers: {
          'Authorization': `Token ${access_token}`,
          'TeamUp-Provider-ID': String(config.providerId),
          'TeamUp-Request-Mode': 'provider'
        },
        params: { page_size: 1 }
      });
      testResults.tests.push({ mode: 'provider', success: true });
      console.log('[OAuth] ✓ Provider mode works!');
    } catch (err: any) {
      testResults.tests.push({ 
        mode: 'provider', 
        success: false, 
        error: err.response?.data 
      });
      console.log('[OAuth] ✗ Provider mode failed:', err.response?.data);
    }
    
    // Test customer mode
    try {
      await axios.get('https://goteamup.com/api/v2/events', {
        headers: {
          'Authorization': `Token ${access_token}`,
          'TeamUp-Provider-ID': String(config.providerId),
          'TeamUp-Request-Mode': 'customer'
        },
        params: { page_size: 1 }
      });
      testResults.tests.push({ mode: 'customer', success: true });
      console.log('[OAuth] ✓ Customer mode works!');
    } catch (err: any) {
      testResults.tests.push({ 
        mode: 'customer', 
        success: false, 
        error: err.response?.data 
      });
      console.log('[OAuth] ✗ Customer mode failed:', err.response?.data);
    }
    
    // Clean up session
    sessions.delete(`oauth_${state}`);
    
    res.send(`
      <h1>OAuth Complete!</h1>
      <div style="max-width: 800px; margin: 20px auto;">
        <h2>Access Token:</h2>
        <pre style="background: #f5f5f5; padding: 10px; word-wrap: break-word;">${access_token}</pre>
        
        <h2>Test Results:</h2>
        <pre style="background: #f5f5f5; padding: 10px;">${JSON.stringify(testResults, null, 2)}</pre>
        
        <h2>Update Railway Environment:</h2>
        <p>If provider mode worked, update your Railway environment variable:</p>
        <pre style="background: #f5f5f5; padding: 10px;">TEAMUP_ACCESS_TOKEN=${access_token}</pre>
        
        <a href="/oauth-test">Test another token</a>
      </div>
    `);
    
  } catch (error: any) {
    console.error('[OAuth] Token exchange error:', error.response?.data || error.message);
    res.send(`
      <h1>Token Exchange Failed</h1>
      <pre>${JSON.stringify(error.response?.data || error.message, null, 2)}</pre>
      <a href="/oauth-test">Try again</a>
    `);
  }
});

// Catch-all route to debug what ChatGPT is looking for
app.get('*', (req, res) => {
  console.log(`[404] Unknown route requested: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Not found',
    message: `Unknown route: ${req.path}`,
    availableEndpoints: [
      '/.well-known/mcp.json',
      '/mcp/tools',
      '/mcp/sse',
      '/api/events',
      '/api/events/{id}',
      '/api/events/{event_id}/register',
      '/api/customers',
      '/api/customers/{id}',
      '/api/memberships',
      '/debug/config',
      '/debug/test-api',
      '/oauth-test'
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TeamUp MCP Remote Server running on port ${PORT}`);
  console.log(`Authentication Mode: ${config.authMode}`);
  
  if (config.authMode === 'TOKEN') {
    console.log(`Using ${config.accessToken ? 'server-configured' : 'user-provided'} access tokens`);
  } else {
    console.log(`OAuth configured with redirect URI: ${config.oauth.redirectUri}`);
  }
  
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    console.log(`Public URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
    console.log(`MCP Endpoint: https://${process.env.RAILWAY_PUBLIC_DOMAIN}/mcp/sse`);
  } else {
    console.log(`Local URL: http://localhost:${PORT}`);
    console.log(`MCP Endpoint: http://localhost:${PORT}/mcp/sse`);
  }
});