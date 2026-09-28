let gameInitialized = false;
let lastGameTick = 0;
let lastProgressSave = 0;

async function initializeGame() {
    const loggedIn = await loadGame();

    if (!loggedIn) {
        requireLogin();
        return;
    }

    // Make sure every active path has a usable timestamp after loading.
    // Older saves may have 0 here, which otherwise makes the first tick
    // only initialize the clock instead of advancing the path.
    const now = Date.now();

    if (paths.forest && !paths.forest.completed) {
        if (!Number.isFinite(Number(paths.forest.progress))) {
            paths.forest.progress = 0;
        }

        paths.forest.progress = Math.max(
            0,
            Math.min(Number(paths.forest.duration) || 300, Number(paths.forest.progress) || 0)
        );

        if (!Number(paths.forest.lastUpdateTime)) {
            paths.forest.lastUpdateTime = now;
        }
    }

    if (paths.ashHills && paths.ashHills.active && !paths.ashHills.completed) {
        if (!Number(paths.ashHills.lastUpdateTime)) {
            paths.ashHills.lastUpdateTime = now;
        }
    }

    refreshGameUI();

    if (paths.ashHills.active && currentPath === "ashHills") {
        showAshHills();
    } else if (village.walk.active && currentPath === "villageWalk") {
        showVillageWalkTab();
    } else if (currentPath === "forest" && !paths.forest.completed) {
        document.getElementById("forestGame")?.classList.remove("hidden");
    } else if (currentPath === "village" && village.unlocked) {
        showVillage();
    }

    gameInitialized = true;
    lastGameTick = Date.now();
    lastProgressSave = Date.now();

    // Paint the real loaded state immediately.
    updateForest();
}

document.addEventListener("DOMContentLoaded", initializeGame);

function tick() {
    if (!gameInitialized) return;

    const now = Date.now();

    // Never allow a bad clock value to make the path freeze.
    if (!lastGameTick) lastGameTick = now;

    // Cutscenes and resting deliberately pause path progression.
    if (!gameEnded && !resting) {
        updatePaths();
    }

    // Always repaint the visible forest bar.
    updateForest();

    if (!village.unlocked) {
        updateRest();
    }

    // Saving every second caused cloud writes to race with the idle-save
    // system. The game state still updates every second, but cloud saves
    // are sent periodically instead of constantly overwriting the server.
    if (now - lastProgressSave >= 10000) {
        lastProgressSave = now;
        saveGame();
    }

    lastGameTick = now;
}

setInterval(tick, 1000);

// When a phone or computer wakes the page, immediately calculate elapsed
// path time before repainting. This avoids waiting for another timer tick.
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && gameInitialized) {
        if (!gameEnded && !resting) {
            updatePaths();
        }

        updateForest();
        refreshGameUI();
    }
});

window.addEventListener("pageshow", () => {
    if (!gameInitialized) return;

    if (!gameEnded && !resting) {
        updatePaths();
    }

    updateForest();
});
