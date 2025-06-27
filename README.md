# LAML MCP Server

Parse and validate LAML (YAML-based markup language) documents through Model Context Protocol.

## What it does

- **Load LAML documents** from filesystem via MCP protocol
- **Integrate with Cursor** for LAML file access

## Quick Start

1. Install and build:
```bash
npm install
npm run build
```

2. Configure MCP server in Cursor:

**Option A: Global MCP settings** (recommended)
Create or edit `~/.cursor/mcp_settings.json`:
```json
{
  "mcpServers": {
    "laml-mcp-server": {
      "command": "node",
      "args": ["/absolute/path/to/your/project/dist/index.js"]
    }
  }
}
```

**Option B: Project-specific settings**
Add to your Cursor workspace settings:
```json
{
  "mcp": {
    "servers": {
      "laml-mcp-server": {
        "command": "node",
        "args": ["/absolute/path/to/your/project/dist/index.js"]
      }
    }
  }
}
```

3. **Activate server**: In Cursor settings, toggle MCP off/on or restart Cursor

## Usage Examples

### Load LAML Document
```yaml
# Example LAML document
$meta:
  name: 'myDocument'
  purpose: "Document description"
  version: 1.0

content:
  title: 'documentTitle'
  description: "Human readable description"
  enabled: true
```

### Load File Content
The server returns raw file content as string for further processing by your application.

## Available Operations

- **loadLaml**: Load LAML document from file path

## Requirements

- Node.js 18+
- Cursor with MCP support 