async function initializeGame() {
    await loadGame();

    catchUpForestWhileAway();

    if (typeof catchUpVillageWalk === "function") {
        catchUpVillageWalk();
    }

    catchUpAshHillsWhileAway();

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

function catchUpAshHillsWhileAway() {
    const path = paths.ashHills;

    if (!path.active || path.completed) return;

    const now = Date.now();
    if (!path.lastUpdateTime) {
        path.lastUpdateTime = now;
        return;
    }

    const offlineSeconds = Math.floor((now - path.lastUpdateTime) / 1000);
    if (offlineSeconds <= 0) return;

    const oldProgress = path.progress;
    const targetProgress = Math.min(path.duration, oldProgress + offlineSeconds);

    let encounterTime = path.encounterTime;
    let diedOffline = false;

    while (encounterTime <= targetProgress && encounterTime > oldProgress) {
        const enemy = ashEnemies[Math.floor(Math.random() * ashEnemies.length)];
        const damageTaken = Math.max(0, enemy.attack - player.attack);

        if (damageTaken <= 0) {
            player.gold += enemy.gold;
            giveXP(enemy.xp);
        } else {
            player.hp -= damageTaken;

            if (player.hp <= 0) {
                player.hp = 0;
                diedOffline = true;
                break;
            }
        }

        encounterTime += randomEncounterTime();
    }

    path.encounterTime = encounterTime;
    path.progress = targetProgress;
    path.lastUpdateTime = now;

    updateHP();
    updateGold();
    updateAshHillsUI();

    if (diedOffline) {
        resting = false;
        startRest(true);
        saveGame();
        return;
    }

    if (path.progress >= path.duration) {
        finishAshHills();
    }
}

function catchUpForestWhileAway() {
    const path = paths.forest;
    const now = Date.now();

    if (village.unlocked || path.completed) return;

    if (!path.lastUpdateTime) {
        path.lastUpdateTime = now;
        return;
    }

    const offlineSeconds = Math.floor((now - path.lastUpdateTime) / 1000);
    if (offlineSeconds <= 0) return;

    const oldProgress = path.progress;
    const targetProgress = Math.min(path.duration, oldProgress + offlineSeconds);

    // Check forest encounters that happened while the game was closed.
    // If one defeats the player, put them into the same forced-rest state
    // they would have had while playing normally.
    let encounterTime = path.encounterTime;
    let diedOffline = false;

    while (encounterTime <= targetProgress && encounterTime > oldProgress) {
        const enemy = enemies[Math.floor(Math.random() * enemies.length)];
        const damageTaken = Math.max(0, enemy.attack - player.attack);

        if (damageTaken <= 0) {
            player.gold += enemy.gold;
            giveXP(enemy.xp);
        } else {
            player.hp -= damageTaken;

            if (player.hp <= 0) {
                player.hp = 0;
                diedOffline = true;
                break;
            }
        }

        encounterTime += randomEncounterTime();
    }

    path.encounterTime = encounterTime;
    path.progress = diedOffline ? targetProgress : targetProgress;
    path.lastUpdateTime = now;

    updateHP();
    updateGold();

    if (diedOffline) {
        // The death happened while the game was closed. Start a fresh
        // forced-rest timer now so the player cannot continue walking yet.
        resting = false;
        startRest(true);
        saveGame();
        return;
    }

    if (path.progress >= path.duration) {
        path.progress = path.duration;
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

    if (resting && paths.ashHills.active && !paths.ashHills.completed) {
        paths.ashHills.lastUpdateTime = Date.now();
    }

    if (!resting && paths.ashHills.active && !paths.ashHills.completed) {
        updateAshHills();
    }

    if (!village.unlocked) {
        updateRest();
    }

    saveGame();
}

setInterval(tick, 1000);
