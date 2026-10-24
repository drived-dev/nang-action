let bleDevice = null;
let bleCharacteristic = null;

let IMU_PROFILES = {
    left: {
        'IDLE': { r: 0, p: 0, y: 0 },
        'LEFT': { r: -45, p: 0, y: 0 },
        'RIGHT': { r: 45, p: 0, y: 0 },
        'FORWARD': { r: 0, p: -45, y: 0 },
        'BACKWARD': { r: 0, p: 45, y: 0 }
    },
    right: {
        'IDLE': { r: 0, p: 0, y: 0 },
        'LEFT': { r: -45, p: 0, y: 0 },
        'RIGHT': { r: 45, p: 0, y: 0 },
        'FORWARD': { r: 0, p: -45, y: 0 },
        'BACKWARD': { r: 0, p: 45, y: 0 }
    }
};

let p1RawData = {
    left: { roll: 0, pitch: 0, yaw: 0 },
    right: { roll: 0, pitch: 0, yaw: 0 }
};

let p1PreviousAction = "IDLE";
let p1ImuActive = false;
const P1_POSE_CAPTURE_MS = 2000;
const P1_SENSOR_HISTORY_MS = 10000;
const P1_PROFILE_NEIGHBORS = 3;
const P1_PROFILE_DISTANCE_SCALE = 20;
const P1_TRIGGER_THRESHOLD = 0.40;
const P1_YAW_WEIGHT = 0.10;
let p1SensorHistory = [];

const P1_ACTION_CONFIRM_MS = 180;
let p1PendingAction = "IDLE";
let p1PendingActionSince = 0;


const SEQUENCE = [
    { id: 'IDLE', title: '1. IDLE (ท่าพัก)', desc: 'ถือไม้ทั้งสองตั้งตรง นิ่งๆ' },
    { id: 'LEFT', title: '2. โยกซ้าย', desc: 'โยกไม้ทั้งสองไปทางซ้ายสุด' },
    { id: 'RIGHT', title: '3. โยกขวา', desc: 'โยกไม้ทั้งสองไปทางขวาสุด' },
    { id: 'FORWARD', title: '4. ดันไปหน้า', desc: 'ดันไม้ทั้งสองไปข้างหน้าสุด' },
    { id: 'BACKWARD', title: '5. ดึงเข้าตัว', desc: 'ดึงไม้ทั้งสองเข้าหาตัวสุด' }
];

function saveP1Pose(state) {
    if (state === 'IDLE') {
        IMU_PROFILES.left.IDLE = { r: 0, p: 0, y: 0, samples: [{ r: 0, p: 0, y: 0 }] };
        IMU_PROFILES.right.IDLE = { r: 0, p: 0, y: 0, samples: [{ r: 0, p: 0, y: 0 }] };
        p1IdleZero.left = { ...p1RawData.left };
        p1IdleZero.right = { ...p1RawData.right };
        console.log('✅ [P1 CALIBRATED - IDLE]', p1IdleZero);
        return;
    }

    const now = performance.now();
    const frames = p1SensorHistory.filter(frame => now - frame.time <= P1_POSE_CAPTURE_MS);
    for (const side of ['left', 'right']) {
        const samples = frames.map(frame => ({
            r: parseFloat(wrapDiff(frame[side].roll, p1IdleZero[side].roll).toFixed(1)),
            p: parseFloat(wrapDiff(frame[side].pitch, p1IdleZero[side].pitch).toFixed(1)),
            y: parseFloat(wrapDiff(frame[side].yaw, p1IdleZero[side].yaw).toFixed(1))
        }));


        if (!samples.length) {
            samples.push({
                r: wrapDiff(p1RawData[side].roll, p1IdleZero[side].roll),
                p: wrapDiff(p1RawData[side].pitch, p1IdleZero[side].pitch),
                y: wrapDiff(p1RawData[side].yaw, p1IdleZero[side].yaw)
            });
        }

        const mean = samples.reduce((sum, sample) => ({
            r: sum.r + sample.r / samples.length,
            p: sum.p + sample.p / samples.length,
            y: sum.y + sample.y / samples.length
        }), { r: 0, p: 0, y: 0 });
        IMU_PROFILES[side][state] = {
            r: parseFloat(mean.r.toFixed(1)),
            p: parseFloat(mean.p.toFixed(1)),
            y: parseFloat(mean.y.toFixed(1)),
            samples
        };
    }
    console.log(`✅ [P1 CALIBRATED - ${state}]`, IMU_PROFILES.left[state], IMU_PROFILES.right[state]);
}

