import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// Collaborative frame casting: the agent proposes an assignment of candidate
// frames to pose slots (deterministic detectors as the starting point), a
// human confirms or overrides in the web UI, and the verdict records BOTH so
// prediction-vs-selection variance can refine the detectors.
export function castingRoutes(state) {
  const router = Router();
  state.casting ??= new Map();
  let seq = 0;

  router.post('/casting', (req, res) => {
    const { title, slots, candidates, predictions = {}, previews = [], generation = null, out } = req.body ?? {};
    if (!Array.isArray(slots) || !slots.length || !Array.isArray(candidates) || !candidates.length)
      return res.status(400).json({ ok: false, error: 'slots and candidates are required' });
    const missing = candidates.filter((c) => !c.id || !c.path || !existsSync(c.path));
    if (missing.length)
      return res.status(400).json({ ok: false, error: `candidate files missing: ${missing.map((c) => c.id ?? '?').join(', ')}` });
    const id = `cast_${Date.now().toString(36)}${++seq}`;
    state.casting.set(id, { id, title: title ?? 'casting session', slots, candidates, predictions, previews, generation, out, verdict: null });
    res.json({ ok: true, data: { id, url: `/casting.html?id=${id}` } });
  });

  router.get('/casting/:id', (req, res) => {
    const s = state.casting.get(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: 'not found' });
    res.json({ ok: true, data: {
      id: s.id, title: s.title, slots: s.slots, predictions: s.predictions, previews: s.previews ?? [],
      generation: s.generation ?? null,
      candidates: s.candidates.map(({ id, label, isNew }) => ({ id, label, isNew })),
      decided: !!s.verdict,
    } });
  });

  router.get('/casting/:id/candidate/:cid', (req, res) => {
    const s = state.casting.get(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: 'not found' });
    const cid = req.params.cid.replace(/\.png$/, '');
    const c = s.candidates.find((x) => x.id === cid);
    if (!c || !existsSync(c.path)) return res.status(404).json({ ok: false, error: 'candidate not found' });
    res.type('image/png').send(readFileSync(c.path));
  });

  router.get('/casting/:id/verdict', (req, res) => {
    const s = state.casting.get(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: 'not found' });
    if (!s.verdict) return res.status(404).json({ ok: false, error: 'pending' });
    res.json({ ok: true, data: s.verdict });
  });

  router.post('/casting/:id/verdict', (req, res) => {
    const s = state.casting.get(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: 'not found' });
    const selections = req.body?.selections;
    if (!selections || typeof selections !== 'object')
      return res.status(400).json({ ok: false, error: 'selections required' });
    let matches = 0;
    const disagreements = [];
    for (const slot of s.slots) {
      const predicted = s.predictions[slot.id] ?? 'gap';
      const selected = selections[slot.id] ?? 'gap';
      if (predicted === selected) matches++;
      else disagreements.push({ slot: slot.id, predicted, selected });
    }
    const verdict = {
      id: s.id, title: s.title, predictions: s.predictions, selections,
      agreement: { total: s.slots.length, matches, pct: Math.round((100 * matches) / s.slots.length), disagreements },
      decidedAt: new Date().toISOString(),
    };
    s.verdict = verdict;
    if (s.out) writeFileSync(s.out, JSON.stringify(verdict, null, 2));
    res.json({ ok: true, data: verdict });
  });

  return router;
}
