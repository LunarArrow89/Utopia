async function initializeGame() {
    const loggedIn = await loadGame();

    if (!loggedIn) {
        requireLogin();
        return;
    }

    // Recalculate time-based progress that happened while the device was off.
    catchUpPathsWhileAway();

    if (typeof catchUpVillageWalk === "function") {
        catchUpVillageWalk();
    }

    // Push all offline catch-up rewards/progress to the account immediately.
    if (typeof saveRemoteGame === "function" && typeof getGameSaveData === "function") {
        await saveRemoteGame(getGameSaveData(Date.now()));
        lastRemoteSaveAt = Date.now();
    }

    updateHP();
    updateGold();
    updateForest();

    if (paths.ashHills.active) {
        showAshHills();
    } else if (village.unlocked && paths.forest.completed) {
        showVillage();
    } else if (paths.forest.completed) {
        gameEnded = true;
        showArrivalScene();
    }
}

document.addEventListener("DOMContentLoaded", initializeGame);

function tick() {
    if (!paths.forest.lastUpdateTime) {
        paths.forest.lastUpdateTime = Date.now();
    }

    // Cutscenes/rest are deliberate pauses. Time spent away during them
    // must not advance the path.
    if (!gameEnded && !resting) {
        updatePaths();
    }

    if (!village.unlocked) {
        updateRest();
    }

    saveGame();
}

setInterval(tick, 1000);
