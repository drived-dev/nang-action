// =========================================================================
// ⚔️ ระบบการต่อสู้ Block ดาบอัตโนมัติ (เปลี่ยนสีดาบเป็น #6D8196 โดยไม่มี Particle)
// =========================================================================

function getSwordAuraIntensity(playerObj) {
    if (playerObj.isCharging) {
        if (playerObj.chargeFrames <= CHARGE_AURA_DELAY_FRAMES) {
            return 0;
        }
        const effectiveFrames = playerObj.chargeFrames - CHARGE_AURA_DELAY_FRAMES;
        const maxEffectiveFrames = Math.max(1, MAX_CHARGE_FRAMES - CHARGE_AURA_DELAY_FRAMES);
        return Math.min(1, effectiveFrames / maxEffectiveFrames);
    }
    if (playerObj.isSlashing && playerObj.slashState === 'swing') {
        return playerObj.activeSlashAura || 0;
    }
    return 0;
}

function startCharging(playerObj) {
    if (!playerObj.isSlashing && !playerObj.isCharging) {
        playerObj.isCharging = true;
        playerObj.chargeFrames = 0;
        playerObj.chargeRatio = 0;
    }
}

function releaseChargeAndSlash(playerObj) {
    if (playerObj.isCharging) {
        const auraAtRelease = getSwordAuraIntensity(playerObj);
        playerObj.isCharging = false;
        playerObj.isSlashing = true;
        playerObj.slashState = 'swing';
        playerObj.activeSlashCharge = playerObj.chargeRatio;
        playerObj.activeSlashAura = auraAtRelease;
        playerObj.activeSlashMultiplier = 1 + (MAX_CHARGE_MULTIPLIER - 1) * playerObj.chargeRatio;
        playerObj.chargeFrames = 0;
        playerObj.chargeRatio = 0;
    }
}

// --- 6. DISMEMBERMENT PHYSICS ---
function appendDetachedPartsForPlayer(targetObj, jointsObj, xMinRatio = 0.06, xSpanRatio = 0.88) {
    updatePlayerTransforms(targetObj, jointsObj);

    const floorBaseY = canvas.height - 14;
    const partNames = Object.keys(jointsObj);
    const totalParts = partNames.length;

    partNames.forEach((name, idx) => {
        const m = targetObj.worldTransforms[name] || [1, 0, 0, 1, 0, 0];
        const j = jointsObj[name] || { pivotX: 0, pivotY: 0, zIndex: 10 };

        const worldCenter = localToWorld(targetObj, m, j.pivotX, j.pivotY);
        const baseAngle = Math.atan2(m[1], m[0]) * (targetObj.visualFacingX >= 0 ? 1 : -1);

        let groundOffset = 22;
        let targetRestAngle = (Math.random() - 0.5) * 0.6;

        if (name === 'sword') {
            groundOffset = 52;
            targetRestAngle = 1.05;
        } else if (name === 'upper_body') {
            groundOffset = 48;
            targetRestAngle = -0.35;
        } else if (name === 'lower_body') {
            groundOffset = 38;
            targetRestAngle = 0.05;
        } else if (name === 'head') {
            groundOffset = 42;
            targetRestAngle = -0.22;
        } else if (name.includes('foot') || name.includes('leg') || name.includes('arm')) {
            groundOffset = 20;
            targetRestAngle = Math.PI * 0.45 * (Math.random() > 0.5 ? 1 : -1);
        } else if (name.includes('hand')) {
            groundOffset = 16;
        }

        const spreadSlot = ((idx + 0.5) / totalParts) * (canvas.width * xSpanRatio) + (canvas.width * xMinRatio);
        const targetX = spreadSlot + (Math.random() - 0.5) * 40;
        const vx = (targetX - worldCenter.x) * 0.028 + (Math.random() - 0.5) * 4;
        const vy = -Math.random() * 7 - 2;

        detachedParts.push({
            name: name,
            x: worldCenter.x,
            y: worldCenter.y,
            vx: vx,
            vy: vy,
            rotation: baseAngle,
            va: (Math.random() - 0.5) * 0.16,
            targetRestAngle: targetRestAngle,
            scale: targetObj.scale,
            facingX: targetObj.facingDir,
            groundY: floorBaseY - groundOffset * targetObj.scale,
            zIndex: j.zIndex || 10,
            settled: false
        });
    });

    detachedParts.sort((a, b) => a.zIndex - b.zIndex);
}

