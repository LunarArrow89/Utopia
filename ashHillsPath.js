const ashEnemies = [
    { name: "Ash Hound", hp: 32, attack: 21, xp: 28, gold: 12 },
    { name: "Cinder Goblin", hp: 38, attack: 23, xp: 32, gold: 15 },
    { name: "Burnt Stalker", hp: 42, attack: 25, xp: 38, gold: 18 },
    { name: "Ash Brute", hp: 50, attack: 27, xp: 45, gold: 22 }
];

registerPath("ashHills", {
    name: "Ash Hills",
    progress: 0,
    duration: 45 * 60,
    encounterTime: 90,
    completed: false,
    rescueCompleted: false,
    active: false,
    lastUpdateTime: 0,
    levelRequirement: 3
}, {
    update() { updateAshHills(); },
    catchUp() { catchUpAshHillsWhileAway(); },
    finish() { finishAshHills(); }
});

function startAshHills() {
    const path = paths.ashHills;
    if (!village.unlocked || village.housesBuilt < 2) return;
    if (player.level < path.levelRequirement) {
        addVillageLog("You must reach level " + path.levelRequirement + " before entering Ash Hills.");
        return;
    }

    if (path.active) {
        currentPath = "ashHills";
        gameEnded = false;
        showAshHills();
        return;
    }

    path.active = true;
    path.progress = path.rescueCompleted ? 0 : Math.max(0, Number(path.progress) || 0);
    path.lastUpdateTime = Date.now();
    path.encounterTime = path.rescueCompleted ? 90 : Math.max(90, Number(path.encounterTime) || 90);
    currentPath = "ashHills";
    gameEnded = false;

    try { localStorage.setItem("utopiaActiveTab", "walk"); } catch (error) {}

    addVillageLog(path.rescueCompleted ? "You returned to the endless Ash Hills route." : "You entered Ash Hills. Find and rescue the civilian.");
    showAshHills();
    updateHP();
    updateAshHillsUI();
    saveGame();
}

function showAshHills() {
    setVillageTabsVisible(true);
    if (typeof updateMainTabs === "function") updateMainTabs("walk");
    try { localStorage.setItem("utopiaActiveTab", "walk"); } catch (error) {}

    ["arrivalScene", "forestGame", "villageScreen", "villageWalkScreen", "questScreen", "travelScreen"].forEach(id => document.getElementById(id)?.classList.add("hidden"));
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
    currentPath = "village";
    gameEnded = true;
    document.getElementById("ashHillsScreen")?.classList.add("hidden");
    showVillage();
    if (paths.ashHills.active) addVillageLog("You returned to Oakshade Village. Ash Hills is still in progress.");
    saveGame();
}

function updateAshHills() {
    const path = paths.ashHills;
    if (!path || !path.active || resting) {
        updateAshHillsUI();
        return;
    }

    const now = Date.now();
    if (!path.lastUpdateTime) path.lastUpdateTime = now;
    const elapsed = Math.floor((now - path.lastUpdateTime) / 1000);
    if (elapsed <= 0) {
        updateAshHillsUI();
        return;
    }

    path.lastUpdateTime = now;
    path.progress = Math.max(0, Number(path.progress) || 0) + elapsed;

    if (!path.rescueCompleted && path.progress >= path.duration) {
        path.progress = path.duration;
        updateAshHillsUI();
        finishAshHills();
        return;
    }

    while (path.active && !resting && path.encounterTime <= path.progress) {
        startAshBattle();
        if (path.active && !resting) path.encounterTime += 90;
    }

    updateHP();
    updateGold();
    updateAshHillsUI();
    if (typeof saveGame === "function") saveGame();
}

