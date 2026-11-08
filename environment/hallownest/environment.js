// environment.js - Modul Environment Arena Luas & Penghubung Karakter (Vengefly)
// Menyambungkan hasil Vengefly dari main.js ke dalam arena luas tanpa mengubah main.js

(function (global) {
    'use strict';

    // =========================================================================
    // 1. PENGATURAN AREA & ANIMASI VENGEFLY DI DALAM ENVIRONMENT
    // =========================================================================
    const ARENA_CONFIG = {
        worldScale: 0.38, // Skala dunia agar seluruh area luas masuk ke jangkauan kamera

        // Pengaturan posisi, skala, & lintasan terbang Vengefly di dalam arena luas
        vengefly: {
            position: [0.0, 2.5, 0.0], // Titik pusat terbang Vengefly di atas panggung arena
            scale: 1.1,                // Ukuran Vengefly terhadap environment
            radiusX: 4.5,              // Jangkauan terbang ke kiri-kanan (sumbu X)
            radiusZ: 3.0,              // Jangkauan terbang ke depan-belakang (sumbu Z)
            bobHeight: 1.5,            // Tinggi naik-turun saat terbang (sumbu Y)
            speed: 0.85                // Kecepatan jelajah di dalam arena
        }
    };

    // Daftar karakter tambahan jika nanti file The Phlips & The Knight ingin disambungkan
    const externalCharacters = [];

    // =========================================================================
    // 2. HELPER MATEMATIKA & PERMUKAAN PARAMETRIK LOKAL (Anti-Bentrok Variabel)
    // =========================================================================
    const TAU = Math.PI * 2;
    const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const cross3 = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
    const norm3 = (a) => {
        const l = Math.hypot(a[0], a[1], a[2]) || 1;
        return [a[0] / l, a[1] / l, a[2] / l];
    };

    function signedPow(x, p) {
        return (x >= 0 ? 1 : -1) * Math.pow(Math.abs(x), p);
    }

    function envMakeM(t, ops) {
        const m = mat4.create();
        mat4.translate(m, m, t);
        (ops || []).forEach(([ax, a]) => {
            if (ax === 'x') mat4.rotateX(m, m, a);
            else if (ax === 'y') mat4.rotateY(m, m, a);
            else if (ax === 'z') mat4.rotateZ(m, m, a);
            else if (ax === 's') mat4.scale(m, m, a);
        });
        return m;
    }

    function envBuildSurface(fn, nu, nv, o) {
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

        if (o.auto) {
            const cnt = pos.length / 3;
            let cx = 0, cy = 0, cz = 0;
            for (let k = 0; k < cnt; k++) {
                cx += pos[3 * k]; cy += pos[3 * k + 1]; cz += pos[3 * k + 2];
            }
            cx /= cnt; cy /= cnt; cz /= cnt;
            let s = 0;
            for (let k = 0; k < cnt; k++) {
                s += nor[3 * k] * (pos[3 * k] - cx) +
                     nor[3 * k + 1] * (pos[3 * k + 1] - cy) +
                     nor[3 * k + 2] * (pos[3 * k + 2] - cz);
            }
            if (s < 0) {
                for (let k = 0; k < nor.length; k++) nor[k] = -nor[k];
                for (let k = 0; k < idx.length; k += 3) {
                    const tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp;
                }
            }
        }

        const motionFn = o.motion || function () { return []; };
        if (o.groupMatrix) {
            motionFn.groupMatrix = o.groupMatrix;
        }

        return {
            pos, nor, col, idx,
            outline: o.outline || 0,
            alpha: o.alpha || 1,
            solid: !o.alpha,
            pivot: o.pivot || [0, 0, 0],
            motion: (o.motion || o.groupMatrix) ? motionFn : null
        };
    }

    // =========================================================================
    // 3. RUMUS GEOMETRI ENVIRONMENT (Batu, Pilar, Kerucut, Lentera)
    // =========================================================================
    function stoneBlock(W, H, D, p = 0.25) {
        return (u, v) => {
            const theta = (u - 0.5) * Math.PI;
            const phi = v * TAU;
            const cu = signedPow(Math.cos(theta), p);
            const su = signedPow(Math.sin(theta), p);
            const cv = signedPow(Math.cos(phi), p);
            const sv = signedPow(Math.sin(phi), p);
            return [0.5 * W * cu * cv, 0.5 * H * su, 0.5 * D * cu * sv];
        };
    }

    function stonePillar(rBottom, rTop, H, waviness = 0.0) {
        return (u, v) => {
            const r = (rBottom + (rTop - rBottom) * u) * (1 + waviness * Math.sin(u * Math.PI * 5));
            return [r * Math.cos(v * TAU), (u - 0.5) * H, r * Math.sin(v * TAU)];
        };
    }

    function coneShape(R, L) {
        return (u, v) => [R * (1 - u) * Math.cos(v * TAU), R * (1 - u) * Math.sin(v * TAU), L * u];
    }

    function ellipsoidShape(rx, ry, rz) {
        return (u, v) => {
            const theta = (u - 0.5) * Math.PI;
            const phi = v * TAU;
            return [
                rx * Math.cos(theta) * Math.cos(phi),
                ry * Math.sin(theta),
                rz * Math.cos(theta) * Math.sin(phi)
            ];
        };
    }

    // =========================================================================
    // 4. PEMBUATAN PROPERTI AREA ARENA LUAS
    // =========================================================================
    function buildArenaMeshes() {
        const parts = [];
        const FLOOR_COL  = [0.18, 0.22, 0.30];
        const SLAB_COL   = [0.29, 0.35, 0.45];
        const PILLAR_COL = [0.14, 0.17, 0.24];
        const CRYS_CYAN  = [0.35, 0.85, 0.98];
        const CRYS_ORNG  = [0.98, 0.55, 0.16];
        const GLOW_GOLD  = [0.98, 0.90, 0.58];
        const IRON_DARK  = [0.11, 0.13, 0.18];

        // A. Lantai Dasar Arena Luas (70 x 46 unit, permukaan di Y = -4.0)
        parts.push(envBuildSurface(stoneBlock(70, 2.0, 46, 0.18), 20, 26, {
            m: envMakeM([0, -5.0, 0]),
            color: (u, v) => {
                const checker = (Math.floor(u * 14) + Math.floor(v * 14)) % 2;
                const tone = checker ? 1.0 : 0.88;
                return [FLOOR_COL[0] * tone, FLOOR_COL[1] * tone, FLOOR_COL[2] * tone];
            },
            outline: 0.04,
            auto: true
        }));

        // B. Jalur Pijakan Batu di Tengah Arena
        for (let i = -4; i <= 4; i++) {
            const zOff = (i % 2 === 0) ? 0.45 : -0.45;
            parts.push(envBuildSurface(stoneBlock(5.4, 0.55, 4.5, 0.35), 10, 14, {
                m: envMakeM([i * 6.2, -3.82, zOff], [['y', (i % 3) * 0.05]]),
                color: SLAB_COL,
                outline: 0.035,
                auto: true
            }));
        }

        // C. Platform Melayang Bertingkat (Tempat Menganimasikan Karakter)
        const platforms = [
            { pos: [-17.0, -0.3, -8.5], size: [9.2, 1.1, 6.0] },
            { pos: [ -3.5,  2.8, -11.5], size: [10.0, 1.1, 6.0] },
            { pos: [ 12.5,  4.2, -9.5], size: [9.2, 1.1, 6.0] },
            { pos: [ 18.5,  0.2, -5.0], size: [8.5, 1.1, 5.8] },
            { pos: [-18.0,  1.5,  9.5], size: [8.0, 1.1, 5.8] },
            { pos: [ 17.5,  1.8,  9.5], size: [8.5, 1.1, 5.8] }
        ];

        platforms.forEach((p, idx) => {
            const piv = p.pos;
            const hoverMotion = (t) => [[[0, 1, 0], 0.02 * Math.sin(t * 1.6 + idx)]];

            parts.push(envBuildSurface(stoneBlock(p.size[0], p.size[1], p.size[2], 0.32), 12, 14, {
                m: envMakeM(p.pos),
                color: SLAB_COL,
                outline: 0.04,
                auto: true,
                pivot: piv,
                motion: hoverMotion
            }));

            parts.push(envBuildSurface(coneShape(p.size[0] * 0.32, 2.3), 8, 12, {
                m: envMakeM([p.pos[0], p.pos[1] - 0.5, p.pos[2]], [['x', Math.PI / 2]]),
                color: PILLAR_COL,
                outline: 0.03,
                auto: true,
                pivot: piv,
                motion: hoverMotion
            }));
        });

        // D. Pilar Gua Raksasa di Sekeliling Arena
        const pillars = [
            [-27, -17], [-10, -19], [10, -19], [27, -17],
            [-29,   0], [ 29,   0], [-26,  16], [26,  16]
        ];
        pillars.forEach(([px, pz], idx) => {
            const r = 1.6 + (idx % 2) * 0.45;
            parts.push(envBuildSurface(stonePillar(r * 1.15, r * 0.85, 24.0, 0.04), 12, 14, {
                m: envMakeM([px, 7.5, pz]),
                color: PILLAR_COL,
                outline: 0.04,
                auto: true
            }));
        });

        // E. Stalaktit Langit-Langit Gua
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * TAU;
            const dist = 15 + (i % 3) * 6;
            const sx = Math.cos(ang) * dist;
            const sz = Math.sin(ang) * (dist * 0.7);
            const len = 3.5 + (i % 3) * 1.4;
            parts.push(envBuildSurface(coneShape(1.05, len), 8, 10, {
                m: envMakeM([sx, 18.0, sz], [['x', Math.PI / 2]]),
                color: PILLAR_COL,
                outline: 0.03,
                auto: true
            }));
        }

        // F. Gugusan Kristal & Infeksi Bercahaya di Sudut Arena
        const crystals = [
            { pos: [-21, -4.0, -12], col: CRYS_CYAN, s: 1.25 },
            { pos: [ 21, -4.0, -13], col: CRYS_ORNG, s: 1.30 },
            { pos: [-22, -4.0,  12], col: CRYS_ORNG, s: 1.15 },
            { pos: [ 22, -4.0,  13], col: CRYS_CYAN, s: 1.25 }
        ];
        crystals.forEach(cr => {
            const shards = [
                { rx: 0.0,   rz: 0.0,   r: 0.52, l: 3.3 },
                { rx: 0.28,  rz: 0.22,  r: 0.38, l: 2.4 },
                { rx: -0.25, rz: -0.22, r: 0.36, l: 2.2 }
            ];
            shards.forEach(sh => {
                parts.push(envBuildSurface(coneShape(sh.r * cr.s, sh.l * cr.s), 8, 6, {
                    m: envMakeM(cr.pos, [['z', sh.rz], ['x', -Math.PI / 2 + sh.rx]]),
                    color: cr.col,
                    outline: 0.03,
                    auto: true
                }));
            });
        });

        // G. Tiang Lentera Hallownest
        const lanterns = [[-12.5, 4.2], [12.5, 4.2], [-12.5, -5.8], [12.5, -5.8]];
        lanterns.forEach(([lx, lz]) => {
            parts.push(envBuildSurface(stonePillar(0.15, 0.11, 4.5, 0), 8, 10, {
                m: envMakeM([lx, -1.75, lz]),
                color: IRON_DARK,
                outline: 0.025,
                auto: true
            }));
            parts.push(envBuildSurface(ellipsoidShape(0.46, 0.56, 0.46), 10, 12, {
                m: envMakeM([lx, 0.80, lz]),
                color: GLOW_GOLD,
                outline: 0.025,
                auto: true
            }));
        });

        return parts;
    }

    // =========================================================================
    // 5. TRANSFORMASI LINTASAN TERBANG VENGEFLY DI DALAM ARENA
    // =========================================================================
    function getVengeflyArenaMatrix(t, origSceneMatrixFn, part) {
        const cfg = ARENA_CONFIG.vengefly;
        const out = mat4.create();
        if (new URLSearchParams(global.location.search).has('trailer') && global.CinematicDirector) {
            const pose = global.CinematicDirector.character('vengefly', t);
            mat4.translate(out, out, pose.position);
            mat4.rotateY(out, out, pose.yaw);
            mat4.rotateZ(out, out, pose.roll);
            mat4.rotateX(out, out, pose.pitch);
            const cinematicScale = cfg.scale;
            mat4.scale(out, out, [cinematicScale, cinematicScale, cinematicScale]);
            if (pose.axisAngle) {
                mat4.rotate(out, out, pose.axisAngle, [0.927, 0.325, 0.185]);
            }
            if (part && part.headGroup && pose.headAngle) {
                const headPivot = part.headPivot;
                mat4.translate(out, out, headPivot);
                mat4.rotateZ(out, out, pose.headAngle);
                mat4.translate(out, out, [-headPivot[0], -headPivot[1], -headPivot[2]]);
            }
            return out;
        }
        const theta = t * cfg.speed;

        const x = cfg.position[0] + Math.cos(theta) * cfg.radiusX;
        const y = cfg.position[1] + Math.sin(theta * 2.5) * cfg.bobHeight;
        const z = cfg.position[2] + Math.sin(theta) * cfg.radiusZ;

        // Hitung arah hadap kepala Vengefly (-X) agar mengikuti lintasan elips
        const vx = -Math.sin(theta) * cfg.radiusX;
        const vz =  Math.cos(theta) * cfg.radiusZ;
        const yawAngle = Math.atan2(vz, -vx);

        mat4.translate(out, out, [x, y, z]);
        mat4.rotateY(out, out, yawAngle);
        const scale = cfg.scale * (1 + 0.035 * Math.sin(t * 2.2));
        mat4.scale(out, out, [scale, scale, scale]);

        // Pertahankan ayunan & kemiringan pose terbang asli dari sceneMatrix(t) di main.js
        if (origSceneMatrixFn) {
            mat4.multiply(out, out, origSceneMatrixFn(t));
        }
        return out;
    }

    // Helper untuk membungkus kumpulan mesh karakter dengan matriks transformasi arena
    function bindCharacterToArena(partsArray, groupMatrixFn, characterName) {
        return (partsArray || []).map(part => {
            const baseMotion = part.motion || function () { return []; };
            const wrappedMotion = function (t) { return baseMotion(t); };
            wrappedMotion.groupMatrix = function (t) { return groupMatrixFn(t, part); };
            part.motion = wrappedMotion;
            if (characterName) part.character = characterName;
            return part;
        });
    }

    // =========================================================================
    // 6. KONEKSI OTOMATIS KE main.js (VENGEFLY) & SLOT KARAKTER LAIN
    // =========================================================================
    function connectVengeflyToEnvironment() {
        if (typeof global.buildVengefly !== 'function') return;

        const origBuildVengefly = global.buildVengefly;
        const origSceneMatrix   = global.sceneMatrix;
        const origMotionMatrix  = global.motionMatrix;

        // Pusatkan pandangan kamera ke tengah arena
        if (typeof VIEW_CENTER !== 'undefined' && Array.isArray(VIEW_CENTER)) {
            VIEW_CENTER[0] = 0.0;
            VIEW_CENTER[1] = -1.2;
            VIEW_CENTER[2] = 0.0;
        }

        // Navigasi WASD + Q/E untuk menggeser titik fokus kamera di dalam arena luas
        window.addEventListener('keydown', function (e) {
            if (typeof VIEW_CENTER === 'undefined') return;
            const step = 0.6;
            if (e.code === 'KeyW') VIEW_CENTER[2] -= step;
            if (e.code === 'KeyS') VIEW_CENTER[2] += step;
            if (e.code === 'KeyA') VIEW_CENTER[0] -= step;
            if (e.code === 'KeyD') VIEW_CENTER[0] += step;
            if (e.code === 'KeyE') VIEW_CENTER[1] += step;
            if (e.code === 'KeyQ') VIEW_CENTER[1] -= step;
        });

        // 1. Gabungkan Arena Environment + Vengefly dari main.js (+ karakter eksternal bila ada)
        global.buildVengefly = function () {
            const arenaParts = buildArenaMeshes();
            const vengeflyParts = bindCharacterToArena(origBuildVengefly(), function (t) {
                return getVengeflyArenaMatrix(t, origSceneMatrix);
            }, 'vengefly');

            let allParts = arenaParts.concat(vengeflyParts);

            // Jika nanti file karakter lain (The Phlips / The Knight) didaftarkan:
            externalCharacters.forEach(charEntry => {
                const charParts = typeof charEntry.buildFn === 'function' ? charEntry.buildFn() : [];
                allParts = allParts.concat(bindCharacterToArena(charParts, charEntry.matrixFn));
            });

            return allParts.sort((a, b) => (a.alpha < 1) - (b.alpha < 1));
        };

        // 2. Jaga agar lantai environment tetap datar (tidak ikut miring TILT Vengefly)
        global.sceneMatrix = function () {
            const out = mat4.create();
            const s = ARENA_CONFIG.worldScale;
            mat4.scale(out, out, [s, s, s]);
            return out;
        };

        // 3. Kalikan matriks posisi karakter di arena dengan matriks gerak bagian tubuhnya
        global.motionMatrix = function (m, t, sceneTime) {
            const trailerMode = new URLSearchParams(global.location.search).has('trailer');
            const motionTime = trailerMode
                ? (m.character === 'vengefly'
                    ? t
                    : m.character === 'knight' ? t : 0)
                : t;
            const localM = origMotionMatrix(m, motionTime);
            if (m.motion && typeof m.motion.groupMatrix === 'function') {
                const groupTime = Number.isFinite(sceneTime) ? sceneTime : t;
                const groupM = m.motion.groupMatrix(groupTime);
                return mat4.multiply(mat4.create(), groupM, localM);
            }
            return localM;
        };
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', connectVengeflyToEnvironment);
    } else {
        connectVengeflyToEnvironment();
    }

    // Ekspos API global untuk memudahkan pengaturan & penyambungan file karakter lain nantinya
    global.ARENA_CONFIG = ARENA_CONFIG;
    global.Environment = {
        config: ARENA_CONFIG,
        registerCharacter: function (buildFn, matrixFn) {
            externalCharacters.push({ buildFn: buildFn, matrixFn: matrixFn });
        }
    };

})(typeof window !== 'undefined' ? window : globalThis);