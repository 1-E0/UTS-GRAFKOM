(function (global) {
    'use strict';

    const TAU = Math.PI * 2;
    const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const cross3 = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
    const norm3 = (a) => {
        const length = Math.hypot(a[0], a[1], a[2]) || 1;
        return [a[0] / length, a[1] / length, a[2] / length];
    };

    function createSphere() {
        const pos = [], nor = [], idx = [];
        const latBands = 30, longBands = 30;
        for (let lat = 0; lat <= latBands; lat++) {
            const theta = lat * Math.PI / latBands;
            for (let lon = 0; lon <= longBands; lon++) {
                const phi = lon * TAU / longBands;
                const x = Math.cos(phi) * Math.sin(theta);
                const y = Math.cos(theta);
                const z = Math.sin(phi) * Math.sin(theta);
                pos.push(x, y, z);
                nor.push(x, y, z);
            }
        }
        for (let lat = 0; lat < latBands; lat++) {
            for (let lon = 0; lon < longBands; lon++) {
                const first = lat * (longBands + 1) + lon;
                const second = first + longBands + 1;
                idx.push(first, second, first + 1, second, second + 1, first + 1);
            }
        }
        return { pos, nor, idx };
    }

    function createParaboloid() {
        const pos = [], nor = [], idx = [];
        const segments = 48, rings = 32, scale = [0.58, 0.289, 0.58];
        for (let ring = 0; ring <= rings; ring++) {
            const radius = ring / rings;
            for (let side = 0; side <= segments; side++) {
                const angle = side * TAU / segments;
                const x = radius * Math.cos(angle), z = radius * Math.sin(angle);
                const normal = [2 * x / scale[0], 1 / scale[1], 2 * z / scale[2]];
                const length = Math.hypot(normal[0], normal[1], normal[2]);
                pos.push(x * scale[0], (0.5 - radius * radius) * scale[1], z * scale[2]);
                nor.push(normal[0] / length, normal[1] / length, normal[2] / length);
            }
        }
        for (let ring = 0; ring < rings; ring++) {
            for (let side = 0; side < segments; side++) {
                const first = ring * (segments + 1) + side;
                const next = first + segments + 1;
                idx.push(first, next, first + 1, next, next + 1, first + 1);
            }
        }
        return { pos, nor, idx };
    }

    function createCylinder() {
        const pos = [], nor = [], idx = [];
        const segments = 24;
        for (let side = 0; side <= segments; side++) {
            const angle = side * TAU / segments;
            const x = Math.cos(angle), z = Math.sin(angle);
            pos.push(x, -0.5, z, x, 0.5, z);
            nor.push(x, 0, z, x, 0, z);
        }
        for (let side = 0; side < segments; side++) {
            const lower = side * 2, upper = lower + 1;
            idx.push(lower, upper, lower + 2, upper, upper + 2, lower + 2);
        }
        for (const [y, normalY, reverse] of [[-0.5, -1, true], [0.5, 1, false]]) {
            const center = pos.length / 3;
            pos.push(0, y, 0);
            nor.push(0, normalY, 0);
            const ring = pos.length / 3;
            for (let side = 0; side <= segments; side++) {
                const angle = side * TAU / segments;
                pos.push(Math.cos(angle), y, Math.sin(angle));
                nor.push(0, normalY, 0);
            }
            for (let side = 0; side < segments; side++) {
                const first = ring + side;
                if (reverse) idx.push(center, first + 1, first);
                else idx.push(center, first, first + 1);
            }
        }
        return { pos, nor, idx };
    }

    function createTube(controlPoints, radius, steps, taperTip, taperCurve) {
        const pointAt = (t) => {
            const inverse = 1 - t;
            const weights = [inverse ** 3, 3 * inverse ** 2 * t, 3 * inverse * t ** 2, t ** 3];
            return [0, 1, 2].map(axis =>
                controlPoints.reduce((sum, point, index) => sum + point[axis] * weights[index], 0)
            );
        };
        const points = Array.from({ length: steps + 1 }, (_, index) => pointAt(index / steps));
        const radii = Array.from({ length: steps + 1 }, (_, index) =>
            radius * (taperCurve ? 1 - 0.58 * index / steps : 1)
        );
        const tipSteps = taperTip ? 8 : 0;
        if (taperTip) {
            const end = points[steps];
            const distance = Math.hypot(taperTip[0] - end[0], taperTip[1] - end[1], taperTip[2] - end[2]);
            const startDirection = end.map((value, axis) => value - points[steps - 1][axis]);
            const startLength = Math.hypot(...startDirection) || 1;
            const endDirection = taperTip.map((value, axis) => value - end[axis]);
            const endLength = Math.hypot(...endDirection) || 1;
            const controlStart = end.map((value, axis) => value + startDirection[axis] / startLength * distance / 3);
            const controlEnd = taperTip.map((value, axis) => value - endDirection[axis] / endLength * distance / 3);
            for (let index = 1; index <= tipSteps; index++) {
                const t = index / tipSteps, inverse = 1 - t;
                points.push([0, 1, 2].map(axis =>
                    inverse ** 3 * end[axis] +
                    3 * inverse ** 2 * t * controlStart[axis] +
                    3 * inverse * t ** 2 * controlEnd[axis] +
                    t ** 3 * taperTip[axis]
                ));
                radii.push(radii[steps] * (1 - t));
            }
        }

        const ringCount = points.length - 1;
        const sides = taperTip ? 32 : 10;
        const pos = [], nor = [], idx = [];
        let previousNormal = null;
        for (let ring = 0; ring <= ringCount; ring++) {
            const before = points[Math.max(0, ring - 1)];
            const after = points[Math.min(ringCount, ring + 1)];
            const tangent = norm3(sub3(after, before));
            let normal;
            if (previousNormal) {
                const projection = previousNormal[0] * tangent[0] + previousNormal[1] * tangent[1] + previousNormal[2] * tangent[2];
                normal = previousNormal.map((value, axis) => value - projection * tangent[axis]);
            } else {
                const reference = Math.abs(tangent[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
                normal = cross3(tangent, reference);
            }
            normal = norm3(normal);
            previousNormal = normal;
            const binormal = cross3(tangent, normal);
            for (let side = 0; side <= sides; side++) {
                const angle = side * TAU / sides;
                const cos = Math.cos(angle), sin = Math.sin(angle);
                const nx = normal[0] * cos + binormal[0] * sin;
                const ny = normal[1] * cos + binormal[1] * sin;
                const nz = normal[2] * cos + binormal[2] * sin;
                pos.push(
                    points[ring][0] + radii[ring] * nx,
                    points[ring][1] + radii[ring] * ny,
                    points[ring][2] + radii[ring] * nz
                );
                nor.push(nx, ny, nz);
            }
        }
        for (let ring = 0; ring < ringCount; ring++) {
            for (let side = 0; side < sides; side++) {
                const first = ring * (sides + 1) + side;
                const next = first + sides + 1;
                idx.push(first, first + 1, next, first + 1, next + 1, next);
            }
        }
        return { pos, nor, idx };
    }

    global.createPilflipRenderer = function (gl, program, locations, bindMesh) {
        const upload = (geometry) => {
            const makeBuffer = (target, values, Type) => {
                const buffer = gl.createBuffer();
                gl.bindBuffer(target, buffer);
                gl.bufferData(target, new Type(values), gl.STATIC_DRAW);
                return buffer;
            };
            return {
                pos: makeBuffer(gl.ARRAY_BUFFER, geometry.pos, Float32Array),
                nor: makeBuffer(gl.ARRAY_BUFFER, geometry.nor, Float32Array),
                col: makeBuffer(gl.ARRAY_BUFFER, new Array(geometry.pos.length).fill(1), Float32Array),
                idx: makeBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.idx, Uint16Array),
                count: geometry.idx.length
            };
        };

        const sphere = upload(createSphere());
        const paraboloid = upload(createParaboloid());
        const cylinder = upload(createCylinder());
        const curveMeshes = [];
        const normalMatrix = mat3.create();
        const modelView = mat4.create();

        function drawPart(baseMatrix, translation, rotation, scale, color, mesh = sphere) {
            const part = mat4.create();
            mat4.multiply(part, baseMatrix, part);
            mat4.translate(part, part, translation);
            mat4.rotateX(part, part, rotation[0]);
            mat4.rotateY(part, part, rotation[1]);
            mat4.rotateZ(part, part, rotation[2]);
            mat4.scale(part, part, scale);
            mat4.multiply(modelView, drawPart.baseView, part);
            mat3.normalFromMat4(normalMatrix, modelView);
            gl.uniformMatrix4fv(locations.MV, false, modelView);
            gl.uniformMatrix3fv(locations.N, false, normalMatrix);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.FRONT);
            gl.uniform1f(locations.outline, 0.035);
            gl.uniform1f(locations.alpha, 1);
            gl.uniform1f(locations.useFlat, 1);
            gl.uniform3f(locations.flat, 0.02, 0.02, 0.04);
            gl.uniform3f(locations.tint, 1, 1, 1);
            gl.depthMask(false);
            bindMesh(mesh, mesh.idx);
            gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
            gl.depthMask(true);
            gl.disable(gl.CULL_FACE);
            gl.uniform1f(locations.outline, 0);
            gl.uniform1f(locations.useFlat, 0);
            gl.uniform3f(locations.flat, 0, 0, 0);
            gl.uniform3f(locations.tint, color[0], color[1], color[2]);
            bindMesh(mesh, mesh.idx);
            gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
        }

        function drawBezierCurve(baseMatrix, controlPoints, radius, color, steps = 12, taperTip = null, taperCurve = false) {
            const geometry = createTube(controlPoints, radius, steps, taperTip, taperCurve);
            const meshIndex = drawBezierCurve.meshIndex++;
            let mesh = curveMeshes[meshIndex];
            if (!mesh) {
                mesh = upload(geometry);
                curveMeshes[meshIndex] = mesh;
            } else {
                gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pos);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(geometry.pos));
                gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nor);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(geometry.nor));
            }
            drawPart(baseMatrix, [0, 0, 0], [0, 0, 0], [1, 1, 1], color, mesh);
        }

        return {
            draw(rootMatrix, baseView, projection, elapsed) {
                gl.useProgram(program);
                gl.uniformMatrix4fv(locations.P, false, projection);
                drawPart.baseView = baseView;
                drawBezierCurve.meshIndex = 0;
                const phase = elapsed % 4.2;
                const blink = phase < 0.12 ? phase / 0.12 :
                    phase < 0.18 ? 1 :
                    phase < 0.34 ? 1 - (phase - 0.18) / 0.16 : 0;
                global.buildPilflip(rootMatrix, {
                    drawPart,
                    drawBezierCurve,
                    paraboloidMesh: paraboloid,
                    cylinderMesh: cylinder,
                    elapsed,
                    blink
                });
            }
        };
    };
})(window);