function spawnDetachedParts(loserObj, jointsObj) {
    detachedParts = [];
    appendDetachedPartsForPlayer(loserObj, jointsObj, 0.06, 0.88);
}

function updateDetachedParts() {
    const gravity = 0.72;

    detachedParts.forEach(p => {
        if (p.settled) return;

        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.va;

        const margin = 45;
        if (p.x < margin) {
            p.x = margin;
            p.vx *= -0.5;
        } else if (p.x > canvas.width - margin) {
            p.x = canvas.width - margin;
            p.vx *= -0.5;
        }

        if (p.y >= p.groundY) {
            p.y = p.groundY;

            if (Math.abs(p.vy) > 2.2) {
                p.vy = -p.vy * 0.28;
                p.vx *= 0.72;
                p.va *= 0.6;
            } else {
                p.vy = 0;
                p.vx *= 0.82;
                const angleDiff = p.targetRestAngle - p.rotation;
                p.rotation += angleDiff * 0.18;
                p.va *= 0.5;

                if (Math.abs(p.vx) < 0.08 && Math.abs(angleDiff) < 0.02) {
                    p.vx = 0;
                    p.va = 0;
                    p.settled = true;
                }
            }
        }
    });
}

// --- 7. SWORD CHARGE AURA PARTICLES ---
function spawnSwordAuraParticles(playerObj) {
    const intensity = getSwordAuraIntensity(playerObj);
    if (intensity <= 0.01 || playerObj.swordSegmentsWorld.length === 0) return;

    const spawnCount = playerObj.isCharging ? (intensity > 0.65 ? 3 : 1) : 2;
    for (let i = 0; i < spawnCount; i++) {
        const seg = playerObj.swordSegmentsWorld[Math.floor(Math.random() * playerObj.swordSegmentsWorld.length)];
        const t = Math.random();
        const px = seg.a.x + (seg.b.x - seg.a.x) * t + (Math.random() - 0.5) * 14;
        const py = seg.a.y + (seg.b.y - seg.a.y) * t + (Math.random() - 0.5) * 14;

        particles.push({
            x: px,
            y: py,
            vx: (Math.random() - 0.5) * 2.5,
            vy: -Math.random() * 3.2 - 0.8,
            size: Math.random() * (3.2 + intensity * 3.5) + 1.5,
            color: ['#ef4444', '#dc2626', '#f87171', '#b91c1c'],
            life: 14
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

// --- 8. PASSIVE SWORD BLOCK & HITBOX DETECTION ---
// ตอน Block เอา Particle กลมๆ ที่กระจายออกมาออกทั้งหมด ทำแค่เปลี่ยนสีดาบเป็น #6D8196
function checkSwordClash(p1Obj, p2Obj) {
    const p1Swinging = p1Obj.isSlashing && p1Obj.slashState === 'swing';
    const p2Swinging = p2Obj.isSlashing && p2Obj.slashState === 'swing';

    if ((p1Swinging || p2Swinging) && p1Obj.clashCooldown <= 0 && p2Obj.clashCooldown <= 0) {
        for (const seg1 of p1Obj.swordSegmentsWorld) {
            for (const seg2 of p2Obj.swordSegmentsWorld) {
                const res = segmentToSegmentCollision(seg1.a, seg1.b, seg2.a, seg2.b);
                const clashThreshold = seg1.radius + seg2.radius + 6;

                if (res.distance <= clashThreshold) {
                    if (p1Swinging) p1Obj.slashState = 'retract';
                    if (p2Swinging) p2Obj.slashState = 'retract';

                    p1Obj.clashCooldown = 14;
                    p2Obj.clashCooldown = 14;

                    // สั่งให้ดาบเปลี่ยนสีเป็นสี Slate #6D8196 (จัดการใน renderer.js)
                    p1Obj.partHitTimers['sword'] = PART_FLASH_DURATION;
                    p2Obj.partHitTimers['sword'] = PART_FLASH_DURATION;

                    p1Obj.x -= p1Obj.facingDir * CLASH_KNOCKBACK;
                    p2Obj.x -= p2Obj.facingDir * CLASH_KNOCKBACK;

                    return true;
                }
            }
        }
    }
    return false;
}

function checkHits(attacker, defender) {
    if (attacker.isSlashing && attacker.slashState === 'swing' && defender.hitCooldown <= 0 && defender.hp > 0) {
        let detectedHit = null;
        let bestPriority = -1;

        const partPriority = {
            head: 3,
            upper_body: 2,
            lower_body: 2
        };

        for (const swordSeg of attacker.swordSegmentsWorld) {
            for (const [partName, capsules] of Object.entries(defender.bodyCapsulesWorld)) {
                for (const cap of capsules) {
                    const res = segmentToSegmentCollision(swordSeg.a, swordSeg.b, cap.a, cap.b);
                    const hitThreshold = swordSeg.radius + cap.radius;

                    if (res.distance <= hitThreshold) {
                        const priority = partPriority[partName] || 1;
                        if (!detectedHit || priority > bestPriority) {
                            bestPriority = priority;
                            detectedHit = {
                                name: partName,
                                pos: res.contactPoint
                            };
                        }
                    }
                }
            }
        }

        if (detectedHit) {
            let partMultiplier = 1.0;
            let isCritical = false;

            switch (detectedHit.name) {
                case 'head':
                    partMultiplier = 1.2;
                    isCritical = true;
                    break;
                case 'upper_body':
                case 'lower_body':
                    partMultiplier = 1.0;
                    break;
                default:
                    partMultiplier = 0.5;
                    break;
            }

            const chargeMultiplier = attacker.activeSlashMultiplier || 1.0;
            const finalDamage = Math.round(BASE_DAMAGE * partMultiplier * chargeMultiplier);

            defender.hp = Math.max(0, defender.hp - finalDamage);
            defender.hitCooldown = 16;

            defender.partHitTimers[detectedHit.name] = PART_FLASH_DURATION;
            attacker.slashState = 'retract';

            const knockbackDist = (isCritical ? 40 : 22) * chargeMultiplier;
            defender.x += attacker.facingDir * knockbackDist;

            updateHpBars();

            if (defender.hp <= 0 && !gameOver) {
                triggerGameOver(
                    attacker,
                    defender,
                    attacker === p1 ? 'P1 WIN' : 'P2 WIN'
                );
            }

            return true;
        }
    }
    return false;
}

function updateHpBars() {
    const p1Pct = Math.max(0, (p1.hp / p1.maxHp) * 100);
    const p2Pct = Math.max(0, (p2.hp / p2.maxHp) * 100);

    document.getElementById('p1HpBar').style.width = p1Pct + '%';
    document.getElementById('p2HpBar').style.width = p2Pct + '%';
}

function triggerGameOver(winner, loser, bannerText) {
    gameOver = true;
    isDrawRound = false;
    gameOverTimer = 0;
    winnerPlayer = winner;
    loserPlayer = loser;
    winnerBannerText = bannerText;

    document.getElementById('topHud').classList.add('opacity-0');
    document.getElementById('bottomFloorBar').classList.add('opacity-0');

    winnerPlayer.isCharging = false;
    winnerPlayer.isSlashing = false;
    winnerPlayer.slashState = 'idle';
    winnerPlayer.slashAngle = 0;
    winnerPlayer.activeSlashAura = 0;
    winnerPlayer.partHitTimers = {};
    winnerPlayer.facingDir = 1;

    const loserJoints = (loser === p1) ? p1Joints : p2Joints;
    spawnDetachedParts(loser, loserJoints);
}

function triggerDrawGameOver() {
    gameOver = true;
    isDrawRound = true;
    gameOverTimer = 0;
    winnerPlayer = null;
    loserPlayer = null;
    winnerBannerText = 'DRAW';

    document.getElementById('topHud').classList.add('opacity-0');
    document.getElementById('bottomFloorBar').classList.add('opacity-0');

    detachedParts = [];
    appendDetachedPartsForPlayer(p1, p1Joints, 0.05, 0.43);
    appendDetachedPartsForPlayer(p2, p2Joints, 0.52, 0.43);
}

function restartGame() {
    p1.hp = 100;
    p2.hp = 100;
    p1.x = canvas.width * 0.28;
    p1.y = canvas.height * 0.56;
    p2.x = canvas.width * 0.72;
    p2.y = canvas.height * 0.56;
    p1.facingDir = 1;
    p1.visualFacingX = 1;
    p2.facingDir = -1;
    p2.visualFacingX = -1;
    p1.hitCooldown = 0;
    p2.hitCooldown = 0;
    p1.clashCooldown = 0;
    p2.clashCooldown = 0;
    p1.partHitTimers = {};
    p2.partHitTimers = {};
    p1.handAimAngle = 0;
    p2.handAimAngle = 0;
    p1.isCharging = false;
    p1.chargeFrames = 0;
    p1.chargeRatio = 0;
    p1.activeSlashCharge = 0;
    p1.activeSlashAura = 0;
    p1.activeSlashMultiplier = 1;
    p1.isSlashing = false;
    p1.slashState = 'idle';
    p1.slashAngle = 0;
    p2.isCharging = false;
    p2.chargeFrames = 0;
    p2.chargeRatio = 0;
    p2.activeSlashCharge = 0;
    p2.activeSlashAura = 0;
    p2.activeSlashMultiplier = 1;
    p2.isSlashing = false;
    p2.slashState = 'idle';
    p2.slashAngle = 0;

    particles = [];
    clashRings = [];
    detachedParts = [];
    winnerPlayer = null;
    loserPlayer = null;
    isDrawRound = false;
    gameOverTimer = 0;
    timerSeconds = 60;
    document.getElementById('timerText').textContent = timerSeconds;
    gameOver = false;

    document.getElementById('topHud').classList.remove('opacity-0');
    document.getElementById('bottomFloorBar').classList.remove('opacity-0');
    updateHpBars();
}

function updatePlayerChargeState(playerObj) {
    if (playerObj.isCharging) {
        playerObj.chargeFrames = Math.min(MAX_CHARGE_FRAMES, playerObj.chargeFrames + 1);
        playerObj.chargeRatio = playerObj.chargeFrames / MAX_CHARGE_FRAMES;
        playerObj.slashAngle = -playerObj.chargeRatio * MAX_CHARGE_WINDUP;
    }
}

function stepPlayerSlash(playerObj, subSteps) {
    if (!playerObj.isSlashing) return;

    const swingSpeed = SLASH_SWING_SPEED * (1 + playerObj.activeSlashCharge * 0.35);

    if (playerObj.slashState === 'swing') {
        playerObj.slashAngle += swingSpeed / subSteps;
        if (playerObj.slashAngle >= MAX_SLASH_ANGLE) {
            playerObj.slashAngle = MAX_SLASH_ANGLE;
            playerObj.slashState = 'retract';
        }
    } else if (playerObj.slashState === 'retract') {
        playerObj.slashAngle -= SLASH_RETRACT_SPEED / subSteps;
        if (playerObj.slashAngle <= 0) {
            playerObj.slashAngle = 0;
            playerObj.slashState = 'idle';
            playerObj.isSlashing = false;
            playerObj.activeSlashCharge = 0;
            playerObj.activeSlashAura = 0;
            playerObj.activeSlashMultiplier = 1.0;
        }
    }
}

function processSlashAndCollisions() {
    const SUB_STEPS = 6;

    updatePlayerChargeState(p1);
    updatePlayerChargeState(p2);

    for (let step = 0; step < SUB_STEPS; step++) {
        stepPlayerSlash(p1, SUB_STEPS);
        stepPlayerSlash(p2, SUB_STEPS);

        updatePlayerTransforms(p1, p1Joints);
        updatePlayerTransforms(p2, p2Joints);

        if (checkSwordClash(p1, p2)) {
            break;
        }

        checkHits(p1, p2);
        if (gameOver) break;
        checkHits(p2, p1);
        if (gameOver) break;
    }
}

function updatePartTimers(playerObj) {
    for (const part in playerObj.partHitTimers) {
        if (playerObj.partHitTimers[part] > 0) {
            playerObj.partHitTimers[part]--;
        }
    }
}

function startRoundTimer() {
    timerInterval = setInterval(() => {
        if (gameScreen === 'playing' && !gameOver && timerSeconds > 0) {
            timerSeconds--;
            document.getElementById('timerText').textContent = timerSeconds;
            if (timerSeconds === 0) {
                triggerDrawGameOver();
            }
        }
    }, 1000);
}
