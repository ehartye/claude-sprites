import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startWebServer(state, port) {
  const app = express();
  app.use(express.static(path.join(__dirname, 'public')));

  const httpServer = http.createServer(app);
  await new Promise((resolve) => httpServer.listen(port, resolve));

  const actualPort = httpServer.address().port;

  const wss = new WebSocketServer({ server: httpServer });
  state.wss = wss;

  // Broadcast helper — tools call this after state changes
  state.broadcast = (msg) => {
    const data = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(data);
    }
  };

  wss.on('connection', (ws) => {
    // Send current project state on connect
    if (state.project) {
      ws.send(JSON.stringify({ type: 'project', data: state.project.toJSON() }));
    }

    ws.on('message', (raw) => {
      // Handle operations from web UI — will be wired in Task 16
      try {
        const msg = JSON.parse(raw);
        // TODO: dispatch operation to engine, then broadcast
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: e.message }));
      }
    });
  });

  return { port: actualPort, httpServer, wss };
}
