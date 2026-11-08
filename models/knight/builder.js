var BUILDER = {
    // 1. Mangkok Melengkung (Bagian Bawah & Atas) / eliptic paraboloid 
    generateRoundedSquareBowl: function (a, b, height, vBands) {
        let vertices = [], indices = [], normals = [];
        let uBands = 60; 
        let n = 4; // Ketajaman sudut squircle

        // Kita gunakan pendekatan bola (latitude/longitude) agar melengkung mulus ke tengah
        for (let i = 0; i <= vBands; i++) {
            // v berjalan dari 0 (titik pusat paling bawah) hingga PI/2 (tepi atas)
            let v = (i / vBands) * (Math.PI / 2);
            
            for (let j = 0; j <= uBands; j++) {
                let u = (j * 2 * Math.PI / uBands);
                
                // Rumus pembentuk squircle
                let r = Math.pow(Math.pow(Math.abs(Math.cos(u)), n) + Math.pow(Math.abs(Math.sin(u)), n), -1/n);
                
                // Kalkulasi posisi 3D melengkung murni
                let x = a * Math.sin(v) * r * Math.cos(u);
                let y = height * (1 - Math.cos(v)); // Melengkung mulus dari Y=0 ke Y=height
                let z = b * Math.sin(v) * r * Math.sin(u);
                
                vertices.push(x, y, z);

                // KALKULASI NORMAL BOLA (Agar lighting menyebar halus tanpa patahan)
                let nx = Math.sin(v) * Math.cos(u);
                let ny = -Math.cos(v); // Di titik pusat menunjuk lurus ke bawah, di tepi jadi mendatar
                let nz = Math.sin(v) * Math.sin(u);
                
                let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
                normals.push(nx/len, ny/len, nz/len);
            }
        }

        // Penyusunan Indeks Segitiga (Sama seperti sebelumnya)
        for (let i = 0; i < vBands; i++) {
            for (let j = 0; j < uBands; j++) {
                let first = (i * (uBands + 1)) + j;
                let second = first + uBands + 1;
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }

        return { vertices, indices, normals };
    },

    // 2. Tabung Melengkung (Bagian Tengah) / cylinder dengan cross section melengkung
    generateRoundedCylinder: function (radiusX, radiusZ, height, vBands) {
        let vertices = [], indices = [], normals = [];
        let uBands = 60; 
        let n = 4;       

        for (let i = 0; i <= vBands; i++) {
            let v = (i / vBands) * height; 
            for (let j = 0; j <= uBands; j++) {
                let u = (j * 2 * Math.PI / uBands);
                let r = Math.pow(Math.pow(Math.abs(Math.cos(u)), n) + Math.pow(Math.abs(Math.sin(u)), n), -1/n);

                let x = radiusX * r * Math.cos(u);
                let y = v; 
                let z = radiusZ * r * Math.sin(u);

                vertices.push(x, y, z);

                let nx = x;
                let nz = z;
                let len = Math.sqrt(nx*nx + nz*nz);
                normals.push(nx/len, 0.0, nz/len);
            }
        }

        for (let i = 0; i < vBands; i++) {
            for (let j = 0; j < uBands; j++) {
                let first = (i * (uBands + 1)) + j;
                let second = first + uBands + 1;
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }
        return { vertices, indices, normals };
    },

    // 3. Bola (Mata) / sphere
    generateSphere: function (radiusX, radiusY, radiusZ, uBands, vBands) {
        let vertices = [], indices = [], normals = [];
        for (let i = 0; i <= vBands; i++) {
            let v = -Math.PI / 2 + (i * Math.PI / vBands); 
            for (let j = 0; j <= uBands; j++) {
                let u = (j * 2 * Math.PI / uBands);
                let x = radiusX * Math.cos(v) * Math.cos(u);
                let y = radiusY * Math.sin(v);
                let z = radiusZ * Math.cos(v) * Math.sin(u);
                vertices.push(x, y, z);

                let nx = x / radiusX;
                let ny = y / radiusY;
                let nz = z / radiusZ;
                let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
                normals.push(nx/len, ny/len, nz/len);
            }
        }
        for (let i = 0; i < vBands; i++) {
            for (let j = 0; j < uBands; j++) {
                let first = (i * (uBands + 1)) + j;
                let second = first + uBands + 1;
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }
        return { vertices, indices, normals };
    },

    // 4. Tanduk Konstan Melengkung Tajam / curved horn
    generateHorn: function(radius, sweepRadius, arcAngle, vBands) {
        let vertices = [], indices = [], normals = [];
        let uBands = 30; 

        // 1. DINDING TABUNG
        for (let i = 0; i <= vBands; i++) {
            let v = (i / vBands) * arcAngle; 
            
            for (let j = 0; j <= uBands; j++) {
                let u = (j * 2 * Math.PI / uBands); 

                // Jalur lengkungan (C-Curve)
                // Kita kurangi dengan sweepRadius agar pangkalnya tepat berada di titik tengah (0,0)
                let pathX = sweepRadius * (Math.cos(v) - 1.0); 
                let pathY = sweepRadius * Math.sin(v);

                let crossX = radius * Math.cos(u);
                let crossZ = radius * Math.sin(u);

                let x = pathX + crossX * Math.cos(v);
                let y = pathY + crossX * Math.sin(v);
                let z = crossZ;

                vertices.push(x, y, z);

                let nx = Math.cos(u) * Math.cos(v);
                let ny = Math.cos(u) * Math.sin(v);
                let nz = Math.sin(u);

                let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
                normals.push(nx/len, ny/len, nz/len);
            }
        }

        for (let i = 0; i < vBands; i++) {
            for (let j = 0; j < uBands; j++) {
                let first = (i * (uBands + 1)) + j;
                let second = first + uBands + 1;
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }

        // 2. TUTUP UJUNG ATAS (CAP) AGAR TIDAK BOLONG / horn cap
        let topCenterIndex = vertices.length / 3;
        let pathXTop = sweepRadius * (Math.cos(arcAngle) - 1);
        let pathYTop = sweepRadius * Math.sin(arcAngle);
        
        vertices.push(pathXTop, pathYTop, 0);
        normals.push(-Math.sin(arcAngle), Math.cos(arcAngle), 0);

        for (let j = 0; j <= uBands; j++) {
            let u = (j * 2 * Math.PI / uBands); 
            let crossX = radius * Math.cos(u);
            let crossZ = radius * Math.sin(u);
            
            let x = pathXTop + crossX * Math.cos(arcAngle);
            let y = pathYTop + crossX * Math.sin(arcAngle);
            let z = crossZ;
            
            vertices.push(x, y, z);
            normals.push(-Math.sin(arcAngle), Math.cos(arcAngle), 0);
        }
        
        for (let j = 0; j < uBands; j++) {
            indices.push(topCenterIndex, topCenterIndex + 1 + j, topCenterIndex + 2 + j);
        }

        return { vertices, indices, normals };
    },

    // 5. Badan Karakter (Bentuk Torso / Superellipse/ Superegg)
    generateBody: function (radiusX, radiusZ, height, taper, uBands, vBands) {
        let vertices = [], indices = [], normals = [];
        
        for (let i = 0; i <= vBands; i++) {
            let v = -Math.PI / 2 + (i * Math.PI / vBands); 
            
            for (let j = 0; j <= uBands; j++) {
                let u = (j * 2 * Math.PI / uBands);
                
                // Tapering (tetap menyempit di leher)
                let taperFactor = 1.0 - (taper * Math.sin(v)); 

                // TRICK EKSPANSI DADA DAN PINGGUL:
                // Memangkatkan nilai cosinus dengan 0.4 akan mendorong lengkungan yang tadinya
                // landai (telur) menjadi melebar keluar di area pundak dan pinggul.
                let profile = Math.pow(Math.abs(Math.cos(v)), 0.4); 

                let x = radiusX * profile * Math.cos(u) * taperFactor;
                let y = height * Math.sin(v);
                let z = radiusZ * profile * Math.sin(u) * taperFactor;
                
                vertices.push(x, y, z);

                // Normal (Arah pantulan cahaya disesuaikan agar shading tetap halus di badan yang melebar)
                let nx = Math.cos(u) * profile;
                let ny = Math.sin(v);
                let nz = Math.sin(u) * profile;
                
                let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
                normals.push(nx/len, ny/len, nz/len);
            }
        }
        
        for (let i = 0; i < vBands; i++) {
            for (let j = 0; j < uBands; j++) {
                let first = (i * (uBands + 1)) + j;
                let second = first + uBands + 1;
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }
        
        return { vertices, indices, normals };
    },

    // 6. Kerucut Terpancung + Ujung Melengkung (Kaki Kapsul)
    generateCone: function (topRadius, bottomRadius, height, vBands) {
        let vertices = [], indices = [], normals = [];
        let uBands = 30; 
        let bottomBands = 15; // Jumlah pita tambahan untuk membentuk setengah bola di bawah

        // 1. Dinding Kerucut Lurus DILANJUTKAN dengan Ujung Melengkung (Setengah Bola)
        // Total perulangan vertikal = dinding lurus (vBands) + lengkungan bawah (bottomBands)
        for (let i = 0; i <= vBands + bottomBands; i++) {
            let x, y, z, nx, ny, nz;
            
            if (i <= vBands) {
                // --- BAGIAN DINDING LURUS ---
                let v = i / vBands; 
                let currentRadius = topRadius * (1 - v) + bottomRadius * v; 
                y = -height * v; 
                
                let slope = (topRadius - bottomRadius); 
                
                for (let j = 0; j <= uBands; j++) {
                    let u = (j * 2 * Math.PI / uBands);
                    x = currentRadius * Math.cos(u);
                    z = currentRadius * Math.sin(u);
                    vertices.push(x, y, z);
                    
                    // Normal Dinding
                    nx = Math.cos(u) * height;
                    ny = slope; 
                    nz = Math.sin(u) * height;
                    
                    let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
                    normals.push(nx/len, ny/len, nz/len);
                }
            } else {
                // --- BAGIAN UJUNG MELENGKUNG (SETENGAH BOLA Bawah) ---
                // v berjalan dari 0 (awal lengkungan) ke 1 (titik paling bawah)
                let v = (i - vBands) / bottomBands; 
                let phi = v * (Math.PI / 2); // Sudut memutar turun 90 derajat
                
                let currentRadius = bottomRadius * Math.cos(phi);
                y = -height - (bottomRadius * Math.sin(phi)); // Turun melengkung ke bawah
                
                for (let j = 0; j <= uBands; j++) {
                    let u = (j * 2 * Math.PI / uBands);
                    x = currentRadius * Math.cos(u);
                    z = currentRadius * Math.sin(u);
                    vertices.push(x, y, z);
                    
                    // Normal Setengah Bola menunjuk ke bawah dan menyebar
                    nx = Math.cos(phi) * Math.cos(u);
                    ny = -Math.sin(phi);
                    nz = Math.cos(phi) * Math.sin(u);
                    normals.push(nx, ny, nz);
                }
            }
        }

        // Penyusunan Indeks Segitiga untuk Dinding + Ujung Melengkung
        for (let i = 0; i < vBands + bottomBands; i++) {
            for (let j = 0; j < uBands; j++) {
                let first = (i * (uBands + 1)) + j;
                let second = first + uBands + 1;
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }

        // 2. Tutup Pangkal Atas (Cap Atas - Menempel di badan)
        let topCenterIndex = vertices.length / 3;
        vertices.push(0, 0, 0); 
        normals.push(0, 1, 0);  

        for (let j = 0; j <= uBands; j++) {
            let u = (j * 2 * Math.PI / uBands);
            let x = topRadius * Math.cos(u);
            let z = topRadius * Math.sin(u);
            vertices.push(x, 0, z);
            normals.push(0, 1, 0);
        }

        for (let j = 0; j < uBands; j++) {
            indices.push(topCenterIndex, topCenterIndex + 1 + j, topCenterIndex + 2 + j);
        }

        return { vertices, indices, normals };
    },

    // 7. Jubah (1 Sheet dari Hyperboloid of Two Sheets)
    generateHyperboloidCloak: function (topRadius, flare, height, sweepAngle, uBands, vBands) {
        let vertices = [], indices = [], normals = [];
        
        let b = 1.0; // Konstanta kelengkungan dasar
        
        // Mencari titik potong (yStart) agar lubang leher persis sebesar topRadius
        // Berdasarkan rumus r = a * sqrt((y^2 / b^2) - 1)
        let yStart = Math.sqrt(Math.pow(topRadius / flare, 2) + b*b);
        let yEnd = yStart + height;

        for (let i = 0; i <= vBands; i++) {
            let v = i / vBands; 
            
            // y bergerak mengikuti kurva hiperboloida asli
            let currentY = yStart + v * (yEnd - yStart);
            
            // Kalkulasi jari-jari pada ketinggian Y tersebut
            let currentRadius = flare * Math.sqrt((currentY * currentY)/(b*b) - 1);
            
            // Koordinat gambar di WebGL (kita tarik turun ke bawah agar jubah menjuntai)
            let drawY = -height * v; 

            for (let j = 0; j <= uBands; j++) {
                // Posisi sudut U didistribusikan dari minus ke plus agar celah ada di depan
                let u = -sweepAngle/2 + (j / uBands) * sweepAngle;
                
                let x = currentRadius * Math.sin(u);
                let z = currentRadius * Math.cos(u);

                vertices.push(x, drawY, z);

                // Kalkulasi arah pantulan cahaya (Normal) untuk Hiperboloida 2 Lembar
                let nx = x / (flare * flare);
                let ny = currentY; // Arah normal mengikuti kurva mangkok
                let nz = z / (flare * flare);
                
                let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
                normals.push(nx/len, ny/len, nz/len);
            }
        }

        // Penyusunan Indeks Segitiga
        for (let i = 0; i < vBands; i++) {
            for (let j = 0; j < uBands; j++) {
                let first = (i * (uBands + 1)) + j;
                let second = first + uBands + 1;
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }

        return { vertices, indices, normals };
    },

    // 8. Tabung Lurus (Gagang Pedang)
    generateCylinder: function (radius, height, uBands) {
        let vertices = [], indices = [], normals = [];
        let vBands = 1; // Tabung lurus tidak butuh banyak potongan vertikal

        // Dinding Tabung
        for (let i = 0; i <= vBands; i++) {
            let y = -height * i; // Bergerak dari 0 ke bawah
            
            for (let j = 0; j <= uBands; j++) {
                let u = (j * 2 * Math.PI / uBands);
                let x = radius * Math.cos(u);
                let z = radius * Math.sin(u);
                
                vertices.push(x, y, z);
                
                // Normal menunjuk keluar secara horizontal
                normals.push(Math.cos(u), 0, Math.sin(u));
            }
        }

        // Penyusunan Indeks Segitiga
        for (let i = 0; i < vBands; i++) {
            for (let j = 0; j < uBands; j++) {
                let first = (i * (uBands + 1)) + j;
                let second = first + uBands + 1;
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }

        const topCenter = vertices.length / 3;
        vertices.push(0, 0, 0);
        normals.push(0, 1, 0);
        for (let j = 0; j <= uBands; j++) {
            const u = j * 2 * Math.PI / uBands;
            vertices.push(radius * Math.cos(u), 0, radius * Math.sin(u));
            normals.push(0, 1, 0);
        }
        for (let j = 0; j < uBands; j++) {
            indices.push(topCenter, topCenter + 2 + j, topCenter + 1 + j);
        }

        const bottomCenter = vertices.length / 3;
        vertices.push(0, -height, 0);
        normals.push(0, -1, 0);
        for (let j = 0; j <= uBands; j++) {
            const u = j * 2 * Math.PI / uBands;
            vertices.push(radius * Math.cos(u), -height, radius * Math.sin(u));
            normals.push(0, -1, 0);
        }
        for (let j = 0; j < uBands; j++) {
            indices.push(bottomCenter, bottomCenter + 1 + j, bottomCenter + 2 + j);
        }

        return { vertices, indices, normals };
    },

    generateNailBlade: function (length, width, thickness) {
        const vertices = [], indices = [], normals = [];
        const rings = [
            { y: 0, w: width * 0.62, d: thickness * 0.62 },
            { y: -length * 0.16, w: width, d: thickness },
            { y: -length * 0.72, w: width * 0.62, d: thickness * 0.72 },
            { y: -length * 0.94, w: width * 0.28, d: thickness * 0.4 }
        ];
        const ringStart = [];

        rings.forEach(ring => {
            ringStart.push(vertices.length / 3);
            [[ring.w, 0], [0, ring.d], [-ring.w, 0], [0, -ring.d]].forEach(([x, z]) => {
                vertices.push(x, ring.y, z);
                const nx = x / Math.max(ring.w * ring.w, 1e-6);
                const nz = z / Math.max(ring.d * ring.d, 1e-6);
                const lengthN = Math.hypot(nx, nz) || 1;
                normals.push(nx / lengthN, 0, nz / lengthN);
            });
        });

        for (let r = 0; r < rings.length - 1; r++) {
            for (let j = 0; j < 4; j++) {
                const a = ringStart[r] + j;
                const b = ringStart[r] + (j + 1) % 4;
                const c = ringStart[r + 1] + j;
                const d = ringStart[r + 1] + (j + 1) % 4;
                indices.push(a, c, b, b, c, d);
            }
        }

        const baseCenter = vertices.length / 3;
        vertices.push(0, 0, 0);
        normals.push(0, 1, 0);
        for (let j = 0; j < 4; j++) {
            indices.push(baseCenter, ringStart[0] + (j + 1) % 4, ringStart[0] + j);
        }

        const tip = vertices.length / 3;
        vertices.push(0, -length, 0);
        normals.push(0, -1, 0);
        for (let j = 0; j < 4; j++) {
            indices.push(ringStart[rings.length - 1] + j, tip, ringStart[rings.length - 1] + (j + 1) % 4);
        }

        return { vertices, indices, normals };
    }
};