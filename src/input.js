function setupInputListeners() {

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
            startNewMatch();
        });
    }

    if (charPreviewContainer) {
        charPreviewContainer.addEventListener('click', () => {
            startNewMatch();
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


    updateMovementKinematics(p1, p1MoveX, p1MoveY);


    let p2MoveX = 0, p2MoveY = 0;
    if (keys['ArrowUp'] || keys['i'] || keys['I']) p2MoveY -= MOVE_SPEED;
    if (keys['ArrowDown'] || keys['k'] || keys['K']) p2MoveY += MOVE_SPEED;
    if (keys['ArrowLeft'] || keys['j'] || keys['J']) p2MoveX -= MOVE_SPEED;
    if (keys['ArrowRight'] || keys['l'] || keys['L']) p2MoveX += MOVE_SPEED;
    updateMovementKinematics(p2, p2MoveX, p2MoveY);
}
