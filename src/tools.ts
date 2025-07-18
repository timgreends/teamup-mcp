
export const staffAndInstructorTools = [
  {
    name: 'list_staff',
    description: 'List all staff members',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        page_size: { type: 'number' },
        active: { type: 'boolean', description: 'Filter by active status' }
      }
    }
  },
  {
    name: 'get_staff',
    description: 'Get staff member details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Staff ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'create_staff',
    description: 'Create a new staff member',
    inputSchema: {
      type: 'object',
      properties: {
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string', description: 'Staff role' },
        permissions: { type: 'array', items: { type: 'string' } }
      },
      required: ['first_name', 'last_name', 'email', 'role']
    }
  },
  {
    name: 'update_staff',
    description: 'Update staff member details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Staff ID' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string' },
        permissions: { type: 'array', items: { type: 'string' } },
        is_active: { type: 'boolean' }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_staff',
    description: 'Delete a staff member',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Staff ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'list_instructors',
    description: 'List all instructors',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        page_size: { type: 'number' },
        active: { type: 'boolean' }
      }
    }
  },
  {
    name: 'assign_instructor',
    description: 'Assign instructor to an event',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: { type: 'number', description: 'Event ID' },
        instructor_id: { type: 'number', description: 'Instructor ID' }
      },
      required: ['event_id', 'instructor_id']
    }
  }
];

export const venueAndRoomTools = [
  {
    name: 'list_venues',
    description: 'List all venues',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        page_size: { type: 'number' }
      }
    }
  },
  {
    name: 'get_venue',
    description: 'Get venue details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Venue ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'create_venue',
    description: 'Create a new venue',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        postal_code: { type: 'string' },
        country: { type: 'string' },
        timezone: { type: 'string' }
      },
      required: ['name', 'address', 'city', 'state', 'postal_code', 'country']
    }
  },
  {
    name: 'update_venue',
    description: 'Update venue details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Venue ID' },
        name: { type: 'string' },
        address: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        postal_code: { type: 'string' },
        country: { type: 'string' },
        timezone: { type: 'string' }
      },
      required: ['id']
    }
  },
  {
    name: 'list_venue_rooms',
    description: 'List all venue rooms',
    inputSchema: {
      type: 'object',
      properties: {
        venue_id: { type: 'number', description: 'Filter by venue ID' },
        page: { type: 'number' },
        page_size: { type: 'number' }
      }
    }
  },
  {
    name: 'get_venue_room',
    description: 'Get venue room details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Room ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'create_venue_room',
    description: 'Create a new venue room',
    inputSchema: {
      type: 'object',
      properties: {
        venue: { type: 'number', description: 'Venue ID' },
        name: { type: 'string' },
        capacity: { type: 'number' },
        description: { type: 'string' }
      },
      required: ['venue', 'name', 'capacity']
    }
  }
];

export const offeringTypesAndCategoriesTools = [
  {
    name: 'list_offering_types',
    description: 'List all offering types',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        page_size: { type: 'number' }
      }
    }
  },
  {
    name: 'get_offering_type',
    description: 'Get offering type details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Offering type ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'create_offering_type',
    description: 'Create a new offering type',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        duration_minutes: { type: 'number' },
        default_capacity: { type: 'number' },
        categories: { type: 'array', items: { type: 'number' } }
      },
      required: ['name', 'duration_minutes']
    }
  },
  {
    name: 'update_offering_type',
    description: 'Update offering type details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Offering type ID' },
        name: { type: 'string' },
        description: { type: 'string' },
        duration_minutes: { type: 'number' },
        default_capacity: { type: 'number' },
        categories: { type: 'array', items: { type: 'number' } }
      },
      required: ['id']
    }
  },
  {
    name: 'list_categories',
    description: 'List all categories',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        page_size: { type: 'number' }
      }
    }
  },
  {
    name: 'get_category',
    description: 'Get category details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Category ID' }
      },
      required: ['id']
    }
  }
];

export const attendanceTools = [
  {
    name: 'list_attendances',
    description: 'List all attendances',
    inputSchema: {
      type: 'object',
      properties: {
        event: { type: 'number', description: 'Filter by event ID' },
        customer: { type: 'number', description: 'Filter by customer ID' },
        status: { type: 'string', enum: ['attended', 'no_show', 'cancelled'] },
        date_from: { type: 'string', description: 'Filter from date (ISO 8601)' },
        date_to: { type: 'string', description: 'Filter to date (ISO 8601)' },
        page: { type: 'number' },
        page_size: { type: 'number' }
      }
    }
  },
  {
    name: 'get_attendance',
    description: 'Get attendance details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Attendance ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'update_attendance',
    description: 'Update attendance details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Attendance ID' },
        status: { type: 'string', enum: ['attended', 'no_show', 'cancelled'] },
        notes: { type: 'string' }
      },
      required: ['id']
    }
  },
  {
    name: 'bulk_update_attendances',
    description: 'Update multiple attendances at once',
    inputSchema: {
      type: 'object',
      properties: {
        attendances: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              status: { type: 'string', enum: ['attended', 'no_show', 'cancelled'] }
            },
            required: ['id', 'status']
          }
        }
      },
      required: ['attendances']
    }
  }
];

