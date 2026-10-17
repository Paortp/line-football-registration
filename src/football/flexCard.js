/**
 * Builds the navy roster Flex Message shown in the LINE group.
 * Large rosters are split into a carousel (several cards you can swipe).
 */
const NAVY_DARK = '#0A1F44';
const NAVY = '#1E3A8A';
const CLUB_NAME = '⚽ SUNSAOWAREE AC';
const ROWS_PER_BUBBLE = 25; // keeps each card well under LINE's size limit
const MAX_BUBBLES = 12; // LINE carousel limit

export function buildRosterMessage(session) {
  const { entries } = session;
  const total = entries.length;
  const guests = entries.filter((e) => e.type === 'guest').length;
  const members = total - guests;

  const chunks = [];
  for (let i = 0; i < entries.length; i += ROWS_PER_BUBBLE) {
    chunks.push(entries.slice(i, i + ROWS_PER_BUBBLE));
  }
  if (chunks.length === 0) chunks.push([]);

  const pages = chunks.slice(0, MAX_BUBBLES);
  const bubbles = pages.map((rows, i) =>
    buildBubble({
      session,
      rows,
      startNumber: i * ROWS_PER_BUBBLE + 1,
      counts: { total, members, guests },
      page: pages.length > 1 ? `${i + 1}/${pages.length}` : null,
    }),
  );

  return {
    type: 'flex',
    altText: `⚽ ผู้เข้าร่วมทั้งหมด ${total} คน`,
    contents: bubbles.length === 1 ? bubbles[0] : { type: 'carousel', contents: bubbles },
  };
}

function buildBubble({ session, rows, startNumber, counts, page }) {
  const isConfirmed = session.status === 'confirmed';
  const isCancelled = session.status === 'cancelled';
  const isOpen = session.status === 'open';

  const bubble = {
    type: 'bubble',
    size: 'mega',
    header: buildHeader(session, counts, page),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '16px',
      contents:
        rows.length > 0
          ? rows.map((entry, i) => buildRow(entry, startNumber + i))
          : [
              {
                type: 'text',
                text: isCancelled
                  ? '❌ นัดหมายนี้ถูกยกเลิกแล้ว'
                  : isOpen
                    ? 'ยังไม่มีผู้สมัคร กด +1 เป็นคนแรกเลย!'
                    : 'ไม่มีผู้สมัคร',
                size: 'sm',
                color: '#9CA3AF',
                align: 'center',
                wrap: true,
              },
            ],
    },
  };

  if (isOpen || isConfirmed) {
    bubble.footer = buildFooter(session);
  }
  return bubble;
}

function buildHeader(session, { total, members, guests }, page) {
  const isConfirmed = session.status === 'confirmed';
  const isCancelled = session.status === 'cancelled';
  const isOpen = session.status === 'open';

  let badgeText = '● ปิดรับแล้ว';
  let badgeColor = '#FFFFFF';
  let badgeBg = '#FFFFFF33';
  let gradStart = NAVY_DARK;
  let gradEnd = NAVY;

  if (isConfirmed) {
    badgeText = '✔ พร้อมเตะ';
    badgeColor = '#059669';
    badgeBg = '#FFFFFF';
    gradStart = '#064E3B';
    gradEnd = '#059669';
  } else if (isCancelled) {
    badgeText = '✕ ยกเลิกนัด';
    badgeColor = '#FFFFFF';
    badgeBg = '#EF4444';
    gradStart = '#374151';
    gradEnd = '#4B5563';
  } else if (isOpen) {
    badgeText = '● กำลังรวมคน';
    badgeColor = NAVY;
    badgeBg = '#FFFFFF';
  }

  let mainTitle = `ผู้เข้าร่วมทั้งหมด ${total} คน`;
  let subStatusText = null;

  if (isConfirmed) {
    mainTitle = `พร้อมเตะแล้ว 🔥 (${total} คน)`;
    subStatusText = 'รวมคนครบตามเป้าหมายแล้ว เจอกันตามนัด!';
  } else if (isCancelled) {
    mainTitle = 'ยกเลิกนัดเตะบอล';
    subStatusText = 'เนื่องจากคนไม่ครบ ไว้เจอกันใหม่รอบหน้านะครับ';
  } else if (session.targetCount) {
    mainTitle = `ผู้เข้าร่วม ${total} / ${session.targetCount} คน`;
    if (total >= session.targetCount) {
      subStatusText = `🎉 คนครบ ${session.targetCount} คนแล้ว! กด "พร้อมเตะ" ได้เลย`;
    } else {
      subStatusText = `(ขาดอีก ${session.targetCount - total} คน จะครบเป้าหมาย)`;
    }
  }

  const contents = [
    {
      type: 'box',
      layout: 'horizontal',
      alignItems: 'center',
      contents: [
        { type: 'text', text: CLUB_NAME, size: 'xs', weight: 'bold', color: '#FFFFFFCC', flex: 1 },
        {
          type: 'box',
          layout: 'vertical',
          flex: 0,
          backgroundColor: badgeBg,
          cornerRadius: '12px',
          paddingStart: '10px',
          paddingEnd: '10px',
          paddingTop: '3px',
          paddingBottom: '3px',
          contents: [
            {
              type: 'text',
              text: badgeText,
              size: 'xxs',
              weight: 'bold',
              color: badgeColor,
            },
          ],
        },
      ],
    },
    { type: 'text', text: mainTitle, size: 'xl', weight: 'bold', color: '#FFFFFF', margin: 'md', wrap: true },
  ];

  if (subStatusText) {
    contents.push({
      type: 'text',
      text: subStatusText,
      size: 'xs',
      weight: 'bold',
      color: isConfirmed ? '#A7F3D0' : '#FDE68A',
      margin: 'xs',
      wrap: true,
    });
  }

  if (guests > 0) {
    contents.push({
      type: 'text',
      text: `สมาชิก ${members} • เพื่อนที่พามา ${guests}`,
      size: 'xs',
      color: '#C7D2FE',
      margin: 'xs',
    });
  }

  const matchInfo = session.note ? `⚽ ${session.note}` : `เตะบอล${formatThaiDate(session.openedAt)}`;
  const dateLine = [matchInfo, page && `หน้า ${page}`].filter(Boolean).join(' • ');
  contents.push({ type: 'text', text: dateLine, size: 'xs', color: '#FFFFFFB3', margin: 'xs', wrap: true });

  return {
    type: 'box',
    layout: 'vertical',
    paddingAll: '20px',
    background: { type: 'linearGradient', angle: '135deg', startColor: gradStart, endColor: gradEnd },
    contents,
  };
}

