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
import { getAllAdditionalTools } from './tools.js';
import { TeamUpAPIImplementations } from './api-implementations.js';

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
  private apiImplementations: TeamUpAPIImplementations;

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
      baseUrl: 'https://goteamup.com/api/v2',
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
        
        // Debug logging
        console.error('API Request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          headers: {
            ...config.headers,
            Authorization: config.headers.Authorization ? '[REDACTED]' : undefined
          }
        });
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axios.interceptors.response.use(
      (response) => {
        console.error('API Response:', {
          status: response.status,
          url: response.config.url,
          method: response.config.method?.toUpperCase()
        });
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        
        // Log error details
        console.error('API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: originalRequest?.url,
          method: originalRequest?.method?.toUpperCase(),
          data: error.response?.data,
          headers: error.response?.headers
        });
        
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

    this.apiImplementations = new TeamUpAPIImplementations(this.axios);

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
          case 'update_customer':
            return await this.updateCustomer(args);
          case 'delete_customer':
            return await this.deleteCustomer(args);
          case 'bulk_delete_customers':
            return await this.bulkDeleteCustomers(args);
          case 'search_customers':
            return await this.searchCustomers(args);
          case 'create_event':
            return await this.createEvent(args);
          case 'update_event':
            return await this.updateEvent(args);
          case 'delete_event':
            return await this.deleteEvent(args);
          case 'duplicate_event':
            return await this.duplicateEvent(args);
          case 'cancel_event':
            return await this.cancelEvent(args);
          case 'unregister_from_event':
            return await this.unregisterFromEvent(args);
          case 'get_event_attendees':
            return await this.getEventAttendees(args);
          case 'mark_attendance':
            return await this.markAttendance(args);
          case 'get_event_registration_timelines':
            return await this.getEventRegistrationTimelines(args);
          case 'create_membership':
            return await this.createMembership(args);
          case 'update_membership':
            return await this.updateMembership(args);
          case 'delete_membership':
            return await this.deleteMembership(args);
          case 'get_membership_allotment':
            return await this.getMembershipAllotment(args);
          case 'initiate_membership_purchase':
            return await this.initiateMembershipPurchase(args);
          // Staff & Instructor Management
          case 'list_staff':
            return await this.apiImplementations.listStaff(args);
          case 'get_staff':
            return await this.apiImplementations.getStaff(args);
          case 'create_staff':
            return await this.apiImplementations.createStaff(args);
          case 'update_staff':
            return await this.apiImplementations.updateStaff(args);
          case 'delete_staff':
            return await this.apiImplementations.deleteStaff(args);
          case 'list_instructors':
            return await this.apiImplementations.listInstructors(args);
          case 'assign_instructor':
            return await this.apiImplementations.assignInstructor(args);
          // Venue & Room Management
          case 'list_venues':
            return await this.apiImplementations.listVenues(args);
          case 'get_venue':
            return await this.apiImplementations.getVenue(args);
          case 'create_venue':
            return await this.apiImplementations.createVenue(args);
          case 'update_venue':
            return await this.apiImplementations.updateVenue(args);
          case 'list_venue_rooms':
            return await this.apiImplementations.listVenueRooms(args);
          case 'get_venue_room':
            return await this.apiImplementations.getVenueRoom(args);
          case 'create_venue_room':
            return await this.apiImplementations.createVenueRoom(args);
          // Offering Types & Categories
          case 'list_offering_types':
            return await this.apiImplementations.listOfferingTypes(args);
          case 'get_offering_type':
            return await this.apiImplementations.getOfferingType(args);
          case 'create_offering_type':
            return await this.apiImplementations.createOfferingType(args);
          case 'update_offering_type':
            return await this.apiImplementations.updateOfferingType(args);
          case 'list_categories':
            return await this.apiImplementations.listCategories(args);
          case 'get_category':
            return await this.apiImplementations.getCategory(args);
          // Attendance Management
          case 'list_attendances':
            return await this.apiImplementations.listAttendances(args);
          case 'get_attendance':
            return await this.apiImplementations.getAttendance(args);
          case 'update_attendance':
            return await this.apiImplementations.updateAttendance(args);
          case 'bulk_update_attendances':
            return await this.apiImplementations.bulkUpdateAttendances(args);
          // Payment & Billing
          case 'list_payments':
            return await this.apiImplementations.listPayments(args);
          case 'get_payment':
            return await this.apiImplementations.getPayment(args);
          case 'process_payment':
            return await this.apiImplementations.processPayment(args);
          case 'refund_payment':
            return await this.apiImplementations.refundPayment(args);
          case 'list_invoices':
            return await this.apiImplementations.listInvoices(args);
          case 'get_invoice':
            return await this.apiImplementations.getInvoice(args);
          // Discount Codes
          case 'list_discount_codes':
            return await this.apiImplementations.listDiscountCodes(args);
          case 'get_discount_code':
            return await this.apiImplementations.getDiscountCode(args);
          case 'create_discount_code':
            return await this.apiImplementations.createDiscountCode(args);
          case 'update_discount_code':
            return await this.apiImplementations.updateDiscountCode(args);
          case 'delete_discount_code':
            return await this.apiImplementations.deleteDiscountCode(args);
          // Reporting & Analytics
          case 'get_bulk_action':
            return await this.apiImplementations.getBulkAction(args);
          case 'list_bulk_actions':
            return await this.apiImplementations.listBulkActions(args);
          case 'get_provider_stats':
            return await this.apiImplementations.getProviderStats(args);
          // CRM & Workflows
          case 'list_crm_workflows':
            return await this.apiImplementations.listCrmWorkflows(args);
          case 'get_crm_workflow':
            return await this.apiImplementations.getCrmWorkflow(args);
          case 'list_workflow_actions':
            return await this.apiImplementations.listWorkflowActions(args);
          case 'update_workflow_action':
            return await this.apiImplementations.updateWorkflowAction(args);
          // Integrations & Settings
          case 'get_provider_settings':
            return await this.apiImplementations.getProviderSettings(args);
          case 'update_provider_settings':
            return await this.apiImplementations.updateProviderSettings(args);
          case 'list_terminologies':
            return await this.apiImplementations.listTerminologies(args);
          case 'get_terminology':
            return await this.apiImplementations.getTerminology(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        const apiError = handleAPIError(error);
        
        // Special handling for mode_not_allowed errors
        if (apiError.code === 'mode_not_allowed') {
          console.error('\n=== AUTHENTICATION ERROR ===');
          console.error('Mode not allowed - Provider access denied');
          console.error('Current configuration:');
          console.error(`- Token: ${this.config.accessToken ? '[SET]' : '[NOT SET]'}`);
          console.error(`- Provider ID: ${this.config.providerId || '[NOT SET]'}`);
          console.error(`- Request Mode: ${this.config.requestMode}`);
          console.error('\nTo test your token directly, run:');
          console.error(`curl -H "Authorization: Token YOUR_TOKEN" -H "TeamUp-Provider-ID: ${this.config.providerId}" -H "TeamUp-Request-Mode: provider" https://goteamup.com/api/v2/events`);
          console.error('===========================\n');
          
          return {
            content: [{
              type: 'text',
              text: `Error: ${apiError.message}\n\n**Provider Mode Access Denied**\n\nThis error means your token doesn't have provider permissions. Please:\n1. Create a new token with provider/admin permissions in TeamUp\n2. Update your Claude Desktop configuration\n3. Restart Claude Desktop\n\nCode: ${apiError.code}\nStatus: ${apiError.statusCode}`
            }]
          };
        }
        
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

  private getAuthenticatedTools(): any[] {
    const baseTools = [
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
        name: 'create_event',
        description: 'Create a new event',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Event name' },
            offering_type: { type: 'number', description: 'Offering type ID' },
            venue: { type: 'number', description: 'Venue ID' },
            venue_room: { type: 'number', description: 'Venue room ID' },
            starts_at: { type: 'string', description: 'Event start time (ISO 8601)' },
            ends_at: { type: 'string', description: 'Event end time (ISO 8601)' },
            capacity: { type: 'number', description: 'Maximum capacity' },
            instructors: { type: 'array', items: { type: 'number' }, description: 'Array of instructor IDs' },
            categories: { type: 'array', items: { type: 'number' }, description: 'Array of category IDs' },
            notes: { type: 'string', description: 'Event notes' },
            is_private: { type: 'boolean', description: 'Private event flag' }
          },
          required: ['name', 'offering_type', 'venue', 'starts_at', 'ends_at']
        }
      },
      {
        name: 'update_event',
        description: 'Update event details',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Event ID' },
            offering_type: { type: 'number' },
            venue: { type: 'number' },
            venue_room: { type: 'number' },
            starts_at: { type: 'string' },
            ends_at: { type: 'string' },
            capacity: { type: 'number' },
            instructors: { type: 'array', items: { type: 'number' } },
            categories: { type: 'array', items: { type: 'number' } },
            notes: { type: 'string' },
            is_private: { type: 'boolean' }
          },
          required: ['id']
        }
      },
      {
        name: 'delete_event',
        description: 'Delete an event',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Event ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'duplicate_event',
        description: 'Duplicate an existing event',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Event ID to duplicate' },
            starts_at: { type: 'string', description: 'New event start time (ISO 8601)' },
            ends_at: { type: 'string', description: 'New event end time (ISO 8601)' }
          },
          required: ['id', 'starts_at', 'ends_at']
        }
      },
      {
        name: 'cancel_event',
        description: 'Cancel an event',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Event ID' },
            reason: { type: 'string', description: 'Cancellation reason' },
            notify_attendees: { type: 'boolean', description: 'Send notifications to attendees' }
          },
          required: ['id']
        }
      },
      {
        name: 'unregister_from_event',
        description: 'Unregister a customer from an event',
        inputSchema: {
          type: 'object',
          properties: {
            event_id: { type: 'number', description: 'Event ID' },
            customer_id: { type: 'number', description: 'Customer ID' }
          },
          required: ['event_id', 'customer_id']
        }
      },
      {
        name: 'get_event_attendees',
        description: 'Get list of attendees for an event',
        inputSchema: {
          type: 'object',
          properties: {
            event_id: { type: 'number', description: 'Event ID' },
            expand: { type: 'string', description: 'Comma-separated list of fields to expand' }
          },
          required: ['event_id']
        }
      },
      {
        name: 'mark_attendance',
        description: 'Mark attendance for an event registration',
        inputSchema: {
          type: 'object',
          properties: {
            attendance_id: { type: 'number', description: 'Attendance ID' },
            status: { 
              type: 'string', 
              enum: ['attended', 'no_show', 'cancelled'],
              description: 'Attendance status' 
            },
            notes: { type: 'string', description: 'Attendance notes' }
          },
          required: ['attendance_id', 'status']
        }
      },
      {
        name: 'get_event_registration_timelines',
        description: 'Get registration timeline settings for an event',
        inputSchema: {
          type: 'object',
          properties: {
            event_id: { type: 'number', description: 'Event ID' }
          },
          required: ['event_id']
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
      },
      {
        name: 'create_membership',
        description: 'Create a new membership',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Membership name' },
            description: { type: 'string', description: 'Membership description' },
            price: { type: 'number', description: 'Price in cents' },
            duration_days: { type: 'number', description: 'Duration in days' },
            allotment_type: { 
              type: 'string', 
              enum: ['unlimited', 'limited', 'punch_card'],
              description: 'Type of allotment' 
            },
            allotment_count: { type: 'number', description: 'Number of allowed visits (for limited/punch_card)' },
            categories: { type: 'array', items: { type: 'number' }, description: 'Array of category IDs' },
            is_active: { type: 'boolean', description: 'Active status' }
          },
          required: ['name', 'price', 'duration_days', 'allotment_type']
        }
      },
      {
        name: 'update_membership',
        description: 'Update membership details',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Membership ID' },
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            duration_days: { type: 'number' },
            allotment_type: { 
              type: 'string', 
              enum: ['unlimited', 'limited', 'punch_card']
            },
            allotment_count: { type: 'number' },
            categories: { type: 'array', items: { type: 'number' } },
            is_active: { type: 'boolean' }
          },
          required: ['id']
        }
      },
      {
        name: 'delete_membership',
        description: 'Delete a membership',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Membership ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'get_membership_allotment',
        description: 'Get membership allotment details',
        inputSchema: {
          type: 'object',
          properties: {
            membership_id: { type: 'number', description: 'Membership ID' }
          },
          required: ['membership_id']
        }
      },
      {
        name: 'initiate_membership_purchase',
        description: 'Initiate a membership purchase',
        inputSchema: {
          type: 'object',
          properties: {
            membership_id: { type: 'number', description: 'Membership ID' },
            customer_id: { type: 'number', description: 'Customer ID' },
            payment_method: { type: 'string', description: 'Payment method' },
            discount_code: { type: 'string', description: 'Discount code' }
          },
          required: ['membership_id', 'customer_id']
        }
      },
      {
        name: 'update_customer',
        description: 'Update customer details',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Customer ID' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            birthdate: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            notes: { type: 'string' },
            custom_fields: { type: 'object', description: 'Custom field values' }
          },
          required: ['id']
        }
      },
      {
        name: 'delete_customer',
        description: 'Delete a customer',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Customer ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'bulk_delete_customers',
        description: 'Delete multiple customers',
        inputSchema: {
          type: 'object',
          properties: {
            customer_ids: { 
              type: 'array', 
              items: { type: 'number' },
              description: 'Array of customer IDs to delete'
            }
          },
          required: ['customer_ids']
        }
      },
      {
        name: 'search_customers',
        description: 'Search customers with advanced filters',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            email: { type: 'string', description: 'Filter by email' },
            phone: { type: 'string', description: 'Filter by phone' },
            first_name: { type: 'string', description: 'Filter by first name' },
            last_name: { type: 'string', description: 'Filter by last name' },
            tags: { type: 'string', description: 'Comma-separated list of tags' },
            created_after: { type: 'string', description: 'Filter by creation date (ISO 8601)' },
            created_before: { type: 'string', description: 'Filter by creation date (ISO 8601)' },
            page: { type: 'number' },
            page_size: { type: 'number' }
          }
        }
      }
    ];

    return [...baseTools, ...getAllAdditionalTools()];
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

  private async updateCustomer(args: any) {
    const { id, ...data } = args;
    if (data.email && !validateEmail(data.email)) {
      throw new Error('Invalid email format');
    }
    const response = await this.axios.patch(`/customers/${id}`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async deleteCustomer(args: any) {
    const { id } = args;
    await this.axios.delete(`/customers/${id}`);
    return {
      content: [{ type: 'text', text: `Customer ${id} deleted successfully` }],
    };
  }

  private async bulkDeleteCustomers(args: any) {
    const { customer_ids } = args;
    const response = await this.axios.post('/customers/bulk_delete', { customers: {} });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async searchCustomers(args: any) {
    const response = await this.axios.get('/customers', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async createEvent(args: any) {
    const response = await this.axios.post('/events', args);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async updateEvent(args: any) {
    const { id, ...data } = args;
    const response = await this.axios.patch(`/events/${id}`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async deleteEvent(args: any) {
    const { id } = args;
    await this.axios.delete(`/events/${id}`);
    return {
      content: [{ type: 'text', text: `Event ${id} deleted successfully` }],
    };
  }

  private async duplicateEvent(args: any) {
    const { id, ...data } = args;
    const response = await this.axios.post(`/events/${id}/duplicate`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async cancelEvent(args: any) {
    const { id, ...data } = args;
    const response = await this.axios.patch(`/events/${id}`, { status: 'cancelled', ...data });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async unregisterFromEvent(args: any) {
    const { event_id, customer_id } = args;
    await this.axios.delete(`/events/${event_id}/register`, { data: { customer: customer_id } });
    return {
      content: [{ type: 'text', text: `Customer ${customer_id} unregistered from event ${event_id}` }],
    };
  }

  private async getEventAttendees(args: any) {
    const { event_id, ...params } = args;
    const response = await this.axios.get(`/events/${event_id}/attendances`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async markAttendance(args: any) {
    const { attendance_id, ...data } = args;
    const response = await this.axios.patch(`/attendances/${attendance_id}`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async getEventRegistrationTimelines(args: any) {
    const { event_id } = args;
    const response = await this.axios.get(`/events/${event_id}/registration_timelines/resolved`);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async createMembership(args: any) {
    const response = await this.axios.post('/memberships', args);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async updateMembership(args: any) {
    const { id, ...data } = args;
    const response = await this.axios.patch(`/memberships/${id}`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async deleteMembership(args: any) {
    const { id } = args;
    await this.axios.delete(`/memberships/${id}`);
    return {
      content: [{ type: 'text', text: `Membership ${id} deleted successfully` }],
    };
  }

  private async getMembershipAllotment(args: any) {
    const { membership_id } = args;
    const response = await this.axios.get(`/memberships/${membership_id}/allotment`);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async initiateMembershipPurchase(args: any) {
    const { membership_id, ...data } = args;
    const response = await this.axios.post(`/memberships/${membership_id}/initiate_purchase`, data);
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