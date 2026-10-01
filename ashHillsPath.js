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
    encounterTime: 90,
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
    path.encounterTime = 90;
    currentPath = "ashHills";
    gameEnded = false;

    try {
        localStorage.setItem("utopiaActiveTab", "walk");
    } catch (error) {}

    addVillageLog("You entered Ash Hills. The path will take 45 minutes.");
    showAshHills();
    saveGame();
}

function showAshHills() {
    setVillageTabsVisible(true);
    if (typeof updateMainTabs === "function") updateMainTabs("walk");
    try {
        localStorage.setItem("utopiaActiveTab", "walk");
    } catch (error) {}
    document.getElementById("arrivalScene")?.classList.add("hidden");
    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("villageScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    document.getElementById("questScreen")?.classList.add("hidden");
    document.getElementById("ashHillsScreen")?.classList.remove("hidden");
    document.getElementById("ashHillsScreen")?.classList.add("walk-active");
    const walkTab = document.getElementById("walkMainTab");
    if (walkTab) {
        walkTab.classList.remove("hidden");
        walkTab.style.display = "";
        walkTab.setAttribute("aria-hidden", "false");
    }
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

    if (!path || !path.active || path.completed || resting) {
        updateAshHillsUI();
        return;
    }

    const now = Date.now();

    if (!path.lastUpdateTime) {
        path.lastUpdateTime = now;
        updateAshHillsUI();
        return;
    }

    const elapsed = Math.floor((now - path.lastUpdateTime) / 1000);
    if (elapsed <= 0) {
        updateAshHillsUI();
        return;
    }

    path.lastUpdateTime = now;
    path.progress = Math.min(path.duration, path.progress + elapsed);

    // Process every encounter that happened during the elapsed time.
    // This keeps Ash Hills working correctly after the browser has been
    // sitting in the background for a while.
    while (
        path.active &&
        !path.completed &&
        !resting &&
        path.encounterTime <= path.progress
    ) {
        startAshBattle();

        if (path.active && !path.completed && !resting) {
            path.encounterTime += 90;
        }
    }

    updateHP();
    updateGold();
    updateAshHillsUI();

    if (path.progress >= path.duration && path.active && !resting) {
        finishAshHills();
    }

    // Keep the account/local save current while the path is running.
    if (typeof saveGame === "function") {
        saveGame();
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

        if (result.defeated) {
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

        encounterTime += 90;
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

    // Pause the game on the visual rescue sequence. It is intentionally
    // silent: the animation tells the story with shapes and motion.
    ashHillsCutsceneSeen = false;

    addLog("Ash Hills completed!");
    addLog("You found a civilian trapped beyond the hills.");
    addLog("You rescued the civilian and brought them safely back to Oakshade Village.");

    village.quests.rescueCivilian.completed = true;

    document.getElementById("ashHillsScreen")?.classList.add("hidden");
    updateQuests();
    updateAshHillsUI();
    saveGame();

    if (typeof showAshHillsCutscene === "function") {
        showAshHillsCutscene();
    } else if (village.unlocked) {
        showVillage();
    }
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

    const progressPercent = path.duration > 0
        ? Math.max(0, Math.min(100, (path.progress / path.duration) * 100))
        : 0;
    const hpPercent = player.maxHp > 0
        ? Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100))
        : 0;
    const xpPercent = player.xpToNext > 0
        ? Math.max(0, Math.min(100, (player.xp / player.xpToNext) * 100))
        : 0;

    if (bar) bar.style.width = progressPercent + "%";

    if (text) {
        const remaining = Math.max(0, path.duration - path.progress);
        text.textContent =
            Math.floor(remaining / 60) + ":" +
            String(remaining % 60).padStart(2, "0") + " remaining";
    }

    if (hpText) hpText.textContent = player.hp + " / " + player.maxHp;
    if (hpBar) hpBar.style.width = hpPercent + "%";
    if (xpText) xpText.textContent = player.xp + " / " + player.xpToNext + " XP";
    if (xpBar) xpBar.style.width = xpPercent + "%";

    const restBar = document.getElementById("ashHillsRestBar");
    if (restBar) {
        const restPercent = resting && restDuration > 0
            ? Math.max(0, Math.min(100, ((Date.now() - restStartTime) / 1000 / restDuration) * 100))
            : 0;
        restBar.style.width = restPercent + "%";
    }
    if (levelText) levelText.textContent = player.level;
    if (attackText) attackText.textContent = player.attack;
    if (goldText) goldText.textContent = player.gold;

    if (restText) {
        restText.textContent = resting
            ? "You are resting before continuing Ash Hills."
            : "Rest when you need to recover.";
    }
}


/*
 * Ash Hills has its own clock so it keeps progressing even though the
 * normal Forest tick is no longer the active path.
 */
let ashHillsTimer = null;

function startAshHillsTimer() {
    if (ashHillsTimer) clearInterval(ashHillsTimer);
    ashHillsTimer = setInterval(() => {
        if (paths.ashHills?.active && !paths.ashHills.completed) {
            updateAshHills();
        }
    }, 1000);
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && paths.ashHills?.active) {
        catchUpAshHillsWhileAway();
        updateAshHillsUI();
    }
});

window.addEventListener("pageshow", () => {
    if (paths.ashHills?.active) {
        catchUpAshHillsWhileAway();
        updateAshHillsUI();
    }
});

startAshHillsTimer();
