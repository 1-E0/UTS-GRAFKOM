// main.js - Vengefly (Hollow Knight) dengan permukaan matematis & kurva Bezier
// Kepala: elliptic paraboloid | Mata: elliptic paraboloid pipih | Badan: cone terbalik
// Sengat & kaki: cone kecil | Sayap: hyperbolic paraboloid
// Tepi sayap & antena/capit: Bezier sweep mesh

// ---------- SHADER ----------
const vsSource = `
    attribute vec3 aPos;
    attribute vec3 aNor;
    attribute vec3 aCol;
    uniform mat4 uMV;
    uniform mat4 uP;
    uniform mat3 uN;
    uniform float uOutline;
    uniform vec3 uTint;
    varying vec3 vN;
    varying vec3 vC;
    void main(void) {
        vec3 p = aPos + aNor * uOutline;
        gl_Position = uP * uMV * vec4(p, 1.0);
        vN = uN * aNor;
        vC = aCol * uTint;
    }
`;
const fsSource = `
    precision mediump float;
    uniform float uAlpha;
    uniform float uUseFlat;
    uniform vec3 uFlat;
    varying vec3 vN;
    varying vec3 vC;
    void main(void) {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        float d = max(dot(n, normalize(vec3(0.4, 0.6, 0.8))), 0.0);
        float t = d < 0.2 ? 0.0 : (d < 0.55 ? 0.5 : 1.0);   // toon shading
        vec3 c = vC * (0.45 + 0.65 * t);
        c = mix(c, uFlat, uUseFlat);
        gl_FragColor = vec4(c, uAlpha);
    }
`;

// ---------- HELPER VEKTOR ----------
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const TAU = Math.PI * 2;
const rad = (d) => d * Math.PI / 180;

// Kurva Bezier kubik (3D)
function bezier(P, t) {
    const m = 1 - t;
    return [0, 1, 2].map(i => m * m * m * P[0][i] + 3 * m * m * t * P[1][i] + 3 * m * t * t * P[2][i] + t * t * t * P[3][i]);
}

// Matriks transformasi: translasi lalu rangkaian rotasi [['x'|'y'|'z', radian], ...]
function makeM(t, ops) {
    const m = mat4.create();
    mat4.translate(m, m, t);
    (ops || []).forEach(([ax, a]) => {
        if (ax === 'x') mat4.rotateX(m, m, a);
        if (ax === 'y') mat4.rotateY(m, m, a);
        if (ax === 'z') mat4.rotateZ(m, m, a);
    });
    return m;
}

// ---------- GENERATOR PERMUKAAN PARAMETRIK ----------
// fn(u,v) -> [x,y,z], u dan v di [0,1]. Normal dihitung dari turunan numerik.
function buildSurface(fn, nu, nv, o) {
    const M = o.m || mat4.create();
    const N = mat3.create();
    mat3.normalFromMat4(N, M);
    const pos = [], nor = [], col = [], idx = [];
    const e = 1e-3;

    for (let i = 0; i <= nu; i++) {
        for (let j = 0; j <= nv; j++) {
            const u = i / nu, v = j / nv;
            const p = fn(u, v);
            const uc = Math.min(1 - e, Math.max(e, u));
            const vc = Math.min(1 - e, Math.max(e, v));
            const pu = sub3(fn(uc + e, vc), fn(uc - e, vc));
            const pv = sub3(fn(uc, vc + e), fn(uc, vc - e));
            const n = cross3(pu, pv);
            // transformasi ke ruang dunia
            pos.push(
                M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12],
                M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13],
                M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]
            );
            const nn = norm3([
                N[0] * n[0] + N[3] * n[1] + N[6] * n[2],
                N[1] * n[0] + N[4] * n[1] + N[7] * n[2],
                N[2] * n[0] + N[5] * n[1] + N[8] * n[2]
            ]);
            nor.push(nn[0], nn[1], nn[2]);
            const c = typeof o.color === 'function' ? o.color(u, v) : o.color;
            col.push(c[0], c[1], c[2]);
        }
    }
    for (let i = 0; i < nu; i++) {
        for (let j = 0; j < nv; j++) {
            const a = i * (nv + 1) + j, b = a + nv + 1, c = a + 1, d = b + 1;
            idx.push(a, b, c, b, d, c);
        }
    }
    // pastikan normal mengarah keluar (untuk bentuk tertutup/hampir cembung)
    if (o.auto) {
        const cnt = pos.length / 3;
        let cx = 0, cy = 0, cz = 0;
        for (let k = 0; k < cnt; k++) { cx += pos[3 * k]; cy += pos[3 * k + 1]; cz += pos[3 * k + 2]; }
        cx /= cnt; cy /= cnt; cz /= cnt;
        let s = 0;
        for (let k = 0; k < cnt; k++) {
            s += nor[3 * k] * (pos[3 * k] - cx) + nor[3 * k + 1] * (pos[3 * k + 1] - cy) + nor[3 * k + 2] * (pos[3 * k + 2] - cz);
        }
        if (s < 0) {
            for (let k = 0; k < nor.length; k++) nor[k] = -nor[k];
            for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
        }
    }
    return {
        pos, nor, col, idx, outline: o.outline || 0, alpha: o.alpha || 1, solid: !o.alpha,
        pivot: o.pivot || [0, 0, 0], motion: o.motion || null
    };
}

