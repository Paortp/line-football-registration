/**
 * Football registration commands.
 *
 *   เตะบอลวันนี้ [โน้ต]   open a new session (optional note e.g. "18:00 สนามA")
 *   เปิดรับ              re-open a closed session (keeps the list)
 *   ปิดรับ               close registration
 *   รายชื่อ              show the roster card
 *   คำสั่ง / help        show help
 *
 *   +1                 join yourself
 *   +3                 yourself + 2 unnamed friends
 *   +1 บอส             add friend "บอส" (you are NOT added)
 *   +2 บอส             yourself + friend "บอส"
 *   +บอส, เจ           add friends "บอส" and "เจ"
 *
 *   -1                 withdraw yourself
 *   -1 บอส             withdraw friend "บอส" (own friends first, then anyone's)
 *   -2                 withdraw yourself + your latest friend
 *   -1 ติดงาน          no friend named that → treated as plain -1
 *
 * Rule of thumb: the number is the total; names are friends; you are included
 * when the number is bigger than the number of names.
 */
import { buildRosterMessage } from './flexCard.js';

const OPEN_KEYWORD = 'เตะบอลวันนี้';
const MAX_COUNT = 20;

const HELP_TEXT = [
  '⚽ คำสั่งบอทเตะบอล',
  '',
  'เตะบอลวันนี้ — เปิดรับสมัคร',
  '   (ใส่โน้ตต่อท้ายได้ เช่น เตะบอลวันนี้ 18:00 สนามA)',
  'รายชื่อ — ดูรายชื่อ',
  'ปิดรับ / เปิดรับ — ปิดหรือเปิดรับสมัครอีกครั้ง',
  '',
  '+1 — สมัคร',
  '-1 — ถอนชื่อ',
  '+1 บอส — พาเพื่อนชื่อบอสมา',
  '+2 บอส — ตัวเอง + บอส',
  '+3 — ตัวเอง + เพื่อนไม่ระบุชื่อ 2 คน',
  '-1 บอส — ถอนชื่อเพื่อน',
].join('\n');

// ---------------------------------------------------------------------------
// Parsing (pure — easy to test)
// ---------------------------------------------------------------------------
function normalize(text) {
  return text
    .replace(/＋/g, '+')
    .replace(/[－−–—]/g, '-')
    .trim();
}

