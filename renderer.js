// =========================================================================
// 🎨 5. RENDER PLAYER, SWORD SLATE BLOCK (#6D8196) & MAIN LOOP
// =========================================================================

function drawSwordRedAura(img, auraIntensity) {
    const pulse = 0.85 + Math.sin(performance.now() * 0.025) * 0.15;
    const glowRadiusOuter = (14 + auraIntensity * 26) * pulse;
    const glowRadiusInner = (6 + auraIntensity * 12) * pulse;

    ctx.save();

    const bladeHalfH = (img && img.complete && img.naturalWidth !== 0) ? (img.height * 0.48) : 175;
    const bladeHalfW = (img && img.complete && img.naturalWidth !== 0) ? (img.width * 0.38) : 18;

    const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, bladeHalfH);
    grad.addColorStop(0, `rgba(239, 68, 68, ${(0.45 + auraIntensity * 0.4) * pulse})`);
    grad.addColorStop(0.6, `rgba(220, 38, 38, ${(0.25 + auraIntensity * 0.35) * pulse})`);
    grad.addColorStop(1, 'rgba(220, 38, 38, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -10, bladeHalfW + auraIntensity * 22 * pulse, bladeHalfH + 18, 0, 0, Math.PI * 2);
    ctx.fill();

    if (img && img.complete && img.naturalWidth !== 0) {
        ctx.filter = `drop-shadow(0px 0px ${glowRadiusInner}px rgba(255, 80, 80, 0.95)) drop-shadow(0px 0px ${glowRadiusOuter}px rgba(220, 38, 38, 0.9))`;
        ctx.globalAlpha = Math.min(1, 0.4 + auraIntensity * 0.6);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
    } else {
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = glowRadiusOuter;
        ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + auraIntensity * 0.55})`;
        ctx.beginPath();
        ctx.roundRect(-10 - auraIntensity * 5, -176, 20 + auraIntensity * 10, 348, 12);
        ctx.fill();
    }

    ctx.restore();
}

function drawImageWithYellowKey(img) {
    ctx.save();
    if (gameOver) {
        ctx.globalCompositeOperation = 'multiply';
    }
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
}

function renderPlayer(playerObj, jointsObj) {
    const worldTransforms = playerObj.worldTransforms;
    if (!worldTransforms || !worldTransforms['upper_body']) return;

    ctx.save();
    ctx.translate(playerObj.x, playerObj.y);
    ctx.scale(playerObj.scale * playerObj.visualFacingX, playerObj.scale);

    drawPuppetSticks(playerObj, worldTransforms);

    const sortedNames = Object.keys(jointsObj).sort((a, b) => {
        return (jointsObj[a].zIndex || 0) - (jointsObj[b].zIndex || 0);
    });

    const swordAuraIntensity = getSwordAuraIntensity(playerObj);

    sortedNames.forEach(name => {
        const worldM = worldTransforms[name];
        if (!worldM) return;

        const j = jointsObj[name] || { pivotX: 0, pivotY: 0 };
        const timer = playerObj.partHitTimers[name] || 0;
        const isPartHit = !gameOver && timer > 0;

        ctx.save();
        ctx.transform(worldM[0], worldM[1], worldM[2], worldM[3], worldM[4], worldM[5]);

        ctx.save();
        ctx.translate(j.pivotX, j.pivotY);

        const img = images[name];

        if (!gameOver && name === 'sword' && swordAuraIntensity > 0.01) {
            drawSwordRedAura(img, swordAuraIntensity);
        }

        if (isPartHit && img && img.complete && img.naturalWidth !== 0) {
            const totalDuration = PART_FLASH_DURATION;
            const progress = (totalDuration - timer) / totalDuration;

            let flashAlpha = 0;
            if (progress < 0.15) {
                flashAlpha = progress / 0.15;
            } else {
                flashAlpha = 1 - (progress - 0.15) / 0.85;
            }
            flashAlpha = Math.max(0, Math.min(1, flashAlpha));

            hitOffscreenCanvas.width = img.width;
            hitOffscreenCanvas.height = img.height;

            hitOffscreenCtx.clearRect(0, 0, img.width, img.height);

            hitOffscreenCtx.globalCompositeOperation = 'source-over';
            hitOffscreenCtx.drawImage(img, 0, 0);

            // ถ้าเป็นดาบ (เกิดการ Block) ให้เปลี่ยนเป็นสี Slate #6D8196 (rgb 109, 129, 150)
            // ถ้าเป็นชิ้นส่วนร่างกายโดนฟัน ให้เปลี่ยนเป็นสีแดง
            hitOffscreenCtx.globalCompositeOperation = 'lighten';
            if (name === 'sword') {
                hitOffscreenCtx.fillStyle = `rgba(109, 129, 150, ${flashAlpha})`;
            } else {
                hitOffscreenCtx.fillStyle = `rgba(239, 45, 20, ${flashAlpha})`;
            }
            hitOffscreenCtx.fillRect(0, 0, img.width, img.height);

            hitOffscreenCtx.globalCompositeOperation = 'destination-in';
            hitOffscreenCtx.drawImage(img, 0, 0);

            ctx.drawImage(hitOffscreenCanvas, -img.width / 2, -img.height / 2);
        } else if (img && img.complete && img.naturalWidth !== 0) {
            drawImageWithYellowKey(img);
        } else {
            drawProceduralFallback(name, isPartHit);
        }
        ctx.restore();
        ctx.restore();
    });

    ctx.restore();
}

function drawPuppetSticks(playerObj, worldTransforms) {
    ctx.save();
    ctx.strokeStyle = gameOver ? '#9a7b00' : '#a1a1aa';
    ctx.lineWidth = gameOver ? 5 : 4;

    if (worldTransforms['lower_body']) {
        const lb = worldTransforms['lower_body'];
        ctx.beginPath();
        ctx.moveTo(lb[4], lb[5]);
        ctx.lineTo(lb[4], 2000);
        ctx.stroke();
    }

    if (worldTransforms['right_hand']) {
        const rh = worldTransforms['right_hand'];
        ctx.beginPath();
        ctx.moveTo(rh[4], rh[5]);
        ctx.lineTo(rh[4] - 75, 2000);
        ctx.stroke();
    }

    ctx.restore();
}

function drawProceduralFallback(name, isPartHit = false) {
    // ตอน Block ดาบจะเปลี่ยนเป็นสี #6D8196
    const hitColor = (name === 'sword') ? '#6D8196' : '#ef4444';
    const innerDetailColor = gameOver ? VICTORY_BG_COLOR : '#ffffff';
    ctx.fillStyle = isPartHit ? hitColor : '#000000';
    ctx.strokeStyle = isPartHit ? hitColor : '#000000';
    ctx.lineWidth = 3;

    switch (name) {
        case 'upper_body':
            ctx.beginPath();
            ctx.moveTo(-28, -60);
            ctx.lineTo(28, -60);
            ctx.lineTo(38, 25);
            ctx.lineTo(-38, 25);
            ctx.closePath();
            ctx.fill();
            break;
        case 'head':
            ctx.beginPath();
            ctx.arc(0, -20, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(10, -28);
            ctx.lineTo(52, -22);
            ctx.lineTo(46, -8);
            ctx.lineTo(10, -14);
            ctx.fill();
            ctx.fillStyle = innerDetailColor;
            ctx.beginPath();
            ctx.arc(6, -24, 3, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'lower_body':
            ctx.beginPath();
            ctx.moveTo(-38, 0);
            ctx.lineTo(38, 0);
            ctx.lineTo(24, 44);
            ctx.lineTo(-24, 44);
            ctx.closePath();
            ctx.fill();
            break;
        case 'right_upper_arm':
        case 'left_upper_arm':
            ctx.beginPath();
            ctx.ellipse(25, 0, 25, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'right_arm':
        case 'left_arm':
            ctx.beginPath();
            ctx.ellipse(20, 0, 20, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'right_hand':
        case 'left_hand':
            ctx.beginPath();
            ctx.arc(8, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'sword':
            ctx.beginPath();
            ctx.fillRect(-6, -170, 12, 340);
            ctx.fillRect(-20, 140, 40, 8);
            break;
        case 'right_leg':
        case 'left_leg':
            ctx.beginPath();
            ctx.ellipse(0, 20, 11, 24, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'right_foot':
        case 'left_foot':
            ctx.beginPath();
            ctx.ellipse(10, 15, 18, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
    }
}

function renderDetachedParts() {
    detachedParts.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(p.scale * p.facingX, p.scale);

        const img = images[p.name];
        if (img && img.complete && img.naturalWidth !== 0) {
            drawImageWithYellowKey(img);
        } else {
            drawProceduralFallback(p.name, false);
        }

        ctx.restore();
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color[Math.floor(Math.random() * p.color.length)];
        ctx.fill();
    });
}

function renderVictoryBanner() {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const fontSize = Math.min(Math.max(canvas.width * 0.045, 36), 68);
    ctx.font = `900 ${fontSize}px "Silkscreen", "Press Start 2P", monospace`;
    ctx.fillText(winnerBannerText, canvas.width * 0.5, canvas.height * 0.08);
    ctx.restore();
}

// --- 9. MAIN LOOP ---
function update() {
    if (gameScreen !== 'playing') return;

    if (gameOver) {
        gameOverTimer++;

        if (winnerPlayer) {
            const targetWinX = canvas.width * 0.48;
            const targetWinY = canvas.height * 0.50;
            winnerPlayer.x += (targetWinX - winnerPlayer.x) * 0.08;
            winnerPlayer.y += (targetWinY - winnerPlayer.y) * 0.08;
            winnerPlayer.visualFacingX += (1 - winnerPlayer.visualFacingX) * 0.15;
            winnerPlayer.handAimAngle += (0 - winnerPlayer.handAimAngle) * 0.15;
            winnerPlayer.walkBlend += (0 - winnerPlayer.walkBlend) * 0.2;
            winnerPlayer.idlePhase += 0.04;

            const winnerJoints = (winnerPlayer === p1) ? p1Joints : p2Joints;
            updatePlayerTransforms(winnerPlayer, winnerJoints);
        }

        updateDetachedParts();
        updateParticles();
        return;
    }

    p1.facingDir = (p1.x <= p2.x) ? 1 : -1;
    p2.facingDir = (p2.x >= p1.x) ? -1 : 1;

    p1.visualFacingX += (p1.facingDir - p1.visualFacingX) * 0.25;
    p2.visualFacingX += (p2.facingDir - p2.visualFacingX) * 0.25;

    if (p1.hitCooldown > 0) p1.hitCooldown--;
    if (p2.hitCooldown > 0) p2.hitCooldown--;
    if (p1.clashCooldown > 0) p1.clashCooldown--;
    if (p2.clashCooldown > 0) p2.clashCooldown--;

    updatePartTimers(p1);
    updatePartTimers(p2);

    handlePlayerControls();

    // บังคับไม่ให้ตัวละครเดินทะลุผ่านกันได้
    resolvePlayerBodyCollision(p1, p2);

    processSlashAndCollisions();

    if (!gameOver) {
        resolvePlayerBodyCollision(p1, p2);

        p1.x = Math.max(80, Math.min(canvas.width - 80, p1.x));
        p1.y = Math.max(120, Math.min(canvas.height - 120, p1.y));
        p2.x = Math.max(80, Math.min(canvas.width - 80, p2.x));
        p2.y = Math.max(120, Math.min(canvas.height - 120, p2.y));

        updatePlayerTransforms(p1, p1Joints);
        updatePlayerTransforms(p2, p2Joints);

        spawnSwordAuraParticles(p1);
        spawnSwordAuraParticles(p2);
    }

    updateParticles();
}

function render() {
    if (gameOver) {
        ctx.fillStyle = VICTORY_BG_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (winnerPlayer && !isDrawRound) {
            const winnerJoints = (winnerPlayer === p1) ? p1Joints : p2Joints;
            renderPlayer(winnerPlayer, winnerJoints);
        }

        renderDetachedParts();
        renderVictoryBanner();
        drawParticles();
        return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    const gridSize = 45;

    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    renderPlayer(p1, p1Joints);
    renderPlayer(p2, p2Joints);

    drawParticles();
}

function loop() {
    update();
    render();
    requestAnimationFrame(loop);
}

// เริ่มต้นระบบทั้งหมด
setupInputListeners();
startRoundTimer();
loop();
