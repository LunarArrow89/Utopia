const forestEnemies = [
    { name: "Corrupt Druid", hp: 18, attack: 12, xp: 12, gold: 5 },
    { name: "Goblin", hp: 22, attack: 10, xp: 15, gold: 7 },
    { name: "Blight", hp: 20, attack: 11, xp: 14, gold: 10 },
    { name: "Slime", hp: 15, attack: 13, xp: 18, gold: 8 }
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
        path.lastUpdateTime = Date.now();

        if (path.completed) return;

        path.progress++;

        if (path.progress >= path.duration) {
            finishPath("forest");
            return;
        }

        if (path.progress >= path.encounterTime) {
            startBattle(forestEnemies);
            path.encounterTime = path.progress + randomEncounterTime();
        }

        updateForest();
    },

    catchUp() {
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

        let encounterTime = path.encounterTime;
        let diedOffline = false;

        while (encounterTime <= targetProgress && encounterTime > oldProgress) {
            const enemy = forestEnemies[Math.floor(Math.random() * forestEnemies.length)];
            const damageTaken = Math.max(0, enemy.attack - player.attack);

            if (damageTaken <= 0) {
                player.gold += enemy.gold;
                giveXP(enemy.xp);
                addLog("You defeated " + enemy.name + ".");
            } else {
                player.hp -= damageTaken;
                addLog(enemy.name + " attacked you for " + damageTaken + " damage.");

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

        if (diedOffline) {
            resting = false;
            startRest(true);
            saveGame();
            return;
        }

        if (path.progress >= path.duration) {
            finishPath("forest");
        }
    },

    finish() {
        const path = paths.forest;

        path.progress = path.duration;
        path.completed = true;
        gameEnded = true;

        addLog(path.name + " completed!");
        saveGame();
    }
});