export function parseCommand(rawText) {
  const text = normalize(rawText ?? '');

  if (text === OPEN_KEYWORD || text.startsWith(`${OPEN_KEYWORD} `)) {
    return { type: 'open', note: text.slice(OPEN_KEYWORD.length).trim() || null };
  }
  if (text === 'เปิดรับ') return { type: 'reopen' };
  if (text === 'ปิดรับ') return { type: 'close' };
  if (text === 'รายชื่อ') return { type: 'list' };
  if (text === 'คำสั่ง' || text.toLowerCase() === 'help') return { type: 'help' };

  const match = text.match(/^([+-])\s*(\d+)?\s*(.*)$/s);
  if (!match) return null;

  const [, sign, numStr, rest] = match;
  const names = rest
    .split(/[,\s、]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!numStr && names.length === 0) return null; // a lone "+" or "-"
  const number = numStr ? Number(numStr) : names.length;
  if (number < 1 || number > MAX_COUNT || names.length > MAX_COUNT) return null;

  return {
    type: sign === '+' ? 'join' : 'leave',
    count: Math.max(number, names.length),
    names,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export function createFootballHandler({ lineClient, store }) {
  const textMsg = (text) => ({ type: 'text', text });

  async function getProfile(source) {
    try {
      const { type, groupId, roomId, userId } = source;
      const p =
        type === 'group'
          ? await lineClient.getGroupMemberProfile(groupId, userId)
          : type === 'room'
            ? await lineClient.getRoomMemberProfile(roomId, userId)
            : await lineClient.getProfile(userId);
      return { name: p.displayName, pictureUrl: p.pictureUrl ?? null };
    } catch (err) {
      console.warn(`⚠️ Could not fetch profile for ${source.userId}: ${err.message}`);
      return { name: 'ไม่ทราบชื่อ', pictureUrl: null };
    }
  }

  function newSession(note) {
    return { status: 'open', note, openedAt: new Date().toISOString(), entries: [] };
  }

  /** Returns LINE messages to reply with, or null to stay silent. */
  async function handleText(event) {
    const cmd = parseCommand(event.message.text);
    if (!cmd) return null; // normal chat → stay silent

    const source = event.source;
    const chatId = source.groupId ?? source.roomId ?? source.userId;
    const userId = source.userId;
    let session = await store.getSession(chatId);

    switch (cmd.type) {
      case 'help':
        return [textMsg(HELP_TEXT)];

      case 'open': {
        if (session?.status === 'open') {
          if (cmd.note) session.note = cmd.note;
        } else {
          session = newSession(cmd.note);
        }
        await store.saveSession(chatId, session);
        return [buildRosterMessage(session)];
      }

      case 'reopen': {
        if (!session) session = newSession(null);
        session.status = 'open';
        await store.saveSession(chatId, session);
        return [buildRosterMessage(session)];
      }

      case 'close': {
        if (!session || session.status !== 'open') return [textMsg('ยังไม่ได้เปิดรับสมัครครับ')];
        session.status = 'closed';
        await store.saveSession(chatId, session);
        return [buildRosterMessage(session)];
      }

      case 'list':
        if (!session) return [textMsg('ยังไม่มีการเปิดรับสมัคร พิมพ์ "เตะบอลวันนี้" เพื่อเปิด')];
        return [buildRosterMessage(session)];

      case 'join':
        return handleJoin(cmd, session, chatId, source, userId);

      case 'leave':
        return handleLeave(cmd, session, chatId, userId);

      default:
        return null;
    }
  }

  async function handleJoin(cmd, session, chatId, source, userId) {
    if (!session) return [textMsg('ยังไม่เปิดรับสมัคร พิมพ์ "เตะบอลวันนี้" เพื่อเปิดก่อนนะครับ')];
    if (session.status !== 'open') return [textMsg('🔒 ปิดรับสมัครแล้วครับ')];

    const profile = await getProfile(source);
    const now = new Date().toISOString();
    const notes = [];
    let added = 0;

    const includeSelf = cmd.count > cmd.names.length;
    if (includeSelf) {
      const already = session.entries.some((e) => e.type === 'member' && e.userId === userId);
      if (already) {
        notes.push(`${profile.name} สมัครไว้แล้ว`);
      } else {
        session.entries.push({
          type: 'member',
          userId,
          name: profile.name,
          pictureUrl: profile.pictureUrl,
          createdAt: now,
        });
        added++;
      }
    }

    for (const name of cmd.names) {
      const duplicate = session.entries.some(
        (e) => e.type === 'guest' && e.addedBy === userId && e.name?.toLowerCase() === name.toLowerCase(),
      );
      if (duplicate) {
        notes.push(`${name} อยู่ในรายชื่อแล้ว`);
        continue;
      }
      session.entries.push({ type: 'guest', name, addedBy: userId, addedByName: profile.name, createdAt: now });
      added++;
    }

    const unnamed = includeSelf ? cmd.count - cmd.names.length - 1 : 0;
    for (let i = 0; i < unnamed; i++) {
      session.entries.push({ type: 'guest', name: null, addedBy: userId, addedByName: profile.name, createdAt: now });
      added++;
    }

    if (added === 0) return [textMsg(notes.join('\n'))];
    await store.saveSession(chatId, session);
    return notes.length > 0 ? [textMsg(notes.join('\n')), buildRosterMessage(session)] : [buildRosterMessage(session)];
  }

  async function handleLeave(cmd, session, chatId, userId) {
    if (!session) return [textMsg('ยังไม่มีการเปิดรับสมัครครับ')];

    const entries = session.entries;
    const removed = [];
    let notFound = [];

    for (const name of cmd.names) {
      const lower = name.toLowerCase();
      const isMatch = (e) => e.type === 'guest' && e.name?.toLowerCase() === lower;
      let idx = entries.findIndex((e) => isMatch(e) && e.addedBy === userId);
      if (idx === -1) idx = entries.findIndex(isMatch);
      if (idx === -1) notFound.push(name);
      else removed.push(...entries.splice(idx, 1));
    }

    let remaining = cmd.count - cmd.names.length;
    // "-1 ติดงาน" → no friend with that name, so treat it as a plain "-1"
    if (cmd.names.length > 0 && removed.length === 0) {
      remaining = cmd.count;
      notFound = [];
    }

    if (remaining > 0) {
      const selfIdx = entries.findIndex((e) => e.type === 'member' && e.userId === userId);
      if (selfIdx !== -1) {
        removed.push(...entries.splice(selfIdx, 1));
        remaining--;
      }
    }
    while (remaining > 0) {
      const idx = entries.findLastIndex((e) => e.type === 'guest' && e.addedBy === userId);
      if (idx === -1) break;
      removed.push(...entries.splice(idx, 1));
      remaining--;
    }

    if (removed.length === 0) return [textMsg('ไม่พบชื่อที่จะถอนครับ')];
    await store.saveSession(chatId, session);

    const card = buildRosterMessage(session);
    return notFound.length > 0 ? [textMsg(`ไม่พบชื่อ: ${notFound.join(', ')}`), card] : [card];
  }

  return { handleText, helpText: HELP_TEXT };
}
