// main.js

window.onload = function() {
    const canvas = document.getElementById("glcanvas");
    const gl = canvas.getContext("webgl");

    if (!gl) {
        alert("WebGL tidak didukung di browser ini.");
        return;
    }

    // ==========================================
    // 1. SHADER & CAHAYA
    // ==========================================
    const vertCode = `
        attribute vec3 position;
        attribute vec3 normal;
        
        uniform mat4 Pmatrix;
        uniform mat4 Vmatrix;
        uniform mat4 Mmatrix;
        uniform mat3 Nmatrix;
        
        varying vec3 vNormal;
        
        void main() {
            gl_Position = Pmatrix * Vmatrix * Mmatrix * vec4(position, 1.0);
            vNormal = Nmatrix * normal;
        }
    `;

    const fragCode = `
        precision mediump float;
        
        uniform vec3 uColor; 
        varying vec3 vNormal;
        
        void main() {
            vec3 normal = normalize(vNormal);
            vec3 lightDirection = normalize(vec3(-0.45, 0.8, 0.7));
            vec3 viewDirection = vec3(0.0, 0.0, 1.0);
            vec3 halfDirection = normalize(lightDirection + viewDirection);
            float ambient = mix(0.30, 0.48, max(normal.y, 0.0));
            float diffuse = max(dot(normal, lightDirection), 0.0);
            float specular = pow(max(dot(normal, halfDirection), 0.0), 36.0) * 0.22;
            float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0) * 0.10;
            vec3 finalColor = uColor * (ambient + diffuse * 0.72 + rim) + vec3(specular);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, compileShader(gl.VERTEX_SHADER, vertCode));
    gl.attachShader(shaderProgram, compileShader(gl.FRAGMENT_SHADER, fragCode));
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    // ==========================================
    // 2. GEOMETRI BOLA DASAR (Satu cetakan untuk semua part)
    // ==========================================
    function createSphere(radius, latBands, longBands) {
        let pos = [], nor = [], ind = [];
        for (let latNumber = 0; latNumber <= latBands; latNumber++) {
            let theta = latNumber * Math.PI / latBands;
            let sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
            for (let longNumber = 0; longNumber <= longBands; longNumber++) {
                let phi = longNumber * 2 * Math.PI / longBands;
                let sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
                let x = cosPhi * sinTheta, y = cosTheta, z = sinPhi * sinTheta;
                pos.push(radius * x, radius * y, radius * z);
                nor.push(x, y, z);
            }
        }
        for (let latNumber = 0; latNumber < latBands; latNumber++) {
            for (let longNumber = 0; longNumber < longBands; longNumber++) {
                let first = (latNumber * (longBands + 1)) + longNumber;
                let second = first + longBands + 1;
                ind.push(first, second, first + 1);
                ind.push(second, second + 1, first + 1);
            }
        }
        return { pos, nor, ind };
    }

    function createEllipticParaboloid(segments, rings, scale = [1, 1, 1]) {
        const pos = [], nor = [], ind = [];
        for (let ring = 0; ring <= rings; ring++) {
            const radius = ring / rings;
            for (let side = 0; side <= segments; side++) {
                const angle = side * 2 * Math.PI / segments;
                const x = radius * Math.cos(angle);
                const z = radius * Math.sin(angle);
                const normal = [2 * x / scale[0], 1 / scale[1], 2 * z / scale[2]];
                const normalLength = Math.hypot(normal[0], normal[1], normal[2]);
                pos.push(x * scale[0], (0.5 - radius * radius) * scale[1], z * scale[2]);
                nor.push(normal[0] / normalLength, normal[1] / normalLength, normal[2] / normalLength);
            }
        }
        for (let ring = 0; ring < rings; ring++) {
            for (let side = 0; side < segments; side++) {
                const first = ring * (segments + 1) + side;
                const next = first + segments + 1;
                ind.push(first, next, first + 1, next, next + 1, first + 1);
            }
        }
        return { pos, nor, ind };
    }

    function createCylinder(segments) {
        const pos = [], nor = [], ind = [];
        for (let side = 0; side <= segments; side++) {
            const angle = side * 2 * Math.PI / segments;
            const x = Math.cos(angle), z = Math.sin(angle);
            pos.push(x, -0.5, z, x, 0.5, z);
            nor.push(x, 0, z, x, 0, z);
        }
        for (let side = 0; side < segments; side++) {
            const lower = side * 2;
            const upper = lower + 1;
            ind.push(lower, upper, lower + 2, upper, upper + 2, lower + 2);
        }
        for (const [y, normalY, reverse] of [[-0.5, -1, true], [0.5, 1, false]]) {
            const center = pos.length / 3;
            pos.push(0, y, 0);
            nor.push(0, normalY, 0);
            const ring = pos.length / 3;
            for (let side = 0; side <= segments; side++) {
                const angle = side * 2 * Math.PI / segments;
                pos.push(Math.cos(angle), y, Math.sin(angle));
                nor.push(0, normalY, 0);
            }
            for (let side = 0; side < segments; side++) {
                const first = ring + side;
                if (reverse) ind.push(center, first + 1, first);
                else ind.push(center, first, first + 1);
            }
        }
        return { pos, nor, ind };
    }

    const sphereData = createSphere(1.0, 30, 30);

    function createMeshBuffers(data) {
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.pos), gl.STATIC_DRAW);

        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.nor), gl.STATIC_DRAW);

        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.ind), gl.STATIC_DRAW);

        return { positionBuffer, normalBuffer, indexBuffer, indexCount: data.ind.length };
    }

    const sphereMesh = createMeshBuffers(sphereData);
    const paraboloidMesh = createMeshBuffers(createEllipticParaboloid(48, 32, [0.58, 0.289, 0.58]));
    const cylinderMesh = createMeshBuffers(createCylinder(24));
    const groundMesh = createMeshBuffers({
        pos: [-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1],
        nor: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
        ind: [0, 2, 1, 0, 3, 2]
    });
    const positionLocation = gl.getAttribLocation(shaderProgram, "position");
    const normalLocation = gl.getAttribLocation(shaderProgram, "normal");

    // ==========================================
    // 3. KONTROL MOUSE / TOUCH (DRAG)
    // ==========================================
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    // Sudut rotasi awal agar model serangga menghadap serong (seperti di screenshot)
    let rotation = { x: 0.18, y: 0.12 }; 

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            let deltaMove = {
                x: e.clientX - previousMousePosition.x,
                y: e.clientY - previousMousePosition.y
            };
            rotation.y += deltaMove.x * 0.01; // Putar kanan/kiri
            rotation.x += deltaMove.y * 0.01; // Putar atas/bawah
            previousMousePosition = { x: e.clientX, y: e.clientY };
        }
    });
    canvas.addEventListener('mouseup', () => isDragging = false);
    canvas.addEventListener('mouseleave', () => isDragging = false);

    // ==========================================
    // 4. RENDER LOOP & PERAKITAN MODEL LENGKAP
    // ==========================================
    const Pmatrix = gl.getUniformLocation(shaderProgram, "Pmatrix");
    const Vmatrix = gl.getUniformLocation(shaderProgram, "Vmatrix");
    const Mmatrix = gl.getUniformLocation(shaderProgram, "Mmatrix");
    const Nmatrix = gl.getUniformLocation(shaderProgram, "Nmatrix");
    const Ucolor = gl.getUniformLocation(shaderProgram, "uColor");

    let projMatrix = mat4.create();
    let viewMatrix = mat4.create();

    mat4.perspective(projMatrix, 45 * Math.PI / 180, canvas.width / canvas.height, 0.1, 100.0);
    mat4.translate(viewMatrix, viewMatrix, [0.0, 0.0, -8.0]);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    const animationStart = performance.now();
    const overlayMode = new URLSearchParams(window.location.search).has("overlay");

    // Fungsi perakit: Menggabungkan matriks induk, posisi, rotasi part, skala, dan warna
    function drawPart(baseMatrix, translation, partRotation, scale, color, mesh = sphereMesh) {
        let partMatrix = mat4.create();
        mat4.multiply(partMatrix, baseMatrix, partMatrix); 
        mat4.translate(partMatrix, partMatrix, translation);
        
        // Rotasi per bagian tubuh (misal: memiringkan tanduk atau kaki)
        mat4.rotateX(partMatrix, partMatrix, partRotation[0]);
        mat4.rotateY(partMatrix, partMatrix, partRotation[1]);
        mat4.rotateZ(partMatrix, partMatrix, partRotation[2]);
        
        mat4.scale(partMatrix, partMatrix, scale); 

        gl.uniformMatrix4fv(Mmatrix, false, partMatrix);
        gl.uniformMatrix3fv(Nmatrix, false, [
            partMatrix[0] / (scale[0] * scale[0]), partMatrix[1] / (scale[0] * scale[0]), partMatrix[2] / (scale[0] * scale[0]),
            partMatrix[4] / (scale[1] * scale[1]), partMatrix[5] / (scale[1] * scale[1]), partMatrix[6] / (scale[1] * scale[1]),
            partMatrix[8] / (scale[2] * scale[2]), partMatrix[9] / (scale[2] * scale[2]), partMatrix[10] / (scale[2] * scale[2])
        ]);
        gl.uniform3fv(Ucolor, color);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
        gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(normalLocation);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    function drawSegment(baseMatrix, start, end, radius, color) {
        const direction = [
            end[0] - start[0],
            end[1] - start[1],
            end[2] - start[2]
        ];
        const length = Math.hypot(direction[0], direction[1], direction[2]);
        const horizontalLength = Math.hypot(direction[0], direction[1]);
        const midpoint = [
            (start[0] + end[0]) / 2,
            (start[1] + end[1]) / 2,
            (start[2] + end[2]) / 2
        ];

        drawPart(
            baseMatrix,
            midpoint,
            [
                Math.atan2(direction[2], horizontalLength),
                0,
                Math.atan2(-direction[0], direction[1])
            ],
            [radius, length / 2 + radius * 0.35, radius],
            color
        );
    }

    const bezierMeshCache = new Map();

    function drawBezierCurve(baseMatrix, controlPoints, radius, color, steps = 12, taperTip = null, taperCurve = false) {
        const cacheKey = JSON.stringify([controlPoints, radius, steps, taperTip, taperCurve]);
        const cachedMesh = bezierMeshCache.get(cacheKey);
        if (cachedMesh) {
            drawPart(baseMatrix, [0, 0, 0], [0, 0, 0], [1, 1, 1], color, cachedMesh);
            return;
        }

        const pointAt = (t) => {
            const inverse = 1 - t;
            const weights = [
                inverse * inverse * inverse,
                3 * inverse * inverse * t,
                3 * inverse * t * t,
                t * t * t
            ];
            return [0, 1, 2].map((axis) =>
                controlPoints.reduce((value, point, index) => value + point[axis] * weights[index], 0)
            );
        };
        const points = Array.from({ length: steps + 1 }, (_, index) => pointAt(index / steps));
        const pointRadii = Array.from({ length: steps + 1 }, (_, index) =>
            radius * (taperCurve ? 1 - 0.58 * index / steps : 1)
        );
        const taperSteps = taperTip ? 8 : 0;
        const curveEnd = points[steps];
        const taperLength = taperTip
            ? Math.hypot(taperTip[0] - curveEnd[0], taperTip[1] - curveEnd[1], taperTip[2] - curveEnd[2])
            : 0;
        const taperStartDirection = [
            curveEnd[0] - points[steps - 1][0],
            curveEnd[1] - points[steps - 1][1],
            curveEnd[2] - points[steps - 1][2]
        ];
        const taperStartLength = Math.hypot(...taperStartDirection) || 1;
        const taperEndDirection = [
            taperTip ? taperTip[0] - curveEnd[0] : 0,
            taperTip ? taperTip[1] - curveEnd[1] : 0,
            taperTip ? taperTip[2] - curveEnd[2] : 0
        ];
        const taperEndLength = Math.hypot(...taperEndDirection) || 1;
        const taperControlStart = [
            curveEnd[0] + taperStartDirection[0] / taperStartLength * taperLength / 3,
            curveEnd[1] + taperStartDirection[1] / taperStartLength * taperLength / 3,
            curveEnd[2] + taperStartDirection[2] / taperStartLength * taperLength / 3
        ];
        const taperControlEnd = taperTip ? [
            taperTip[0] - taperEndDirection[0] / taperEndLength * taperLength / 3,
            taperTip[1] - taperEndDirection[1] / taperEndLength * taperLength / 3,
            taperTip[2] - taperEndDirection[2] / taperEndLength * taperLength / 3
        ] : null;
        for (let index = 1; index <= taperSteps; index++) {
            const progress = index / taperSteps;
            const inverse = 1 - progress;
            points.push([
                inverse ** 3 * curveEnd[0] +
                    3 * inverse ** 2 * progress * taperControlStart[0] +
                    3 * inverse * progress ** 2 * taperControlEnd[0] +
                    progress ** 3 * taperTip[0],
                inverse ** 3 * curveEnd[1] +
                    3 * inverse ** 2 * progress * taperControlStart[1] +
                    3 * inverse * progress ** 2 * taperControlEnd[1] +
                    progress ** 3 * taperTip[1],
                inverse ** 3 * curveEnd[2] +
                    3 * inverse ** 2 * progress * taperControlStart[2] +
                    3 * inverse * progress ** 2 * taperControlEnd[2] +
                    progress ** 3 * taperTip[2]
            ]);
            pointRadii.push(pointRadii[steps] * (1 - progress));
        }
        const ringCount = points.length - 1;
        const positions = [], normals = [], indices = [];
        const sides = taperTip ? 32 : 10;
        let previousNormalAxis = null;

        for (let ring = 0; ring <= ringCount; ring++) {
            const before = points[Math.max(0, ring - 1)];
            const after = points[Math.min(ringCount, ring + 1)];
            const tangent = [
                after[0] - before[0],
                after[1] - before[1],
                after[2] - before[2]
            ];
            const tangentLength = Math.hypot(tangent[0], tangent[1], tangent[2]) || 1;
            tangent[0] /= tangentLength;
            tangent[1] /= tangentLength;
            tangent[2] /= tangentLength;

            let normalAxis;
            if (previousNormalAxis) {
                const projection = previousNormalAxis[0] * tangent[0] +
                    previousNormalAxis[1] * tangent[1] +
                    previousNormalAxis[2] * tangent[2];
                normalAxis = [
                    previousNormalAxis[0] - projection * tangent[0],
                    previousNormalAxis[1] - projection * tangent[1],
                    previousNormalAxis[2] - projection * tangent[2]
                ];
            } else {
                const reference = Math.abs(tangent[1]) < 0.9
                    ? [0, 1, 0]
                    : [1, 0, 0];
                normalAxis = [
                    tangent[1] * reference[2] - tangent[2] * reference[1],
                    tangent[2] * reference[0] - tangent[0] * reference[2],
                    tangent[0] * reference[1] - tangent[1] * reference[0]
                ];
            }
            const axisLength = Math.hypot(normalAxis[0], normalAxis[1], normalAxis[2]) || 1;
            normalAxis[0] /= axisLength;
            normalAxis[1] /= axisLength;
            normalAxis[2] /= axisLength;
            previousNormalAxis = normalAxis;
            const binormal = [
                tangent[1] * normalAxis[2] - tangent[2] * normalAxis[1],
                tangent[2] * normalAxis[0] - tangent[0] * normalAxis[2],
                tangent[0] * normalAxis[1] - tangent[1] * normalAxis[0]
            ];

            for (let side = 0; side <= sides; side++) {
                const angle = side * 2 * Math.PI / sides;
                const cos = Math.cos(angle), sin = Math.sin(angle);
                const nx = normalAxis[0] * cos + binormal[0] * sin;
                const ny = normalAxis[1] * cos + binormal[1] * sin;
                const nz = normalAxis[2] * cos + binormal[2] * sin;
                positions.push(
                    points[ring][0] + pointRadii[ring] * nx,
                    points[ring][1] + pointRadii[ring] * ny,
                    points[ring][2] + pointRadii[ring] * nz
                );
                normals.push(nx, ny, nz);
            }
        }

        for (let ring = 0; ring < ringCount; ring++) {
            for (let side = 0; side < sides; side++) {
                const first = ring * (sides + 1) + side;
                const next = first + sides + 1;
                indices.push(first, first + 1, next, first + 1, next + 1, next);
            }
        }

        const startRing = positions.slice(0, (sides + 1) * 3);
        const startCenter = positions.length / 3;
        positions.push(...points[0]);
        const startTangent = [
            points[1][0] - points[0][0],
            points[1][1] - points[0][1],
            points[1][2] - points[0][2]
        ];
        const startLength = Math.hypot(...startTangent) || 1;
        normals.push(
            -startTangent[0] / startLength,
            -startTangent[1] / startLength,
            -startTangent[2] / startLength
        );
        const startCapRing = positions.length / 3;
        for (let side = 0; side <= sides; side++) {
            positions.push(...startRing.slice(side * 3, side * 3 + 3));
            normals.push(...normals.slice(side * 3, side * 3 + 3));
        }

        if (!taperTip) {
            const endRingStart = ringCount * (sides + 1) * 3;
            const endRing = positions.slice(endRingStart, endRingStart + (sides + 1) * 3);
            const endCenter = positions.length / 3;
            positions.push(...points[ringCount]);
            const endTangent = [
                points[ringCount][0] - points[ringCount - 1][0],
                points[ringCount][1] - points[ringCount - 1][1],
                points[ringCount][2] - points[ringCount - 1][2]
            ];
            const endLength = Math.hypot(...endTangent) || 1;
            normals.push(
                endTangent[0] / endLength,
                endTangent[1] / endLength,
                endTangent[2] / endLength
            );
            const endCapRing = positions.length / 3;
            for (let side = 0; side <= sides; side++) {
                positions.push(...endRing.slice(side * 3, side * 3 + 3));
                const normalOffset = (ringCount * (sides + 1) + side) * 3;
                normals.push(...normals.slice(normalOffset, normalOffset + 3));
            }
            for (let side = 0; side < sides; side++) {
                indices.push(endCenter, endCapRing + side, endCapRing + side + 1);
            }
        }

        for (let side = 0; side < sides; side++) {
            indices.push(startCenter, startCapRing + side + 1, startCapRing + side);
        }

        const curveMesh = createMeshBuffers({ pos: positions, nor: normals, ind: indices });
        bezierMeshCache.set(cacheKey, curveMesh);
        drawPart(baseMatrix, [0, 0, 0], [0, 0, 0], [1, 1, 1], color, curveMesh);
    }

    function render() {
        gl.clearColor(
            overlayMode ? 0 : 0.53,
            overlayMode ? 0 : 0.61,
            overlayMode ? 0 : 0.65,
            overlayMode ? 0 : 1
        );
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const elapsed = (performance.now() - animationStart) / 1000;
        const blinkPhase = elapsed % 4.2;
        const blink = blinkPhase < 0.12
            ? blinkPhase / 0.12
            : blinkPhase < 0.18
                ? 1
                : blinkPhase < 0.34
                    ? 1 - (blinkPhase - 0.18) / 0.16
                    : 0;

        let rootMatrix = mat4.create();
        mat4.rotateX(rootMatrix, rootMatrix, rotation.x);
        mat4.rotateY(rootMatrix, rootMatrix, rotation.y);
        mat4.translate(rootMatrix, rootMatrix, [0, 0.035 * Math.sin(elapsed * 2), 0]);
        const breathingScale = 1 + 0.055 * Math.sin(elapsed * 1.7);
        mat4.scale(rootMatrix, rootMatrix, [breathingScale, breathingScale, breathingScale]);

        gl.uniformMatrix4fv(Pmatrix, false, projMatrix);
        gl.uniformMatrix4fv(Vmatrix, false, viewMatrix);

        if (!overlayMode) {
            const groundMatrix = mat4.create();
            drawPart(groundMatrix, [0, -1.5, 0], [0, 0, 0], [5, 1, 5], [0.22, 0.39, 0.41], groundMesh);
        }

        window.buildPilflip(rootMatrix, {
            drawPart,
            drawBezierCurve,
            paraboloidMesh,
            cylinderMesh,
            elapsed,
            blink
        });

        requestAnimationFrame(render);
    }

    render();
};