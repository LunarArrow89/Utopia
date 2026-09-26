async function initializeGame() {
    await loadGame();

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

initializeGame();

function tick() {
    if (!resting && !gameEnded && !village.unlocked) {
        updatePath();
    }

    if (!village.unlocked) {
        updateRest();
    }

    saveGame();
}

setInterval(tick, 1000);
