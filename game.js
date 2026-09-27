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

    if (paths.ashHills.active) {
        showAshHills();
    }

    gameInitialized = true;
}

document.addEventListener("DOMContentLoaded", initializeGame);

function tick() {
    // Do not save or advance anything while the initial cloud save is
    // still loading. This prevents an old local save from racing the
    // server-side idle engine during startup.
    if (!gameInitialized) return;

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
