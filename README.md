# ⚽ SUNSAOWAREE AC — LINE Football Registration Bot

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-24%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/LINE-Messaging%20API-06C755?style=for-the-badge&logo=line&logoColor=white" alt="LINE" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon%20Serverless-00E599?style=for-the-badge&logo=postgresql&logoColor=black" alt="Neon" />
  <img src="https://img.shields.io/badge/License-Private-1E3A8A?style=for-the-badge" alt="License" />
</p>

ระบบ Backend สำหรับจัดการการลงทะเบียนและนัดเตะฟุตบอลของสมาชิกในกลุ่ม LINE **SUNSAOWAREE AC** โดยพัฒนาด้วย Node.js เชื่อมต่อกับ LINE Messaging API และ Neon Serverless PostgreSQL ออกแบบให้ใช้งานง่าย ยืดหยุ่นสูง ไม่จำกัดจำนวนคน และไม่รบกวนการสนทนาทั่วไปในกลุ่ม

---

## ✨ ฟีเจอร์หลัก (Key Features)

- 📅 **นัดหมายล่วงหน้าได้อย่างอิสระ:** พิมพ์ระบุวัน เวลา และสนามบอลได้ตามสะดวก เช่น `เตะบอล เสาร์ 25 ต.ค. 19:00 สนามเทพหัสดิน`
- 👥 **ระบบลงชื่อยืดหยุ่น (+1 / -1):**
  - สมัครตัวเอง: `+1` (ดึงชื่อและรูปโปรไฟล์จาก LINE อัตโนมัติ ป้องกันการกดซ้ำด้วย LINE User ID)
  - พาเพื่อนมา: ระบุชื่อได้ เช่น `+2 บอส` (ตัวเอง + เพื่อน) หรือ `+1 เจ` (ส่งเพื่อนไปแทน)
  - เพื่อนไม่ระบุชื่อ: `+3` (ตัวเอง + เพื่อน 2 คน)
  - ถอนชื่อ: `-1` หรือถอนชื่อเพื่อน `-1 บอส`
- 🎨 **LINE Flex Message สไตล์พรีเมียม:**
  - การ์ดสีกรมท่า (Navy Theme) เรียบหรู แสดงรูปโปรไฟล์กลม ลำดับผู้สมัคร และสัดส่วนสมาชิก/เพื่อน
  - รองรับสมาชิกได้ไม่จำกัด (หากคนเยอะ ระบบจะแปลงเป็นการ์ด Carousel ให้เลื่อนดูอัตโนมัติ)
- 🚦 **ระบบ 3 สถานะอัจฉริยะ:**
  1. **`● กำลังรวมคน` (สีกรม):** เปิดรับสมัครเรื่อย ๆ มีปุ่มกดลัดบนการ์ด
  2. **`✔ พร้อมเตะ` (สีเขียว Emerald):** เมื่อคนพอแล้ว คนจัดกดปุ่ม `พร้อมเตะ` เพื่อล็อกรายชื่อ
  3. **`✕ ยกเลิกนัด` (สีเทา-แดง):** กรณียกเลิกนัด (คนไม่ครบ หรือติดภารกิจ)
- 📲 **ปุ่มบันทึกลงปฏิทินมือถือ (Add to Calendar):**
  - เมื่อกด `พร้อมเตะ` บอทจะมีปุ่ม **"📅 บันทึกลงปฏิทินมือถือ"** ให้สมาชิกทุกคนกดคลิกเดียวเพื่อเพิ่มนัดหมายลงใน Google Calendar / Apple Calendar บนมือถือทันที
- 🤫 **เงียบและไม่กวนใจ (Smart Silent):**
  - แชทคุยเล่นทั่วไปในกลุ่ม บอทจะไม่ตอบ
  - กรองประโยคคำถาม เช่น *"เตะบอลมั้ย"*, *"เตะบอลวันไหน"* บอทจะไม่เผลอเปิดรอบใหม่

---

## 🏛️ สถาปัตยกรรมระบบ (Architecture)

