let gameInitialized = false;

async function initializeGame() {
    const loggedIn = await loadGame();

    if (!loggedIn) {
        requireLogin();
        return;
    }

    // The server has already processed all offline idle time and
    // loadGame() has loaded the authoritative cloud save.
    // Do not run browser catch-up here or save the old browser state back
    // over the server's offline progress.

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
}

document.addEventListener("DOMContentLoaded", initializeGame);

function tick() {
    // Do not save or advance anything while the initial cloud save is
    // still loading. This prevents an old local save from racing the
    // server-side idle engine during startup.
    if (!gameInitialized) return;

    const now = Date.now();

    // Always keep the forest clock anchored to real time. This prevents
    // the progress bar from getting stuck at 0 on phones or after a
    // browser has throttled a timer.
    if (paths.forest && !paths.forest.lastUpdateTime) {
        paths.forest.lastUpdateTime = now;
    }

    // Cutscenes and resting deliberately pause path progression.
    if (!gameEnded && !resting) {
        updatePaths();
    }

    // Update the visible bars every tick even if the path itself did not
    // advance this exact second.
    updateForest();

    if (!village.unlocked) {
        updateRest();
    }

    saveGame();
}

setInterval(tick, 1000);

// Repaint the progress bar when the tab becomes visible again. Mobile
// browsers commonly throttle timers while a page is hidden.
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && gameInitialized) {
        updateForest();
        updatePaths();
    }
});