export const paymentAndBillingTools = [
  {
    name: 'list_payments',
    description: 'List all payments',
    inputSchema: {
      type: 'object',
      properties: {
        customer: { type: 'number', description: 'Filter by customer ID' },
        status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] },
        date_from: { type: 'string', description: 'Filter from date (ISO 8601)' },
        date_to: { type: 'string', description: 'Filter to date (ISO 8601)' },
        page: { type: 'number' },
        page_size: { type: 'number' }
      }
    }
  },
  {
    name: 'get_payment',
    description: 'Get payment details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Payment ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'process_payment',
    description: 'Process a new payment',
    inputSchema: {
      type: 'object',
      properties: {
        customer: { type: 'number', description: 'Customer ID' },
        amount: { type: 'number', description: 'Amount in cents' },
        payment_method: { type: 'string' },
        description: { type: 'string' },
        metadata: { type: 'object' }
      },
      required: ['customer', 'amount', 'payment_method']
    }
  },
  {
    name: 'refund_payment',
    description: 'Refund a payment',
    inputSchema: {
      type: 'object',
      properties: {
        payment_id: { type: 'number', description: 'Payment ID' },
        amount: { type: 'number', description: 'Refund amount in cents (optional for full refund)' },
        reason: { type: 'string', description: 'Refund reason' }
      },
      required: ['payment_id']
    }
  },
  {
    name: 'list_invoices',
    description: 'List all invoices',
    inputSchema: {
      type: 'object',
      properties: {
        customer: { type: 'number', description: 'Filter by customer ID' },
        status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue'] },
        date_from: { type: 'string' },
        date_to: { type: 'string' },
        page: { type: 'number' },
        page_size: { type: 'number' }
      }
    }
  },
  {
    name: 'get_invoice',
    description: 'Get invoice details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Invoice ID' }
      },
      required: ['id']
    }
  }
];

export const discountCodeTools = [
  {
    name: 'list_discount_codes',
    description: 'List all discount codes',
    inputSchema: {
      type: 'object',
      properties: {
        active: { type: 'boolean' },
        page: { type: 'number' },
        page_size: { type: 'number' }
      }
    }
  },
  {
    name: 'get_discount_code',
    description: 'Get discount code details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Discount code ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'create_discount_code',
    description: 'Create a new discount code',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Discount code' },
        discount_type: { type: 'string', enum: ['percentage', 'fixed'] },
        discount_value: { type: 'number', description: 'Discount value (percentage or cents)' },
        valid_from: { type: 'string', description: 'Valid from date (ISO 8601)' },
        valid_until: { type: 'string', description: 'Valid until date (ISO 8601)' },
        max_uses: { type: 'number', description: 'Maximum number of uses' },
        applies_to: { type: 'array', items: { type: 'string' } }
      },
      required: ['code', 'discount_type', 'discount_value']
    }
  },
  {
    name: 'update_discount_code',
    description: 'Update discount code details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Discount code ID' },
        code: { type: 'string' },
        discount_type: { type: 'string', enum: ['percentage', 'fixed'] },
        discount_value: { type: 'number' },
        valid_from: { type: 'string' },
        valid_until: { type: 'string' },
        max_uses: { type: 'number' },
        is_active: { type: 'boolean' }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_discount_code',
    description: 'Delete a discount code',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Discount code ID' }
      },
      required: ['id']
    }
  }
];

export const reportingAndAnalyticsTools = [
  {
    name: 'get_bulk_action',
    description: 'Get bulk action status',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Bulk action ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'list_bulk_actions',
    description: 'List all bulk actions',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
        page: { type: 'number' },
        page_size: { type: 'number' }
      }
    }
  },
  {
    name: 'get_provider_stats',
    description: 'Get provider statistics',
    inputSchema: {
      type: 'object',
      properties: {
        provider_id: { type: 'number', description: 'Provider ID' },
        date_from: { type: 'string', description: 'Start date (ISO 8601)' },
        date_to: { type: 'string', description: 'End date (ISO 8601)' },
        metrics: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Specific metrics to retrieve'
        }
      },
      required: ['provider_id']
    }
  }
];

export const crmAndWorkflowTools = [
  {
    name: 'list_crm_workflows',
    description: 'List all CRM workflows',
    inputSchema: {
      type: 'object',
      properties: {
        active: { type: 'boolean' },
        page: { type: 'number' },
        page_size: { type: 'number' }
      }
    }
  },
  {
    name: 'get_crm_workflow',
    description: 'Get CRM workflow details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Workflow ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'list_workflow_actions',
    description: 'List all workflow actions',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: { type: 'number', description: 'Filter by workflow ID' },
        page: { type: 'number' },
        page_size: { type: 'number' }
      }
    }
  },
  {
    name: 'update_workflow_action',
    description: 'Update workflow action',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Action ID' },
        enabled: { type: 'boolean' },
        settings: { type: 'object' }
      },
      required: ['id']
    }
  }
];

export const integrationsAndSettingsTools = [
  {
    name: 'get_provider_settings',
    description: 'Get provider settings',
    inputSchema: {
      type: 'object',
      properties: {
        provider_id: { type: 'number', description: 'Provider ID' }
      },
      required: ['provider_id']
    }
  },
  {
    name: 'update_provider_settings',
    description: 'Update provider settings',
    inputSchema: {
      type: 'object',
      properties: {
        provider_id: { type: 'number', description: 'Provider ID' },
        settings: { type: 'object', description: 'Settings object' }
      },
      required: ['provider_id', 'settings']
    }
  },
  {
    name: 'list_terminologies',
    description: 'List all terminologies',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        page_size: { type: 'number' }
      }
    }
  },
  {
    name: 'get_terminology',
    description: 'Get terminology details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Terminology ID' }
      },
      required: ['id']
    }
  }
];

export const getAllAdditionalTools = () => {
  return [
    ...staffAndInstructorTools,
    ...venueAndRoomTools,
    ...offeringTypesAndCategoriesTools,
    ...attendanceTools,
    ...paymentAndBillingTools,
    ...discountCodeTools,
    ...reportingAndAnalyticsTools,
    ...crmAndWorkflowTools,
    ...integrationsAndSettingsTools
  ];
};