window.buildPilflip = function(rootMatrix, {
    drawPart,
    drawBezierCurve,
    paraboloidMesh,
    cylinderMesh,
    elapsed,
    blink
}) {
    const animatedRoot = mat4.create();
    animatedRoot.set(rootMatrix);
    const arbitraryAxis = [1, Math.SQRT1_2, Math.SQRT1_2];
    const arbitraryAxisLength = Math.hypot(...arbitraryAxis);
    mat4.rotate(
        animatedRoot,
        animatedRoot,
        0.12 * Math.sin(elapsed * 1.35),
        arbitraryAxis.map(component => component / arbitraryAxisLength)
    );

    const cBody = [0.40, 0.50, 0.62];
    const cShellLight = [0.43, 0.54, 0.66];
    const cShellDark = [0.37, 0.47, 0.59];
    const cHead = [0.90, 0.88, 0.85];
    const cEye = [0.05, 0.05, 0.05];
    const cSpot = [0.05, 0.05, 0.05];
    const cLeg = [0.30, 0.20, 0.18];

    drawPart(animatedRoot, [0, 0, 0], [0, 0, 0], [1.0, 1.0, 1.5], cBody);
    drawPart(animatedRoot, [0, 0, -0.58], [0, 0, 0], [0.99, 0.99, 0.43], cShellDark);
    drawPart(animatedRoot, [0, 0, 0.05], [0, 0, 0], [1.005, 1.005, 0.43], cShellLight);
    drawPart(animatedRoot, [0, 0, 0.67], [0, 0, 0], [0.99, 0.99, 0.40], cShellDark);
    drawPart(animatedRoot, [0, 0, -0.8], [-Math.PI / 2, 0, 0], [1.6, 1.6, 1.6], cShellDark, paraboloidMesh);

    drawPart(animatedRoot, [0, -0.16, 1.42], [0, 0, 0], [0.82, 0.72, 0.62], cHead);
    const eyeHeight = 0.29 * (1 - 0.9 * blink);
    [-1, 1].forEach((sign) => {
        drawPart(animatedRoot, [sign * 0.36, -0.13, 1.94], [0.12, sign * 0.16, 0], [0.19, eyeHeight, 0.09], cEye);
    });

    [-1, 1].forEach((sign) => {
        const root = [sign * 0.32, 0.32, 1.54];
        const hornTipBase = [sign * 1.02, 0.94, 1.48];
        const hornTip = [sign * 0.78, 1.36, 1.44];
        drawBezierCurve(animatedRoot, [
            root,
            [sign * 0.68, 0.35, 1.54],
            [sign * 1.28, 0.62, 1.48],
            hornTipBase
        ], 0.21, cHead, 40, hornTip, true);

        const smallRoot = [sign * 0.10, 0.40, 1.54];
        const smallTipBase = [sign * 0.25, 0.65, 1.48];
        const smallTip = [sign * 0.18, 0.88, 1.44];
        drawBezierCurve(animatedRoot, [
            smallRoot,
            [sign * 0.12, 0.52, 1.54],
            [sign * 0.32, 0.52, 1.48],
            smallTipBase
        ], 0.09, cHead, 24, smallTip, true);
    });

    const legRows = [
        { z: 0.82, spread: 0.16, stride: 0.20 },
        { z: 0.00, spread: 0.00, stride: 0.00 },
        { z: -0.82, spread: -0.16, stride: -0.20 }
    ];
    const legSwingAxis = [0.24, 0.88, 0.41];
    const legSwingAxisLength = Math.hypot(...legSwingAxis);
    const normalizedLegSwingAxis = legSwingAxis.map(component => component / legSwingAxisLength);
    legRows.forEach(({ z, spread, stride }, rowIndex) => {
        [-1, 1].forEach((sign) => {
            const hip = [sign * 0.56, -0.10, z];
            const phaseOffset = (rowIndex + (sign > 0 ? 0 : 1)) % 2 * Math.PI;
            const gaitPhase = elapsed * 7 + phaseOffset;
            const legMatrix = mat4.create();
            mat4.multiply(legMatrix, animatedRoot, legMatrix);
            mat4.translate(legMatrix, legMatrix, hip);
            mat4.rotateX(legMatrix, legMatrix, Math.sin(gaitPhase) * 0.22);
            mat4.rotateZ(legMatrix, legMatrix, sign * Math.cos(gaitPhase) * 0.27);
            mat4.rotate(
                legMatrix,
                legMatrix,
                Math.sin(gaitPhase + Math.PI / 3) * 0.16,
                normalizedLegSwingAxis
            );

            drawBezierCurve(legMatrix, [
                [0, 0, 0],
                [sign * 0.52, -0.12, spread * 0.2],
                [sign * 1.12, 0.92, spread],
                [sign * 0.60, -1.02, stride]
            ], 0.125, cLeg, 28);
            drawPart(legMatrix, [sign * 0.60, -1.02, stride], [0, 0, 0], [0.15, 0.11, 0.15], cLeg, cylinderMesh);
        });
    });

    const spots = [
        [-0.30, 0.95], [0.30, 0.95],
        [-0.30, 0.32], [0.30, 0.32],
        [-0.30, -0.32], [0.30, -0.32],
        [-0.30, -0.95], [0.30, -0.95]
    ];
    spots.forEach(([x, z]) => {
        const surfaceY = Math.sqrt(Math.max(0, 1 - x * x - (z / 1.5) ** 2));
        const bend = x < 0 ? -1 : 1;
        const base = [x, surfaceY - 0.02, z];
        const tip = [x + bend * 0.10, surfaceY + 0.35, z - 0.46];
        drawBezierCurve(animatedRoot, [
            base,
            [x + bend * 0.01, surfaceY + 0.12, z - 0.015],
            [x + bend * 0.07, surfaceY + 0.26, z - 0.13],
            [x + bend * 0.12, surfaceY + 0.31, z - 0.32]
        ], 0.07, cSpot, 24, tip);
    });
};
