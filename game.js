async function initializeGame() {
    await loadGame();

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

document.addEventListener("DOMContentLoaded", initializeGame);

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
