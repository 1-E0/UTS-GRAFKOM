(function (global) {
    'use strict';

    if (!global.Environment || typeof global.buildKnightSceneParts !== 'function') {
        throw new Error('Hallownest Knight integration dependencies were not loaded.');
    }

    global.Environment.registerCharacter(global.buildKnightSceneParts, function (time) {
        if (new URLSearchParams(global.location.search).has('trailer') && global.CinematicDirector) {
            const pose = global.CinematicDirector.character('knight', time);
            const breathing = time >= 4.5
                ? Math.sin(global.CinematicDirector.idleTime * 2) * 0.045
                : 0;
            const cinematicMatrix = mat4.create();
            const walkBob = time > 35 && time < 40
                ? Math.abs(Math.sin((time - 35) * 7)) * 0.12
                : 0;
            const counterBob = time > 55 && time < 58
                ? Math.abs(Math.sin((time - 55) * 7)) * 0.12
                : 0;
            mat4.translate(cinematicMatrix, cinematicMatrix, [
                pose.position[0],
                pose.position[1] + breathing + walkBob + counterBob,
                pose.position[2]
            ]);
            mat4.rotateY(cinematicMatrix, cinematicMatrix, pose.yaw);
            if (pose.axisAngle) {
                const axisPivot = [0, -2.1, 0];
                mat4.translate(cinematicMatrix, cinematicMatrix, axisPivot);
                mat4.rotate(cinematicMatrix, cinematicMatrix, pose.axisAngle, [0.7845, 0.51, 0.353]);
                mat4.translate(cinematicMatrix, cinematicMatrix, [-axisPivot[0], -axisPivot[1], -axisPivot[2]]);
            }
            if (pose.hitLean) {
                const hitPivot = [0, -2.1, 0];
                mat4.translate(cinematicMatrix, cinematicMatrix, hitPivot);
                mat4.rotateZ(cinematicMatrix, cinematicMatrix, pose.hitLean);
                mat4.translate(cinematicMatrix, cinematicMatrix, [-hitPivot[0], -hitPivot[1], -hitPivot[2]]);
            }
            mat4.scale(cinematicMatrix, cinematicMatrix, [0.72, 0.72, 0.72]);
            return cinematicMatrix;
        }

        const speed = 0.24;
        const phase = time * speed + 0.65;
        const radiusX = 7.2;
        const radiusZ = 5.2;
        const x = Math.cos(phase) * radiusX;
        const z = Math.sin(phase) * radiusZ;
        const directionX = -Math.sin(phase) * radiusX;
        const directionZ = Math.cos(phase) * radiusZ;
        const yaw = Math.atan2(directionX, directionZ);
        const scale = 0.72 + 0.012 * Math.sin(time * 1.7);
        const matrix = mat4.create();
        mat4.translate(matrix, matrix, [x, -0.53, z]);
        mat4.rotateY(matrix, matrix, yaw);
        mat4.rotate(matrix, matrix, 0.08 * Math.sin(time * 1.4), [1, 0.65, 0.45]);
        mat4.scale(matrix, matrix, [scale, scale, scale]);
        return matrix;
    });
})(window);
