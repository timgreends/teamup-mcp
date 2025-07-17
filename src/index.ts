#!/usr/bin/env node

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
  authMode: 'TOKEN' | 'OAUTH';
  oauth: OAuthConfig;
  accessToken?: string;
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
      authMode: (process.env.TEAMUP_AUTH_MODE as 'TOKEN' | 'OAUTH') || 'TOKEN',
      oauth: {
        clientId: process.env.TEAMUP_CLIENT_ID || '',
        clientSecret: process.env.TEAMUP_CLIENT_SECRET || '',
        redirectUri: process.env.TEAMUP_REDIRECT_URI || 'http://localhost:8080/callback',
        scope: process.env.TEAMUP_OAUTH_SCOPE || 'read_write',
        autoAuthUrl: process.env.TEAMUP_AUTO_AUTH_URL
      },
      accessToken: process.env.TEAMUP_ACCESS_TOKEN,
      providerId: process.env.TEAMUP_PROVIDER_ID,
      baseUrl: process.env.TEAMUP_BASE_URL || 'https://goteamup.com/api/v2',
      requestMode: (process.env.TEAMUP_REQUEST_MODE as 'customer' | 'provider') || 'customer',
      callbackPort: parseInt(process.env.TEAMUP_CALLBACK_PORT || '8080')
    };

    // Validate configuration based on auth mode
    if (this.config.authMode === 'OAUTH') {
      if (!this.config.oauth.clientId || !this.config.oauth.clientSecret) {
        console.error('Error: TEAMUP_CLIENT_ID and TEAMUP_CLIENT_SECRET are required for OAUTH mode');
        process.exit(1);
      }
    } else if (this.config.authMode === 'TOKEN') {
      if (!this.config.accessToken) {
        console.error('Error: TEAMUP_ACCESS_TOKEN is required for TOKEN mode');
        process.exit(1);
      }
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
        // In TOKEN mode, use the configured access token
        if (this.config.authMode === 'TOKEN' && this.config.accessToken) {
          config.headers.Authorization = `Token ${this.config.accessToken}`;
        }
        // In OAUTH mode, use OAuth tokens
        else if (this.tokens?.accessToken) {
          config.headers.Authorization = `Token ${this.tokens.accessToken}`;
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
        `${this.config.baseUrl}/auth/refresh_access_token`,
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
      // In TOKEN mode, skip authentication
      if (this.config.authMode === 'TOKEN') {
        return { tools: this.getAuthenticatedTools() };
      }

      // In OAUTH mode, require authentication
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
          if (this.config.authMode === 'TOKEN') {
            return {
              content: [{
                type: 'text',
                text: 'This server is configured for TOKEN authentication. No initialization needed.'
              }]
            };
          }
          return await this.initializeTeamUp();
        }

        // In TOKEN mode, skip authentication check
        if (this.config.authMode === 'TOKEN') {
          // Continue to handle the request
        }
        // In OAUTH mode, require authentication
        else if (this.authState !== 'authenticated') {
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

    const authUrl = `${this.config.baseUrl.replace('/api/v2', '')}/api/auth/authorize?${params.toString()}`;

    const clickUrl = this.config.oauth.autoAuthUrl 
      ? `${this.config.oauth.autoAuthUrl}?auth_url=${encodeURIComponent(authUrl)}`
      : authUrl;

    return {
      content: [{
        type: 'text',
        text: `🔐 **TeamUp Authentication Required**

Please click the link below to connect your TeamUp account:

🔗 **[Connect TeamUp Account](${clickUrl})**

This will:
1. Open TeamUp login in your browser
2. Ask you to authorize this integration
3. Automatically complete the setup

⏳ Waiting for authentication...

(The integration will automatically continue once you've authorized it)`
      }]
    };
  }

  private async startCallbackServer(): Promise<void> {
    if (this.callbackServer) {
      return;
    }

    return new Promise((resolve) => {
      this.callbackServer = createServer(async (req, res) => {
        const url = new URL(req.url!, `http://localhost:${this.config.callbackPort}`);
        
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1>❌ Authentication Failed</h1>
                  <p>Error: ${error}</p>
                  <p>Please close this window and try again.</p>
                </body>
              </html>
            `);
            return;
          }

          if (code) {
            try {
              await this.exchangeCodeForTokens(code);
              
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
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
              `);
              
              this.callbackServer.close();
              this.callbackServer = null;
            } catch (error: any) {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
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
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.callbackServer.listen(this.config.callbackPort, () => {
        console.error(`OAuth callback server listening on port ${this.config.callbackPort}`);
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
        `${this.config.baseUrl.replace('/api/v2', '')}/api/auth/access_token`,
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
      throw new Error(`Failed to exchange code for token: ${error.message}`);
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
    const response = await this.axios.get(`/events/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async registerForEvent(args: any) {
    const { event_id, customer_id, customer_membership_id } = args;
    const response = await this.axios.post(`/events/${event_id}/register`, {
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
    const response = await this.axios.get(`/customers/${id}`, { params });
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
    const response = await this.axios.get(`/memberships/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('TeamUp MCP Server started');
    console.error(`Authentication mode: ${this.config.authMode}`);
    
    if (this.config.authMode === 'TOKEN') {
      console.error('Using configured access token');
      console.error(`Request mode: ${this.config.requestMode}`);
      console.error(`Provider ID: ${this.config.providerId || 'Not set'}`);
      console.error('Authorization header format: Token [token]');
    } else {
      console.error(`OAuth callback URL: ${this.config.oauth.redirectUri}`);
      if (this.authState === 'authenticated') {
        console.error('Using stored authentication tokens');
      } else {
        console.error('Authentication required - use "initialize_teamup" tool to begin');
      }
    }
  }
}

const server = new TeamUpOAuthMCPServer();
server.start().catch(console.error);