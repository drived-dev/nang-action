// =========================================================================
// 🎮 3. BLE SEARCH & CONNECT (P1), 5-POSE AUTO CALIBRATION & INPUT CONTROLS
// =========================================================================

// UUID จากบอร์ด ESP32_IM
const BLE_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const BLE_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

let bleDevice = null;
let bleCharacteristic = null;

// ================= ALGORITHM & PROFILE STATE (P1) =================
// สามารถนำโค้ดที่กด Export จากหน้า Pose Trainer มาวางทับ 2 ตัวแปรด้านล่างนี้ได้ทันที
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
let IDLE_BIAS = 30;

let p1RawData = {
    left: { roll: 0, pitch: 0, yaw: 0 },
    right: { roll: 0, pitch: 0, yaw: 0 }
};

let p1PreviousAction = "IDLE";
let p1ImuActive = false;
// Ignore brief pose transitions so an initial tilt is not treated as a command.
const P1_ACTION_CONFIRM_MS = 180;
let p1PendingAction = "IDLE";
let p1PendingActionSince = 0;

// ================= AUTO TRAINING (5 ท่าสำหรับ P1) =================
const SEQUENCE = [
    { id: 'IDLE', title: '1. IDLE (ท่าพัก)', desc: 'ถือไม้ทั้งสองตั้งตรง นิ่งๆ' },
    { id: 'LEFT', title: '2. โยกซ้าย', desc: 'โยกไม้ทั้งสองไปทางซ้ายสุด' },
    { id: 'RIGHT', title: '3. โยกขวา', desc: 'โยกไม้ทั้งสองไปทางขวาสุด' },
    { id: 'FORWARD', title: '4. ดันไปหน้า', desc: 'ดันไม้ทั้งสองไปข้างหน้าสุด' },
    { id: 'BACKWARD', title: '5. ดึงเข้าตัว', desc: 'ดึงไม้ทั้งสองเข้าหาตัวสุด' }
];

function saveP1Pose(state) {
    IMU_PROFILES.left[state] = { r: p1RawData.left.roll, p: p1RawData.left.pitch, y: p1RawData.left.yaw };
    IMU_PROFILES.right[state] = { r: p1RawData.right.roll, p: p1RawData.right.pitch, y: p1RawData.right.yaw };
    console.log(`✅ [P1 CALIBRATED - ${state}]`, IMU_PROFILES.left[state], IMU_PROFILES.right[state]);
}

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
        desc.textContent = pose.desc;
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

// ================= INDEPENDENT STICK CLASSIFICATION =================
function angleDiff(a, b) {
    let diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
}

function classifyP1Stick(stickRaw, side) {
    let bestMatch = 'IDLE';
    let minDistance = Infinity;

    for (const [state, target] of Object.entries(IMU_PROFILES[side])) {
        let dr = angleDiff(stickRaw.roll, target.r);
        let dp = angleDiff(stickRaw.pitch, target.p);
        let dy = angleDiff(stickRaw.yaw, target.y) * 0.5;

        let dist = Math.sqrt(dr * dr + dp * dp + dy * dy);

        if (state === 'IDLE') dist -= IDLE_BIAS;

        if (dist < minDistance) {
            minDistance = dist;
            bestMatch = state;
        }
    }
    return bestMatch;
}

// เช็คว่าเชื่อมครบทั้งซ้ายและขวาหรือยัง ถ้าครบแล้วให้แสดงปุ่มลูกศรสีเหลืองด้านล่าง
function checkBothSticksConnected() {
    const btnStickNext = document.getElementById('btnStickNext');
    if (leftStickConnected && rightStickConnected && btnStickNext) {
        btnStickNext.classList.remove('hidden');
        btnStickNext.classList.add('flex');
    }
}

// แปลงข้อมูล DataView ที่รับมาจาก BLE เป็น HEX String
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

// แปลงข้อมูล DataView เป็น Array ของเลขทศนิยม Float32 (Little-Endian)
function dataViewToFloatArray(dataView) {
    const floats = [];
    for (let i = 0; i + 4 <= dataView.byteLength; i += 4) {
        floats.push(Number(dataView.getFloat32(i, true).toFixed(2)));
    }
    return floats;
}

// อัปเดตค่า IMU ของ P1 จาก DataView (12 ไบต์แรก = ไม้ขวา, 12 ไบต์หลัง = ไม้ซ้าย)
function parseP1ImuDataView(dataView) {
    if (dataView.byteLength >= 24) {
        p1RawData.right.roll = dataView.getFloat32(0, true);
        p1RawData.right.pitch = dataView.getFloat32(4, true);
        p1RawData.right.yaw = dataView.getFloat32(8, true);

        p1RawData.left.roll = dataView.getFloat32(12, true);
        p1RawData.left.pitch = dataView.getFloat32(16, true);
        p1RawData.left.yaw = dataView.getFloat32(20, true);
        p1ImuActive = true;
    }
}