let p1IdleZero = {
    left: { roll: 0, pitch: 0, yaw: 0 },
    right: { roll: 0, pitch: 0, yaw: 0 }
};

async function startP1AutoCalibration() {
    gameScreen = 'calibrating';
    const overlay = document.getElementById('calibOverlay');
    const title = document.getElementById('calibTitle');
    const count = document.getElementById('calibCount');
    const desc = document.getElementById('calibDesc');

    if (!overlay) return;
    overlay.classList.remove('hidden');

    for (let i = 0; i < SEQUENCE.length; i++) {
        const pose = SEQUENCE[i];
        title.textContent = pose.title;
        desc.textContent = `${pose.desc} (เก็บตัวอย่างทุกเฟรมช่วงท้าย 2 วินาที)`;
        title.className = "text-4xl sm:text-5xl font-bold mb-4 text-[#f5c400]";

        for (let c = 3; c > 0; c--) {
            count.textContent = c;
            await new Promise(r => setTimeout(r, 1000));
        }

        saveP1Pose(pose.id);
        count.textContent = "📸";
        await new Promise(r => setTimeout(r, 600));
    }

    title.textContent = "✅ เสร็จสิ้น!";
    title.className = "text-4xl sm:text-5xl font-bold mb-4 text-emerald-400";
    desc.textContent = "พร้อมเข้าสู่การต่อสู้!";
    count.textContent = "🎉";

    await new Promise(r => setTimeout(r, 1500));
    overlay.classList.add('hidden');
}


function wrapDiff(currentAngle, referenceAngle) {
    let diff = (currentAngle - referenceAngle) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff;
}

function getP1RelativeAngles(stickRaw, side) {
    return {
        r: wrapDiff(stickRaw.roll, p1IdleZero[side].roll),
        p: wrapDiff(stickRaw.pitch, p1IdleZero[side].pitch),
        y: wrapDiff(stickRaw.yaw, p1IdleZero[side].yaw)
    };
}

function computeP1PoseScores(stickRaw, side) {
    const cur = getP1RelativeAngles(stickRaw, side);
    const scores = { LEFT: 0, RIGHT: 0, FORWARD: 0, BACKWARD: 0 };
    const curMagnitude = Math.sqrt(cur.r ** 2 + cur.p ** 2 + (cur.y * P1_YAW_WEIGHT) ** 2);
    if (curMagnitude < 5) return scores;

    for (const state of Object.keys(scores)) {
        const profile = IMU_PROFILES[side][state];
        if (!profile) continue;

        const samples = Array.isArray(profile.samples) && profile.samples.length ? profile.samples : [profile];
        const distances = samples.map(sample => Math.sqrt(
            wrapDiff(cur.r, sample.r) ** 2 +
            wrapDiff(cur.p, sample.p) ** 2 +
            (wrapDiff(cur.y, sample.y) * P1_YAW_WEIGHT) ** 2
        )).sort((a, b) => a - b);
        const nearest = distances.slice(0, Math.min(P1_PROFILE_NEIGHBORS, distances.length));
        const nearestAverage = nearest.reduce((sum, distance) => sum + distance, 0) / nearest.length;
        scores[state] = 1 / (1 + nearestAverage / P1_PROFILE_DISTANCE_SCALE);
    }
    return scores;
}

function resolveP1Pose(scores) {
    const L = scores.LEFT || 0;
    const R = scores.RIGHT || 0;
    const F = scores.FORWARD || 0;
    const B = scores.BACKWARD || 0;
    const maxValue = Math.max(L, R, F, B);
    if (maxValue < P1_TRIGGER_THRESHOLD) return 'IDLE';
    if (B >= P1_TRIGGER_THRESHOLD && R >= P1_TRIGGER_THRESHOLD && B >= R * 0.70) return 'BACKWARD';
    if (maxValue === F) return 'FORWARD';
    if (maxValue === R) return 'RIGHT';
    if (maxValue === L) return 'LEFT';
    if (maxValue === B) return 'BACKWARD';
    return 'IDLE';
}

