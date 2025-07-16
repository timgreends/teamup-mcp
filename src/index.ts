#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const TeamUpTaskSchema = z.object({
  title: z.string().describe('Task title'),
  description: z.string().optional().describe('Task description'),
  assignee: z.string().optional().describe('Person assigned to the task'),
  dueDate: z.string().optional().describe('Due date in ISO format'),
  priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority'),
});

const server = new Server(
  {
    name: 'teamup-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_task',
        description: 'Create a new task in TeamUp',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Task title',
            },
            description: {
              type: 'string',
              description: 'Task description',
            },
            assignee: {
              type: 'string',
              description: 'Person assigned to the task',
            },
            dueDate: {
              type: 'string',
              description: 'Due date in ISO format',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Task priority',
            },
          },
          required: ['title'],
        },
      },
      {
        name: 'list_tasks',
        description: 'List all tasks',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['all', 'pending', 'completed'],
              description: 'Filter by task status',
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'create_task': {
      const task = TeamUpTaskSchema.parse(args);
      
      return {
        content: [
          {
            type: 'text',
            text: `Task created: ${task.title}`,
          },
        ],
      };
    }

    case 'list_tasks': {
      return {
        content: [
          {
            type: 'text',
            text: 'No tasks found (this is a placeholder implementation)',
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});