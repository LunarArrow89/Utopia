const paths = {};
const pathHandlers = {};

function registerPath(name, data, handlers = {}) {
    paths[name] = data;
    pathHandlers[name] = handlers;
}

let currentPath = "forest";

function randomEncounterTime() {
    return 30 + Math.floor(Math.random() * 31);
}

function updatePath(pathName = currentPath) {
    const handler = pathHandlers[pathName];

    if (handler && typeof handler.update === "function") {
        handler.update();
    }
}

function catchUpPathWhileAway(pathName) {
    const handler = pathHandlers[pathName];

    if (handler && typeof handler.catchUp === "function") {
        handler.catchUp();
    }
}

function catchUpPathsWhileAway() {
    Object.keys(pathHandlers).forEach(pathName => {
        catchUpPathWhileAway(pathName);
    });
}

function finishPath(pathName = currentPath) {
    const handler = pathHandlers[pathName];

    if (handler && typeof handler.finish === "function") {
        handler.finish();
        return;
    }

    const path = paths[pathName];
    if (!path) return;

    path.progress = path.duration;
    path.completed = true;
    gameEnded = true;

    addLog(path.name + " completed!");
    saveGame();
}

function updatePaths() {
    // Normal on-screen progression.
    if (!resting && !gameEnded && !village.unlocked && !paths.forest.completed) {
        updatePath("forest");
    }

    if (!resting && paths.ashHills.active && !paths.ashHills.completed) {
        updatePath("ashHills");
    }
}