function classifyP1Stick(stickRaw, side) {
    return resolveP1Pose(computeP1PoseScores(stickRaw, side));
}


function checkBothSticksConnected() {
    const btnStickNext = document.getElementById('btnStickNext');
    if (leftStickConnected && rightStickConnected && btnStickNext) {
        btnStickNext.classList.remove('hidden');
        btnStickNext.classList.add('flex');
    }
}


function dataViewToHexString(dataView) {
    const hexBytes = [];
    for (let i = 0; i < dataView.byteLength; i++) {
        const byteHex = dataView.getUint8(i).toString(16).toUpperCase().padStart(2, '0');
        hexBytes.push(byteHex);
    }

    const groupedWords = [];
    for (let i = 0; i < hexBytes.length; i += 2) {
        groupedWords.push(hexBytes.slice(i, i + 2).join(''));
    }
    return groupedWords.join(' ');
}


function dataViewToFloatArray(dataView) {
    const floats = [];
    for (let i = 0; i + 4 <= dataView.byteLength; i += 4) {
        floats.push(Number(dataView.getFloat32(i, true).toFixed(2)));
    }
    return floats;
}


function parseP1ImuDataView(dataView) {
    if (dataView.byteLength >= 24) {
        p1RawData.right.roll = dataView.getFloat32(0, true);
        p1RawData.right.pitch = dataView.getFloat32(4, true);
        p1RawData.right.yaw = dataView.getFloat32(8, true);

        p1RawData.left.roll = dataView.getFloat32(12, true);
        p1RawData.left.pitch = dataView.getFloat32(16, true);
        p1RawData.left.yaw = dataView.getFloat32(20, true);
        p1ImuActive = true;

        const now = performance.now();
        p1SensorHistory.push({
            time: now,
            left: { ...p1RawData.left },
            right: { ...p1RawData.right }
        });
        p1SensorHistory = p1SensorHistory.filter(frame => now - frame.time <= P1_SENSOR_HISTORY_MS);
    }
}


async function searchAndConnectLeftStickBLE() {
    const btnConnectLeft = document.getElementById('btnConnectLeft');
    const leftStickGraphic = document.getElementById('leftStickGraphic');
    const btnStickNext = document.getElementById('btnStickNext');

    if (!navigator.bluetooth) {
        console.error('❌ เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth API (กรุณาเปิดด้วย Chrome หรือ Edge บน localhost / HTTPS)');
        alert('กรุณาเปิดผ่าน Google Chrome หรือ Microsoft Edge บน localhost หรือ HTTPS เพื่อใช้งาน Bluetooth');
        return;
    }

    try {
        btnConnectLeft.textContent = 'SEARCHING...';

        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [
                { services: [BLE_SERVICE_UUID] }
            ]
        });

        console.log(`🔍 พบและเลือกอุปกรณ์: ${bleDevice.name || 'Unnamed'} (${bleDevice.id})`);
        btnConnectLeft.textContent = 'CONNECTING...';

        bleDevice.addEventListener('gattserverdisconnected', () => {
            console.warn('⚠️ ESP32 BLE หลุดการเชื่อมต่อ (Disconnected)');
            leftStickConnected = false;
            p1ImuActive = false;
            leftStickGraphic.classList.add('hidden');
            btnConnectLeft.textContent = 'CONNECT';
            btnConnectLeft.classList.remove('hidden');
            if (btnStickNext) {
                btnStickNext.classList.add('hidden');
                btnStickNext.classList.remove('flex');
            }
        });

        const server = await bleDevice.gatt.connect();
        console.log('✅ เชื่อมต่อ GATT Server สำเร็จ กำลังค้นหา Service & Characteristic...');

        let targetCharacteristic = null;

        try {
            const service = await server.getPrimaryService(BLE_SERVICE_UUID);
            targetCharacteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);
        } catch (uuidErr) {
            console.log('🔎 กำลังค้นหา Characteristic ที่รองรับ Notify อัตโนมัติ...');
            const services = await server.getPrimaryServices();
            for (const svc of services) {
                const chars = await svc.getCharacteristics();
                for (const ch of chars) {
                    if (ch.properties.notify || ch.properties.indicate || ch.properties.read) {
                        targetCharacteristic = ch;
                        break;
                    }
                }
                if (targetCharacteristic) break;
            }
        }

        if (!targetCharacteristic) {
            throw new Error('ไม่พบ Characteristic สำหรับรับข้อมูลจากอุปกรณ์นี้');
        }

        bleCharacteristic = targetCharacteristic;

        bleCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
            const dataView = event.target.value;
            parseP1ImuDataView(dataView);

            const hexString = dataViewToHexString(dataView);
            const floatValues = dataViewToFloatArray(dataView);
            console.log(`[BLE HEX] ${hexString}`, floatValues.length ? `| Values: [${floatValues.join(', ')}]` : '');
        });

        if (bleCharacteristic.properties.notify || bleCharacteristic.properties.indicate) {
            await bleCharacteristic.startNotifications();
            console.log(`📡 เริ่มรับข้อมูล BLE Notifications จาก [${bleCharacteristic.uuid}] สำเร็จ!`);
        }

        if (bleCharacteristic.properties.read) {
            const initialVal = await bleCharacteristic.readValue();
            parseP1ImuDataView(initialVal);
            console.log(`[BLE INITIAL READ HEX] ${dataViewToHexString(initialVal)}`);
        }

        leftStickConnected = true;
        btnConnectLeft.classList.add('hidden');
        leftStickGraphic.classList.remove('hidden');
        checkBothSticksConnected();

    } catch (error) {
        console.error('❌ ยกเลิกการค้นหาหรือเชื่อมต่อ BLE ไม่สำเร็จ:', error);
        btnConnectLeft.textContent = 'CONNECT';
    }
}

