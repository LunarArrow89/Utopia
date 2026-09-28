const forestEnemies = [
    { name: "Corrupt Druid", hp: 18, attack: 6, xp: 6, gold: 2 },
    { name: "Goblin", hp: 22, attack: 5, xp: 8, gold: 3 },
    { name: "Blight", hp: 20, attack: 7, xp: 7, gold: 4 },
    { name: "Slime", hp: 15, attack: 6, xp: 9, gold: 3 }
];

registerPath("forest", {
    name: "Whispering Woods",
    progress: 0,
    duration: 300,
    encounterTime: 45,
    completed: false,
    lastUpdateTime: 0
}, {
    update() {
        const path = paths.forest;
        const now = Date.now();

        if (path.completed || gameEnded || resting) return;

        if (!path.lastUpdateTime) {
            path.lastUpdateTime = now;
            updateForest();
            return;
        }

        const elapsedSeconds = Math.floor((now - path.lastUpdateTime) / 1000);
        if (elapsedSeconds <= 0) {
            updateForest();
            return;
        }

        path.lastUpdateTime += elapsedSeconds * 1000;
        path.progress = Math.min(path.duration, path.progress + elapsedSeconds);

        // An encounter is allowed only when the progress crosses the
        // scheduled encounter point. Never run the same encounter again
        // just because update() is called again during the same second.
        if (path.progress >= path.encounterTime) {
            const enemy = forestEnemies[Math.floor(Math.random() * forestEnemies.length)];
            const result = resolveBattle(enemy);

            if (result.defeated) {
                player.gold += enemy.gold;
                giveXP(enemy.xp);
                addLog("You defeated " + enemy.name + ".");
            } else {
                player.hp = Math.max(0, player.hp - result.damageTaken);
                addLog(enemy.name + " attacked you for " + result.damageTaken + " damage.");

                if (player.hp <= 0) {
                    addLog(enemy.name + " defeated you.");
                    path.encounterTime = path.progress + randomEncounterTime();
                    updateHP();
                    updateGold();
                    startRest(true);
                    updateForest();
                    return;
                }
            }

            // Move the encounter point forward immediately. This prevents
            // the same encounter from firing on every timer tick.
            path.encounterTime = path.progress + randomEncounterTime();
            updateHP();
            updateGold();
        }

        if (path.progress >= path.duration) {
            finishPath("forest");
            return;
        }

        updateForest();
    },

    catchUp() {
        const path = paths.forest;
        const now = Date.now();

        if (path.completed || village.unlocked) return;

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
            const enemy = forestEnemies[Math.floor(Math.random() * forestEnemies.length)];
            const result = resolveBattle(enemy);

            if (result.defeated) {
                player.gold += enemy.gold;
                player.xp += enemy.xp;
                addLog("You defeated " + enemy.name + ".");
            } else {
                player.hp = Math.max(0, player.hp - result.damageTaken);
                addLog(enemy.name + " attacked you for " + result.damageTaken + " damage.");

                if (player.hp <= 0) {
                    player.hp = 0;
                    addLog(enemy.name + " defeated you.");
                    diedOffline = true;
                    break;
                }
            }

            encounterTime += randomEncounterTime();
        }

        // Apply any level-ups caused by offline XP without calling saveGame
        // once per enemy.
        while (player.xp >= player.xpToNext) {
            player.xp -= player.xpToNext;
            player.level++;
            player.attack += 1;
            player.maxHp += 3;
            player.hp = Math.min(player.maxHp, player.hp + 3);
            player.xpToNext += 25;
            addLog(`You reached level ${player.level}! Attack +1, Max HP +3.`);
        }

        path.encounterTime = encounterTime;
        path.progress = targetProgress;
        path.lastUpdateTime = now;

        updateHP();
        updateGold();

        if (diedOffline) {
            resting = false;
            startRest(true);
            saveGame();
            return;
        }

        if (path.progress >= path.duration) {
            finishPath("forest");
            return;
        }

        updateForest();
    },

    finish() {
        const path = paths.forest;

        path.progress = path.duration;
        path.completed = true;
        gameEnded = true;

        if (typeof arrivalCutsceneSeen !== "undefined" && !arrivalCutsceneSeen) {
            showArrivalScene();
        }

        addLog(path.name + " completed!");
        saveGame();
    }
});
