import express from 'express';
import {
  messagingApi,
  middleware as lineMiddleware,
  SignatureValidationFailed,
  JSONParseError,
} from '@line/bot-sdk';
import { createFootballHandler } from './football/commands.js';
import { memoryStore } from './store/memoryStore.js';
import { postgresStore } from './store/postgresStore.js';

// ---------------------------------------------------------------------------
// Config — values come from .env (never hard-code secrets here)
// ---------------------------------------------------------------------------
const REQUIRED_ENV = ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing env: ${missing.join(', ')} (copy .env.example to .env and fill in)`);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3000;
const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const store = process.env.DATABASE_URL ? postgresStore : memoryStore;
const football = createFootballHandler({ lineClient, store });

const app = express();

// Health check — used to verify the server (and later the tunnel) is reachable
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// LINE webhook
// NOTE: lineMiddleware must run BEFORE any body parser (it verifies the raw
// body against the x-line-signature header).
// ---------------------------------------------------------------------------
app.post('/webhook', lineMiddleware(lineConfig), async (req, res) => {
  const events = req.body.events ?? [];

  const results = await Promise.allSettled(events.map(handleEvent));
  results
    .filter((r) => r.status === 'rejected')
    .forEach((r) => console.error('⚠️ Event handling failed:', r.reason?.message ?? r.reason));

  // Always answer 200 so LINE knows we received the events
  res.sendStatus(200);
});

/**
 * Handle a single LINE event.
 * Normal chat messages are ignored — the bot only replies to football commands.
 */
async function handleEvent(event) {
  const { type: sourceType, groupId, userId } = event.source ?? {};
  console.log(`📩 ${event.type} from ${sourceType}${groupId ? ` (group ${groupId})` : ''} user=${userId}`);

  let messages = null;

  if (event.type === 'join') {
    // Bot was invited to a group/room → introduce the commands
    messages = [{ type: 'text', text: `สวัสดีครับ 👋\n\n${football.helpText}` }];
  } else if (event.type === 'message' && event.message.type === 'text') {
    messages = await football.handleText(event);
  }

  if (!messages || messages.length === 0) return;
  await lineClient.replyMessage({ replyToken: event.replyToken, messages });
}

// Error handler — mainly for invalid/forged webhook requests
app.use((err, req, res, next) => {
  if (err instanceof SignatureValidationFailed) {
    console.warn('🚫 Invalid LINE signature — request rejected');
    return res.sendStatus(401);
  }
  if (err instanceof JSONParseError) {
    return res.sendStatus(400);
  }
  console.error('💥 Unexpected error:', err);
  res.sendStatus(500);
});

app.listen(PORT, () => {
  console.log(`⚽ Football bot server running on http://localhost:${PORT}`);
});
