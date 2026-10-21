// =========================================================================
// ⚙️ ตัวแปรสำหรับปรับองศาการฟัน ความเร็ว ระบบชาร์จ การหน่วงออร่า และการควบคุมมือ
// =========================================================================
const MAX_SLASH_ANGLE = 45;          // 📐 องศามุมการฟันไปข้างหน้าใน 1 ครั้ง
const MAX_CHARGE_WINDUP = 28;        // 📐 องศาที่ดาบง้างถอยหลังเพิ่มขึ้นเมื่อชาร์จเต็ม
const SLASH_SWING_SPEED = 4.2;       // ความเร็วตอนฟันดาบออก
const SLASH_RETRACT_SPEED = 3.5;     // ความเร็วตอนชักดาบกลับ
const MOVE_SPEED = 5.5;              // ความเร็วในการเดินของตัวละคร
const BASE_DAMAGE = 20;              // ค่าความเสียหายพื้นฐาน (100%)
const PART_FLASH_DURATION = 45;      // ระยะเวลา (เฟรม) ที่ชิ้นส่วนเปลี่ยนเป็นสีแดง
const CLASH_KNOCKBACK = 28;          // ระยะกระเด็นถอยหลังเมื่อดาบฟันปะทะกันเอง
const VICTORY_BG_COLOR = '#f5c400';  // สีพื้นหลังเหลืองทองหน้าประกาศผลผู้ชนะ

// --- ตัวแปรระบบ Charge Attack, ดีเลย์ออร่าสีแดง & การควบคุมมือ ---
const MAX_CHARGE_MULTIPLIER = 1.5;   // ความแรงสูงสุดเมื่อชาร์จเต็ม (1.5 เท่า)
const MAX_CHARGE_FRAMES = 55;        // จำนวนเฟรมที่ใช้ชาร์จจนเต็ม 100% (~0.9 วินาที)
const CHARGE_AURA_DELAY_FRAMES = 14; // ⏳ ดีเลย์ (จำนวนเฟรม) ก่อนที่ออร่าสีแดงจะเริ่มปรากฏเมื่อกดชาร์จค้าง
const HAND_CONTROL_SPEED = 2.2;      // ความเร็วในการบังคับยก/ลดมือที่ถือดาบ (Q/E และ U/O)
const HAND_MIN_ANGLE = -55;          // มุมยกมือสูงสุด (เล็งส่วนหัว)
const HAND_MAX_ANGLE = 50;           // มุมลดมือต่ำสุด (เล็งส่วนขา)

// --- 1. CONFIG & RIGGING DATA ---
const DEFAULT_JOINTS = {
    upper_body:      { x: 0,    y: 0,    pivotX: 0,   pivotY: 0,    rotation: 0,  zIndex: 70 },
    head:            { x: 0,    y: -101, pivotX: 38,  pivotY: -93,  rotation: 0,  zIndex: 80 },
    lower_body:      { x: 0,    y: 154,  pivotX: 0,   pivotY: 0,    rotation: 0,  zIndex: 82 },
    right_upper_arm: { x: 95,   y: -4,   pivotX: 35,  pivotY: 24,   rotation: 0,  zIndex: 30 },
    right_arm:       { x: 78,   y: 71,   pivotX: 55,  pivotY: -18,  rotation: -9, zIndex: 40 },
    sword:           { x: 34,   y: 4,    pivotX: -8,  pivotY: -178, rotation: 16, zIndex: 50 },
    right_hand:      { x: 108,  y: -44,  pivotX: 24,  pivotY: 3,    rotation: 0,  zIndex: 60 },
    left_upper_arm:  { x: -87,  y: -5,   pivotX: -45, pivotY: 4,    rotation: 0,  zIndex: 20 },
    left_arm:        { x: -104, y: 24,   pivotX: -39, pivotY: 38,   rotation: 0,  zIndex: 21 },
    left_hand:       { x: -78,  y: 88,   pivotX: 1,   pivotY: 24,   rotation: 0,  zIndex: 22 },
    right_leg:       { x: 50,   y: -1,   pivotX: 27,  pivotY: 25,   rotation: 0,  zIndex: 13 },
    right_foot:      { x: 65,   y: 70,   pivotX: 49,  pivotY: 62,   rotation: 0,  zIndex: 14 },
    left_leg:        { x: -70,  y: 3,    pivotX: -7,  pivotY: 28,   rotation: 0,  zIndex: 11 },
    left_foot:       { x: -36,  y: 80,   pivotX: -19, pivotY: 75,   rotation: 0,  zIndex: 12 }
};

const PART_HITBOX_CONFIG = {
    head:            { radius: 44, x1: 0, y1: 10,  x2: 45,   y2: -125 },
    upper_body:      { radius: 56, x1: 0, y1: -95, x2: 0,    y2: 115  },
    lower_body:      { radius: 50, x1: 0, y1: -45, x2: 0,    y2: 65   },
    right_upper_arm: { radius: 30, x1: 0, y1: 0,   x2: 78,   y2: 71   },
    right_arm:       { radius: 26, x1: 0, y1: 0,   x2: 108,  y2: -44  },
    right_hand:      { radius: 24, x1: 0, y1: 0,   x2: 40,   y2: 6    },
    left_upper_arm:  { radius: 30, x1: 0, y1: 0,   x2: -104, y2: 24   },
    left_arm:        { radius: 26, x1: 0, y1: 0,   x2: -78,  y2: 88   },
    left_hand:       { radius: 24, x1: 0, y1: 0,   x2: 2,    y2: 48   },
    right_leg:       { radius: 35, x1: 0, y1: 0,   x2: 65,   y2: 70   },
    right_foot:      { radius: 30, x1: 0, y1: 0,   x2: 85,   y2: 110  },
    left_leg:        { radius: 35, x1: 0, y1: 0,   x2: -36,  y2: 80   },
    left_foot:       { radius: 30, x1: 0, y1: 0,   x2: -35,  y2: 130  }
};

const SCENE_GRAPH = {
    upper_body:      { parent: null },
    head:            { parent: 'upper_body' },
    lower_body:      { parent: 'upper_body' },
    left_leg:        { parent: 'lower_body' },
    left_foot:       { parent: 'left_leg' },
    right_leg:       { parent: 'lower_body' },
    right_foot:      { parent: 'right_leg' },
    left_upper_arm:  { parent: 'upper_body' },
    left_arm:        { parent: 'left_upper_arm' },
    left_hand:       { parent: 'left_arm' },
    right_upper_arm: { parent: 'upper_body' },
    right_arm:       { parent: 'right_upper_arm' },
    right_hand:      { parent: 'right_arm' },
    sword:           { parent: 'right_hand' }
};