// ---------- ANIMASI TERBANG ----------
// Tiap bagian boleh punya pivot + motion(t) -> [[sumbu, sudut], ...] (rotasi mengelilingi pivot)
const CENTER = [0, 0.3, 0];          // pivot pose terbang
const VIEW_CENTER = [-0.5, 1.5, 0];   // titik yang dipusatkan kamera
const TILT = -0.50;   // pose terbang: ekor turun, kepala sedikit terangkat
function motionMatrix(m, t) {
    const out = mat4.create();
    if (!m.motion) return out;
    mat4.translate(out, out, m.pivot);
    m.motion(t).forEach(op => {
        if (op[0] === 's' || op[0] === 'scale') mat4.scale(out, out, op[1]);
        else if (op[0] === 't' || op[0] === 'translate') mat4.translate(out, out, op[1]);
        else mat4.rotate(out, out, op[1], op[0]);              // [sumbu, sudut]
    });
    mat4.translate(out, out, [-m.pivot[0], -m.pivot[1], -m.pivot[2]]);
    return out;
}
// seluruh badan naik-turun & sedikit miring saat melayang
function sceneMatrix(t) {
    const out = mat4.create();
    mat4.translate(out, out, CENTER);
    mat4.translate(out, out, [0, Math.sin(t * 3.2) * 0.14, 0]);
    mat4.rotateZ(out, out, TILT + Math.sin(t * 3.2 + 0.6) * 0.035);
    mat4.translate(out, out, [-CENTER[0], -CENTER[1], -CENTER[2]]);
    return out;
}

// ---------- BENTUK-BENTUK ----------
// Elliptic paraboloid: z = h*u^2, x = a*u*cos, y = b*u*sin
const ellipticParaboloid = (a, b, h) => (u, v) =>
    [a * u * Math.cos(v * TAU), b * u * Math.sin(v * TAU), h * u * u];

// Elliptic paraboloid terbalik (kubah pipih) - untuk mata
const paraboloidDome = (a, b, h) => (u, v) =>
    [a * u * Math.cos(v * TAU), b * u * Math.sin(v * TAU), h * (1 - u * u)];

// Cone ujung di z=0, alas di z=H
const coneApexDown = (R, H) => (u, v) =>
    [R * u * Math.cos(v * TAU), R * u * Math.sin(v * TAU), H * u];

// Cone alas di z=0, ujung di z=L
const coneApexUp = (R, L) => (u, v) =>
    [R * (1 - u) * Math.cos(v * TAU), R * (1 - u) * Math.sin(v * TAU), L * u];

// Tutup lingkaran (disc) di z=H
const disc = (R, H) => (u, v) => [R * u * Math.cos(v * TAU), R * u * Math.sin(v * TAU), H];

