// =========================================================================
// 📦 สถานะของเกม ผู้เล่น การโหลดรูปภาพ และตั้งค่าขนาด Canvas
// =========================================================================
const canvas = document.getElementById('stageCanvas');
const ctx = canvas.getContext('2d');

// Offscreen Canvas สำหรับประมวลผลสีชิ้นส่วน
const hitOffscreenCanvas = document.createElement('canvas');
const hitOffscreenCtx = hitOffscreenCanvas.getContext('2d');

let p1Joints = JSON.parse(JSON.stringify(DEFAULT_JOINTS));
let p2Joints = JSON.parse(JSON.stringify(DEFAULT_JOINTS));

function createPlayerState(xRatio, facing) {
    return {
        x: window.innerWidth * xRatio,
        y: window.innerHeight * 0.58,
        vx: 0,
        vy: 0,
        scale: 0.78,
        facingDir: facing,
        visualFacingX: facing,
        handAimAngle: 0,
        isCharging: false,
        chargeFrames: 0,
        chargeRatio: 0,
        activeSlashCharge: 0,
        activeSlashAura: 0,
        activeSlashMultiplier: 1,
        isSlashing: false,
        slashState: 'idle',
        slashAngle: 0,
        hp: 100,
        maxHp: 100,
        hitCooldown: 0,
        clashCooldown: 0,
        partHitTimers: {},
        walkPhase: Math.random() * Math.PI * 2,
        idlePhase: Math.random() * Math.PI * 2,
        walkBlend: 0,
        worldTransforms: {},
        swordSegmentsWorld: [],
        bodyCapsulesWorld: {}
    };
}

let p1 = createPlayerState(0.28, 1);
let p2 = createPlayerState(0.72, -1);

let keys = {};
let gameOver = false;
let winnerBannerText = '';
let winnerPlayer = null;
let loserPlayer = null;
let detachedParts = []; // เก็บชิ้นส่วนร่างกายของผู้แพ้ที่หลุดออกจากกันและหล่นลงพื้น
let gameOverTimer = 0;

let particles = [];
let clashRings = [];
let timerSeconds = 60;
let timerInterval = null;

// โหลดรูปภาพชิ้นส่วนทั้งหมด
const componentNames = Object.keys(DEFAULT_JOINTS);
const images = {};

componentNames.forEach(name => {
    const img = new Image();
    img.src = `Body_Component/${name}.png`;
    images[name] = img;
});

// --- 2. CANVAS SETUP & DYNAMIC SCALING ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const responsiveScale = Math.min(Math.max(canvas.height * 0.00105, 0.65), 0.88);
    p1.scale = responsiveScale;
    p2.scale = responsiveScale;

    if (!gameOver) {
        p1.y = canvas.height * 0.56;
        p2.y = canvas.height * 0.56;
    }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
