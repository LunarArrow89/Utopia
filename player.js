const player = {
    hp: 40,
    maxHp: 40,
    attack: 8,
    level: 1,
    xp: 0,
    xpToNext: 50,
    gold: 0
};

let resting = false;
let gameEnded = false;

function addLog(message) {
    const log = document.getElementById("log");
    const entry = document.createElement("div");

    entry.className = "log-entry";
    entry.textContent = message;

    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

function updateHP() {
    document.getElementById("hpText").textContent =
        `${player.hp} / ${player.maxHp}`;

    document.getElementById("hpBarText").textContent =
        `${player.hp} / ${player.maxHp} HP`;

    document.getElementById("hpBar").style.width =
        `${(player.hp / player.maxHp) * 100}%`;
}

function updateGold() {
    document.getElementById("goldText").textContent = player.gold;
}

function updateForest() {
    const path = paths[currentPath];

    document.getElementById("forestBar").style.width =
        `${(path.progress / path.duration) * 100}%`;

    const minutes = Math.floor(path.progress / 60);
    const seconds = path.progress % 60;
    const totalMinutes = Math.floor(path.duration / 60);
    const totalSeconds = path.duration % 60;

    document.getElementById("forestText").textContent =
        `${minutes}:${String(seconds).padStart(2, '0')} / ${totalMinutes}:${String(totalSeconds).padStart(2, '0')}`;
}

function giveXP(amount) {
    player.xp += amount;

    if (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level++;
        player.attack += 2;
        player.xpToNext += 25;

        addLog(`You reached level ${player.level}!`);
    }

    document.getElementById("xpBarText").textContent =
        `${player.xp} / ${player.xpToNext} XP`;

    document.getElementById("xpBar").style.width =
        `${(player.xp / player.xpToNext) * 100}%`;

    document.getElementById("levelText").textContent = player.level;
    document.getElementById("attackText").textContent = player.attack;

    if (typeof updateVillageUI === "function") updateVillageUI();
    if (typeof updateVillageWalkUI === "function") updateVillageWalkUI();
    if (typeof updateAshHillsUI === "function") updateAshHillsUI();
}

function updateRest() {
    if (!resting) return;

    document.getElementById("statusText").textContent = "Resting";
}

let restTimer = null;
let restStartTime = 0;
let restDuration = 0;

function startRest(force = false) {
    if (resting) return;

    const missingHp = Math.max(0, player.maxHp - player.hp);

    if (missingHp <= 0) {
        addLog("You don't need to rest.");
        return;
    }

    resting = true;

    // Rest time = HP missing × 0.5 minutes.
    restDuration = missingHp * 0.5 * 60 * 1000;
    restStartTime = Date.now();

    const restButton = document.getElementById("restButton");
    const leaveButton = document.getElementById("leaveButton");

    document.getElementById("statusText").textContent =
        force ? "Forced Rest" : "Resting";

    document.getElementById("restText").textContent =
        force ? "You must rest before you can continue." : "You are resting...";

    document.getElementById("restBar").style.width = "0%";

    if (restButton) restButton.disabled = true;
    if (leaveButton) leaveButton.disabled = force;

    addLog(force ? "You must rest." : "You are resting.");

    clearInterval(restTimer);

    restTimer = setInterval(() => {
        const elapsed = Date.now() - restStartTime;
        const progress = Math.min(1, elapsed / restDuration);

        document.getElementById("restBar").style.width =
            `${progress * 100}%`;

        const ashRestBar = document.getElementById("ashHillsRestBar");
        if (ashRestBar) ashRestBar.style.width = `${progress * 100}%`;

        if (progress >= 1) {
            clearInterval(restTimer);
            restTimer = null;

            player.hp = player.maxHp;
            resting = false;

            document.getElementById("statusText").textContent = "Walking";
            document.getElementById("restText").textContent =
                "Rest when you need to recover.";

            const ashRestBar = document.getElementById("ashHillsRestBar");
            if (ashRestBar) ashRestBar.style.width = "0%";

            if (restButton) restButton.disabled = false;
            if (leaveButton) leaveButton.disabled = true;

            updateHP();
            addLog("You feel refreshed!");
            saveGame();
        }
    }, 1000);
}

function leaveRest() {
    if (!resting) return;

    const leaveButton = document.getElementById("leaveButton");
    if (!leaveButton || leaveButton.disabled) return;

    clearInterval(restTimer);
    restTimer = null;

    resting = false;

    document.getElementById("statusText").textContent = "Walking";
    document.getElementById("restText").textContent =
        "Rest when you need to recover.";
    document.getElementById("restBar").style.width = "0%";

    document.getElementById("restButton").disabled = false;
    leaveButton.disabled = true;

    addLog("You stopped resting.");
    saveGame();
}

async function resetGame() {
    if (!confirm("Are you sure you want to reset your save? This cannot be undone.")) {
        return;
    }

    clearInterval(restTimer);
    restTimer = null;
    clearInterval(typeof villageWalkTimer !== "undefined" ? villageWalkTimer : null);
    villageWalkTimer = null;

    player.hp = 40;
    player.maxHp = 40;
    player.attack = 8;
    player.level = 1;
    player.xp = 0;
    player.xpToNext = 50;
    player.gold = 0;

    resting = false;
    gameEnded = false;
    currentPath = "forest";

    resetVillage();

    paths.forest.progress = 0;
    paths.forest.encounterTime = 45;
    paths.forest.completed = false;
    paths.forest.lastUpdateTime = Date.now();

    paths.cave.progress = 0;
    paths.cave.encounterTime = 60;
    paths.cave.completed = false;

    paths.ashHills.progress = 0;
    paths.ashHills.encounterTime = 45;
    paths.ashHills.completed = false;
    paths.ashHills.active = false;
    paths.ashHills.lastUpdateTime = 0;

    document.getElementById("log").innerHTML = "";
    document.getElementById("villageLog").innerHTML = "";

    document.getElementById("forestGame")?.classList.remove("hidden");
    document.getElementById("forestScreen")?.classList.remove("hidden");
    document.getElementById("villageScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    document.getElementById("questScreen")?.classList.add("hidden");
    document.getElementById("ashHillsScreen")?.classList.add("hidden");
    document.getElementById("arrivalScene")?.classList.add("hidden");

    updateHP();
    updateGold();

    document.getElementById("levelText").textContent = player.level;
    document.getElementById("attackText").textContent = player.attack;
    document.getElementById("statusText").textContent = "Walking";
    document.getElementById("forestBar").style.width = "0%";
    document.getElementById("xpBar").style.width = "0%";
    document.getElementById("xpBarText").textContent = "0 / 50 XP";
    document.getElementById("forestText").textContent = "0:00 / 5:00";

    document.getElementById("restBar").style.width = "0%";
    const ashRestBar = document.getElementById("ashHillsRestBar");
    if (ashRestBar) ashRestBar.style.width = "0%";

    document.getElementById("restText").textContent = "Rest when you need to recover.";
    document.getElementById("restButton").disabled = false;
    document.getElementById("leaveButton").disabled = true;

    updateForest();
    updateRest();
    updateVillageUI();

    // Save the reset state to both local storage and the cloud before reloading.
    // Otherwise an older Supabase save could immediately restore the old game.
    localStorage.setItem(SAVE_KEY, JSON.stringify(getGameSaveData()));

    if (typeof currentSupabaseUser !== "undefined" && currentSupabaseUser) {
        await saveRemoteGame(getGameSaveData());
    }

    location.reload();
}

// Initialize UI on page load
document.addEventListener("DOMContentLoaded", () => {
    updateHP();
    updateGold();
    document.getElementById("levelText").textContent = player.level;
    document.getElementById("attackText").textContent = player.attack;
    
    const resetButton = document.getElementById("resetButton");
    if (resetButton) {
        resetButton.addEventListener("click", resetGame);
    }

    const villageResetButton = document.getElementById("villageResetButton");
    if (villageResetButton) {
        villageResetButton.addEventListener("click", resetGame);
    }
    
    const restButton = document.getElementById("restButton");
    if (restButton) {
        restButton.addEventListener("click", () => startRest(false));
    }

    const leaveButton = document.getElementById("leaveButton");
    if (leaveButton) {
        leaveButton.addEventListener("click", leaveRest);
    }
});
