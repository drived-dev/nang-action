// =========================================================================
// 🎮 3. BLE SEARCH & CONNECT (LEFT STICK), HEX LOGGER & KEYBOARD INPUTS
// =========================================================================

// UUID จากบอร์ด ESP32_IM
const BLE_SERVICE_UUID        = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const BLE_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

let bleDevice = null;
let bleCharacteristic = null;

// เช็คว่าเชื่อมครบทั้งซ้ายและขวาหรือยัง ถ้าครบแล้วให้แสดงปุ่มลูกศรสีเหลืองด้านล่าง
function checkBothSticksConnected() {
    const btnStickNext = document.getElementById('btnStickNext');
    if (leftStickConnected && rightStickConnected && btnStickNext) {
        btnStickNext.classList.remove('hidden');
        btnStickNext.classList.add('flex');
    }
}

// แปลงข้อมูล DataView ที่รับมาจาก ESP32 เป็น HEX String เช่น "116E 7242 0B72 21C0..."
// ฟังก์ชันแปลงข้อมูล DataView ที่รับมาจาก BLE เป็น HEX String
function dataViewToHexString(dataView) {
    const hexBytes = [];
    for (let i = 0; i < dataView.byteLength; i++) {
        const byteHex = dataView.getUint8(i).toString(16).toUpperCase().padStart(2, '0');
        hexBytes.push(byteHex);
    }

    // จัดกลุ่มละ 2 Bytes (4 ตัวอักษร HEX) คั่นด้วยช่องว่าง
    const groupedWords = [];
    for (let i = 0; i < hexBytes.length; i += 2) {
        groupedWords.push(hexBytes.slice(i, i + 2).join(''));
    }
    return groupedWords.join(' ');
}

// ส่วนที่ผูกกับ Event เมื่อมีข้อมูลส่งเข้ามา
bleCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
    const dataView = event.target.value; // DataView
    const hexString = dataViewToHexString(dataView);

    // ปริ้นท์ค่า HEX ลงใน Browser Console (Terminal)
    console.log(`[ESP32 HEX] ${hexString}`);
});


// แปลงข้อมูล DataView เป็น Array ของเลขทศนิยม Float32 (Little-Endian) เผื่อดูค่ามุมคู่กับ HEX
function dataViewToFloatArray(dataView) {
    const floats = [];
    for (let i = 0; i + 4 <= dataView.byteLength; i += 4) {
        floats.push(Number(dataView.getFloat32(i, true).toFixed(2)));
    }
    return floats;
}