```mermaid
flowchart TD
    User["👥 สมาชิกในกลุ่ม LINE"] -->|พิมพ์ +1 / เตะบอล| LINE["LINE Messaging API"]
    LINE -->|Webhook (HTTPS)| Tunnel["Cloudflare / ngrok / Render"]
    Tunnel --> Webhook["src/index.js (Express Webhook)"]
    Webhook --> Auth["ตรวจลายเซ็น x-line-signature"]
    Auth --> Router["src/football/commands.js"]
    Router <--> DB[("Neon Serverless PostgreSQL")]
    Router --> Builder["src/football/flexCard.js"]
    Builder -->|Flex Message Card + ปุ่ม Calendar| LINE
```

---

## 🗄️ โครงสร้างฐานข้อมูล (Database Schema)

ระบบจัดเก็บข้อมูลลงใน **Neon Serverless PostgreSQL** เพื่อความเสถียรและเก็บประวัติย้อนหลังได้ตลอดไป:

### 1. ตาราง `sessions` (บันทึกแต่ละรอบนัดเตะบอล)
| Column | Type | Description |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | รหัสรอบนัดเตะบอล |
| `chat_id` | `VARCHAR(64)` | รหัสห้อง/กลุ่ม LINE (แยกข้อมูลอิสระแต่ละกลุ่ม) |
| `status` | `VARCHAR(16)` | สถานะ: `'open'`, `'confirmed'`, `'cancelled'`, `'closed'` |
| `note` | `TEXT` | รายละเอียดนัดหมาย เช่น วันเวลา และสนามบอล |
| `target_count` | `INTEGER` | เป้าหมายจำนวนคน (ถ้ามี) |
| `creator_user_id` | `VARCHAR(64)` | LINE User ID ของคนเปิดนัด |
| `creator_name` | `VARCHAR(128)` | ชื่อของคนเปิดนัด |
| `opened_at` | `TIMESTAMPTZ` | วัน-เวลาที่เปิดรับสมัคร |
| `closed_at` | `TIMESTAMPTZ` | วัน-เวลาที่ปิดรับหรือยกเลิก |

### 2. ตาราง `session_entries` (รายชื่อผู้เข้าร่วมในแต่ละรอบ)
| Column | Type | Description |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | รหัสแถวรายชื่อ |
| `session_id` | `INTEGER REFERENCES sessions(id)` | รหัสรอบที่สังกัด (CASCADE Delete) |
| `type` | `VARCHAR(16)` | ประเภท: `'member'` (สมาชิกกลุ่ม) หรือ `'guest'` (เพื่อนที่พามา) |
| `user_id` | `VARCHAR(64)` | LINE User ID ของสมาชิก (ป้องกันกดสมัครซ้ำ) |
| `display_name` | `VARCHAR(128)` | ชื่อที่แสดงบนการ์ด |
| `picture_url` | `TEXT` | URL รูปโปรไฟล์ LINE ของสมาชิก |
| `added_by_user_id`| `VARCHAR(64)` | LINE User ID ของคนที่พามา |
| `added_by_name` | `VARCHAR(128)` | ชื่อของคนที่พามา (แสดงเป็น subtitle ใต้ชื่อเพื่อน) |
| `created_at` | `TIMESTAMPTZ` | เวลาที่กดสมัคร |

---

## 📖 คู่มือคำสั่งบอท (Commands Reference)

