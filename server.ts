import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { INITIAL_CAMPAIGN_STATE } from './src/data/initialCampaign.ts';
import { syncCampaignCharacterNames } from './src/utils/dndRules.ts';
import type { CampaignState } from './src/types/vtt.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Authoritative server-side campaign state
let serverCampaignState: CampaignState = structuredClone(INITIAL_CAMPAIGN_STATE);
const clientSessions = new Map<WebSocket, { sessionId: string; userName: string }>();

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Support high-resolution lossless image uploads in JSON payloads up to 50MB
  app.use(express.json({ limit: '50mb' }));

  // REST API fallback & state inspection
  app.get('/api/campaign', (_req, res) => {
    res.json(serverCampaignState);
  });

  app.post('/api/campaign/sync', (req, res) => {
    if (req.body && req.body.state) {
      serverCampaignState = req.body.state;
      serverCampaignState.nomesCampanha = syncCampaignCharacterNames(
        serverCampaignState.nomesCampanha || [],
        serverCampaignState.fichas || []
      );
      broadcast({ type: 'campaign:state', payload: serverCampaignState });
      res.json({ ok: true });
      return;
    }
    res.status(400).json({ error: 'Invalid state payload' });
  });

  // WebSocket Server on the same HTTP server (port 3000)
  const wss = new WebSocketServer({ server, path: '/ws' });

  function broadcast(message: unknown, excludeClient?: WebSocket) {
    const raw = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  }

  wss.on('connection', (ws) => {
    // Immediately send authoritative state upon connection
    ws.send(
      JSON.stringify({
        type: 'campaign:init',
        payload: serverCampaignState,
      })
    );

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (!msg || typeof msg.type !== 'string') return;

        switch (msg.type) {
          case 'session:register': {
            const { sessionId, userName, requestedRole } = msg.payload || {};
            if (!sessionId) break;
            clientSessions.set(ws, { sessionId, userName: userName || 'Jogador' });

            if (requestedRole !== 'jogador') {
              serverCampaignState.mestreSessionId = sessionId;
              serverCampaignState.mestreNome = userName || 'Mestre (GM)';
            }
            break;
          }
          case 'gm:claim': {
            const { sessionId, userName } = msg.payload || {};
            if (!sessionId) break;
            serverCampaignState.mestreSessionId = sessionId;
            serverCampaignState.mestreNome = userName || 'Mestre (GM)';
            broadcast({
              type: 'gm:lock_update',
              payload: {
                mestreSessionId: serverCampaignState.mestreSessionId,
                mestreNome: serverCampaignState.mestreNome,
              },
            });
            break;
          }
          case 'gm:release': {
            const { sessionId } = msg.payload || {};
            if (serverCampaignState.mestreSessionId === sessionId) {
              serverCampaignState.mestreSessionId = null;
              serverCampaignState.mestreNome = null;
            }
            break;
          }
          case 'campaign:update': {
            if (msg.payload) {
              serverCampaignState = msg.payload;
              serverCampaignState.nomesCampanha = syncCampaignCharacterNames(
                serverCampaignState.nomesCampanha || [],
                serverCampaignState.fichas || []
              );
              broadcast({ type: 'campaign:state', payload: serverCampaignState }, ws);
            }
            break;
          }
          case 'roll:push':
          case 'log:append': {
            const entry = msg.payload;
            if (entry && entry.id) {
              const exists = serverCampaignState.logsCombate.some((l) => l.id === entry.id);
              if (!exists) {
                serverCampaignState.logsCombate = [entry, ...serverCampaignState.logsCombate].slice(
                  0,
                  200
                );
                broadcast({ type: 'roll:pushed', payload: entry }, ws);
              }
            }
            break;
          }
          case 'token:move': {
            const { sceneId, tokenId, x, y } = msg.payload || {};
            const scene = serverCampaignState.cenas.find((c) => c.id === sceneId);
            if (scene) {
              const token = scene.tokens.find((t) => t.id === tokenId);
              if (token && typeof x === 'number' && typeof y === 'number') {
                token.x = x;
                token.y = y;
                broadcast({ type: 'token:moved', payload: { sceneId, tokenId, x, y } }, ws);
              }
            }
            break;
          }
          default:
            break;
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      const info = clientSessions.get(ws);
      clientSessions.delete(ws);
      if (info && serverCampaignState.mestreSessionId === info.sessionId) {
        // Check if another socket with the same sessionId is still open
        const stillConnected = Array.from(clientSessions.values()).some(
          (s) => s.sessionId === info.sessionId
        );
        if (!stillConnected) {
          serverCampaignState.mestreSessionId = null;
          serverCampaignState.mestreNome = null;
          broadcast({
            type: 'gm:lock_update',
            payload: { mestreSessionId: null, mestreNome: null },
          });
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Owlbear Quest VTT server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
