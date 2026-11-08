(function (global) {
    'use strict';

    function makeMatrix(translation, rotations, scale) {
        const matrix = mat4.create();
        mat4.translate(matrix, matrix, translation || [0, 0, 0]);
        (rotations || []).forEach(([axis, angle]) => {
            if (axis === 'x') mat4.rotateX(matrix, matrix, angle);
            else if (axis === 'y') mat4.rotateY(matrix, matrix, angle);
            else if (axis === 'z') mat4.rotateZ(matrix, matrix, angle);
        });
        if (scale) mat4.scale(matrix, matrix, scale);
        return matrix;
    }

    function combine(parent, local) {
        const result = mat4.create();
        mat4.multiply(result, parent, local);
        return result;
    }

    function buildKnightSceneParts() {
        if (!global.BUILDER) throw new Error('Knight geometry builder was not loaded.');

        const colors = {
            shell: [0.88, 0.87, 0.84],
            body: [0.10, 0.11, 0.14],
            dark: [0.08, 0.09, 0.12],
            eye: [0.025, 0.025, 0.03],
            cloak: [0.19, 0.20, 0.24],
            handle: [0.27, 0.24, 0.22],
            blade: [0.72, 0.74, 0.79]
        };
        const parts = [];
        const body = makeMatrix([0, -2.1, 0]);
        const head = combine(body, makeMatrix([0, 2.1, 0]));

        function add(geometry, color, matrix, motion, pivot) {
            const normalMatrix = mat3.create();
            if (!mat3.normalFromMat4(normalMatrix, matrix)) {
                throw new Error('Unable to build a normal matrix for a Knight part.');
            }
            const pos = [], nor = [], col = [];
            for (let i = 0; i < geometry.vertices.length; i += 3) {
                const x = geometry.vertices[i], y = geometry.vertices[i + 1], z = geometry.vertices[i + 2];
                pos.push(
                    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
                    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
                    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
                );
                const nx = geometry.normals[i], ny = geometry.normals[i + 1], nz = geometry.normals[i + 2];
                nor.push(
                    normalMatrix[0] * nx + normalMatrix[3] * ny + normalMatrix[6] * nz,
                    normalMatrix[1] * nx + normalMatrix[4] * ny + normalMatrix[7] * nz,
                    normalMatrix[2] * nx + normalMatrix[5] * ny + normalMatrix[8] * nz
                );
                col.push(color[0], color[1], color[2]);
            }
            parts.push({
                pos, nor, col,
                idx: geometry.indices,
                outline: 0.035,
                alpha: 1,
                glow: 0,
                character: 'knight',
                motion: motion || null,
                pivot: pivot || [0, 0, 0]
            });
        }

        function addHead(geometry, color, translation, rotations, motion, pivot) {
            add(geometry, color, combine(head, makeMatrix(translation, rotations)), motion, pivot);
        }

        const bowl = global.BUILDER.generateRoundedSquareBowl(2.3, 2, 1, 50);
        addHead(bowl, colors.shell, [0, -1, 0]);
        addHead(global.BUILDER.generateRoundedCylinder(2.3, 2, 2.5, 50), colors.shell, [0, 0, 0]);
        addHead(bowl, colors.shell, [0, 3.5, 0], [['x', Math.PI]]);

        const horn = global.BUILDER.generateHorn(0.6, 1.7, Math.PI * 0.75, 40);
        addHead(horn, colors.shell, [1.8, 2.6, 0.1], [['z', -Math.PI / 3]]);
        const rightHorn = parts[parts.length - 1];
        const leftHorn = Object.assign({}, rightHorn, {
            pos: rightHorn.pos.slice(),
            nor: rightHorn.nor.slice(),
            idx: rightHorn.idx.slice()
        });
        for (let i = 0; i < leftHorn.pos.length; i += 3) {
            leftHorn.pos[i] = -rightHorn.pos[i];
            leftHorn.nor[i] = -rightHorn.nor[i];
        }
        for (let i = 0; i < leftHorn.idx.length; i += 3) {
            const index = leftHorn.idx[i + 1];
            leftHorn.idx[i + 1] = leftHorn.idx[i + 2];
            leftHorn.idx[i + 2] = index;
        }
        parts.push(leftHorn);

        add(global.BUILDER.generateBody(1, 1, 1.5, 0.1, 40, 40), colors.body, body);

        const eye = global.BUILDER.generateSphere(0.65, 0.65, 0.3, 30, 30);
        const blinkMotion = (time) => {
            const phase = time % 2.8;
            const pulse = phase < 0.16 ? Math.sin(phase / 0.16 * Math.PI) : 0;
            const scaleY = Math.max(0.06, 1 - 0.94 * pulse);
            return [['s', [1, scaleY, 1]]];
        };
        [-1, 1].forEach(sign => {
            addHead(
                eye, colors.eye, [sign * 1.1, 0.7, 2.0],
                [['y', sign * 15 * Math.PI / 180]],
                blinkMotion, [sign * 1.1, 0.7, 2.0]
            );
        });

        const hands = global.BUILDER.generateRoundedSquareBowl(0.3, 0.3, 1.5, 50);
        [-1, 1].forEach(sign => {
            add(
                hands, colors.dark,
                combine(body, makeMatrix([sign * 1.3, -0.2, 0], [['z', sign * 35 * Math.PI / 180]]))
            );
        });

        const leg = global.BUILDER.generateCone(0.3, 0.2, 1, 50);
        const legSwingAxis = [0.27, 0.86, 0.43];
        const legSwingAxisLength = Math.hypot(...legSwingAxis);
        const normalizedLegSwingAxis = legSwingAxis.map(component => component / legSwingAxisLength);
        [-1, 1].forEach(sign => {
            const legPhase = sign > 0 ? 0 : Math.PI;
            const pivot = [sign * 0.49, -3.4, 0];
            add(
                leg, colors.body,
                combine(body, makeMatrix([sign * 0.49, -1.3, 0])),
                time => {
                    const sceneTime = time > 55
                        ? 10 + (time - 55) * 3.6
                        : time > 35 ? Math.min(10, 4.5 + time - 35) : time;
                    const step = Math.sin(sceneTime * 3.6 + legPhase);
                    const walkBlend = time > 55
                        ? Math.max(0, Math.min(1, (58.5 - time) / 0.5))
                        : 1;
                    return [
                        [normalizedLegSwingAxis, sign * 0.22 * step * walkBlend],
                        [[1, 0, 0], 0.34 * step * walkBlend],
                        ['t', [0, Math.max(0, step) * 0.12 * walkBlend, 0]]
                    ];
                },
                pivot
            );
        });

        add(
            global.BUILDER.generateHyperboloidCloak(0.001, 0.6, 3.5, Math.PI * 1.9, 40, 40),
            colors.cloak,
            combine(body, makeMatrix([0, 1.9, 0], [['y', 3.1]]))
        );

        const trailerMode = new URLSearchParams(global.location.search).has('trailer');
        const swordRotations = trailerMode
            ? [['z', 120 * Math.PI / 180]]
            : [['z', 40 * Math.PI / 180], ['x', 50 * Math.PI / 180], ['y', 25 * Math.PI / 180]];
        const handleAnchor = trailerMode ? [1.45, 1.05, 1.65] : [1.1, 0.74, -0.3];
        const swordMatrix = combine(body, makeMatrix(handleAnchor, swordRotations));
        add(
            global.BUILDER.generateCylinder(0.16, 1.2, 20),
            colors.handle,
            swordMatrix
        );
        parts[parts.length - 1].outline = 0;
        const blade = global.BUILDER.generateCone(0.5, 0.02, 3.5, 30);
        for (let i = 0; i < blade.vertices.length; i += 3) {
            blade.vertices[i + 1] -= 1.2;
            blade.vertices[i + 2] *= 0.15;
            blade.normals[i + 2] /= 0.15;
            const normalLength = Math.hypot(blade.normals[i], blade.normals[i + 1], blade.normals[i + 2]) || 1;
            blade.normals[i] /= normalLength;
            blade.normals[i + 1] /= normalLength;
            blade.normals[i + 2] /= normalLength;
        }
        add(
            blade,
            colors.blade,
            swordMatrix
        );
        parts[parts.length - 1].outline = 0;
        if (trailerMode) {
            const swordPivot = [handleAnchor[0], body[13] + handleAnchor[1], handleAnchor[2]];
            const readySwordMotion = time => {
                const swordKeys = [
                    [39.2, 0],
                    [39.7, -0.55],
                    [40.25, 1.25],
                    [40.8, 0.35],
                    [41.5, 0],
                    [55, 0],
                    [56.8, -0.6],
                    [58.2, 1.35],
                    [58.7, 0.35],
                    [59.4, 0],
                    [65, 0]
                ];
                let segment = 0;
                while (segment < swordKeys.length - 2 && time > swordKeys[segment + 1][0]) segment++;
                const current = swordKeys[segment];
                const next = swordKeys[segment + 1];
                const progress = Math.max(0, Math.min(1, (time - current[0]) / (next[0] - current[0])));
                const eased = progress * progress * (3 - 2 * progress);
                const angle = current[1] + (next[1] - current[1]) * eased;
                return [[[0, 0, 1], angle]];
            };
            parts.slice(-2).forEach(part => {
                part.pivot = [handleAnchor[0], body[13] + handleAnchor[1], handleAnchor[2]];
                part.motion = readySwordMotion;
            });
        }

        return parts;
    }

    global.buildKnightSceneParts = buildKnightSceneParts;
})(window);
