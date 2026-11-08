function main() {
    const canvas = document.getElementById('myCanvas');
    const gl = canvas.getContext('webgl');

    if (!gl) { alert("WebGL tidak didukung."); return; }

    const vertCode = `
        attribute vec3 position;
        attribute vec3 normal; 
        uniform mat4 Pmatrix;
        uniform mat4 Vmatrix;
        uniform mat4 Mmatrix;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main(void) {
            vec4 viewPosition = Vmatrix * Mmatrix * vec4(position, 1.0);
            vNormal = mat3(Vmatrix * Mmatrix) * normal;
            vViewPosition = viewPosition.xyz;
            gl_Position = Pmatrix * viewPosition;
        }
    `;
    
    const fragCode = `
        precision mediump float;
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main(void) {
            vec3 normal = normalize(vNormal);
            if (!gl_FrontFacing) normal = -normal;
            vec3 lightDir = normalize(vec3(-0.45, 0.8, 0.7));
            vec3 viewDir = normalize(-vViewPosition);
            float diffuse = max(dot(normal, lightDir), 0.0);
            float toon = diffuse < 0.24 ? 0.18 : (diffuse < 0.58 ? 0.52 : 1.0);
            float specular = pow(max(dot(normal, normalize(lightDir + viewDir)), 0.0), 28.0) * 0.16;
            float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0) * 0.14;
            vec3 shadedColor = uColor * (0.34 + 0.66 * toon) + vec3(specular + rim * 0.35);
            gl_FragColor = vec4(shadedColor, 1.0);
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
    // 1. PEMBUATAN GEOMETRI & BUFFER
    // ==========================================
    const bottomGeom = BUILDER.generateRoundedSquareBowl(2.3, 2, 1, 50);
    const midGeom = BUILDER.generateRoundedCylinder(2.3, 2, 2.5, 50); 
    const topGeom = BUILDER.generateRoundedSquareBowl(2.3, 2, 1, 50); 
    const eyeGeom = BUILDER.generateSphere(0.65, 0.65, 0.3, 30, 30);
    const hornGeom = BUILDER.generateHorn(0.6, 1.7, Math.PI * 0.75, 40);
    const bodyGeom = BUILDER.generateBody(1, 1, 1.5, 0.1, 40, 40);
    const handsGeom = BUILDER.generateRoundedSquareBowl(0.3, 0.3, 1.5, 50);
    const legsGeom = BUILDER.generateCone(0.3, 0.2, 1, 50);
    const cloakGeom = BUILDER.generateHyperboloidCloak(0.001, 0.6, 3.5, Math.PI * 1.9, 40, 40);
    const handleGeom = BUILDER.generateCylinder(0.16, 1.2, 20);
    const bladeGeom = BUILDER.generateCone(0.5, 0.02, 3.5, 30);

    function createBuffer(geometry) {
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.vertices), gl.STATIC_DRAW);
        
        const nbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, nbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.normals), gl.STATIC_DRAW);

        const ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);
        
        return { vbo, nbo, ibo, length: geometry.indices.length };
    }

    const bottomBuf = createBuffer(bottomGeom);
    const midBuf = createBuffer(midGeom);
    const topBuf = createBuffer(topGeom); 
    const eyeBuf = createBuffer(eyeGeom); 
    const hornBuf = createBuffer(hornGeom);
    const bodyBuf = createBuffer(bodyGeom);
    const handsBuf = createBuffer(handsGeom);
    const legsBuf = createBuffer(legsGeom);
    const shroudBuf = createBuffer(cloakGeom);
    const handleBuf = createBuffer(handleGeom);
    const bladeBuf = createBuffer(bladeGeom);

    // ==========================================
    // 2. LOKASI VARIABEL SHADER & EVENT MOUSE
    // ==========================================
    const positionLocation = gl.getAttribLocation(shaderProgram, "position");
    const normalLocation = gl.getAttribLocation(shaderProgram, "normal"); 
    const pMatrixLocation = gl.getUniformLocation(shaderProgram, "Pmatrix");
    const vMatrixLocation = gl.getUniformLocation(shaderProgram, "Vmatrix");
    const mMatrixLocation = gl.getUniformLocation(shaderProgram, "Mmatrix");
    const colorLocation = gl.getUniformLocation(shaderProgram, "uColor");

    let isDragging = false;
    let oldX = 0, oldY = 0;
    let rotX = 0, rotY = 0; 

    canvas.addEventListener("mousedown", e => { isDragging = true; oldX = e.pageX; oldY = e.pageY; e.preventDefault(); });
    canvas.addEventListener("mouseup", () => isDragging = false);
    canvas.addEventListener("mouseout", () => isDragging = false);
    canvas.addEventListener("mousemove", e => {
        if (!isDragging) return;
        rotY += (e.pageX - oldX) * 0.01; 
        rotX += (e.pageY - oldY) * 0.01;
        oldX = e.pageX; oldY = e.pageY;
        e.preventDefault();
    });

    function drawObject(buffer, matrix, color) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vbo);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer.nbo);
        gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(normalLocation);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer.ibo);
        
        gl.uniformMatrix4fv(mMatrixLocation, false, matrix);
        gl.uniform3fv(colorLocation, color);
        gl.drawElements(gl.TRIANGLES, buffer.length, gl.UNSIGNED_SHORT, 0);
    }

    // ==========================================
    // 3. ARSITEKTUR SCENE GRAPH (ENGINE CORE)
    // ==========================================
    class SceneNode {
        constructor(buffer = null, color = [1, 1, 1]) {
            this.buffer = buffer;
            this.color = color;
            this.localMatrix = LIBS.get_I4(); // Posisi relatif terhadap Induk
            this.worldMatrix = LIBS.get_I4(); // Posisi absolut di dunia 3D
            this.children = [];
            this.onUpdate = null; // Hook untuk animasi dinamis per frame
        }

        addChild(node) {
            this.children.push(node);
            return node; 
        }

        update(parentWorldMatrix) {
            if (this.onUpdate) this.onUpdate(this); 
            this.worldMatrix = LIBS.multiply(this.localMatrix, parentWorldMatrix);
            for (let child of this.children) {
                child.update(this.worldMatrix);
            }
        }

        draw(drawFunc) {
            if (this.buffer) {
                drawFunc(this.buffer, this.worldMatrix, this.color);
            }
            for (let child of this.children) {
                child.draw(drawFunc);
            }
        }
    }

    // ==========================================
    // 4. MEMBANGUN POHON HIRARKI KARAKTER
    // ==========================================
    const sceneRoot = new SceneNode(); // Titik jangkar dunia (Mouse Control)

    // A. BADAN (Induk Utama)
    const bodyNode = new SceneNode(bodyBuf, [0.1, 0.1, 0.1]);
    LIBS.translateY(bodyNode.localMatrix, -2.1);
    sceneRoot.addChild(bodyNode);

    // B. KEPALA & KOMPONENNYA (Anak dari Badan)
    const headNode = new SceneNode();
    LIBS.translateY(headNode.localMatrix, 2.1); 
    bodyNode.addChild(headNode);

    const bottomNode = new SceneNode(bottomBuf, [1, 1, 1]);
    LIBS.translateY(bottomNode.localMatrix, -1.0);
    headNode.addChild(bottomNode);

    const midNode = new SceneNode(midBuf, [1, 1, 1]); 
    headNode.addChild(midNode);

    const topNode = new SceneNode(topBuf, [1, 1, 1]);
    LIBS.translateY(topNode.localMatrix, 3.5);
    LIBS.rotateX(topNode.localMatrix, Math.PI);
    headNode.addChild(topNode);

    const leftHorn = new SceneNode(hornBuf, [1, 1, 1]);
    LIBS.translateY(leftHorn.localMatrix, 2.6);
    LIBS.translateX(leftHorn.localMatrix, -1.8);
    LIBS.translateZ(leftHorn.localMatrix, -0.1);
    LIBS.rotateY(leftHorn.localMatrix, LIBS.degToRad(180));
    LIBS.rotateZ(leftHorn.localMatrix, LIBS.degToRad(60));
    headNode.addChild(leftHorn);

    const rightHorn = new SceneNode(hornBuf, [1, 1, 1]);
    LIBS.translateY(rightHorn.localMatrix, 2.6);
    LIBS.translateX(rightHorn.localMatrix, 1.8);
    LIBS.translateZ(rightHorn.localMatrix, 0.1);
    LIBS.rotateZ(rightHorn.localMatrix, LIBS.degToRad(-60));
    headNode.addChild(rightHorn);

    // Animasi Mata (Dynamic Hook)
    const eyeUpdateHook = function(node, isRight) {
        const m = LIBS.get_I4(); // Buat matriks baru yang bersih setiap frame
        let blinkCycle = Date.now() % 2000;
        let scaleY = (blinkCycle < 150) ? Math.max(0.05, Math.abs(Math.cos((blinkCycle/150) * Math.PI))) : 1.0;
        
        LIBS.scaleY(m, scaleY);
        LIBS.translateY(m, 0.7);
        LIBS.translateX(m, isRight ? 1.1 : -1.1);
        LIBS.translateZ(m, 2.0);
        LIBS.rotateY(m, LIBS.degToRad(isRight ? 15 : -15));
        
        node.localMatrix = m; // Timpa matriks lokal dengan animasi terbaru
    };

    const leftEye = new SceneNode(eyeBuf, [0.03, 0.03, 0.03]);
    leftEye.onUpdate = (node) => eyeUpdateHook(node, false);
    headNode.addChild(leftEye);

    const rightEye = new SceneNode(eyeBuf, [0.03, 0.03, 0.03]);
    rightEye.onUpdate = (node) => eyeUpdateHook(node, true);
    headNode.addChild(rightEye);

    // C. TANGAN & KAKI (Anak dari Badan)
    const leftHand = new SceneNode(handsBuf, [0.1, 0.1, 0.1]);
    LIBS.translateY(leftHand.localMatrix, -0.2);
    LIBS.translateX(leftHand.localMatrix, -1.3);
    LIBS.rotateZ(leftHand.localMatrix, LIBS.degToRad(-35));
    bodyNode.addChild(leftHand);

    const rightHand = new SceneNode(handsBuf, [0.1, 0.1, 0.1]);
    LIBS.translateY(rightHand.localMatrix, -0.2);
    LIBS.translateX(rightHand.localMatrix, 1.3);
    LIBS.rotateZ(rightHand.localMatrix, LIBS.degToRad(35));
    bodyNode.addChild(rightHand);

    const leftLeg = new SceneNode(legsBuf, [0.1, 0.1, 0.1]);
    leftLeg.onUpdate = (node) => {
        const m = LIBS.get_I4();
        const step = Math.sin((Date.now() / 1000) * 3.6 + Math.PI);
        LIBS.translateY(m, -1.3 + Math.max(0, step) * 0.12);
        LIBS.translateX(m, -0.49);
        LIBS.rotateX(m, 0.34 * step);
        node.localMatrix = m;
    };
    bodyNode.addChild(leftLeg);

    const rightLeg = new SceneNode(legsBuf, [0.1, 0.1, 0.1]);
    rightLeg.onUpdate = (node) => {
        const m = LIBS.get_I4();
        const step = Math.sin((Date.now() / 1000) * 3.6);
        LIBS.translateY(m, -1.3 + Math.max(0, step) * 0.12);
        LIBS.translateX(m, 0.49);
        LIBS.rotateX(m, 0.34 * step);
        node.localMatrix = m;
    };
    bodyNode.addChild(rightLeg);

    // D. JUBAH (Anak dari Badan)
    const cloakNode = new SceneNode(shroudBuf, [0.2, 0.2, 0.2]);
    LIBS.translateY(cloakNode.localMatrix, 1.9); 
    LIBS.rotateY(cloakNode.localMatrix, 3.1);
    bodyNode.addChild(cloakNode);

    // E. PEDANG (Anak dari Badan)
    const swordHandle = new SceneNode(handleBuf, [0.3, 0.3, 0.3]);
    LIBS.translateY(swordHandle.localMatrix, 0.74);
    LIBS.translateX(swordHandle.localMatrix, 1);
    LIBS.translateZ(swordHandle.localMatrix, -1.62);
    LIBS.rotateZ(swordHandle.localMatrix, LIBS.degToRad(-40));
    LIBS.rotateX(swordHandle.localMatrix, LIBS.degToRad(50));
    LIBS.rotateY(swordHandle.localMatrix, LIBS.degToRad(25));
    bodyNode.addChild(swordHandle);

    const swordBlade = new SceneNode(bladeBuf, [0.8, 0.8, 0.85]);
    LIBS.translateY(swordBlade.localMatrix, 0.3);
    LIBS.translateX(swordBlade.localMatrix, 0.4);
    LIBS.translateZ(swordBlade.localMatrix, -1.8);
    LIBS.rotateZ(swordBlade.localMatrix, LIBS.degToRad(-40));
    LIBS.rotateX(swordBlade.localMatrix, LIBS.degToRad(50));
    LIBS.rotateY(swordBlade.localMatrix, LIBS.degToRad(25));
    LIBS.scaleZ(swordBlade.localMatrix, 0.15);
    bodyNode.addChild(swordBlade);

    // ==========================================
    // 5. RENDER LOOP
    // ==========================================
    const animationStart = performance.now();

    function render() {
        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0.2, 0.2, 0.2, 1.0); 
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const PROJMATRIX = LIBS.get_projection(40, canvas.width / canvas.height, 1, 100);
        const VIEWMATRIX = LIBS.get_I4();
        LIBS.translateZ(VIEWMATRIX, -14); 
        LIBS.translateY(VIEWMATRIX, -1.0); 

        gl.uniformMatrix4fv(pMatrixLocation, false, PROJMATRIX);
        gl.uniformMatrix4fv(vMatrixLocation, false, VIEWMATRIX);

        const BASE_MATRIX = LIBS.get_I4();
        LIBS.rotateX(BASE_MATRIX, rotX); 
        LIBS.rotateY(BASE_MATRIX, rotY); 
        const elapsed = (performance.now() - animationStart) / 1000;
        LIBS.rotateAxis(BASE_MATRIX, 0.08 * Math.sin(elapsed * 1.4), [1, 0.65, 0.45]);

        const newBodyMatrix = LIBS.get_I4(); 
        LIBS.translateY(newBodyMatrix, -2.1);
        
        bodyNode.localMatrix = newBodyMatrix; 

        // HANYA PANGGIL SATU KALI SAJA
        sceneRoot.update(BASE_MATRIX);
        sceneRoot.draw(drawObject);

        requestAnimationFrame(render);
    }
    render();
}