const forestEnemies = [
    { name: "Corrupt Druid", hp: 18, attack: 6, xp: 6, gold: 2 },
    { name: "Goblin", hp: 22, attack: 5, xp: 8, gold: 3 },
    { name: "Blight", hp: 20, attack: 7, xp: 7, gold: 4 },
    { name: "Slime", hp: 15, attack: 6, xp: 9, gold: 3 }
];

registerPath("forest", {
    name: "The Forest",
    progress: 0,
    duration: 300,
    encounterTime: 45,
    completed: false,
    lastUpdateTime: 0
}, {
    update() {
        const path = paths.forest;
        if (path.completed || gameEnded || resting) return;

        const now = Date.now();
        if (!path.lastUpdateTime) {
            path.lastUpdateTime = now;
            updateForest();
            return;
        }

        const seconds = Math.floor((now - path.lastUpdateTime) / 1000);
        if (seconds <= 0) return updateForest();

        path.lastUpdateTime += seconds * 1000;
        path.progress = Math.min(path.duration, path.progress + seconds);

        if (path.progress >= path.encounterTime) {
            if (forestEncounter(path)) return;
        }

        if (path.progress >= path.duration) {
            finishPath("forest");
            return;
        }

        updateForest();
    },

    catchUp() {
        const path = paths.forest;
        if (path.completed || village.unlocked || !path.lastUpdateTime) return;

        const seconds = Math.floor((Date.now() - path.lastUpdateTime) / 1000);
        if (seconds <= 0) return;

        const target = Math.min(path.duration, path.progress + seconds);
        path.progress = target;

        while (path.encounterTime <= target) {
            if (offlineEncounter(path)) break;
        }

        path.lastUpdateTime = Date.now();
        updateHP();
        updateGold();
        updateForest();

        if (path.progress >= path.duration && !resting) {
            finishPath("forest");
        } else {
            saveGame();
        }
    },

    finish() {
        const path = paths.forest;
        path.progress = path.duration;
        path.completed = true;
        gameEnded = true;

        if (!arrivalCutsceneSeen) showArrivalScene();

        addLog("The Forest completed!");
        saveGame();
    }
});

function randomForestEnemy() {
    return forestEnemies[Math.floor(Math.random() * forestEnemies.length)];
}

function nextForestEncounter(path) {
    path.encounterTime = path.progress + randomEncounterTime();
}

function forestEncounter(path) {
    const enemy = randomForestEnemy();
    const result = resolveBattle(enemy);

    if (result.defeated) {
        player.gold += enemy.gold;
        giveXP(enemy.xp);
        addLog(`You defeated ${enemy.name}.`);
    } else {
        player.hp = Math.max(0, player.hp - result.damageTaken);
        addLog(`${enemy.name} attacked you for ${result.damageTaken} damage.`);

        if (player.hp <= 0) {
            addLog(`${enemy.name} defeated you.`);
            nextForestEncounter(path);
            updateHP();
            updateGold();
            startRest(true);
            return true;
        }
    }

    nextForestEncounter(path);
    updateHP();
    updateGold();
    return false;
}

function offlineEncounter(path) {
    const enemy = randomForestEnemy();
    const result = resolveBattle(enemy);

    if (result.defeated) {
        player.gold += enemy.gold;
        addOfflineXP(enemy.xp);
        addLog(`You defeated ${enemy.name}.`);
    } else {
        player.hp = Math.max(0, player.hp - result.damageTaken);
        addLog(`${enemy.name} attacked you for ${result.damageTaken} damage.`);

        if (player.hp <= 0) {
            player.hp = 0;
            addLog(`${enemy.name} defeated you.`);
            nextForestEncounter(path);
            startRest(true);
            return true;
        }
    }

    nextForestEncounter(path);
    return false;
}

function addOfflineXP(amount) {
    player.xp += amount;

    while (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level++;
        player.attack++;
        player.maxHp += 3;
        player.hp = Math.min(player.maxHp, player.hp + 3);
        player.xpToNext += 25;
        addLog(`You reached level ${player.level}! Attack +1, Max HP +3.`);
    }
}
