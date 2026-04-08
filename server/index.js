import { createMcpServer, startMcpServer } from './mcp/server.js';
import { startWebServer } from './web/http.js';
import { registerProjectTools } from './mcp/project-tools.js';
import { registerDrawingTools } from './mcp/drawing-tools.js';

// Shared state: a project instance (starts null, created/loaded via tools)
const state = {
  project: null,
};

const { server } = createMcpServer(state);

// Register tool modules
registerProjectTools(server, state);
registerDrawingTools(server, state);

const WEB_PORT = parseInt(process.env.SPRITE_PORT ?? '3377', 10);

// Start web server (non-blocking)
startWebServer(state, WEB_PORT).then((info) => {
  // Log to stderr so it doesn't interfere with MCP stdio
  console.error(`Sprite editor web UI: http://localhost:${info.port}`);
});

// Start MCP server (blocks on stdio)
startMcpServer(server);
