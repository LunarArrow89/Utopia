let gameInitialized = false;
let lastProgressSave = 0;

async function initializeGame() {
    const loggedIn = await loadGame();

    if (!loggedIn) {
        requireLogin();
        return;
    }

    // Do NOT replace an existing forest timestamp with Date.now().
    // That timestamp is what lets the forest calculate elapsed time.
    const path = paths.forest;

    if (path) {
        path.duration = Number(path.duration) || 300;
        path.progress = Math.max(0, Math.min(path.duration, Number(path.progress) || 0));

        if (!Number(path.lastUpdateTime)) {
            path.lastUpdateTime = Date.now();
        }
    }

    gameInitialized = true;
    lastProgressSave = Date.now();

    // Catch up using the saved timestamp first. This makes progress survive
    // refreshes even if the server idle RPC is not installed yet.
    if (!gameEnded && !resting && path && !path.completed) {
        catchUpPathWhileAway("forest");
        updatePath("forest");
    }

    refreshGameUI();

    if (paths.ashHills?.active && currentPath === "ashHills") {
        showAshHills();
    } else if (village.walk.active && currentPath === "villageWalk") {
        showVillageWalkTab();
    } else if (currentPath === "forest" && !paths.forest.completed) {
        document.getElementById("forestGame")?.classList.remove("hidden");
    } else if (currentPath === "village" && village.unlocked) {
        showVillage();
    }

    updateForest();
}

document.addEventListener("DOMContentLoaded", initializeGame);

function tick() {
    if (!gameInitialized) return;

    // Whispering Woods owns its own elapsed-time clock. Do not gate it on
    // village.unlocked or currentPath; those flags can change screens while
    // the forest save still needs to display its real progress.
    if (!gameEnded && !resting && paths.forest && !paths.forest.completed) {
        updatePath("forest");
    }

    updateForest();

    if (!village.unlocked) {
        updateRest();
    }

    const now = Date.now();
    if (now - lastProgressSave >= 2000) {
        lastProgressSave = now;
        saveGame();
    }
}

setInterval(tick, 1000);

// Catch up immediately when a phone/browser wakes the page.
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !gameInitialized) return;

    if (!gameEnded && !resting && paths.forest && !paths.forest.completed) {
        catchUpPathWhileAway("forest");
        updatePath("forest");
    }

    updateForest();
    refreshGameUI();
});

window.addEventListener("pageshow", () => {
    if (!gameInitialized) return;

    if (!gameEnded && !resting && paths.forest && !paths.forest.completed) {
        updatePath("forest");
    }

    updateForest();
});
