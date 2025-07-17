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
  oauth: OAuthConfig;
  providerId?: string;
  baseUrl: string;
  requestMode: 'customer' | 'provider';
}

interface UserSession {
  id: string;
  tokens?: OAuthTokens;
  authState: 'uninitialized' | 'waiting_for_auth' | 'authenticated';
  createdAt: Date;
  lastAccess: Date;
}

// In-memory session store (replace with Redis/Database in production)
const sessions = new Map<string, UserSession>();

// Environment configuration
const config: TeamUpConfig = {
  oauth: {
    clientId: process.env.TEAMUP_CLIENT_ID!,
    clientSecret: process.env.TEAMUP_CLIENT_SECRET!,
    redirectUri: process.env.TEAMUP_REDIRECT_URI || 'https://your-domain.com/callback',
    scope: process.env.TEAMUP_OAUTH_SCOPE || 'read_write'
  },
  providerId: process.env.TEAMUP_PROVIDER_ID,
  baseUrl: process.env.TEAMUP_BASE_URL || 'https://goteamup.com/api/v2',
  requestMode: (process.env.TEAMUP_REQUEST_MODE as 'customer' | 'provider') || 'customer',
};

if (!config.oauth.clientId || !config.oauth.clientSecret) {
  console.error('Error: TEAMUP_CLIENT_ID and TEAMUP_CLIENT_SECRET are required');
  process.exit(1);
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
      <title>TeamUp MCP Remote Server</title>
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
        .status {
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
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🏃 TeamUp MCP Remote Server</h1>
        
        <div class="status">
          <h3>✅ Server is running</h3>
          <p>This is a remote MCP server for TeamUp integration.</p>
        </div>
        
        <h3>🔌 Connect from Claude Desktop</h3>
        <p>Add this to your Claude Desktop configuration:</p>
        <pre><code>{
  "mcpServers": {
    "teamup": {
      "url": "${process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : req.get('host')}/mcp/sse"
    }
  }
}</code></pre>
        
        <p>Then restart Claude Desktop and use the TeamUp integration!</p>
      </div>
    </body>
    </html>
  `);
});

// OAuth callback endpoint
app.get('/callback', async (req, res) => {
  const { code, error, state } = req.query;
  const sessionId = state as string;
  
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).send('Invalid session');
  }
  
  const session = sessions.get(sessionId)!;
  
  if (error) {
    session.authState = 'uninitialized';
    return res.send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>❌ Authentication Failed</h1>
          <p>Error: ${error}</p>
          <p>Please close this window and try again.</p>
        </body>
      </html>
    `);
  }
  
  if (code) {
    try {
      // Exchange code for tokens
      const formData = new URLSearchParams();
      formData.append('client_id', config.oauth.clientId);
      formData.append('client_secret', config.oauth.clientSecret);
      formData.append('code', code as string);
      
      const response = await axios.post(
        `${config.baseUrl.replace('/api/v2', '')}/api/auth/access_token`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      session.tokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: response.data.expires_in 
          ? new Date(Date.now() + (response.data.expires_in * 1000))
          : undefined
      };
      
      session.authState = 'authenticated';
      
      res.send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>✅ Successfully Connected!</h1>
            <p>TeamUp has been connected to your AI assistant.</p>
            <p>You can close this window and return to Claude.</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      session.authState = 'uninitialized';
      res.send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>❌ Authentication Failed</h1>
            <p>${error.message}</p>
            <p>Please close this window and try again.</p>
          </body>
        </html>
      `);
    }
  }
});

// MCP SSE endpoint
app.post('/mcp/sse', async (req, res) => {
  const session = req.session!;
  
  // Create axios instance for this session
  const axiosInstance = axios.create({
    baseURL: config.baseUrl,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(config.providerId && { 'TeamUp-Provider-ID': config.providerId }),
      'TeamUp-Request-Mode': config.requestMode
    },
    timeout: 30000
  });
  
  // Add auth interceptor
  axiosInstance.interceptors.request.use(
    async (config) => {
      if (session.tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${session.tokens.accessToken}`;
      }
      return config;
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
    if (session.authState !== 'authenticated') {
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
      if (name === 'initialize_teamup') {
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
        return {
          content: [{
            type: 'text',
            text: 'TeamUp is not authenticated. Please use the "initialize_teamup" tool first to connect your TeamUp account.'
          }]
        };
      }
      
      // Handle authenticated tools
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TeamUp MCP Remote Server running on port ${PORT}`);
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    console.log(`Public URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
    console.log(`MCP Endpoint: https://${process.env.RAILWAY_PUBLIC_DOMAIN}/mcp/sse`);
  } else {
    console.log(`Local URL: http://localhost:${PORT}`);
    console.log(`MCP Endpoint: http://localhost:${PORT}/mcp/sse`);
  }
});