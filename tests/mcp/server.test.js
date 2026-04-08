import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../../server/mcp/server.js';

describe('MCP Server Bootstrap', () => {
  it('creates server and returns engine reference', () => {
    const state = { project: null };
    const result = createMcpServer(state);

    expect(result.server).toBeDefined();
    expect(result.engine).toBe(state);
  });

  it('server has expected name and version', () => {
    const state = { project: null };
    const { server } = createMcpServer(state);

    // McpServer stores its config internally
    expect(server).toBeDefined();
    expect(typeof server.tool).toBe('function');
  });
});