// Bezier sweep: lingkaran disapukan sepanjang kurva C(u) dengan jari-jari R(u)
function bezierSweep(C, R) {
    return (u, v) => {
        const e = 1e-3;
        const t = norm3(sub3(C(Math.min(1, u + e)), C(Math.max(0, u - e))));
        const ref = Math.abs(t[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
        const n = norm3(cross3(ref, t));
        const b = cross3(t, n);
        const p = C(u), r = R(u);
        const cs = Math.cos(v * TAU), sn = Math.sin(v * TAU);
        return [p[0] + r * (cs * n[0] + sn * b[0]), p[1] + r * (cs * n[1] + sn * b[1]), p[2] + r * (cs * n[2] + sn * b[2])];
    };
}

// Sayap: hyperbolic paraboloid z = K((2u-1)^2 - (2t-1)^2),
// dengan batas atas/bawah mengikuti kurva Bezier (bentuk daun)
function wingPoint(L, W, K) {
    const top = [[0, 0, 0], [0.20 * L, 0.95 * W, 0], [0.65 * L, 0.75 * W, 0], [L, 0, 0]];
    const bot = [[0, 0, 0], [0.25 * L, -0.35 * W, 0], [0.70 * L, -0.45 * W, 0], [L, 0, 0]];
    return (u, t) => {
        const a = bezier(top, u), b = bezier(bot, u);
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        const z = K * ((2 * u - 1) * (2 * u - 1) - (2 * t - 1) * (2 * t - 1));
        return [x, y, z];
    };
}

// ---------- SUSUN KARAKTER ----------
// Semua bagian dibangun pada SATU sumbu badan (sumbu +X = arah ekor, +Y = punggung, Z = kiri/kanan),
// lalu seluruh tubuh dimiringkan sekaligus oleh sceneMatrix() sebagai pose terbang.
function buildVengefly() {
    const parts = [];
    const BONE = [0.92, 0.86, 0.84];
    const BLUE = [0.17, 0.30, 0.58];
    const DARK = [0.08, 0.10, 0.20];
    const BLACK = [0.04, 0.04, 0.07];

    // ----- BADAN: cone dibalik, ujung (ekor) di +X, sumbu tepat di Y=0 -----
    const BR = 1.5, BH = 3.2, BP = 0.55, ZS = 0.82;   // BP = 1 -> cone lurus murni
    const TAIL = 2.0;                                  // x ujung ekor
    const bodyM = makeM([TAIL, 0, 0], [['y', -Math.PI / 2]]);   // sumbu lokal z -> -X
    const bodyR = (s) => BR * Math.pow(s / BH, BP);              // s = jarak dari ujung ekor
    // titik di permukaan badan: s (axial), z (kiri/kanan), side +1 punggung / -1 perut
    const surfPt = (s, z, side, k) => {
        const r = bodyR(s);
        const q = Math.sqrt(Math.max(0.02, 1 - (z / (ZS * r)) * (z / (ZS * r))));
        return [TAIL - s, side * r * q * k];
    };
    parts.push(buildSurface((u, v) => {
        const r = BR * Math.pow(u, BP);
        return [ZS * r * Math.cos(v * TAU), r * Math.sin(v * TAU), BH * u];
    }, 36, 44, {
        m: bodyM, outline: 0.04, auto: true,
        color: (u) => {
            const band = u * 6, f = band - Math.floor(band);
            if (f < 0.07 && u > 0.12) return [0.06, 0.09, 0.22];   // garis segmen
            const tone = (Math.floor(band) % 2) ? 1.0 : 0.86;
            return [BLUE[0] * tone, BLUE[1] * tone, BLUE[2] * tone];
        }
    }));
    // tutup depan badan: kubah elliptic paraboloid
    const capM = mat4.clone(bodyM);
    mat4.translate(capM, capM, [0, 0, BH]);
    parts.push(buildSurface(paraboloidDome(BR * ZS, BR, 0.7), 12, 44, { m: capM, color: [0.20, 0.33, 0.62], outline: 0.04, auto: true }));

    // ----- KEPALA: elliptic paraboloid di depan badan (-X), moncong ke depan-bawah -----
    const xFront = TAIL - BH;                           // x ujung depan badan
    const hAng = rad(38), HL = 1.35, HA = 0.85, HB = 0.95;
    const hd = [Math.cos(hAng), Math.sin(hAng)], hp = [-Math.sin(hAng), Math.cos(hAng)];
    const rim = [xFront - 0.15, -0.70];                 // pusat tepi kepala, menempel di depan-bawah badan
    const Hp = [rim[0] - hd[0] * HL, rim[1] - hd[1] * HL];
    const headM = makeM([Hp[0], Hp[1], 0], [['z', hAng], ['y', Math.PI / 2]]);
    parts.push(buildSurface(ellipticParaboloid(HA, HB, HL), 24, 36, { m: headM, color: BONE, outline: 0.035, auto: true }));
    const skullM = mat4.clone(headM);
    mat4.translate(skullM, skullM, [0, 0, HL]);
    parts.push(buildSurface(paraboloidDome(HA, HB, 0.4), 12, 36, { m: skullM, color: BONE, outline: 0.035, auto: true }));

    // ----- MATA (2): elliptic paraboloid pipih, simetris kiri-kanan -----
    const eye = paraboloidDome(0.17, 0.27, 0.10);
    const et = 0.78, eoff = 0.12;
    const ex = Hp[0] + hd[0] * et + hp[0] * eoff, ey = Hp[1] + hd[1] * et + hp[1] * eoff;
    const ez = HA * Math.sqrt(et / HL) - 0.05;
    // kedip: mata dipipihkan searah sumbu panjangnya lalu dibuka lagi.
    // Siklus 3.2 dtk: 1 kedipan; tiap siklus ke-3 kedip dua kali (cepat).
    const blinkK = (t) => {
        const CY = 3.2, DUR = 0.16;
        const cyc = Math.floor(t / CY), ph = t - cyc * CY;
        const pulse = (p) => (p >= 0 && p < DUR) ? Math.sin(p / DUR * Math.PI) : 0;
        let b = pulse(ph);
        if (cyc % 3 === 2) b = Math.max(b, pulse(ph - 0.30));
        return Math.max(0.04, 1 - 0.96 * b);
    };
    const Z = [0, 0, 1];
    const blink = (t) => [[Z, hAng], ['scale', [1, blinkK(t), 1]], [Z, -hAng]];
    parts.push(buildSurface(eye, 12, 20, {
        m: makeM([ex, ey, ez], [['z', hAng]]), color: BLACK, auto: true,
        pivot: [ex, ey, ez], motion: blink
    }));
    parts.push(buildSurface(eye, 12, 20, {
        m: makeM([ex, ey, -ez], [['z', hAng], ['y', Math.PI]]), color: BLACK, auto: true,   // cermin mata kiri
        pivot: [ex, ey, -ez], motion: blink
    }));

    // ----- ANTENA / CAPIT (2): Bezier sweep dari moncong, simetris -----
    [1, -1].forEach(s => {
        const P = [
            [Hp[0] + 0.15, Hp[1] + 0.10, 0.14 * s],
            [Hp[0] - 0.10, Hp[1] - 0.75, 0.28 * s],
            [Hp[0] - 0.75, Hp[1] - 1.00, 0.38 * s],
            [Hp[0] - 1.05, Hp[1] - 0.40, 0.38 * s]
        ];
        parts.push(buildSurface(
            bezierSweep(t => bezier(P, t), t => 0.24 * Math.pow(1 - t, 0.8) + 0.04),
            32, 12, {
                color: BONE, outline: 0.03, auto: true,
                pivot: [Hp[0] + 0.15, Hp[1] + 0.10, 0],
                motion: (t) => [[[0, 1, 0], s * (0.10 + 0.10 * Math.sin(t * 5))]]   // membuka-menutup
            }
        ));
    });

    // ----- SENGAT / EKOR: cone kecil, segaris dengan sumbu badan -----
    parts.push(buildSurface(coneApexUp(0.2, 0.9), 10, 20, {
        m: makeM([TAIL - 0.05, 0, 0], [['y', Math.PI / 2]]),     // sumbu lokal z -> +X
        color: DARK, outline: 0.03, auto: true,
        pivot: [TAIL, 0, 0],
        motion: (t) => [[[0, 0, 1], 0.08 * Math.sin(t * 6)]]
    }));

    // ----- KAKI (4): cone kecil, 2 pasang simetris di perut -----
    [2.3, 2.85].forEach((sx, k) => {
        [0.34, -0.34].forEach(z => {
            const [x, y] = surfPt(sx, z, -1, 0.92);
            parts.push(buildSurface(coneApexUp(0.085, 0.95), 6, 10, {
                m: makeM([x, y, z], [['z', 0.12], ['x', Math.PI / 2]]),   // menggantung ke bawah (-Y)
                color: BLACK, outline: 0.02, auto: true,
                pivot: [x, y, z],
                motion: (t) => [[[0, 0, 1], 0.12 * Math.sin(t * 8 + k * 1.3)]]
            }));
        });
    });

    // ----- SAYAP (4): 2 pasang, akar simetris kiri-kanan di punggung -----
    // pasang depan (besar, tegak ke atas-depan) dan pasang belakang (besar, mengarah ke belakang)
    const beta = 0.38;                                  // sayap membuka seperti huruf V
    const wings = [
        { s: 2.65, z: 0.42,  rz: rad(112), L: 3.2, W: 1.25, ph: 0.0 },
        { s: 2.65, z: -0.42, rz: rad(100), L: 2.8, W: 1.10, ph: 0.15 },
        { s: 2.05, z: 0.42,  rz: rad(58),  L: 3.4, W: 1.40, ph: 0.45 },
        { s: 2.05, z: -0.42, rz: rad(44),  L: 3.0, W: 1.25, ph: 0.6 }
    ];
    wings.forEach(w => {
        const side = Math.sign(w.z);
        const [wx, wy] = surfPt(w.s, w.z, 1, 0.85);
        const base = [wx, wy, w.z];
        const m = makeM(base, [['x', side * beta], ['z', w.rz]]);
        const wp = wingPoint(w.L, w.W, 0.14);
        const normal = [0, -Math.sin(side * beta), Math.cos(side * beta)];
        const along = [Math.cos(w.rz), Math.sin(w.rz), 0];
        const flap = {
            pivot: base,
            motion: (t) => {
                const f = t * 18 + w.ph * 6;
                return [[normal, 0.30 * Math.sin(f)], [along, side * 0.22 * Math.sin(f + 1.2)]];
            }
        };
        parts.push(buildSurface((u, v) => wp(u, v), 28, 12, Object.assign({ m, color: [0.82, 0.76, 0.80], alpha: 0.82 }, flap)));
        [0, 1].forEach(edge => {
            parts.push(buildSurface(
                bezierSweep(u => wp(u, edge), u => 0.05 * (1 - 0.6 * u)),
                36, 8, Object.assign({ m, color: DARK, auto: true }, flap)
            ));
        });
    });

    // yang solid dulu, sayap transparan terakhir
    return parts.sort((a, b) => (a.alpha < 1) - (b.alpha < 1));
}

window.CinematicDirector = {
    idleTime: 0,
    camera(time) {
        const scale = window.ARENA_CONFIG ? window.ARENA_CONFIG.worldScale : 1;
        const cameraFromKeys = cameraKeys => {
            let segment = 0;
            while (segment < cameraKeys.length - 2 && time > cameraKeys[segment + 1][0]) segment++;
            const current = cameraKeys[segment];
            const next = cameraKeys[segment + 1];
            const blend = Math.max(0, Math.min(1, (time - current[0]) / (next[0] - current[0])));
            const eased = blend * blend * (3 - 2 * blend);
            const values = current.slice(1).map((value, index) =>
                value + (next[index + 1] - value) * eased
            );
            return {
                target: [values[0] * scale, values[1] * scale, values[2] * scale],
                yaw: values[3],
                pitch: values[4],
                zoom: values[5]
            };
        };

        // Scene 1: 0-10 detik.
        if (time <= 10) {
            const zoomStart = 1;
            const zoomEnd = 0.19;
            const cameraBlend = Math.max(0, Math.min(1, (time - 4.2) / 3.8));
            const smoothCameraBlend = cameraBlend * cameraBlend * (3 - 2 * cameraBlend);
            return {
                target: [
                    -3 * scale,
                    (-2.5 + 2.85 * smoothCameraBlend) * scale,
                    1 * smoothCameraBlend * scale
                ],
                yaw: Math.PI / 2 * smoothCameraBlend,
                pitch: 0.08,
                zoom: zoomStart + (zoomEnd - zoomStart) * smoothCameraBlend
            };
        }

        // Scene 2A: kamera di belakang Knight hingga ia selesai berbalik.
        if (time > 10 && time <= 14.2) {
            return cameraFromKeys([
                [10, -3, 0.35, 1, Math.PI / 2, 0.08, 0.19],
                [11.8, -3, 0.35, 0, Math.PI / 2, 0.08, 0.19],
                [14.2, -3, 0.35, 0, Math.PI / 2, 0.08, 0.19]
            ]);
        }

        // Scene 2B: kamera berputar 180 derajat ke arah hadap Knight.
        if (time > 14.2 && time <= 18.5) {
            return cameraFromKeys([
                [14.2, -3, 0.35, 0, Math.PI / 2, 0.08, 0.19],
                [18.5, -12, -0.8, 0, -Math.PI / 2, 0.12, 0.34]
            ]);
        }

        // Scene 2C: kamera menghadap Pilflip saat ia mendekat.
        if (time > 18.5 && time <= 25) {
            return cameraFromKeys([
                [18.5, -12, -0.8, 0, -Math.PI / 2, 0.12, 0.34],
                [24, -12, -0.8, 0, -Math.PI / 2, 0.12, 0.32],
                [25, -12, -0.8, 0, -Math.PI / 2, 0.12, 0.34]
            ]);
        }

        // Scene 3: kamera beralih ke atas dan belakang untuk mengikuti Vengefly.
        if (time > 25 && time <= 35) {
            return cameraFromKeys([
                [25, -12, -0.8, 0, -Math.PI / 2, 0.12, 0.34],
                [27, 20, 15.5, -10, 0, 0, 1.2],
                [35, 20, 3, -10, 0, 0.2, 1.2]
            ]);
        }

        // Scene 4: zoom out, lalu kamera tetap diam selama pertarungan.
        if (time > 35) {
            return cameraFromKeys([
                [35, 20, 3, -10, 0, 0.2, 1.2],
                [38, 2.5, -1.2, 0, 0, 0.28, 2.35],
                [55, 2.5, -1.2, 0, 0, 0.28, 2.35]
            ]);
        }
    },
    character(name, time) {
        if (name === 'knight') {
            const walkProgress = Math.max(0, Math.min(1, time / 4.5));
            if (time > 35) {
                const approach = Math.max(0, Math.min(1, (time - 35) / 5));
                const faceFly = Math.max(0, Math.min(1, (time - 45) / 2));
                const smoothFaceFly = faceFly * faceFly * (3 - 2 * faceFly);
                const attackLunge = Math.sin(Math.max(0, Math.min(1, (time - 39.3) / 1.8)) * Math.PI) * 1.15;
                const hitProgress = Math.max(0, Math.min(1, (time - 50.25) / 1.2));
                const hitReaction = Math.sin(hitProgress * Math.PI);
                const counterApproach = Math.max(0, Math.min(1, (time - 55) / 3));
                const smoothCounterApproach = counterApproach * counterApproach * (3 - 2 * counterApproach);
                const counterLunge = Math.sin(Math.max(0, Math.min(1, (time - 58.1) / 0.9)) * Math.PI) * 0.8;
                const counterStrike = Math.sin(Math.max(0, Math.min(1, (time - 57.8) / 1.2)) * Math.PI);
                return {
                    position: [
                        -1.5 - 9 * approach - attackLunge - 0.8 * hitReaction +
                            6.5 * smoothCounterApproach + counterLunge,
                        -0.53 + 0.38 * hitReaction,
                        0
                    ],
                    yaw: -Math.PI / 2 + Math.PI * smoothFaceFly,
                    hitLean: -0.16 * hitReaction,
                    axisAngle: 0.07 * hitReaction + 0.05 * counterStrike
                };
            }
            return {
                position: [8.5 - 10 * walkProgress, -0.53, 0],
                yaw: -Math.PI / 2
            };
        }
        if (name === 'pilflip') {
            const start = [-25, -2.35, 0];
            const end = [-15, -2.35, 0];
            const approach = Math.max(0, Math.min(1, (time - 17) / 8));
            const deathBlend = Math.max(0, Math.min(1, (time - 41.5) / 1.2));
            return {
                position: [
                    start[0] + (end[0] - start[0]) * approach,
                    start[1] + (end[1] - start[1]) * approach + 0.7 * Math.sin(deathBlend * Math.PI),
                    start[2] + (end[2] - start[2]) * approach
                ],
                yaw: Math.PI / 2,
                deathRoll: Math.PI * deathBlend
            };
        }
        if (name === 'vengefly') {
            const samplePath = keys => {
                let segment = 0;
                while (segment < keys.length - 2 && time > keys[segment + 1][0]) segment++;
                const current = keys[segment];
                const next = keys[segment + 1];
                const progress = Math.max(0, Math.min(1, (time - current[0]) / (next[0] - current[0])));
                const eased = progress * progress * (3 - 2 * progress);
                return current.slice(1).map((value, axis) =>
                    value + (next[axis + 1] - value) * eased
                );
            };
            const positionKeys = [
                [25, 20, 17, -4],
                [35, 20, 5, -4],
                [42, -1.5, 5, -2],
                [48, -1.5, 2, 0],
                [49, -4, 2, 0],
                [50, -6, 2, 0],
                [50.4, -6, 2, 0],
                [52, -1.5, 2, 0],
                [55, -1.5, 2, 0],
                [57.8, -1.5, 2, 0],
                [58.3, -0.8, 2.4, 0],
                [58.8, 0, 0.5, 0],
                [59.6, 0, -2.55, 0],
                [65, 0, -2.55, 0]
            ];
            const attitudeKeys = [
                [25, 0, 0, 0],
                [58.3, 0, 0, 0],
                [59.6, Math.PI / 2, 0, 0],
                [65, Math.PI / 2, 0, 0]
            ];
            const position = samplePath(positionKeys);
            const [pitch, roll, yaw] = samplePath(attitudeKeys);
            const headAngle = samplePath([
                [25, 0],
                [48, 0],
                [49, 0.08],
                [50, -0.2],
                [50.4, -0.2],
                [51.2, 0],
                [55, 0],
                [65, 0]
            ])[0];
            const axisAngle = samplePath([
                [25, 0],
                [58, 0],
                [58.8, 0.08],
                [59.6, 0.16],
                [65, 0.16]
            ])[0];
            return {
                position,
                yaw,
                pitch,
                roll,
                headAngle,
                axisAngle
            };
        }
        return null;
    }
};

// ---------- WEBGL ----------
function main() {
    const canvas = document.querySelector('#glcanvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) { alert('Browser Anda tidak mendukung WebGL.'); return; }

    const prog = initShaderProgram(gl, vsSource, fsSource);
    if (!prog) return;
    gl.useProgram(prog);
    const loc = {
        pos: gl.getAttribLocation(prog, 'aPos'),
        nor: gl.getAttribLocation(prog, 'aNor'),
        col: gl.getAttribLocation(prog, 'aCol'),
        P: gl.getUniformLocation(prog, 'uP'),
        MV: gl.getUniformLocation(prog, 'uMV'),
        N: gl.getUniformLocation(prog, 'uN'),
        outline: gl.getUniformLocation(prog, 'uOutline'),
        alpha: gl.getUniformLocation(prog, 'uAlpha'),
        useFlat: gl.getUniformLocation(prog, 'uUseFlat'),
        flat: gl.getUniformLocation(prog, 'uFlat'),
        tint: gl.getUniformLocation(prog, 'uTint')
    };

    // upload mesh ke GPU
    const mk = (target, data, Type) => {
        const b = gl.createBuffer();
        gl.bindBuffer(target, b);
        gl.bufferData(target, new Type(data), gl.STATIC_DRAW);
        return b;
    };
    const meshes = buildVengefly().map(m => {
        const lines = [];
        for (let k = 0; k < m.idx.length; k += 3) {
            const a = m.idx[k], b = m.idx[k + 1], c = m.idx[k + 2];
            lines.push(a, b, b, c, c, a);
        }
        return {
            pos: mk(gl.ARRAY_BUFFER, m.pos, Float32Array),
            nor: mk(gl.ARRAY_BUFFER, m.nor, Float32Array),
            col: mk(gl.ARRAY_BUFFER, m.col, Float32Array),
            idx: mk(gl.ELEMENT_ARRAY_BUFFER, m.idx, Uint16Array),
            lidx: mk(gl.ELEMENT_ARRAY_BUFFER, lines, Uint16Array),
            count: m.idx.length, lcount: lines.length,
            outline: m.outline, alpha: m.alpha, solid: m.solid,
            pivot: m.pivot, motion: m.motion, character: m.character
        };
    });
    const pilflip = typeof globalThis.createPilflipRenderer === 'function'
        ? globalThis.createPilflipRenderer(gl, prog, loc, bindMesh)
        : null;

    // ---- state kamera & UI ----
    const trailerMode = new URLSearchParams(window.location.search).has('trailer');
    const DEF = { yaw: 0.0, pitch: 0.12, zoom: trailerMode ? 1.28 : 1.0 };
    let yaw = DEF.yaw, pitch = DEF.pitch, zoom = DEF.zoom;
    let manualCamera = false;
    let autoRotate = false, wireframe = false, flying = true, time = 0, dragging = false, lx = 0, ly = 0;

    if (trailerMode) {
        window.addEventListener('message', event => {
            if (event.source !== window.parent || !event.data || event.data.type !== 'hallownest-trailer') return;
            if (Number.isFinite(event.data.time)) time = Math.max(0, Math.min(65, event.data.time));
            if (event.data.camera === 'director') {
                manualCamera = false;
                yaw = DEF.yaw;
                pitch = DEF.pitch;
                zoom = DEF.zoom;
            }
        });
        window.parent.postMessage({ type: 'hallownest-trailer-ready' }, '*');
    }

    canvas.addEventListener('mousedown', e => { dragging = true; lx = e.clientX; ly = e.clientY; });
    window.addEventListener('mouseup', () => dragging = false);
    window.addEventListener('mousemove', e => {
        if (!dragging) return;
        yaw += (e.clientX - lx) * 0.01;
        pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - ly) * 0.01));
        lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('touchstart', e => { dragging = true; lx = e.touches[0].clientX; ly = e.touches[0].clientY; }, { passive: true });
    canvas.addEventListener('touchend', () => dragging = false);
    canvas.addEventListener('touchmove', e => {
        const t = e.touches[0];
        yaw += (t.clientX - lx) * 0.01;
        pitch = Math.max(-1.4, Math.min(1.4, pitch + (t.clientY - ly) * 0.01));
        lx = t.clientX; ly = t.clientY;
    }, { passive: true });
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        if (trailerMode) manualCamera = true;
        zoom = Math.max(0.35, Math.min(2.5, zoom * Math.exp(e.deltaY * 0.001)));
    }, { passive: false });

    const btnAuto = document.getElementById('btn-autorotate');
    const btnWire = document.getElementById('btn-wireframe');
    const btnReset = document.getElementById('btn-reset');
    if (btnAuto) {
        btnAuto.onclick = () => {
            autoRotate = !autoRotate;
            btnAuto.textContent = 'Auto-Rotate: ' + (autoRotate ? 'ON' : 'OFF');
            btnAuto.classList.toggle('active', autoRotate);
        };
    }
    if (btnWire) {
        btnWire.onclick = () => {
            wireframe = !wireframe;
            btnWire.textContent = 'Wireframe: ' + (wireframe ? 'ON' : 'OFF');
            btnWire.classList.toggle('active', wireframe);
        };
    }
    const btnFly = document.getElementById('btn-fly');
    if (btnFly) {
        btnFly.onclick = () => {
            flying = !flying;
            btnFly.textContent = 'Terbang: ' + (flying ? 'ON' : 'OFF');
            btnFly.classList.toggle('active', flying);
        };
    }
    if (btnReset) {
        btnReset.onclick = () => { yaw = DEF.yaw; pitch = DEF.pitch; zoom = DEF.zoom; };
    }

    function bindMesh(m, indexBuf) {
        gl.bindBuffer(gl.ARRAY_BUFFER, m.pos);
        gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc.pos);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.nor);
        gl.vertexAttribPointer(loc.nor, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc.nor);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.col);
        gl.vertexAttribPointer(loc.col, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc.col);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
    }

    let last = 0;
    function render(now) {
        const dt = Math.min(0.05, (now - last) * 0.001);
        last = now;
        if (trailerMode) window.CinematicDirector.idleTime += dt;
        if (trailerMode && dragging) manualCamera = true;
        if (autoRotate && !dragging) yaw += dt * 0.6;
        if (trailerMode) {
            time = Math.min(65, time);
        } else if (flying) {
            time += dt;
        }

        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.36, 0.40, 0.47, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const proj = mat4.create();
        const aspect = canvas.width / canvas.height;
        mat4.perspective(proj, rad(45), aspect, 0.1, 100);
        // jarak kamera otomatis menyesuaikan ukuran layar agar model selalu muat
        const fit = Math.max(3.4, 3.6 / aspect) / Math.tan(rad(22.5)) * 1.1;
        const scriptedCamera = trailerMode && !manualCamera
            ? window.CinematicDirector.camera(time)
            : null;
        const activeZoom = scriptedCamera ? scriptedCamera.zoom : zoom;
        const activePitch = scriptedCamera ? scriptedCamera.pitch : pitch;
        const activeYaw = scriptedCamera ? scriptedCamera.yaw : yaw;
        const cameraTarget = scriptedCamera ? scriptedCamera.target : VIEW_CENTER;
        const dist = fit * activeZoom;
        const mv = mat4.create();
        mat4.translate(mv, mv, [0, 0, -dist]);
        mat4.rotateX(mv, mv, activePitch);
        mat4.rotateY(mv, mv, activeYaw);
        mat4.translate(mv, mv, [-cameraTarget[0], -cameraTarget[1], -cameraTarget[2]]);
        const scene = sceneMatrix(time);
        const mvm = mat4.create(), mvScene = mat4.create(), nm = mat3.create();
        mat4.multiply(mvScene, mv, scene);

        gl.useProgram(prog);
        gl.uniformMatrix4fv(loc.P, false, proj);

        meshes.forEach(m => {
            if (trailerMode && m.character === 'vengefly' && time < 25) return;
            // matriks per bagian = kamera * badan melayang * kepakan bagian
            const motionTime = trailerMode
                ? (m.character === 'knight'
                    ? (time > 35 ? time : Math.min(time, 4.5))
                    : m.character === 'vengefly'
                        ? Math.min(Math.max(0, time - 25), 34.6)
                        : 0)
                : time;
            mat4.multiply(mvm, mvScene, motionMatrix(m, motionTime, time));
            mat3.normalFromMat4(nm, mvm);
            gl.uniformMatrix4fv(loc.MV, false, mvm);
            gl.uniformMatrix3fv(loc.N, false, nm);
            gl.uniform3f(loc.tint, 1, 1, 1);
            if (wireframe) {
                gl.disable(gl.CULL_FACE);
                gl.uniform1f(loc.outline, 0);
                gl.uniform1f(loc.alpha, 1);
                gl.uniform1f(loc.useFlat, 1);
                gl.uniform3f(loc.flat, 1, 1, 1);
                bindMesh(m, m.lidx);
                gl.drawElements(gl.LINES, m.lcount, gl.UNSIGNED_SHORT, 0);
                return;
            }
            gl.uniform1f(loc.useFlat, 0);
            // pass 1: outline hitam (inverted hull) untuk bagian solid
            if (m.outline > 0) {
                gl.enable(gl.CULL_FACE);
                gl.cullFace(gl.FRONT);
                gl.uniform1f(loc.outline, m.outline);
                gl.uniform1f(loc.alpha, 1);
                gl.uniform1f(loc.useFlat, 1);
                gl.uniform3f(loc.flat, 0.02, 0.02, 0.04);
                bindMesh(m, m.idx);
                gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
                gl.disable(gl.CULL_FACE);
                gl.uniform1f(loc.useFlat, 0);
            }
            // pass 2: permukaan berwarna
            gl.uniform1f(loc.outline, 0);
            gl.uniform1f(loc.alpha, m.alpha);
            if (m.alpha < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
            bindMesh(m, m.idx);
            gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
            if (m.alpha < 1) { gl.disable(gl.BLEND); gl.depthMask(true); }
        });

        if (pilflip) {
            const root = mat4.create();
            const routePhase = time * 0.20;
            const breathing = trailerMode
                ? Math.sin(window.CinematicDirector.idleTime * 2) * 0.06
                : 0;
            const pilflipPose = trailerMode
                ? window.CinematicDirector.character('pilflip', time)
                : null;
            const position = trailerMode
                ? (time < 17 ? [25, -2.35 + breathing, 10] : [
                    pilflipPose.position[0],
                    pilflipPose.position[1] + breathing,
                    pilflipPose.position[2]
                ])
                : [11 * Math.cos(routePhase), -2.35 + 0.025 * Math.sin(time * 7), 7 * Math.sin(routePhase)];
            const yaw = trailerMode
                ? (time < 17 ? -Math.PI / 2 : pilflipPose.yaw)
                : Math.atan2(-11 * Math.sin(routePhase), 7 * Math.cos(routePhase));
            const scale = trailerMode ? 1.05 : 1.05 + 0.03 * Math.sin(time * 1.7);
            mat4.translate(root, root, position);
            mat4.rotateY(root, root, yaw);
            if (trailerMode && pilflipPose && pilflipPose.deathRoll) {
                mat4.rotateX(root, root, pilflipPose.deathRoll);
            }
            mat4.scale(root, root, [scale, scale, scale]);
            const pilflipTime = trailerMode
                ? Math.min(Math.max(0, time - 17), 25.7)
                : time;
            pilflip.draw(root, mvScene, proj, pilflipTime);
        }

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

function initShaderProgram(gl, vsSrc, fsSrc) {
    const vs = loadShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = loadShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error('Gagal link shader:', gl.getProgramInfoLog(p));
        return null;
    }
    return p;
}

function loadShader(gl, type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Error compile shader:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
    }
    return s;
}

window.onload = main;
