const ashEnemies = [
    { name: "Ash Hound", hp: 32, attack: 17, xp: 28, gold: 12 },
    { name: "Cinder Goblin", hp: 38, attack: 19, xp: 32, gold: 15 },
    { name: "Burnt Stalker", hp: 42, attack: 21, xp: 38, gold: 18 },
    { name: "Ash Brute", hp: 50, attack: 23, xp: 45, gold: 22 }
];

registerPath("ashHills", {
    name: "Ash Hills",
    progress: 0,
    duration: 45 * 60,
    encounterTime: 45,
    completed: false,
    active: false,
    lastUpdateTime: 0,
    levelRequirement: 3
}, {
    update() {
        updateAshHills();
    },

    catchUp() {
        catchUpAshHillsWhileAway();
    },

    finish() {
        finishAshHills();
    }
});

function startAshHills() {
    const path = paths.ashHills;

    if (!village.unlocked || village.housesBuilt < 2) return;

    if (player.level < path.levelRequirement) {
        addVillageLog("You must reach level " + path.levelRequirement + " before entering Ash Hills.");
        return;
    }

    if (path.completed || path.active) {
        showAshHills();
        return;
    }

    path.active = true;
    path.lastUpdateTime = Date.now();
    path.encounterTime = 45;
    currentPath = "ashHills";
    gameEnded = false;

    addVillageLog("You entered Ash Hills. The path will take 45 minutes.");
    showAshHills();
    saveGame();
}

function showAshHills() {
    setVillageTabsVisible(false);
    document.getElementById("arrivalScene")?.classList.add("hidden");
    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("villageScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    document.getElementById("questScreen")?.classList.add("hidden");
    document.getElementById("ashHillsScreen")?.classList.remove("hidden");
    updateAshHillsUI();
}

function returnToVillageFromAshHills() {
    showVillage();

    if (paths.ashHills.active) {
        addVillageLog("You returned to Oakshade Village. Ash Hills is still in progress.");
    }

    saveGame();
}

function updateAshHills() {
    const path = paths.ashHills;

    if (!path.active || path.completed || resting) return;

    const now = Date.now();
    const elapsed = Math.floor((now - path.lastUpdateTime) / 1000);

    if (elapsed <= 0) return;

    path.lastUpdateTime = now;
    path.progress = Math.min(path.duration, path.progress + elapsed);

    if (path.progress >= path.encounterTime) {
        startAshBattle();

        if (path.active && !path.completed) {
            path.encounterTime = path.progress + randomEncounterTime();
        }
    }

    updateAshHillsUI();

    if (path.progress >= path.duration) {
        finishAshHills();
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
        const result = resolveBattle(enemy);

        if (result.won) {
            player.gold += enemy.gold;
            giveXP(enemy.xp);
            addLog("You defeated " + enemy.name + ".");
        } else {
            player.hp -= result.damageTaken;
            addLog(enemy.name + " attacked you for " + result.damageTaken + " damage.");

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

function finishAshHills() {
    const path = paths.ashHills;

    if (path.completed) return;

    path.progress = path.duration;
    path.active = false;
    path.completed = true;
    currentPath = "forest";
    gameEnded = true;

    addLog("Ash Hills completed!");
    addLog("You found a civilian trapped beyond the hills.");
    addLog("You rescued the civilian and brought them safely back to Oakshade Village.");

    village.quests.rescueCivilian.completed = true;

    document.getElementById("ashHillsScreen")?.classList.add("hidden");

    if (village.unlocked) {
        showVillage();
        addVillageLog("You returned with a rescued civilian from Ash Hills.");
    }

    updateQuests();
    updateAshHillsUI();
    saveGame();
}

function updateAshHillsUI() {
    const path = paths.ashHills;
    const bar = document.getElementById("ashHillsBar");
    const text = document.getElementById("ashHillsText");
    const hpText = document.getElementById("ashHillsHpText");
    const hpBar = document.getElementById("ashHillsHpBar");
    const xpText = document.getElementById("ashHillsXpText");
    const xpBar = document.getElementById("ashHillsXpBar");
    const levelText = document.getElementById("ashHillsLevelText");
    const attackText = document.getElementById("ashHillsAttackText");
    const goldText = document.getElementById("ashHillsGoldText");
    const restText = document.getElementById("ashHillsRestText");

    if (bar) bar.style.width = (path.progress / path.duration * 100) + "%";

    if (text) {
        const remaining = Math.max(0, path.duration - path.progress);
        text.textContent =
            Math.floor(remaining / 60) + ":" +
            String(remaining % 60).padStart(2, "0") + " remaining";
    }

    if (hpText) hpText.textContent = player.hp + " / " + player.maxHp;
    if (hpBar) hpBar.style.width = (player.hp / player.maxHp * 100) + "%";
    if (xpText) xpText.textContent = player.xp + " / " + player.xpToNext + " XP";
    if (xpBar) xpBar.style.width = (player.xp / player.xpToNext * 100) + "%";
    if (levelText) levelText.textContent = player.level;
    if (attackText) attackText.textContent = player.attack;
    if (goldText) goldText.textContent = player.gold;

    if (restText) {
        restText.textContent = resting
            ? "You are resting before continuing Ash Hills."
            : "Rest when you need to recover.";
    }
}