function setupInputListeners() {

    const btnConnectLeft = document.getElementById('btnConnectLeft');
    const btnConnectRight = document.getElementById('btnConnectRight');
    const rightStickGraphic = document.getElementById('rightStickGraphic');
    const btnStickNext = document.getElementById('btnStickNext');


    if (btnConnectLeft) {
        btnConnectLeft.addEventListener('click', () => {
            searchAndConnectLeftStickBLE();
        });
    }


    if (btnConnectRight) {
        btnConnectRight.addEventListener('click', () => {
            rightStickConnected = true;
            btnConnectRight.classList.add('hidden');
            rightStickGraphic.classList.remove('hidden');
            checkBothSticksConnected();
        });
    }

    if (btnStickNext) {
        btnStickNext.addEventListener('click', (e) => {
            e.stopPropagation();
            showMenuScreen();
        });
    }


    document.getElementById('btnGameStart').addEventListener('click', () => {
        showCharSelectScreen();
    });

    document.getElementById('btnTutorial').addEventListener('click', () => {
        showTutorialScreen();
    });


    const charThumbChalawan = document.getElementById('charThumbChalawan');
    const charPreviewContainer = document.getElementById('charPreviewContainer');

    if (charThumbChalawan) {
        charThumbChalawan.addEventListener('click', () => {
            selectCharacterAndCalibrateP1();
        });
    }

    if (charPreviewContainer) {
        charPreviewContainer.addEventListener('click', () => {
            selectCharacterAndCalibrateP1();
        });
    }


    document.getElementById('btnBackToMenu').addEventListener('click', () => {
        showMenuScreen();
    });


    window.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        keys[e.key] = true;
        keys[e.code] = true;

        if (gameScreen === 'char_select') {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                selectCharacterAndCalibrateP1();
            } else if (e.code === 'Escape') {
                showMenuScreen();
            }
            return;
        }

        if (gameScreen !== 'playing') return;

        if (gameOver) {
            if (gameOverTimer > 75 && (e.code === 'KeyR' || e.code === 'Space' || e.code === 'Enter')) {
                advanceRoundOrReturnToMenu();
            }
            return;
        }

        if (!e.repeat) {
            if (e.code === 'Space') {
                startCharging(p1);
            }
            if (e.code === 'Enter') {
                startCharging(p2);
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
        keys[e.key] = false;
        keys[e.code] = false;

        if (gameScreen !== 'playing') return;

        if (!gameOver) {
            if (e.code === 'Space') {
                releaseChargeAndSlash(p1);
            }
            if (e.code === 'Enter') {
                releaseChargeAndSlash(p2);
            }
        }
    });

    window.addEventListener('mousedown', () => {
        if (gameScreen === 'playing' && gameOver && gameOverTimer > 60) {
            advanceRoundOrReturnToMenu();
        }
    });
}

