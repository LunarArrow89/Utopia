const paths = {
    forest: {
        name: "Whispering Woods",
        progress: 0,
        duration: 300,
        encounterTime: 45,
        completed: false,
        lastUpdateTime: 0
    },

    cave: {
        name: "Crystal Cave",
        progress: 0,
        duration: 420,
        encounterTime: 60,
        completed: false
    }
};

let currentPath = "forest";

function updatePath() {
    const path = paths[currentPath];
    path.lastUpdateTime = Date.now();

    if (path.completed) return;

    path.progress++;

    if (path.progress >= path.duration) {
        finishPath();
        return;
    }

    if (path.progress >= path.encounterTime) {
        startBattle();
        path.encounterTime =
            path.progress + randomEncounterTime();
    }

    updateForest();
}

function randomEncounterTime() {
    return 30 + Math.floor(Math.random() * 31);
}

function finishPath() {
    const path = paths[currentPath];

    path.completed = true;
    gameEnded = true;

    addLog(`${path.name} completed!`);

    if (currentPath === "forest" && !village.unlocked) {
        showArrivalScene();
    }

    saveGame();
}