function catchUpAshHillsWhileAway() {
    const path = paths.ashHills;
    if (!path || !path.active || resting) return;

    const now = Date.now();
    const last = Number(path.lastUpdateTime) || now;
    const offlineSeconds = Math.floor((now - last) / 1000);
    if (offlineSeconds <= 0) {
        updateAshHillsUI();
        return;
    }

    const oldProgress = Number(path.progress) || 0;
    let targetProgress = oldProgress + offlineSeconds;
    if (!path.rescueCompleted) targetProgress = Math.min(targetProgress, path.duration);

    let encounterTime = Number(path.encounterTime) || 90;
    let diedOffline = false;

    while (encounterTime <= targetProgress && encounterTime > oldProgress) {
        const enemy = ashEnemies[Math.floor(Math.random() * ashEnemies.length)];
        const result = resolveBattle(enemy);
        if (result.defeated) {
            player.gold += enemy.gold;
            giveXP(enemy.xp);
            addLog("You defeated " + enemy.name + ".");
        } else {
            player.hp = Math.max(0, player.hp - result.damageTaken);
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
        startRest(true);
        saveGame();
        return;
    }
    if (!path.rescueCompleted && path.progress >= path.duration) {
        finishAshHills();
        return;
    }
    saveGame();
}

function finishAshHills() {
    const path = paths.ashHills;
    if (path.rescueCompleted) return;
    path.active = false;
    path.completed = true;
    path.rescueCompleted = true;
    path.progress = path.duration;
    currentPath = "village";
    gameEnded = true;
    addLog("Ash Hills completed!");
    addLog("You found a civilian trapped beyond the hills.");
    addLog("You rescued the civilian and brought them safely back to Oakshade Village.");
    village.quests.rescueCivilian.completed = true;
    document.getElementById("ashHillsScreen")?.classList.add("hidden");
    updateQuests();
    updateAshHillsUI();
    saveGame();
    if (typeof showAshHillsCutscene === "function") showAshHillsCutscene();
    else if (village.unlocked) showVillage();
}

function updateAshHillsUI() {
    const path = paths.ashHills;
    if (!path) return;

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

    const progress = Math.max(0, Number(path.progress) || 0);
    const duration = Math.max(1, Number(path.duration) || 2700);
    const percent = path.rescueCompleted ? 100 : Math.max(0, Math.min(100, progress / duration * 100));
    const hpPercent = player.maxHp > 0 ? Math.max(0, Math.min(100, player.hp / player.maxHp * 100)) : 0;
    const xpPercent = player.xpToNext > 0 ? Math.max(0, Math.min(100, player.xp / player.xpToNext * 100)) : 0;

    if (bar) {
        bar.style.display = "block";
        bar.style.width = percent + "%";
        bar.style.minWidth = percent > 0 ? "1px" : "0";
    }
    if (text) {
        if (path.rescueCompleted) {
            text.textContent = "Endless route — " + Math.floor(progress / 60) + ":" + String(progress % 60).padStart(2, "0") + " elapsed";
        } else {
            const remaining = Math.max(0, duration - progress);
            text.textContent = Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0") + " remaining";
        }
    }
    if (hpText) hpText.textContent = player.hp + " / " + player.maxHp;
    if (hpBar) { hpBar.style.display = "block"; hpBar.style.width = hpPercent + "%"; hpBar.style.minWidth = hpPercent > 0 ? "1px" : "0"; }
    if (xpText) xpText.textContent = player.xp + " / " + player.xpToNext + " XP";
    if (xpBar) { xpBar.style.display = "block"; xpBar.style.width = xpPercent + "%"; xpBar.style.minWidth = xpPercent > 0 ? "1px" : "0"; }
    if (levelText) levelText.textContent = player.level;
    if (attackText) attackText.textContent = player.attack;
    if (goldText) goldText.textContent = player.gold;
    if (restText) restText.textContent = resting ? "You are resting." : "Rest when you need to recover.";

    const screen = document.getElementById("ashHillsScreen");
    if (screen) {
        screen.style.setProperty("--ash-red", "#d44747");
        screen.style.setProperty("--ash-dark", "#2b0b0b");
    }
}

let ashHillsTimer = null;
function startAshHillsTimer() {
    if (ashHillsTimer) clearInterval(ashHillsTimer);
    ashHillsTimer = setInterval(() => {
        if (paths.ashHills?.active && !resting) updateAshHills();
        else updateAshHillsUI();
    }, 1000);
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && paths.ashHills?.active) {
        if (resting && typeof resumeRest === "function") resumeRest();
        else catchUpAshHillsWhileAway();
        updateAshHillsUI();
    }
});

window.addEventListener("pageshow", () => {
    if (paths.ashHills?.active) {
        if (resting && typeof resumeRest === "function") resumeRest();
        else catchUpAshHillsWhileAway();
        updateAshHillsUI();
    }
});

startAshHillsTimer();