| คำสั่ง | ตัวอย่างการใช้งาน | คำอธิบาย |
|---|---|---|
| **เตะบอล** | `เตะบอล เสาร์ 25 ต.ค. 19:00 สนามเทพหัสดิน` | เปิดรอบรับสมัครใหม่ พร้อมระบุรายละเอียด |
| **+1** | `+1` | สมัครเข้าร่วมด้วยตัวเอง |
| **+N [ชื่อเพื่อน]** | `+2 บอส` | ตัวเอง + เพื่อนชื่อบอส (รวม 2 คน) |
| **+1 [ชื่อเพื่อน]** | `+1 บอส` | เพิ่มเฉพาะเพื่อนชื่อบอส (ตัวเองไม่ได้ไป) |
| **+N** | `+3` | ตัวเอง + เพื่อนไม่ระบุชื่อ 2 คน |
| **-1** | `-1` | ถอนชื่อตัวเองออก |
| **-1 [ชื่อเพื่อน]** | `-1 บอส` | ถอนชื่อเพื่อนที่พามา |
| **รายชื่อ** | `รายชื่อ` | แสดงการ์ดสรุปรายชื่อผู้เข้าร่วมปัจจุบัน |
| **พร้อมเตะ** | `พร้อมเตะ` หรือ `คนครบแล้ว` | ยืนยันการนัดหมาย เปลี่ยนการ์ดเป็นสีเขียว แจกลิงก์ปฏิทิน |
| **ยกเลิก** | `ยกเลิก` หรือ `ยกเลิกนัด` | ยกเลิกนัดรอบปัจจุบัน |
| **เปิดรับ / ปิดรับ** | `เปิดรับ` หรือ `ปิดรับ` | เปิดหรือปิดรับสมัครสมาชิกเพิ่มเติม |
| **คำสั่ง** | `คำสั่ง` หรือ `help` | แสดงคู่มือการใช้งานบอท |

---

## 🛠️ โครงสร้างไฟล์ในโปรเจกต์ (Project Structure)

```text
line-football-registration/
├── .env.example              # แม่แบบ Environment Variables
├── .gitignore                # ป้องกันไฟล์ความลับ (.env) เข้า Git
├── package.json              # กำหนด Dependencies และ Scripts
│
└── src/
    ├── index.js              # ประตูทางเข้า Webhook และ Express Server
    ├── football/
    │   ├── commands.js       # ตรรกะประมวลผลคำสั่งทั้งหมด
    │   └── flexCard.js       # ตัวสร้างการ์ด LINE Flex Message และปุ่ม Calendar
    ├── store/
    │   ├── postgresStore.js  # ตัวเชื่อมต่อฐานข้อมูล Neon PostgreSQL
    │   └── memoryStore.js    # In-memory Store สำรอง
    └── db/
        └── schema.sql        # โครงสร้าง Table DDL สำหรับ PostgreSQL
```

---

## 🚀 การติดตั้งและรันในเครื่อง (Local Setup)

### 1. ความต้องการของระบบ (Prerequisites)
- Node.js version 22 ขึ้นไป
- PostgreSQL Database (แนะนำ [Neon.tech](https://neon.tech/) ฟรี)
- LINE Official Account & Messaging API Channel ([LINE Developers](https://developers.line.biz/))
- [ngrok](https://ngrok.com/) สำหรับสร้าง Tunnel ไปยังเครื่อง Mac

### 2. ติดตั้งโปรเจกต์
```bash
git clone https://github.com/Paortp/line-football-registration.git
cd line-football-registration
npm install
```

### 3. ตั้งค่าตัวแปรสภาพแวดล้อม (.env)
คัดลอกไฟล์ `.env.example` เป็น `.env` และกรอกค่าความลับ:
```bash
cp .env.example .env
```
```ini
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here
DATABASE_URL=
PORT=3000
```

### 4. รันระบบ (Development Mode)
```bash
npm run dev
```

### 5. เปิด Tunnel ด้วย ngrok
```bash
ngrok http 3000 --url https://your-domain.ngrok-free.dev
```
นำ URL ที่ได้ไปใส่ใน **LINE Developers Console** -> **Webhook URL**:
`https://your-domain.ngrok-free.dev/webhook`

---

## ☁️ การนำขึ้น Cloud รัน 24 ชั่วโมง (Deployment)

แนะนำให้นำโปรเจกต์ไป Deploy บน **[Render.com](https://render.com/)** (ฟรี):
1. นำโค้ดขึ้น GitHub
2. สร้าง **New Web Service** บน Render แล้วเชื่อมกับ GitHub Repository นี้
3. ตั้งค่า:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. เพิ่มค่าใน **Environment Variables**:
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`
   - `DATABASE_URL`
5. นำ URL ที่ได้จาก Render (เช่น `https://your-app.onrender.com/webhook`) ไปใส่ใน LINE Developers Console

---

<p align="center">
  พัฒนาด้วย ❤️ สำหรับสมาชิกทีม <b>SUNSAOWAREE AC</b> ⚽
</p>