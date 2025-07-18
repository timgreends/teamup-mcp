import { AxiosInstance } from 'axios';
import { buildQueryParams } from './utils.js';
import { validateEmail } from './utils.js';

export class TeamUpAPIImplementations {
  constructor(private axios: AxiosInstance) {}

  // Staff & Instructor Management
  async listStaff(args: any) {
    const response = await this.axios.get('/staff', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async getStaff(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(`/staff/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async createStaff(args: any) {
    if (args.email && !validateEmail(args.email)) {
      throw new Error('Invalid email format');
    }
    const response = await this.axios.post('/staff', args);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async updateStaff(args: any) {
    const { id, ...data } = args;
    if (data.email && !validateEmail(data.email)) {
      throw new Error('Invalid email format');
    }
    const response = await this.axios.patch(`/staff/${id}`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async deleteStaff(args: any) {
    const { id } = args;
    await this.axios.delete(`/staff/${id}`);
    return {
      content: [{ type: 'text', text: `Staff member ${id} deleted successfully` }],
    };
  }

  async listInstructors(args: any) {
    const response = await this.axios.get('/instructors', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async assignInstructor(args: any) {
    const { event_id, instructor_id } = args;
    const response = await this.axios.post(`/events/${event_id}/instructors`, { instructor: instructor_id });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  // Venue & Room Management
  async listVenues(args: any) {
    const response = await this.axios.get('/venues', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async getVenue(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(`/venues/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async createVenue(args: any) {
    const response = await this.axios.post('/venues', args);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async updateVenue(args: any) {
    const { id, ...data } = args;
    const response = await this.axios.patch(`/venues/${id}`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async listVenueRooms(args: any) {
    const response = await this.axios.get('/venue_rooms', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async getVenueRoom(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(`/venue_rooms/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async createVenueRoom(args: any) {
    const response = await this.axios.post('/venue_rooms', args);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  // Offering Types & Categories
  async listOfferingTypes(args: any) {
    const response = await this.axios.get('/offering_types', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async getOfferingType(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(`/offering_types/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async createOfferingType(args: any) {
    const response = await this.axios.post('/offering_types', args);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async updateOfferingType(args: any) {
    const { id, ...data } = args;
    const response = await this.axios.patch(`/offering_types/${id}`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async listCategories(args: any) {
    const response = await this.axios.get('/categories', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async getCategory(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(`/categories/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  // Attendance Management
  async listAttendances(args: any) {
    const response = await this.axios.get('/attendances', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async getAttendance(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(`/attendances/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async updateAttendance(args: any) {
    const { id, ...data } = args;
    const response = await this.axios.patch(`/attendances/${id}`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async bulkUpdateAttendances(args: any) {
    const response = await this.axios.post('/attendances/bulk_update', args);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  // Payment & Billing
  async listPayments(args: any) {
    const response = await this.axios.get('/payments', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async getPayment(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(`/payments/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async processPayment(args: any) {
    const response = await this.axios.post('/payments', args);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async refundPayment(args: any) {
    const { payment_id, ...data } = args;
    const response = await this.axios.post(`/payments/${payment_id}/refund`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async listInvoices(args: any) {
    const response = await this.axios.get('/invoices', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async getInvoice(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(`/invoices/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  // Discount Codes
  async listDiscountCodes(args: any) {
    const response = await this.axios.get('/discount_codes', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async getDiscountCode(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(`/discount_codes/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async createDiscountCode(args: any) {
    const response = await this.axios.post('/discount_codes', args);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async updateDiscountCode(args: any) {
    const { id, ...data } = args;
    const response = await this.axios.patch(`/discount_codes/${id}`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async deleteDiscountCode(args: any) {
    const { id } = args;
    await this.axios.delete(`/discount_codes/${id}`);
    return {
      content: [{ type: 'text', text: `Discount code ${id} deleted successfully` }],
    };
  }

  // Reporting & Analytics
  async getBulkAction(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(`/bulk_actions/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async listBulkActions(args: any) {
    const response = await this.axios.get('/bulk_actions', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async getProviderStats(args: any) {
    const { provider_id, ...params } = args;
    const response = await this.axios.get(`/providers/${provider_id}/stats`, { params: buildQueryParams(params) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  // CRM & Workflows
  async listCrmWorkflows(args: any) {
    const response = await this.axios.get('/crm/workflows', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async getCrmWorkflow(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(`/crm/workflows/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async listWorkflowActions(args: any) {
    const response = await this.axios.get('/crm/workflow_actions', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async updateWorkflowAction(args: any) {
    const { id, ...data } = args;
    const response = await this.axios.patch(`/crm/workflow_actions/${id}`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  // Integrations & Settings
  async getProviderSettings(args: any) {
    const { provider_id, ...params } = args;
    const response = await this.axios.get(`/providers/${provider_id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async updateProviderSettings(args: any) {
    const { provider_id, ...data } = args;
    const response = await this.axios.patch(`/providers/${provider_id}`, data);
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async listTerminologies(args: any) {
    const response = await this.axios.get('/terminologies', { params: buildQueryParams(args) });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async getTerminology(args: any) {
    const { id, ...params } = args;
    const response = await this.axios.get(`/terminologies/${id}`, { params });
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
    };
  }
}