// ฟังก์ชัน Search ค้นหาและเชื่อมต่อ BLE สำหรับปุ่ม CONNECT ฝั่งซ้าย
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

        // ค้นหาเฉพาะบอร์ดที่ปล่อย Service UUID ตรงกับ ESP32 เท่านั้น (ไม่ต้องสนชื่อ)
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [
                { services: [BLE_SERVICE_UUID] } // ใช้ UUID เป็นตัวกรองหลัก
            ]
        });


        console.log(`🔍 พบและเลือกอุปกรณ์: ${bleDevice.name || 'Unnamed'} (${bleDevice.id})`);
        btnConnectLeft.textContent = 'CONNECTING...';

        // กรณีสายหลุดหรือบอร์ดปิด ให้ปุ่ม CONNECT ฝั่งซ้ายกลับมาแสดงใหม่
        bleDevice.addEventListener('gattserverdisconnected', () => {
            console.warn('⚠️ ESP32 BLE หลุดการเชื่อมต่อ (Disconnected)');
            leftStickConnected = false;
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
            // 1. ค้นหาจาก UUID หลักของ ESP32_IM โดยตรง
            const service = await server.getPrimaryService(BLE_SERVICE_UUID);
            targetCharacteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);
        } catch (uuidErr) {
            // 2. Fallback: ถ้าค้นหาตรงๆ ไม่เจอ ให้กวาดหาทุก Service ที่มี Characteristic แบบ Notify
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

        // ผูก Event รับข้อมูลทุกครั้งที่ ESP32 ส่งค่ามา แล้วปริ้นท์ HEX ลงใน Terminal (Console)
        bleCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
            const dataView = event.target.value;
            const hexString = dataViewToHexString(dataView);
            const floatValues = dataViewToFloatArray(dataView);

            // ปริ้นท์ค่า HEX ลง Terminal ตามที่ต้องการ
            console.log(`[BLE HEX] ${hexString}`, floatValues.length ? `| Values: [${floatValues.join(', ')}]` : '');
        });

        // เริ่มเปิดรับสัญญาณ Notify
        if (bleCharacteristic.properties.notify || bleCharacteristic.properties.indicate) {
            await bleCharacteristic.startNotifications();
            console.log(`📡 เริ่มรับข้อมูล BLE Notifications จาก [${bleCharacteristic.uuid}] สำเร็จ!`);
        }

        // อ่านค่าครั้งแรกทันที (Last Read) หากรองรับการ Read
        if (bleCharacteristic.properties.read) {
            const initialVal = await bleCharacteristic.readValue();
            console.log(`[BLE INITIAL READ HEX] ${dataViewToHexString(initialVal)}`);
        }

        // เปลี่ยนปุ่ม CONNECT ฝั่งซ้ายเป็นรูปไม้เชิดเหมือนเดิม
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

    // ปุ่มซ้าย: กดเพื่อ Search ค้นหาและเชื่อมต่อ BLE กับ ESP32
    if (btnConnectLeft) {
        btnConnectLeft.addEventListener('click', () => {
            searchAndConnectLeftStickBLE();
        });
    }

    // ปุ่มขวา: กดแล้วเปลี่ยนเป็นรูปไม้เชิดฝั่งขวา (Placeholder)
    if (btnConnectRight) {
        btnConnectRight.addEventListener('click', () => {
            rightStickConnected = true;
            btnConnectRight.classList.add('hidden');
            rightStickGraphic.classList.remove('hidden');
            checkBothSticksConnected();
        });
    }

    // ปุ่มลูกศรกลมสีเหลืองด้านล่าง (แสดงเมื่อทั้งซ้ายและขวาขึ้นรูปไม้เชิดครบแล้ว)
    if (btnStickNext) {
        btnStickNext.addEventListener('click', (e) => {
            e.stopPropagation();
            showMenuScreen();
        });
    }

    // 1. ปุ่มในหน้า Start Menu (NANG ACTION)
    document.getElementById('btnGameStart').addEventListener('click', () => {
        showCharSelectScreen();
    });

    document.getElementById('btnTutorial').addEventListener('click', () => {
        showTutorialScreen();
    });

    // 2. หน้าเลือกตัวละคร (SELECT YOUR NANG)
    const charThumbChalawan = document.getElementById('charThumbChalawan');
    const charPreviewContainer = document.getElementById('charPreviewContainer');

    if (charThumbChalawan) {
        charThumbChalawan.addEventListener('click', () => {
            startNewMatch();
        });
    }

    if (charPreviewContainer) {
        charPreviewContainer.addEventListener('click', () => {
            startNewMatch();
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
                startNewMatch();
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

    // คลิกเมาส์ที่หน้าจอประกาศผลเพื่อไปตาถัดไป หรือกลับหน้าเมนูเมื่อครบ 3 รอบ
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

    // P1 MOVEMENT (WASD)
    let p1MoveX = 0, p1MoveY = 0;
    if (keys['w'] || keys['W']) p1MoveY -= MOVE_SPEED;
    if (keys['s'] || keys['S']) p1MoveY += MOVE_SPEED;
    if (keys['a'] || keys['A']) p1MoveX -= MOVE_SPEED;
    if (keys['d'] || keys['D']) p1MoveX += MOVE_SPEED;
    updateMovementKinematics(p1, p1MoveX, p1MoveY);

    // P2 MOVEMENT (Arrows or IJKL)
    let p2MoveX = 0, p2MoveY = 0;
    if (keys['ArrowUp'] || keys['i'] || keys['I']) p2MoveY -= MOVE_SPEED;
    if (keys['ArrowDown'] || keys['k'] || keys['K']) p2MoveY += MOVE_SPEED;
    if (keys['ArrowLeft'] || keys['j'] || keys['J']) p2MoveX -= MOVE_SPEED;
    if (keys['ArrowRight'] || keys['l'] || keys['L']) p2MoveX += MOVE_SPEED;
    updateMovementKinematics(p2, p2MoveX, p2MoveY);
}
