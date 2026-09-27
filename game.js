async function initializeGame() {
    await loadGame();

    catchUpForestWhileAway();

    if (typeof catchUpVillageWalk === "function") {
        catchUpVillageWalk();
    }

    updateHP();
    updateGold();
    updateForest();

    if (village.unlocked && paths.forest.completed) {
        showVillage();
    } else if (paths.forest.completed) {
        gameEnded = true;
        showArrivalScene();
    }
}

function catchUpForestWhileAway() {
    const path = paths.forest;
    const now = Date.now();

    if (village.unlocked || path.completed || gameEnded) return;

    if (!path.lastUpdateTime) {
        path.lastUpdateTime = now;
        return;
    }

    const offlineSeconds = Math.floor((now - path.lastUpdateTime) / 1000);
    if (offlineSeconds <= 0) return;

    path.lastUpdateTime = now;
    path.progress = Math.min(path.duration, path.progress + offlineSeconds);

    if (path.progress >= path.duration) {
        path.completed = true;
        gameEnded = true;
        addLog(`${path.name} completed!`);
        saveGame();
    }
}

document.addEventListener("DOMContentLoaded", initializeGame);

function tick() {
    if (!paths.forest.lastUpdateTime) paths.forest.lastUpdateTime = Date.now();

    if (!resting && !gameEnded && !village.unlocked) {
        updatePath();
    }

    if (!village.unlocked) {
        updateRest();
    }

    saveGame();
}

setInterval(tick, 1000);
