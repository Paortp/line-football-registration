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
  const isOpen = session.status === 'open';

  const bubble = {
    type: 'bubble',
    size: 'mega',
    header: buildHeader(session, counts, isOpen, page),
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
                text: isOpen ? 'ยังไม่มีผู้สมัคร กด +1 เป็นคนแรกเลย!' : 'ไม่มีผู้สมัคร',
                size: 'sm',
                color: '#9CA3AF',
                align: 'center',
                wrap: true,
              },
            ],
    },
  };

  if (isOpen) bubble.footer = buildFooter();
  return bubble;
}

function buildHeader(session, { total, members, guests }, isOpen, page) {
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
          backgroundColor: isOpen ? '#FFFFFF' : '#FFFFFF33',
          cornerRadius: '12px',
          paddingStart: '10px',
          paddingEnd: '10px',
          paddingTop: '3px',
          paddingBottom: '3px',
          contents: [
            {
              type: 'text',
              text: isOpen ? '● เปิดรับสมัคร' : '● ปิดรับแล้ว',
              size: 'xxs',
              weight: 'bold',
              color: isOpen ? NAVY : '#FFFFFF',
            },
          ],
        },
      ],
    },
    { type: 'text', text: `ผู้เข้าร่วมทั้งหมด ${total} คน`, size: 'xl', weight: 'bold', color: '#FFFFFF', margin: 'md' },
  ];

  if (guests > 0) {
    contents.push({
      type: 'text',
      text: `สมาชิก ${members} • เพื่อนที่พามา ${guests}`,
      size: 'xs',
      color: '#C7D2FE',
      margin: 'xs',
    });
  }

  const dateLine = [`เตะบอล${formatThaiDate(session.openedAt)}`, session.note, page && `หน้า ${page}`]
    .filter(Boolean)
    .join(' • ');
  contents.push({ type: 'text', text: dateLine, size: 'xs', color: '#FFFFFFB3', margin: 'xs', wrap: true });

  return {
    type: 'box',
    layout: 'vertical',
    paddingAll: '20px',
    background: { type: 'linearGradient', angle: '135deg', startColor: NAVY_DARK, endColor: NAVY },
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

function buildFooter() {
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

function formatThaiDate(isoString) {
  return new Date(isoString).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}
