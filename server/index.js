import { createMcpServer, startMcpServer } from './mcp/server.js';
import { startWebServer } from './web/http.js';
import { registerProjectTools } from './mcp/project-tools.js';
import { registerDrawingTools } from './mcp/drawing-tools.js';
import { registerShapeTools } from './mcp/shape-tools.js';
import { registerCellTools } from './mcp/cell-tools.js';
import { registerGroupTools } from './mcp/group-tools.js';
import { registerHistoryTools } from './mcp/history-tools.js';
import { registerViewTools } from './mcp/view-tools.js';

// Shared state: a project instance (starts null, created/loaded via tools)
const state = {
  project: null,
};

const { server } = createMcpServer(state);

// Register tool modules
registerProjectTools(server, state);
registerDrawingTools(server, state);
registerShapeTools(server, state);
registerCellTools(server, state);
registerGroupTools(server, state);
registerHistoryTools(server, state);
registerViewTools(server, state);

const WEB_PORT = parseInt(process.env.SPRITE_PORT ?? '3377', 10);

// Start web server (non-blocking, won't crash MCP if port is busy)
startWebServer(state, WEB_PORT).then((info) => {
  console.error(`Sprite editor web UI: http://localhost:${info.port}`);
}).catch((err) => {
  console.error(`Web server failed to start: ${err.message}`);
  console.error('MCP tools still available — web UI will not be accessible.');
});

// Start MCP server (blocks on stdio)
startMcpServer(server);
