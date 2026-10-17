
import { buildRosterMessage } from './flexCard.js';

const OPEN_KEYWORD = 'เตะบอลวันนี้';
const MAX_COUNT = 20;

const HELP_TEXT = [
  '⚽ คำสั่งบอทเตะบอล',
  '',
  'เตะบอล [วันเวลา] [สนาม] [จำนวนคน]',
  '   เช่น: เตะบอล 14 คน เสาร์ 25 ต.ค. 19:00 สนามA',
  'รายชื่อ — ดูรายชื่อผู้สมัคร',
  'พร้อมเตะ — คนครบแล้ว ยืนยันนัดหมาย + บันทึกปฏิทิน',
  'ยกเลิก — ยกเลิกนัดรอบนี้ (คนไม่ครบ)',
  'เปิดรับ / ปิดรับ — ปิดหรือเปิดรับสมัครอีกครั้ง',
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

/** ดึงจำนวนเป้าหมายคนจากข้อความ เช่น "14 คน", "(14 คน)", "(14)" */
function extractTargetCount(rawNote) {
  if (!rawNote) return { note: null, targetCount: null };
  let note = rawNote;
  let targetCount = null;
  const countMatch = note.match(/(?:[\(（])?\s*(\d{1,2})\s*คน\s*(?:[\)）])?/) || note.match(/[\(（]\s*(\d{1,2})\s*[\)）]/);
  if (countMatch) {
    targetCount = Number(countMatch[1]);
    note = note.replace(countMatch[0], '').replace(/\s+/g, ' ').trim();
  }
  return { note: note || null, targetCount };
}

export function parseCommand(rawText) {
  const text = normalize(rawText ?? '');

  // คำสั่งเปิดรับสมัคร: เตะบอล, เตะบอลวันนี้, นัดเตะบอล
  const openMatch = text.match(/^(?:นัด)?เตะบอล(?:วันนี้)?(?:\s+(.*))?$/s);
  if (openMatch) {
    const rawNote = (openMatch[1] ?? '').trim();
    if (/^(ไหม|มั้ย|ปะ|ป่ะ|หรือเปล่า|วันไหน)/.test(rawNote)) {
      return null;
    }
    const { note, targetCount } = extractTargetCount(rawNote);
    return { type: 'open', note, targetCount };
  }

  if (text === 'พร้อมเตะ' || text === 'คนครบแล้ว' || text === 'ครบแล้ว') return { type: 'confirm' };
  if (text === 'ยกเลิก' || text === 'ยกเลิกนัด' || text === 'ไม่เตะแล้ว') return { type: 'cancel' };
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

  function newSession(note, targetCount, creatorUserId, creatorName) {
    return {
      status: 'open',
      note: note || null,
      targetCount: targetCount || null,
      creatorUserId: creatorUserId || null,
      creatorName: creatorName || null,
      openedAt: new Date().toISOString(),
      entries: [],
    };
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
        const profile = await getProfile(source);
        if (session?.status === 'open') {
          if (cmd.note) session.note = cmd.note;
          if (cmd.targetCount) session.targetCount = cmd.targetCount;
        } else {
          session = newSession(cmd.note, cmd.targetCount, userId, profile.name);
        }
        await store.saveSession(chatId, session);
        return [buildRosterMessage(session)];
      }

      case 'confirm': {
        if (!session || session.status === 'cancelled') {
          return [textMsg('ยังไม่มีการเปิดนัดเตะบอลครับ พิมพ์ "เตะบอล" เพื่อเริ่มนัดใหม่')];
        }
        session.status = 'confirmed';
        await store.saveSession(chatId, session);
        return [
          textMsg('🔥 ยืนยันนัดหมายเรียบร้อย! คนครบพร้อมเตะแล้วครับ อย่าลืมกด "บันทึกลงปฏิทิน" ด้านล่างกันนะครับ 📅'),
          buildRosterMessage(session),
        ];
      }

      case 'cancel': {
        if (!session || session.status === 'cancelled') {
          return [textMsg('ไม่มีนัดที่เปิดอยู่ครับ')];
        }
        session.status = 'cancelled';
        await store.saveSession(chatId, session);
        return [textMsg('❌ ยกเลิกนัดเตะบอลรอบนี้เรียบร้อยครับ ไว้เจอกันใหม่รอบหน้านะครับ'), buildRosterMessage(session)];
      }

      case 'reopen': {
        if (!session) session = newSession(null, null, userId, null);
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
        if (!session) return [textMsg('ยังไม่มีการเปิดรับสมัคร พิมพ์ "เตะบอล" เพื่อเปิด')];
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
    if (!session) return [textMsg('ยังไม่เปิดรับสมัคร พิมพ์ "เตะบอล" เพื่อเปิดก่อนนะครับ')];
    if (session.status === 'cancelled') return [textMsg('❌ นัดนี้ถูกยกเลิกแล้วครับ พิมพ์ "เตะบอล" เพื่อเปิดนัดใหม่')];
    if (session.status === 'closed') return [textMsg('🔒 ปิดรับสมัครแล้วครับ (พิมพ์ "เปิดรับ" เพื่อเปิดใหม่)')];
    if (session.status === 'confirmed') {
      return [textMsg('🔥 นัดนี้ยืนยันพร้อมเตะแล้วครับ หากต้องการเพิ่มคนให้พิมพ์ "เปิดรับ" ก่อนนะครับ')];
    }

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
