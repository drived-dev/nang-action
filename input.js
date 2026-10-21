// =========================================================================
// 🎮 3. KEYBOARD, MENU BUTTONS & CLICK INPUTS
// =========================================================================

function setupInputListeners() {
    // ปุ่มในหน้า Start Menu และหน้า Tutorial Placeholder
    // ทั้งปุ่ม GAME START และปุ่ม TUTORIAL จะพาเข้าสู่หน้า Tutorial Placeholder ก่อนตามที่ต้องการ
    document.getElementById('btnGameStart').addEventListener('click', () => {
        showTutorialScreen();
    });

    document.getElementById('btnTutorial').addEventListener('click', () => {
        showTutorialScreen();
    });

    document.getElementById('btnBackToMenu').addEventListener('click', () => {
        showMenuScreen();
    });

    document.getElementById('btnSkipToFight').addEventListener('click', () => {
        startBattleArena();
    });

    window.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        keys[e.key] = true;
        keys[e.code] = true;

        // รับคำสั่งเฉพาะเมื่ออยู่ในโหมดการเล่นจริง ('playing') เท่านั้น
        if (gameScreen !== 'playing') return;

        if (gameOver) {
            // หลังจบเกมผ่านไปสักครู่ กด R, Space หรือ Enter เพื่อเริ่มเกมใหม่ได้
            if (gameOverTimer > 75 && (e.code === 'KeyR' || e.code === 'Space' || e.code === 'Enter')) {
                restartGame();
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

    // คลิกเมาส์ที่หน้าจอประกาศผลเพื่อเริ่มรอบใหม่ได้เช่นกัน
    window.addEventListener('mousedown', () => {
        if (gameScreen === 'playing' && gameOver && gameOverTimer > 60) {
            restartGame();
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
