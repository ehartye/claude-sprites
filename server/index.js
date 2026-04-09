import { startWebServer } from './web/http.js';
import { SessionDB } from './db/session.js';
import { Project } from './engine/project.js';

const db = new SessionDB();

const state = {
  project: null,
  sessionId: null,
  db,
};

// Restore last session
const lastSession = db.getLastSession();
if (lastSession?.draft_json) {
  try {
    state.project = Project.fromJSON(JSON.parse(lastSession.draft_json));
    state.sessionId = lastSession.id;
  } catch (e) {
    console.error('Failed to restore last session:', e.message);
  }
}

const WEB_PORT = parseInt(process.env.SPRITE_PORT ?? '3377', 10);
startWebServer(state, WEB_PORT).then((info) => {
  console.error(`Sprite editor: http://localhost:${info.port}`);
}).catch((err) => {
  console.error(`Web server failed: ${err.message}`);
  process.exit(1);
});
