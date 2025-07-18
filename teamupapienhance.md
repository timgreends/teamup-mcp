# TeamUp MCP - Complete API Coverage Feature Request

## Overview
Current MCP implements ~20% of TeamUp API endpoints. Request comprehensive coverage to achieve 100% parity with the full REST API.

## Current vs Required Implementation

### ✅ Currently Implemented (8 functions)
- `teamup:list_customers` - GET /customers
- `teamup:get_customer` - GET /customers/{id}
- `teamup:create_customer` - POST /customers
- `teamup:list_events` - GET /events
- `teamup:get_event` - GET /events/{id}
- `teamup:list_memberships` - GET /memberships
- `teamup:get_membership` - GET /memberships/{id}
- `teamup:register_for_event` - POST /events/{id}/register

### ❌ Missing Functions by Category

#### **Customer Management**
```
teamup:update_customer - PATCH /customers/{id}
teamup:delete_customer - DELETE /customers/{id}
teamup:bulk_delete_customers - POST /customers/bulk_delete
teamup:search_customers - GET /customers (with search params)
```

#### **Event Management**
```
teamup:create_event - POST /events
teamup:update_event - PATCH /events/{id}
teamup:delete_event - DELETE /events/{id}
teamup:duplicate_event - POST /events/{id}/duplicate
teamup:cancel_event - PATCH /events/{id} (status update)
teamup:unregister_from_event - DELETE /events/{id}/register
teamup:get_event_attendees - GET /events/{id}/attendances
teamup:mark_attendance - PATCH /attendances/{id}
teamup:get_event_registration_timelines - GET /events/{id}/registration_timelines/resolved
```

#### **Membership Management**
```
teamup:create_membership - POST /memberships
teamup:update_membership - PATCH /memberships/{id}
teamup:delete_membership - DELETE /memberships/{id}
teamup:get_membership_allotment - GET /memberships/{id}/allotment
teamup:initiate_membership_purchase - POST /memberships/{id}/initiate_purchase
```

#### **Staff & Instructor Management**
```
teamup:list_staff - GET /staff
teamup:get_staff - GET /staff/{id}
teamup:create_staff - POST /staff
teamup:update_staff - PATCH /staff/{id}
teamup:delete_staff - DELETE /staff/{id}
teamup:list_instructors - GET /instructors
teamup:assign_instructor - POST /events/{id}/instructors
```

#### **Venue & Room Management**
```
teamup:list_venues - GET /venues
teamup:get_venue - GET /venues/{id}
teamup:create_venue - POST /venues
teamup:update_venue - PATCH /venues/{id}
teamup:list_venue_rooms - GET /venue_rooms
teamup:get_venue_room - GET /venue_rooms/{id}
teamup:create_venue_room - POST /venue_rooms
```

#### **Offering Types & Categories**
```
teamup:list_offering_types - GET /offering_types
teamup:get_offering_type - GET /offering_types/{id}
teamup:create_offering_type - POST /offering_types
teamup:update_offering_type - PATCH /offering_types/{id}
teamup:list_categories - GET /categories
teamup:get_category - GET /categories/{id}
```

#### **Attendance Management**
```
teamup:list_attendances - GET /attendances
teamup:get_attendance - GET /attendances/{id}
teamup:update_attendance - PATCH /attendances/{id}
teamup:bulk_update_attendances - POST /attendances/bulk_update
```

#### **Payment & Billing**
```
teamup:list_payments - GET /payments
teamup:get_payment - GET /payments/{id}
teamup:process_payment - POST /payments
teamup:refund_payment - POST /payments/{id}/refund
teamup:list_invoices - GET /invoices
teamup:get_invoice - GET /invoices/{id}
```

#### **Discount Codes**
```
teamup:list_discount_codes - GET /discount_codes
teamup:get_discount_code - GET /discount_codes/{id}
teamup:create_discount_code - POST /discount_codes
teamup:update_discount_code - PATCH /discount_codes/{id}
teamup:delete_discount_code - DELETE /discount_codes/{id}
```

#### **Reporting & Analytics**
```
teamup:get_bulk_action - GET /bulk_actions/{id}
teamup:list_bulk_actions - GET /bulk_actions
teamup:get_provider_stats - GET /providers/{id}/stats
```

#### **CRM & Workflows**
```
teamup:list_crm_workflows - GET /crm/workflows
teamup:get_crm_workflow - GET /crm/workflows/{id}
teamup:list_workflow_actions - GET /crm/workflow_actions
teamup:update_workflow_action - PATCH /crm/workflow_actions/{id}
```

#### **Integrations & Settings**
```
teamup:get_provider_settings - GET /providers/{id}
teamup:update_provider_settings - PATCH /providers/{id}
teamup:list_terminologies - GET /terminologies
teamup:get_terminology - GET /terminologies/{id}
```

## Implementation Notes

### Headers Required
All functions must include:
```
Authorization: Token {api_key}
Teamup-Provider-ID: {provider_id}
Teamup-Request-Mode: provider|customer
Content-Type: application/json
```

### Error Handling
Standard HTTP response codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Rate Limited

### Pagination Support
List endpoints should support:
- `page` parameter
- `page_size` parameter
- `next`/`previous` URLs in responses

### Expandable Fields
Many endpoints support `expand` parameter for related data:
- `expand=instructors,venue,offering_type`

### Search & Filtering
List endpoints should support relevant filters:
- Date ranges (`starts_after`, `starts_before`)
- Status filters (`status`, `active`)
- ID arrays (`customer`, `event`, `venue`)

## Priority Implementation Order

1. **High Priority**: CRUD operations for core entities (events, memberships, customers)
2. **Medium Priority**: Registration management, attendance tracking
3. **Low Priority**: Advanced features, reporting, integrations

## Testing Requirements

Each function should include:
- Input validation
- Success/error response handling
- Proper parameter mapping to API
- Documentation with examples

## Expected Outcome

100% parity with TeamUp REST API v2, enabling complete business automation through MCP interface.