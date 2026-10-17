/**
 * In-memory session store — one football session per LINE chat (group/room/user).
 *
 * ⚠️ Data is lost when the server restarts. This is intentional for the
 * development phase. Keep this async interface (getSession/saveSession) so it
 * can later be swapped for a PostgreSQL implementation without touching the
 * command logic.
 */
const sessions = new Map();

export const memoryStore = {
  async getSession(chatId) {
    return sessions.get(chatId) ?? null;
  },

  async saveSession(chatId, session) {
    sessions.set(chatId, session);
  },
};
