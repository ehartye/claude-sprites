import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export function createMcpServer(engine) {
  const server = new McpServer({
    name: 'claude-sprites',
    version: '0.1.0',
  });

  // engine is the shared Project instance — tool modules will register against this server
  return { server, engine };
}

export async function startMcpServer(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
