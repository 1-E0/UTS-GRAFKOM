// libs.js - Library matriks & vektor untuk Grafika Komputer (WebGL)
// API: vec3, mat3, mat4 (gaya gl-matrix, kolom-mayor) + helper LIBS (gaya praktikum)
// Semua fungsi mat4 bertipe (out, a, ...) dan aman dipakai dengan out === a.

(function (global) {
    'use strict';

    // ==========================================
    // VEC3
    // ==========================================
    const vec3 = {
        create() { return new Float32Array(3); },
        fromValues(x, y, z) { const o = new Float32Array(3); o[0] = x; o[1] = y; o[2] = z; return o; },
        set(out, x, y, z) { out[0] = x; out[1] = y; out[2] = z; return out; },
        copy(out, a) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out; },
        add(out, a, b) { out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2]; return out; },
        subtract(out, a, b) { out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2]; return out; },
        scale(out, a, s) { out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s; return out; },
        negate(out, a) { out[0] = -a[0]; out[1] = -a[1]; out[2] = -a[2]; return out; },
        lerp(out, a, b, t) {
            out[0] = a[0] + t * (b[0] - a[0]);
            out[1] = a[1] + t * (b[1] - a[1]);
            out[2] = a[2] + t * (b[2] - a[2]);
            return out;
        },
        dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
        cross(out, a, b) {
            const ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2];
            out[0] = ay * bz - az * by;
            out[1] = az * bx - ax * bz;
            out[2] = ax * by - ay * bx;
            return out;
        },
        length(a) { return Math.hypot(a[0], a[1], a[2]); },
        normalize(out, a) {
            const len = Math.hypot(a[0], a[1], a[2]);
            if (len > 0) {
                const inv = 1 / len;
                out[0] = a[0] * inv; out[1] = a[1] * inv; out[2] = a[2] * inv;
            } else {
                out[0] = 0; out[1] = 0; out[2] = 0;
            }
            return out;
        },
        // transformasi titik dengan mat4 (w = 1, dibagi w)
        transformMat4(out, a, m) {
            const x = a[0], y = a[1], z = a[2];
            let w = m[3] * x + m[7] * y + m[11] * z + m[15];
            w = w || 1;
            out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
            out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
            out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
            return out;
        }
    };

    // ==========================================
    // MAT4
    // ==========================================
    const mat4 = {
        create() {
            const o = new Float32Array(16);
            o[0] = 1; o[5] = 1; o[10] = 1; o[15] = 1;
            return o;
        },
        identity(out) {
            out.fill(0);
            out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
            return out;
        },
        clone(a) { return new Float32Array(a); },
        copy(out, a) { out.set(a); return out; },

        perspective(out, fovy, aspect, near, far) {
            const f = 1.0 / Math.tan(fovy / 2);
            const nf = 1 / (near - far);
            out.fill(0);
            out[0] = f / aspect;
            out[5] = f;
            out[10] = (far + near) * nf;
            out[11] = -1;
            out[14] = 2 * far * near * nf;
            return out;
        },

        ortho(out, l, r, b, t, n, f) {
            const lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
            out.fill(0);
            out[0] = -2 * lr; out[5] = -2 * bt; out[10] = 2 * nf;
            out[12] = (l + r) * lr; out[13] = (t + b) * bt; out[14] = (f + n) * nf;
            out[15] = 1;
            return out;
        },

        lookAt(out, eye, center, up) {
            let z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
            let len = Math.hypot(z0, z1, z2);
            if (len < 1e-6) return mat4.identity(out);
            len = 1 / len; z0 *= len; z1 *= len; z2 *= len;

            let x0 = up[1] * z2 - up[2] * z1;
            let x1 = up[2] * z0 - up[0] * z2;
            let x2 = up[0] * z1 - up[1] * z0;
            len = Math.hypot(x0, x1, x2);
            if (len) { len = 1 / len; x0 *= len; x1 *= len; x2 *= len; } else { x0 = x1 = x2 = 0; }

            let y0 = z1 * x2 - z2 * x1;
            let y1 = z2 * x0 - z0 * x2;
            let y2 = z0 * x1 - z1 * x0;
            len = Math.hypot(y0, y1, y2);
            if (len) { len = 1 / len; y0 *= len; y1 *= len; y2 *= len; } else { y0 = y1 = y2 = 0; }

            out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
            out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
            out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
            out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
            out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
            out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
            out[15] = 1;
            return out;
        },

        // out = a * b
        multiply(out, a, b) {
            const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
            const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
            const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
            const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
            for (let i = 0; i < 16; i += 4) {
                const b0 = b[i], b1 = b[i + 1], b2 = b[i + 2], b3 = b[i + 3];
                out[i]     = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
                out[i + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
                out[i + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
                out[i + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
            }
            return out;
        },

        transpose(out, a) {
            if (out === a) {
                const a01 = a[1], a02 = a[2], a03 = a[3], a12 = a[6], a13 = a[7], a23 = a[11];
                out[1] = a[4]; out[2] = a[8]; out[3] = a[12];
                out[4] = a01; out[6] = a[9]; out[7] = a[13];
                out[8] = a02; out[9] = a12; out[11] = a[14];
                out[12] = a03; out[13] = a13; out[14] = a23;
            } else {
                out[0] = a[0]; out[1] = a[4]; out[2] = a[8]; out[3] = a[12];
                out[4] = a[1]; out[5] = a[5]; out[6] = a[9]; out[7] = a[13];
                out[8] = a[2]; out[9] = a[6]; out[10] = a[10]; out[11] = a[14];
                out[12] = a[3]; out[13] = a[7]; out[14] = a[11]; out[15] = a[15];
            }
            return out;
        },

        invert(out, a) {
            const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
            const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
            const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
            const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
            const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
            const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
            const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
            const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
            const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
            const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
            let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
            if (!det) return null;
            det = 1.0 / det;
            out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
            out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
            out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
            out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
            out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
            out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
            out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
            out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
            out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
            out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
            out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
            out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
            out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
            out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
            out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
            out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
            return out;
        },

        translate(out, a, v) {
            const x = v[0], y = v[1], z = v[2];
            if (a !== out) out.set(a);
            out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
            out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
            out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
            out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
            return out;
        },

        scale(out, a, v) {
            const x = v[0], y = v[1], z = v[2];
            for (let i = 0; i < 4; i++) {
                out[i] = a[i] * x;
                out[4 + i] = a[4 + i] * y;
                out[8 + i] = a[8 + i] * z;
                out[12 + i] = a[12 + i];
            }
            return out;
        },

        rotateX(out, a, rad) {
            const s = Math.sin(rad), c = Math.cos(rad);
            const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
            const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
            if (a !== out) {
                out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
                out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
            }
            out[4] = a10 * c + a20 * s;  out[5] = a11 * c + a21 * s;
            out[6] = a12 * c + a22 * s;  out[7] = a13 * c + a23 * s;
            out[8] = a20 * c - a10 * s;  out[9] = a21 * c - a11 * s;
            out[10] = a22 * c - a12 * s; out[11] = a23 * c - a13 * s;
            return out;
        },

        rotateY(out, a, rad) {
            const s = Math.sin(rad), c = Math.cos(rad);
            const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
            const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
            if (a !== out) {
                out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
                out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
            }
            out[0] = a00 * c - a20 * s;  out[1] = a01 * c - a21 * s;
            out[2] = a02 * c - a22 * s;  out[3] = a03 * c - a23 * s;
            out[8] = a00 * s + a20 * c;  out[9] = a01 * s + a21 * c;
            out[10] = a02 * s + a22 * c; out[11] = a03 * s + a23 * c;
            return out;
        },

        rotateZ(out, a, rad) {
            const s = Math.sin(rad), c = Math.cos(rad);
            const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
            const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
            if (a !== out) {
                out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
                out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
            }
            out[0] = a00 * c + a10 * s;  out[1] = a01 * c + a11 * s;
            out[2] = a02 * c + a12 * s;  out[3] = a03 * c + a13 * s;
            out[4] = a10 * c - a00 * s;  out[5] = a11 * c - a01 * s;
            out[6] = a12 * c - a02 * s;  out[7] = a13 * c - a03 * s;
            return out;
        },

        // rotasi terhadap sumbu sembarang
        rotate(out, a, rad, axis) {
            let x = axis[0], y = axis[1], z = axis[2];
            let len = Math.hypot(x, y, z);
            if (len < 1e-6) return null;
            len = 1 / len; x *= len; y *= len; z *= len;
            const s = Math.sin(rad), c = Math.cos(rad), t = 1 - c;
            const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
            const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
            const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
            const b00 = x * x * t + c, b01 = y * x * t + z * s, b02 = z * x * t - y * s;
            const b10 = x * y * t - z * s, b11 = y * y * t + c, b12 = z * y * t + x * s;
            const b20 = x * z * t + y * s, b21 = y * z * t - x * s, b22 = z * z * t + c;
            if (a !== out) {
                out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
            }
            out[0] = a00 * b00 + a10 * b01 + a20 * b02;
            out[1] = a01 * b00 + a11 * b01 + a21 * b02;
            out[2] = a02 * b00 + a12 * b01 + a22 * b02;
            out[3] = a03 * b00 + a13 * b01 + a23 * b02;
            out[4] = a00 * b10 + a10 * b11 + a20 * b12;
            out[5] = a01 * b10 + a11 * b11 + a21 * b12;
            out[6] = a02 * b10 + a12 * b11 + a22 * b12;
            out[7] = a03 * b10 + a13 * b11 + a23 * b12;
            out[8] = a00 * b20 + a10 * b21 + a20 * b22;
            out[9] = a01 * b20 + a11 * b21 + a21 * b22;
            out[10] = a02 * b20 + a12 * b21 + a22 * b22;
            out[11] = a03 * b20 + a13 * b21 + a23 * b22;
            return out;
        }
    };

    // ==========================================
    // MAT3
    // ==========================================
    const mat3 = {
        create() {
            const o = new Float32Array(9);
            o[0] = 1; o[4] = 1; o[8] = 1;
            return o;
        },
        // ambil bagian 3x3 kiri-atas dari mat4
        fromMat4(out, a) {
            out[0] = a[0]; out[1] = a[1]; out[2] = a[2];
            out[3] = a[4]; out[4] = a[5]; out[5] = a[6];
            out[6] = a[8]; out[7] = a[9]; out[8] = a[10];
            return out;
        },
        // matriks normal = transpose(invers(mat4)) bagian 3x3
        normalFromMat4(out, a) {
            const inv = mat4.invert(new Float32Array(16), a);
            if (!inv) return null;
            const t = mat4.transpose(inv, inv);
            return mat3.fromMat4(out, t);
        }
    };

    // ==========================================
    // LIBS: helper gaya praktikum Grafkom
    // ==========================================
    const LIBS = {
        degToRad(angle) { return angle * Math.PI / 180; },
        get_projection(angle, aspect, zMin, zMax) {
            return mat4.perspective(mat4.create(), LIBS.degToRad(angle), aspect, zMin, zMax);
        },
        get_I4() { return mat4.create(); },
        set_I4(m) { mat4.identity(m); },
        rotateX(m, angle) { mat4.rotateX(m, m, angle); },
        rotateY(m, angle) { mat4.rotateY(m, m, angle); },
        rotateZ(m, angle) { mat4.rotateZ(m, m, angle); },
        translateX(m, t) { mat4.translate(m, m, [t, 0, 0]); },
        translateY(m, t) { mat4.translate(m, m, [0, t, 0]); },
        translateZ(m, t) { mat4.translate(m, m, [0, 0, t]); },
        scaleX(m, t) { mat4.scale(m, m, [t, 1, 1]); },
        scaleY(m, t) { mat4.scale(m, m, [1, t, 1]); },
        scaleZ(m, t) { mat4.scale(m, m, [1, 1, t]); },
        multiply(m1, m2) { return mat4.multiply(mat4.create(), m1, m2); }
    };

    global.vec3 = vec3;
    global.mat4 = mat4;
    global.mat3 = mat3;
    global.LIBS = LIBS;

})(typeof window !== 'undefined' ? window : globalThis);