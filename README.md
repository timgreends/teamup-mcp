# TeamUp MCP Server

An MCP (Model Context Protocol) server for TeamUp integration, allowing AI assistants to create and manage tasks.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Building

```bash
npm run build
```

## Usage

This MCP server provides tools for:
- Creating tasks with title, description, assignee, due date, and priority
- Listing tasks with status filtering

## Available Tools

### create_task
Creates a new task in TeamUp.

Parameters:
- `title` (required): Task title
- `description`: Task description
- `assignee`: Person assigned to the task
- `dueDate`: Due date in ISO format
- `priority`: Task priority (low, medium, high)

### list_tasks
Lists all tasks with optional filtering.

Parameters:
- `status`: Filter by task status (all, pending, completed)