import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('💥 Unexpected PostgreSQL pool error:', err);
});

export const postgresStore = {
  /**
   * ดึงรอบเตะบอลล่าสุดของกลุ่ม (chatId)
   */
  async getSession(chatId) {
    const client = await pool.connect();
    try {
      const sessionRes = await client.query(
        'SELECT * FROM sessions WHERE chat_id = $1 ORDER BY id DESC LIMIT 1',
        [chatId]
      );

      if (sessionRes.rows.length === 0) {
        return null;
      }

      const s = sessionRes.rows[0];

      const entriesRes = await client.query(
        'SELECT * FROM session_entries WHERE session_id = $1 ORDER BY id ASC',
        [s.id]
      );

      return {
        id: s.id,
        status: s.status,
        note: s.note,
        openedAt: new Date(s.opened_at).toISOString(),
        entries: entriesRes.rows.map((r) => ({
          type: r.type,
          userId: r.user_id,
          name: r.display_name,
          pictureUrl: r.picture_url,
          addedBy: r.added_by_user_id,
          addedByName: r.added_by_name,
          createdAt: new Date(r.created_at).toISOString(),
        })),
      };
    } finally {
      client.release();
    }
  },

  /**
   * บันทึกหรืออัปเดตข้อมูลรอบเตะบอลลงใน PostgreSQL ด้วย Transaction
   */
  async saveSession(chatId, session) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const isClosed = session.status === 'closed';
      const closedAt = isClosed ? new Date().toISOString() : null;

      if (session.id) {
        // อัปเดตรอบเดิม
        await client.query(
          'UPDATE sessions SET status = $1, note = $2, closed_at = $3 WHERE id = $4',
          [session.status, session.note, closedAt, session.id]
        );

        // แทนที่ entries ทั้งหมดในรอบนี้เพื่อความถูกต้องตรงกับ state
        await client.query('DELETE FROM session_entries WHERE session_id = $1', [session.id]);
      } else {
        // สร้างรอบใหม่
        const insertRes = await client.query(
          'INSERT INTO sessions (chat_id, status, note, opened_at, closed_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [chatId, session.status, session.note, session.openedAt || new Date().toISOString(), closedAt]
        );
        session.id = insertRes.rows[0].id;
      }

      // บันทึก entries
      if (session.entries && session.entries.length > 0) {
        for (const entry of session.entries) {
          await client.query(
            `INSERT INTO session_entries 
              (session_id, type, user_id, display_name, picture_url, added_by_user_id, added_by_name, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              session.id,
              entry.type,
              entry.userId || null,
              entry.name || null,
              entry.pictureUrl || null,
              entry.addedBy || null,
              entry.addedByName || null,
              entry.createdAt || new Date().toISOString(),
            ]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
