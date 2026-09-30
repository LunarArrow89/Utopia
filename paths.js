const paths = {};
const pathHandlers = {};

let currentPath = "forest";

function registerPath(name, data, handlers = {}) {
    paths[name] = data;
    pathHandlers[name] = handlers;
}

function updatePath(name = currentPath) {
    pathHandlers[name]?.update?.();
}

function catchUpPathWhileAway(name) {
    pathHandlers[name]?.catchUp?.();
}

function finishPath(name = currentPath) {
    const handler = pathHandlers[name];
    if (handler?.finish) return handler.finish();

    const path = paths[name];
    if (!path) return;

    path.progress = path.duration;
    path.completed = true;
    gameEnded = true;
    addLog(`${path.name} completed!`);
    saveGame();
}
