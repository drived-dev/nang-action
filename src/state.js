


const canvas = document.getElementById('stageCanvas');
const ctx = canvas.getContext('2d');

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
// Keyboard-first development mode: start at the menu so the game can be
// tested without connecting the Bluetooth IMU controllers.
let gameScreen = 'menu';
let leftStickConnected = false;
let rightStickConnected = false;

let gameOver = false;
let isDrawRound = false;
let winnerBannerText = '';
let winnerPlayer = null;
let loserPlayer = null;
let detachedParts = [];
let gameOverTimer = 0;


const TOTAL_ROUNDS = 3;
let currentRound = 1;


const CHARACTER_ROSTER = ['CHALAWAN'];
let p1CharIndex = 0;
let p2CharIndex = 0;

let particles = [];
let clashRings = [];
let timerSeconds = 60;
let timerInterval = null;


const componentNames = Object.keys(DEFAULT_JOINTS);
const images = {};
let loadedImagesCount = 0;

componentNames.forEach(name => {
    const img = new Image();
    img.src = `src/assets/Body_Component/${name}.png`;
    img.onload = () => {
        loadedImagesCount++;
        if (loadedImagesCount === componentNames.length) {
            drawFallbackStickSetupShadow();
            renderCharacterSelectPreviews();
        }
    };
    images[name] = img;
});

function drawStaticPuppetOnCanvas(targetCanvas, centerX, centerY, scale, facingDir, showSticks = true) {
    if (!targetCanvas || typeof updatePlayerTransforms !== 'function') return;
    const tCtx = targetCanvas.getContext('2d');
    tCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

    const dummy = createPlayerState(0.5, facingDir);
    dummy.x = centerX;
    dummy.y = centerY;
    dummy.scale = scale;
    dummy.visualFacingX = facingDir;
    dummy.walkBlend = 0;
    dummy.idlePhase = 0;

    updatePlayerTransforms(dummy, DEFAULT_JOINTS);

    tCtx.save();
    tCtx.translate(dummy.x, dummy.y);
    tCtx.scale(dummy.scale * dummy.visualFacingX, dummy.scale);

    if (showSticks && dummy.worldTransforms['lower_body'] && dummy.worldTransforms['right_hand']) {
        tCtx.save();
        tCtx.strokeStyle = '#000000';
        tCtx.lineWidth = 5;

        const lb = dummy.worldTransforms['lower_body'];
        tCtx.beginPath();
        tCtx.moveTo(lb[4], lb[5]);
        tCtx.lineTo(lb[4], 1000);
        tCtx.stroke();

        const rh = dummy.worldTransforms['right_hand'];
        tCtx.beginPath();
        tCtx.moveTo(rh[4], rh[5]);
        tCtx.lineTo(rh[4] - 70, 1000);
        tCtx.stroke();
        tCtx.restore();
    }

    const sorted = Object.keys(DEFAULT_JOINTS).sort((a, b) => (DEFAULT_JOINTS[a].zIndex || 0) - (DEFAULT_JOINTS[b].zIndex || 0));
    sorted.forEach(name => {
        const m = dummy.worldTransforms[name];
        const j = DEFAULT_JOINTS[name];
        const img = images[name];
        if (!m) return;

        tCtx.save();
        tCtx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        tCtx.translate(j.pivotX, j.pivotY);

        if (img && img.complete && img.naturalWidth > 0) {
            tCtx.drawImage(img, -img.width / 2, -img.height / 2);
        } else if (typeof drawProceduralFallback === 'function') {
            tCtx.fillStyle = '#000000';
            tCtx.beginPath();
            tCtx.arc(0, 0, 20, 0, Math.PI * 2);
            tCtx.fill();
        }
        tCtx.restore();
    });

    tCtx.restore();
}

function renderCharacterSelectPreviews() {
    const p1Canvas = document.getElementById('p1PreviewCanvas');
    const p2Canvas = document.getElementById('p2PreviewCanvas');
    const thumb1 = document.getElementById('thumbCanvas1');

    drawStaticPuppetOnCanvas(p1Canvas, 245, 250, 0.72, 1, true);
    drawStaticPuppetOnCanvas(p2Canvas, 275, 250, 0.72, -1, true);
    drawStaticPuppetOnCanvas(thumb1, 100, 195, 0.78, 1, false);
}