// ฟังก์ชัน Search ค้นหาและเชื่อมต่อ BLE สำหรับปุ่ม CONNECT ฝั่งซ้าย (P1)
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
    // 0. ปุ่มในหน้า Stick Setup
    const btnConnectLeft = document.getElementById('btnConnectLeft');
    const btnConnectRight = document.getElementById('btnConnectRight');
    const rightStickGraphic = document.getElementById('rightStickGraphic');
    const btnStickNext = document.getElementById('btnStickNext');

    // ปุ่มซ้าย (P1): กดเพื่อเชื่อมต่อ BLE กับ ESP32
    if (btnConnectLeft) {
        btnConnectLeft.addEventListener('click', () => {
            searchAndConnectLeftStickBLE();
        });
    }

    // ปุ่มขวา (P2): Placeholder กดแล้วเปลี่ยนเป็นรูปไม้เชิดทันที
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

    // 1. ปุ่มในหน้า Start Menu
    document.getElementById('btnGameStart').addEventListener('click', () => {
        showCharSelectScreen();
    });

    document.getElementById('btnTutorial').addEventListener('click', () => {
        showTutorialScreen();
    });

    // 2. หน้าเลือกตัวละคร (SELECT YOUR NANG) -> กดแล้วเริ่ม Calibrate P1 ทั้ง 5 ท่าก่อนเข้าเกม
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

    // 3. ปุ่มในหน้า Tutorial
    document.getElementById('btnBackToMenu').addEventListener('click', () => {
        showMenuScreen();
    });

    // 4. ปุ่มคีย์บอร์ด
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

    // P1 HAND CONTROL (Q/E)
    if (keys['q'] || keys['Q']) {
        p1.handAimAngle = Math.max(HAND_MIN_ANGLE, p1.handAimAngle - HAND_CONTROL_SPEED);
    }
    if (keys['e'] || keys['E']) {
        p1.handAimAngle = Math.min(HAND_MAX_ANGLE, p1.handAimAngle + HAND_CONTROL_SPEED);
    }

    // P2 HAND CONTROL (U/O หรือ ,/.)
    if (keys['u'] || keys['U'] || keys[','] || keys['<']) {
        p2.handAimAngle = Math.max(HAND_MIN_ANGLE, p2.handAimAngle - HAND_CONTROL_SPEED);
    }
    if (keys['o'] || keys['O'] || keys['.'] || keys['>']) {
        p2.handAimAngle = Math.min(HAND_MAX_ANGLE, p2.handAimAngle + HAND_CONTROL_SPEED);
    }

    // P1 MOVEMENT (WASD + Independent Left/Right Stick IMU)
    let p1MoveX = 0, p1MoveY = 0;
    if (keys['w'] || keys['W']) p1MoveY -= MOVE_SPEED;
    if (keys['s'] || keys['S']) p1MoveY += MOVE_SPEED;
    if (keys['a'] || keys['A']) p1MoveX -= MOVE_SPEED;
    if (keys['d'] || keys['D']) p1MoveX += MOVE_SPEED;

    // ประมวลผลท่าทาง P1 จากอัลกอริทึมแยกซ้าย-ขวาอิสระ
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
                // READY TO ATTACK is the debugger's neutral/IDLE state.
                // Only the right-stick LEFT/RIGHT poses are attack actions;
                // neutral, FORWARD, and BACKWARD on the right stick stay IDLE.
                action = "IDLE";
            }
        }

        // Require a pose to remain stable briefly before acting on it.
        // This is especially useful for distinguishing a deliberate charge
        // gesture from the transitional tilt on the way into a pose.
        const now = performance.now();
        if (action !== p1PendingAction) {
            p1PendingAction = action;
            p1PendingActionSince = now;
        }
        if (action !== p1PreviousAction && now - p1PendingActionSince < P1_ACTION_CONFIRM_MS) {
            action = p1PreviousAction;
        }

        // เงื่อนไขดึงชาร์จแล้วปล่อยกลับท่าพัก -> ปล่อยโจมตี!
        let triggerReleaseAttack = false;
        if (p1PreviousAction === "⚔️ CHARGING PULL" && action === "IDLE") {
            triggerReleaseAttack = true;
        }

        // แปลง Action เป็นการเคลื่อนที่และการฟันของ P1
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

    // P2 MOVEMENT (Arrows or IJKL - Placeholder)
    let p2MoveX = 0, p2MoveY = 0;
    if (keys['ArrowUp'] || keys['i'] || keys['I']) p2MoveY -= MOVE_SPEED;
    if (keys['ArrowDown'] || keys['k'] || keys['K']) p2MoveY += MOVE_SPEED;
    if (keys['ArrowLeft'] || keys['j'] || keys['J']) p2MoveX -= MOVE_SPEED;
    if (keys['ArrowRight'] || keys['l'] || keys['L']) p2MoveX += MOVE_SPEED;
    updateMovementKinematics(p2, p2MoveX, p2MoveY);
}