function handlePlayerControls() {
    if (gameScreen !== 'playing') return;


    if (keys['q'] || keys['Q']) {
        p1.handAimAngle = Math.max(HAND_MIN_ANGLE, p1.handAimAngle - HAND_CONTROL_SPEED);
    }
    if (keys['e'] || keys['E']) {
        p1.handAimAngle = Math.min(HAND_MAX_ANGLE, p1.handAimAngle + HAND_CONTROL_SPEED);
    }


    if (keys['u'] || keys['U'] || keys[','] || keys['<']) {
        p2.handAimAngle = Math.max(HAND_MIN_ANGLE, p2.handAimAngle - HAND_CONTROL_SPEED);
    }
    if (keys['o'] || keys['O'] || keys['.'] || keys['>']) {
        p2.handAimAngle = Math.min(HAND_MAX_ANGLE, p2.handAimAngle + HAND_CONTROL_SPEED);
    }


    let p1MoveX = 0, p1MoveY = 0;
    if (keys['w'] || keys['W']) p1MoveY -= MOVE_SPEED;
    if (keys['s'] || keys['S']) p1MoveY += MOVE_SPEED;
    if (keys['a'] || keys['A']) p1MoveX -= MOVE_SPEED;
    if (keys['d'] || keys['D']) p1MoveX += MOVE_SPEED;


    if (leftStickConnected && p1ImuActive) {
        const lState = classifyP1Stick(p1RawData.left, 'left');
        const rState = classifyP1Stick(p1RawData.right, 'right');

        let action = "IDLE";

        if (lState === rState && lState !== 'IDLE') {
            if (lState === "LEFT") action = "MOVE LEFT";
            else if (lState === "RIGHT") action = "MOVE RIGHT";
            else if (lState === "FORWARD") action = "MOVE UP (FORWARD)";
            else if (lState === "BACKWARD") action = "MOVE DOWN (BACKWARD)";
        } else if (lState === 'IDLE') {
            if (rState === "LEFT") {
                action = "⚔️ CHARGING PULL";
            } else if (rState === "RIGHT") {
                action = "💥 SLASH ATTACK!";
            } else {



                action = "IDLE";
            }
        }




        const now = performance.now();
        if (action !== p1PendingAction) {
            p1PendingAction = action;
            p1PendingActionSince = now;
        }
        if (action !== p1PreviousAction && now - p1PendingActionSince < P1_ACTION_CONFIRM_MS) {
            action = p1PreviousAction;
        }


        let triggerReleaseAttack = false;
        if (p1PreviousAction === "⚔️ CHARGING PULL" && action === "IDLE") {
            triggerReleaseAttack = true;
        }


        if (action === "MOVE LEFT") p1MoveX -= MOVE_SPEED;
        if (action === "MOVE RIGHT") p1MoveX += MOVE_SPEED;
        if (action === "MOVE UP (FORWARD)") p1MoveY -= MOVE_SPEED;
        if (action === "MOVE DOWN (BACKWARD)") p1MoveY += MOVE_SPEED;

        if (action === "⚔️ CHARGING PULL") {
            startCharging(p1);
        } else if (action === "💥 SLASH ATTACK!") {
            if (p1.isCharging) {
                releaseChargeAndSlash(p1);
            } else if (!p1.isSlashing && p1PreviousAction !== "💥 SLASH ATTACK!") {
                startCharging(p1);
                releaseChargeAndSlash(p1);
            }
        } else if (triggerReleaseAttack) {
            if (p1.isCharging && !keys['Space']) {
                releaseChargeAndSlash(p1);
            }
        }

        p1PreviousAction = action;
    }

    updateMovementKinematics(p1, p1MoveX, p1MoveY);


    let p2MoveX = 0, p2MoveY = 0;
    if (keys['ArrowUp'] || keys['i'] || keys['I']) p2MoveY -= MOVE_SPEED;
    if (keys['ArrowDown'] || keys['k'] || keys['K']) p2MoveY += MOVE_SPEED;
    if (keys['ArrowLeft'] || keys['j'] || keys['J']) p2MoveX -= MOVE_SPEED;
    if (keys['ArrowRight'] || keys['l'] || keys['L']) p2MoveX += MOVE_SPEED;
    updateMovementKinematics(p2, p2MoveX, p2MoveY);
}