function drawFallbackStickSetupShadow() {
    const fbCanvas = document.getElementById('fallbackShadowCanvas');
    if (!fbCanvas) return;
    const fbCtx = fbCanvas.getContext('2d');
    fbCtx.clearRect(0, 0, fbCanvas.width, fbCanvas.height);

    const dummyLeft = createPlayerState(0.35, 1);
    const dummyRight = createPlayerState(0.65, -1);
    dummyLeft.x = 250;
    dummyLeft.y = 260;
    dummyLeft.scale = 0.56;
    dummyLeft.walkBlend = 0;
    dummyLeft.idlePhase = 0;

    dummyRight.x = 510;
    dummyRight.y = 260;
    dummyRight.scale = 0.56;
    dummyRight.walkBlend = 0;
    dummyRight.idlePhase = 0;

    if (typeof updatePlayerTransforms === 'function') {
        updatePlayerTransforms(dummyLeft, p1Joints);
        updatePlayerTransforms(dummyRight, p2Joints);

        [dummyLeft, dummyRight].forEach(dPlayer => {
            fbCtx.save();
            fbCtx.translate(dPlayer.x, dPlayer.y);
            fbCtx.scale(dPlayer.scale * dPlayer.visualFacingX, dPlayer.scale);

            const sorted = Object.keys(DEFAULT_JOINTS).sort((a, b) => (DEFAULT_JOINTS[a].zIndex || 0) - (DEFAULT_JOINTS[b].zIndex || 0));
            sorted.forEach(name => {
                const m = dPlayer.worldTransforms[name];
                const j = DEFAULT_JOINTS[name];
                const img = images[name];
                if (m && img && img.complete && img.naturalWidth > 0) {
                    fbCtx.save();
                    fbCtx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
                    fbCtx.translate(j.pivotX, j.pivotY);
                    fbCtx.drawImage(img, -img.width / 2, -img.height / 2);
                    fbCtx.restore();
                }
            });
            fbCtx.restore();
        });
    }
}

function hideAllScreens() {
    document.getElementById('stickSetupScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('charSelectScreen').classList.add('hidden');
    document.getElementById('tutorialScreen').classList.add('hidden');
    const calibOverlay = document.getElementById('calibOverlay');
    if (calibOverlay) calibOverlay.classList.add('hidden');
    document.getElementById('topHud').classList.add('opacity-0');
    document.getElementById('bottomFloorBar').classList.add('opacity-0');
}

function showStickSetupScreen() {
    gameScreen = 'stick_setup';
    hideAllScreens();
    document.getElementById('stickSetupScreen').classList.remove('hidden');
    drawFallbackStickSetupShadow();
}

function showMenuScreen() {
    gameScreen = 'menu';
    gameOver = false;
    hideAllScreens();
    document.getElementById('startScreen').classList.remove('hidden');
}

function showCharSelectScreen() {
    gameScreen = 'char_select';
    updateCharSelectUI();
    hideAllScreens();
    document.getElementById('charSelectScreen').classList.remove('hidden');
    renderCharacterSelectPreviews();
}

function showTutorialScreen() {
    gameScreen = 'tutorial';
    hideAllScreens();
    document.getElementById('tutorialScreen').classList.remove('hidden');
}

function updateCharSelectUI() {
    const p1Name = CHARACTER_ROSTER[p1CharIndex] || 'CHALAWAN';
    const p2Name = CHARACTER_ROSTER[p2CharIndex] || 'CHALAWAN';

    document.getElementById('p1CharName').textContent = p1Name;
    document.getElementById('p2CharName').textContent = p2Name;
    document.getElementById('p1HudName').textContent = p1Name;
    document.getElementById('p2HudName').textContent = p2Name;
}

function updateRoundDotsUI() {
    const dots = [
        document.getElementById('roundDot1'),
        document.getElementById('roundDot2'),
        document.getElementById('roundDot3')
    ];
    dots.forEach((dot, idx) => {
        if (!dot) return;
        if (idx < currentRound) {
            dot.classList.remove('bg-white');
            dot.classList.add('bg-black');
        } else {
            dot.classList.remove('bg-black');
            dot.classList.add('bg-white');
        }
    });
}


async function selectCharacterAndCalibrateP1() {
    if (gameScreen === 'calibrating') return;
    if (typeof startP1AutoCalibration === 'function') {
        await startP1AutoCalibration();
    }
    startNewMatch();
}

function startNewMatch() {
    currentRound = 1;
    gameScreen = 'playing';
    hideAllScreens();
    updateRoundDotsUI();
    restartGame();
}

function advanceRoundOrReturnToMenu() {
    if (currentRound < TOTAL_ROUNDS) {
        currentRound++;
        updateRoundDotsUI();
        restartGame();
    } else {
        currentRound = 1;
        updateRoundDotsUI();
        showMenuScreen();
    }
}


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
showMenuScreen();
