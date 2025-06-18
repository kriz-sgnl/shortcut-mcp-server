Shortcut MCP Server for Claude desktop
Requires nodejs and dir node_modules with required files

What You Get

1- Main Server File (src/index.ts): Complete MCP server implementation with 20+ tools
2- Package Configuration (package.json): All necessary dependencies and scripts
3- TypeScript Config (tsconfig.json): Optimized for modern Node.js
4- Comprehensive Documentation (README.md): Setup instructions and API reference

Desktop Instructions

1- Create file: /Library/Application\ Support/Claude/claude_desktop_config.json

and use this JS:
{
  "mcpServers": {
    "shortcut": {
      "command": "node",
      "args": ["/absolute/path/to/your/shortcut-mcp-server/build/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}

Important: Replace /absolute/path/to/your/shortcut-mcp-server

Usage

1- Install dependencies: npm install
2- Build the project: npm run build
3- Configure your MCP client to use the built server
4- Get your Shortcut API token from your account settings
5- Start using the tools after running shortcut_configure

The server provides a clean, consistent interface to Shortcut's powerful project management features, making it easy to integrate Shortcut operations into any MCP-compatible application or workflow.

When installed and server is running, open Claude desktop and type: "Configure Shortcut with these settings:
- API Token: YOUR_ACTUAL_TOKEN_HERE"
