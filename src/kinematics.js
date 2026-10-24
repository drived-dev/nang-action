



function multiplyMatrix(m1, m2) {
    return [
        m1[0] * m2[0] + m1[2] * m2[1],
        m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3],
        m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
        m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
}

function createTransformMatrix(x, y, rotationDegrees) {
    const rad = (rotationDegrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [cos, sin, -sin, cos, x, y];
}

function getJointAnimationOffset(playerObj, name) {
    let dx = 0, dy = 0, dRot = 0;

    const wp = playerObj.walkPhase;
    const ip = playerObj.idlePhase;
    const wb = playerObj.walkBlend;

    const slashForwardRatio = (playerObj.isSlashing && playerObj.slashAngle > 0)
        ? (playerObj.slashAngle / MAX_SLASH_ANGLE)
        : 0;

    const chargeRatio = playerObj.isCharging
        ? playerObj.chargeRatio
        : (playerObj.isSlashing && playerObj.slashAngle < 0 ? Math.abs(playerObj.slashAngle) / MAX_CHARGE_WINDUP : 0);

    const auraIntensity = getSwordAuraIntensity(playerObj);
    const chargeTremor = playerObj.isCharging
        ? Math.sin(performance.now() * 0.06) * 1.8 * auraIntensity
        : 0;

    const handAimNorm = playerObj.handAimAngle / 50;
    const forwardMove = (playerObj.vx * playerObj.facingDir) / MOVE_SPEED;

    switch (name) {
        case 'upper_body':
            dy = Math.abs(Math.sin(wp)) * -2.5 * wb + Math.sin(ip) * 1.5 * (1 - wb);
            dRot = (forwardMove * 2 + Math.sin(wp) * 1) * wb
                + (slashForwardRatio * 5)
                - (chargeRatio * 6)
                + (handAimNorm * 4);
            break;

        case 'head':
            dy = Math.sin(wp * 2) * -1 * wb;
            dRot = (Math.sin(wp - 0.4) * 2 * wb)
                + (Math.sin(ip - 0.5) * 1.5 * (1 - wb))
                - (slashForwardRatio * 4)
                + (chargeRatio * 5)
                + (handAimNorm * 6);
            break;

        case 'lower_body':
            dy = Math.sin(wp * 2) * 1 * wb;
            dRot = -forwardMove * 1.5 * wb + Math.cos(wp) * 1 * wb + (chargeRatio * 4);
            break;

        case 'right_upper_arm':
            dx = (Math.cos(wp) * 2 * wb) + (slashForwardRatio * 10) - (chargeRatio * 10);
            dy = (Math.sin(wp * 2) * -2 * wb) + (Math.sin(ip) * -1 * (1 - wb)) - (slashForwardRatio * 4) + (handAimNorm * 12) - (chargeRatio * 6);
            dRot = (Math.sin(wp) * 4 * wb)
                + (Math.sin(ip) * 1.5 * (1 - wb))
                + (playerObj.handAimAngle * 0.6)
                + playerObj.slashAngle
                + chargeTremor;
            break;

        case 'right_arm':
            dx = (Math.sin(wp) * 2.5 * wb) + (slashForwardRatio * 10) - (chargeRatio * 10);
            dy = (Math.cos(wp) * 2 * wb) - (slashForwardRatio * 6) + (handAimNorm * 16) - (chargeRatio * 8);
            dRot = (Math.sin(wp - 0.6) * 5 * wb)
                + (Math.cos(ip) * 1.5 * (1 - wb))
                + (playerObj.handAimAngle * 0.4)
                + (slashForwardRatio * 8)
                - (chargeRatio * 10);
            break;

        case 'right_hand':
            dx = (Math.cos(wp) * 3 * wb)
                + (forwardMove * 2 * wb)
                + (slashForwardRatio * 14)
                - (chargeRatio * 12)
                + ((1 - Math.abs(handAimNorm)) * 5);
            dy = (Math.sin(wp) * 2.5 * wb)
                + (Math.sin(ip) * 1.5 * (1 - wb))
                + (slashForwardRatio * 5)
                + (handAimNorm * 22)
                - (chargeRatio * 8);
            dRot = (Math.sin(wp - 0.9) * 4 * wb)
                + (playerObj.handAimAngle * 0.35)
                + (slashForwardRatio * 6)
                - (chargeRatio * 8)
                + chargeTremor;
            break;

        case 'sword':
            dRot = -(chargeRatio * 8) + (slashForwardRatio * 4) + chargeTremor * 1.2;
            break;

        case 'left_upper_arm':
            dx = -Math.cos(wp) * 2 * wb;
            dy = Math.sin(wp * 2 + Math.PI) * -1.5 * wb;
            dRot = (-Math.sin(wp) * 8 * wb) + (Math.sin(ip + Math.PI) * 1.5 * (1 - wb)) - (slashForwardRatio * 12) + (chargeRatio * 10);
            break;

        case 'left_arm':
            dx = -Math.sin(wp) * 1.5 * wb;
            dy = Math.cos(wp) * 1.5 * wb;
            dRot = (-Math.sin(wp - 0.5) * 7 * wb) - 3 * wb + (chargeRatio * 8);
            break;

        case 'left_hand':
            dx = -Math.cos(wp) * 2 * wb;
            dy = -Math.sin(wp) * 2 * wb;
            dRot = -Math.sin(wp - 0.8) * 4 * wb;
            break;

        case 'right_leg':
            dx = Math.sin(wp) * 3.5 * wb;
            dy = Math.min(0, Math.cos(wp) * 3) * wb;
            dRot = Math.sin(wp) * 10 * wb;
            break;

        case 'right_foot':
            dy = Math.max(0, Math.cos(wp) * -3) * wb;
            dRot = (Math.max(0, Math.cos(wp)) * 8 - 3) * wb;
            break;

        case 'left_leg':
            dx = Math.sin(wp + Math.PI) * 3.5 * wb;
            dy = Math.min(0, Math.cos(wp + Math.PI) * 3) * wb;
            dRot = Math.sin(wp + Math.PI) * 10 * wb;
            break;

        case 'left_foot':
            dy = Math.max(0, Math.cos(wp + Math.PI) * -3) * wb;
            dRot = (Math.max(0, Math.cos(wp + Math.PI)) * 8 - 3) * wb;
            break;
    }

    return { dx, dy, dRot };
}

function getLocalMatrix(playerObj, jointsObj, name) {
    const j = jointsObj[name] || { x: 0, y: 0, rotation: 0 };
    const anim = getJointAnimationOffset(playerObj, name);
    return createTransformMatrix(j.x + anim.dx, j.y + anim.dy, j.rotation + anim.dRot);
}

function localToWorld(playerObj, m, lx, ly) {
    const relX = m[4] + m[0] * lx + m[2] * ly;
    const relY = m[5] + m[1] * lx + m[3] * ly;
    return {
        x: playerObj.x + relX * playerObj.scale * playerObj.visualFacingX,
        y: playerObj.y + relY * playerObj.scale
    };
}

function segmentToSegmentCollision(A, B, C, D) {
    const ux = B.x - A.x, uy = B.y - A.y;
    const vx = D.x - C.x, vy = D.y - C.y;
    const wx = A.x - C.x, wy = A.y - C.y;

    const a = ux * ux + uy * uy;
    const b = ux * vx + uy * vy;
    const c = vx * vx + vy * vy;
    const d = ux * wx + uy * wy;
    const e = vx * wx + vy * wy;
    const D_det = a * c - b * b;

    let sc, sN, sD = D_det;
    let tc, tN, tD = D_det;

    if (D_det < 1e-7) {
        sN = 0.0;
        sD = 1.0;
        tN = e;
        tD = c;
    } else {
        sN = (b * e - c * d);
        tN = (a * e - b * d);
        if (sN < 0.0) {
            sN = 0.0;
            tN = e;
            tD = c;
        } else if (sN > sD) {
            sN = sD;
            tN = e + b;
            tD = c;
        }
    }

    if (tN < 0.0) {
        tN = 0.0;
        if (-d < 0.0) sN = 0.0;
        else if (-d > a) sN = sD;
        else {
            sN = -d;
            sD = a;
        }
    } else if (tN > tD) {
        tN = tD;
        if ((-d + b) < 0.0) sN = 0.0;
        else if ((-d + b) > a) sN = sD;
        else {
            sN = (-d + b);
            sD = a;
        }
    }

    sc = (Math.abs(sN) < 1e-7 ? 0.0 : sN / sD);
    tc = (Math.abs(tN) < 1e-7 ? 0.0 : tN / tD);

    const closestOnAB = { x: A.x + sc * ux, y: A.y + sc * uy };
    const closestOnCD = { x: C.x + tc * vx, y: C.y + tc * vy };

    const dx = closestOnAB.x - closestOnCD.x;
    const dy = closestOnAB.y - closestOnCD.y;

    return {
        distance: Math.sqrt(dx * dx + dy * dy),
        closestOnAB: closestOnAB,
        closestOnCD: closestOnCD,
        contactPoint: {
            x: (closestOnAB.x + closestOnCD.x) * 0.5,
            y: (closestOnAB.y + closestOnCD.y) * 0.5
        }
    };
}

function updatePlayerTransforms(playerObj, jointsObj) {
    const worldTransforms = {};

    function computeWorldTransform(name, parentMatrix) {
        const localM = getLocalMatrix(playerObj, jointsObj, name);
        const worldM = parentMatrix ? multiplyMatrix(parentMatrix, localM) : localM;
        worldTransforms[name] = worldM;

        for (const [childName, config] of Object.entries(SCENE_GRAPH)) {
            if (config.parent === name) {
                computeWorldTransform(childName, worldM);
            }
        }
    }

    computeWorldTransform('upper_body', null);
    playerObj.worldTransforms = worldTransforms;

    Object.keys(PART_HITBOX_CONFIG).forEach(partName => {
        const m = worldTransforms[partName];
        if (!m) return;

        const cfg = PART_HITBOX_CONFIG[partName];
        const j = jointsObj[partName] || { pivotX: 0, pivotY: 0 };
        const img = images[partName];

        const segments = [];

        segments.push({
            a: localToWorld(playerObj, m, cfg.x1, cfg.y1),
            b: localToWorld(playerObj, m, cfg.x2, cfg.y2),
            radius: cfg.radius * playerObj.scale
        });

        if (img && img.complete && img.naturalWidth > 0) {
            const halfW = img.width * 0.42;
            const halfH = img.height * 0.42;
            if (img.height >= img.width) {
                const span = Math.max(10, halfH - halfW * 0.5);
                segments.push({
                    a: localToWorld(playerObj, m, j.pivotX, j.pivotY - span),
                    b: localToWorld(playerObj, m, j.pivotX, j.pivotY + span),
                    radius: halfW * playerObj.scale
                });
            } else {
                const span = Math.max(10, halfW - halfH * 0.5);
                segments.push({
                    a: localToWorld(playerObj, m, j.pivotX - span, j.pivotY),
                    b: localToWorld(playerObj, m, j.pivotX + span, j.pivotY),
                    radius: halfH * playerObj.scale
                });
            }
        }

        playerObj.bodyCapsulesWorld[partName] = segments;
    });

    if (worldTransforms['sword']) {
        const swM = worldTransforms['sword'];
        const j = jointsObj['sword'] || { pivotX: -8, pivotY: -178 };
        const swordImg = images['sword'];
        const hasSwordImg = swordImg && swordImg.complete && swordImg.naturalWidth > 0;

        const halfBladeLen = hasSwordImg
            ? (swordImg.height / 2)
            : Math.max(Math.abs(j.pivotY), 75);

        const bladeRadius = (hasSwordImg ? Math.min(swordImg.width * 0.35, 22) : 16) * playerObj.scale;

        const hiltWorld = localToWorld(playerObj, swM, 0, 20);
        const midWorld = localToWorld(playerObj, swM, j.pivotX, j.pivotY);
        const tipWorld = localToWorld(playerObj, swM, j.pivotX, j.pivotY - halfBladeLen);

        playerObj.swordSegmentsWorld = [
            { a: hiltWorld, b: midWorld, radius: bladeRadius },
            { a: midWorld, b: tipWorld, radius: bladeRadius }
        ];
    }
}


function resolvePlayerBodyCollision(p1Obj, p2Obj) {
    updatePlayerTransforms(p1Obj, p1Joints);
    updatePlayerTransforms(p2Obj, p2Joints);

    let maxOverlap = 0;
    let pushX = 0;
    let pushY = 0;

    for (const caps1 of Object.values(p1Obj.bodyCapsulesWorld)) {
        for (const c1 of caps1) {
            for (const caps2 of Object.values(p2Obj.bodyCapsulesWorld)) {
                for (const c2 of caps2) {
                    const res = segmentToSegmentCollision(c1.a, c1.b, c2.a, c2.b);

                    const minAllowedDist = (c1.radius + c2.radius) * 0.82;

                    if (res.distance < minAllowedDist) {
                        const overlap = minAllowedDist - res.distance;
                        if (overlap > maxOverlap) {
                            maxOverlap = overlap;
                            let dx = res.closestOnAB.x - res.closestOnCD.x;
                            let dy = res.closestOnAB.y - res.closestOnCD.y;
                            const len = Math.sqrt(dx * dx + dy * dy);
                            if (len > 0.001) {
                                pushX = dx / len;
                                pushY = dy / len;
                            } else {
                                pushX = (p1Obj.x <= p2Obj.x) ? -1 : 1;
                                pushY = 0;
                            }
                        }
                    }
                }
            }
        }
    }

    if (maxOverlap > 0) {
        const p1Speed = Math.abs(p1Obj.vx) + Math.abs(p1Obj.vy);
        const p2Speed = Math.abs(p2Obj.vx) + Math.abs(p2Obj.vy);
        const totalSpeed = p1Speed + p2Speed;


        let p1Share = 0.5;
        let p2Share = 0.5;
        if (totalSpeed > 0) {
            p1Share = p1Speed / totalSpeed;
            p2Share = p2Speed / totalSpeed;
        }

        p1Obj.x += pushX * maxOverlap * p1Share;
        p1Obj.y += pushY * maxOverlap * p1Share;
        p2Obj.x -= pushX * maxOverlap * p2Share;
        p2Obj.y -= pushY * maxOverlap * p2Share;

        updatePlayerTransforms(p1Obj, p1Joints);
        updatePlayerTransforms(p2Obj, p2Joints);
    }
}

function updateMovementKinematics(playerObj, moveX, moveY) {
    const speedFactor = playerObj.isCharging ? 0.72 : 1.0;
    const actualMoveX = moveX * speedFactor;
    const actualMoveY = moveY * speedFactor;

    playerObj.vx = actualMoveX;
    playerObj.vy = actualMoveY;
    playerObj.x += actualMoveX;
    playerObj.y += actualMoveY;

    const isMoving = (actualMoveX !== 0 || actualMoveY !== 0);
    const targetBlend = isMoving ? 1 : 0;
    playerObj.walkBlend += (targetBlend - playerObj.walkBlend) * 0.2;

    if (isMoving) {
        const dirSign = (actualMoveX * playerObj.facingDir) < 0 ? -1 : 1;
        playerObj.walkPhase += 0.22 * dirSign * speedFactor;
    }
    playerObj.idlePhase += 0.06;
}