function buildRow(entry, number) {
  const isGuest = entry.type === 'guest';
  const name = isGuest ? entry.name ?? `เพื่อนของ ${entry.addedByName}` : entry.name;

  const nameBlock = isGuest
    ? {
        type: 'box',
        layout: 'vertical',
        flex: 1,
        contents: [
          { type: 'text', text: name, size: 'sm', weight: 'bold', color: '#111827' },
          {
            type: 'text',
            text: entry.name ? `เพื่อนของ ${entry.addedByName}` : 'ไม่ระบุชื่อ',
            size: 'xxs',
            color: '#6B7280',
          },
        ],
      }
    : { type: 'text', text: name, size: 'sm', weight: 'bold', color: '#111827', flex: 1 };

  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'md',
    alignItems: 'center',
    contents: [
      { type: 'text', text: String(number), size: 'xs', color: '#9CA3AF', flex: 0 },
      buildAvatar(entry, name),
      nameBlock,
    ],
  };
}

function buildAvatar(entry, displayName) {
  const base = { type: 'box', layout: 'vertical', flex: 0, width: '30px', height: '30px', cornerRadius: '100px' };

  if (entry.pictureUrl) {
    return { ...base, contents: [{ type: 'image', url: entry.pictureUrl, aspectMode: 'cover', size: 'full' }] };
  }

  const initial = entry.name ? Array.from(entry.name)[0] : '+';
  return {
    ...base,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    contents: [{ type: 'text', text: initial || '?', size: 'sm', weight: 'bold', color: NAVY }],
  };
}

function buildFooter(session) {
  const isConfirmed = session.status === 'confirmed';

  if (isConfirmed) {
    const calendarUrl = buildCalendarUrl(session);
    return {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#059669',
          height: 'sm',
          action: {
            type: 'uri',
            label: '📅 บันทึกลงปฏิทินมือถือ',
            uri: calendarUrl,
          },
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: { type: 'message', label: '-1 ถอนชื่อ', text: '-1' },
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: { type: 'message', label: '➕ เปิดรับเพิ่ม', text: 'เปิดรับ' },
            },
          ],
        },
        {
          type: 'text',
          text: 'กดปุ่มสีเขียวเพื่อเพิ่มนัดหมายลงในปฏิทินมือถือได้ทันที 📅',
          size: 'xxs',
          color: '#6B7280',
          align: 'center',
          margin: 'sm',
          wrap: true,
        },
      ],
    };
  }

  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    paddingAll: '16px',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: NAVY,
            height: 'sm',
            action: { type: 'message', label: '+1 สมัคร', text: '+1' },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '-1 ถอนชื่อ', text: '-1' },
          },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '🔥 พร้อมเตะ', text: 'พร้อมเตะ' },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '❌ ยกเลิกนัด', text: 'ยกเลิก' },
          },
        ],
      },
      {
        type: 'text',
        text: 'พาเพื่อนมา พิมพ์ +1 ตามด้วยชื่อ เช่น +1 บอส',
        size: 'xxs',
        color: '#9CA3AF',
        align: 'center',
        margin: 'sm',
        wrap: true,
      },
    ],
  };
}

function buildCalendarUrl(session) {
  const title = encodeURIComponent('⚽ เตะบอล SUNSAOWAREE AC');
  const attendees = (session.entries || []).map((e, i) => `${i + 1}. ${e.name}`).join('\n');
  const details = encodeURIComponent(
    `⚽ นัดเตะบอลกลุ่ม SUNSAOWAREE AC\nสถานที่/โน้ต: ${session.note || '-'}\n\nผู้เข้าร่วม (${session.entries?.length || 0} คน):\n${attendees}`
  );
  const location = encodeURIComponent(session.note || 'สนามฟุตบอล');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
}

function formatThaiDate(isoString) {
  return new Date(isoString).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}
