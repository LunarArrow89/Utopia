const player = {
    hp: 40,
    maxHp: 40,
    attack: 8,
    level: 1,
    xp: 0,
    xpToNext: 150,
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
    // The Forest always uses the forest path.
    // currentPath changes after leaving the forest, so using
    // paths[currentPath] here can break the forest progress bar.
    const path = paths?.forest;
    const bar = document.getElementById("forestBar");
    const text = document.getElementById("forestText");

    if (!path || !bar || !text) return;

    const duration = Math.max(1, Number(path.duration) || 300);
    const progress = Math.max(0, Math.min(duration, Number(path.progress) || 0));
    const percent = (progress / duration) * 100;

    bar.style.width = percent + "%";

    const minutes = Math.floor(progress / 60);
    const seconds = Math.floor(progress % 60);
    const totalMinutes = Math.floor(duration / 60);
    const totalSeconds = Math.floor(duration % 60);

    text.textContent =
        minutes + ":" + String(seconds).padStart(2, "0") +
        " / " + totalMinutes + ":" + String(totalSeconds).padStart(2, "0");
}
function giveXP(amount) {
    player.xp += amount;

    while (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level++;

        player.attack += 1;
        player.maxHp += 3;
        player.hp = Math.min(player.maxHp, player.hp + 3);

        player.xpToNext += 25;

        addLog(`You reached level ${player.level}! Attack +1, Max HP +3.`);
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

    // XP and level changes are saved immediately.
    saveGame();
}

function updateRest() {
    if (!resting) return;

    const restText = document.getElementById("restText");
    if (!restText || !restStartTime || !restDuration) return;

    const remaining = Math.max(0, restDuration - (Date.now() - restStartTime));
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    restText.textContent =
        `${minutes}:${String(seconds).padStart(2, "0")} remaining`;

    document.getElementById("statusText").textContent =
        "Resting";
}

let restTimer = null;
let restStartTime = 0;
let restDuration = 0;
let restForced = false;

function finishRest() {
    clearInterval(restTimer);
    restTimer = null;

    player.hp = player.maxHp;
    resting = false;
    restForced = false;
    restStartTime = 0;
    restDuration = 0;

    document.getElementById("statusText").textContent = "Walking";
    document.getElementById("restText").textContent =
        "Rest when you need to recover.";

    const restBar = document.getElementById("restBar");
    if (restBar) restBar.style.width = "0%";

    const ashRestBar = document.getElementById("ashHillsRestBar");
    if (ashRestBar) ashRestBar.style.width = "0%";

    const restButton = document.getElementById("restButton");
    const leaveButton = document.getElementById("leaveButton");

    if (restButton) restButton.disabled = false;
    if (leaveButton) leaveButton.disabled = true;

    updateHP();
    saveGame();
}

function runRestTimer() {
    clearInterval(restTimer);

    const tickRest = () => {
        if (!resting || restDuration <= 0) return;

        const elapsed = Date.now() - restStartTime;
        const progress = Math.min(1, elapsed / restDuration);
        const remaining = Math.max(0, restDuration - elapsed);

        const restBar = document.getElementById("restBar");
        if (restBar) restBar.style.width = `${progress * 100}%`;

        const ashRestBar = document.getElementById("ashHillsRestBar");
        if (ashRestBar) ashRestBar.style.width = `${progress * 100}%`;

        const restText = document.getElementById("restText");
        if (restText) {
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            restText.textContent =
                `${minutes}:${String(seconds).padStart(2, "0")} remaining`;
        }

        if (progress >= 1) {
            finishRest();
        }
    };

    tickRest();
    if (resting) {
        restTimer = setInterval(tickRest, 1000);
    }
}

function startRest(force = false) {
    if (resting) return;

    const missingHp = Math.max(0, player.maxHp - player.hp);

    if (missingHp <= 0) {
        addLog("You don't need to rest.");
        return;
    }

    resting = true;
    restForced = force;
    restDuration = missingHp * 0.5 * 60 * 1000;
    restStartTime = Date.now();

    const restButton = document.getElementById("restButton");
    const leaveButton = document.getElementById("leaveButton");

    document.getElementById("statusText").textContent =
        force ? "Forced Rest" : "Resting";

    document.getElementById("restText").textContent =
        `${Math.floor(restDuration / 60000)}:00 remaining`;

    document.getElementById("restBar").style.width = "0%";

    if (restButton) restButton.disabled = true;
    if (leaveButton) leaveButton.disabled = force;

    addLog(force ? "You must rest." : "You are resting.");

    saveGame();
    runRestTimer();
}

function resumeRest() {
    if (!resting) return;

    if (!restStartTime || !restDuration) {
        resting = false;
        restForced = false;
        return;
    }

    const elapsed = Date.now() - restStartTime;

    if (elapsed >= restDuration) {
        finishRest();
        return;
    }

    const restButton = document.getElementById("restButton");
    const leaveButton = document.getElementById("leaveButton");

    document.getElementById("statusText").textContent =
        restForced ? "Forced Rest" : "Resting";

    if (restButton) restButton.disabled = true;
    if (leaveButton) leaveButton.disabled = restForced;

    runRestTimer();
}

function leaveRest() {
    if (!resting) return;

    const leaveButton = document.getElementById("leaveButton");
    if (!leaveButton || leaveButton.disabled) return;

    clearInterval(restTimer);
    restTimer = null;

    resting = false;
    restForced = false;
    restStartTime = 0;
    restDuration = 0;

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

    // Make the reset function available to the HTML onclick handler too.
    // This also gives us an immediate visible status if the cloud reset
    // takes a moment.
    setAccountStatus("Resetting your profile...");

    try {
        // Stop every delayed save from the old game first.
        if (remoteSaveTimer) {
            clearTimeout(remoteSaveTimer);
            remoteSaveTimer = null;
        }

        pendingRemoteSave = null;

        // Never let a stuck background save make Reset appear frozen.
        // Give an in-progress save a short chance to finish, then the
        // revision check below will safely replace it with the reset.
        const waitUntil = Date.now() + 2000;
        while (remoteSaveInProgress && Date.now() < waitUntil) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        remoteSaveInProgress = false;

        clearInterval(restTimer);
        restTimer = null;

        if (typeof villageWalkTimer !== "undefined") {
            clearInterval(villageWalkTimer);
            villageWalkTimer = null;
        }

        // Completely rebuild the player state.
        player.hp = 40;
        player.maxHp = 40;
        player.attack = 8;
        player.level = 1;
        player.xp = 0;
        player.xpToNext = 50;
        player.gold = 0;

        resting = false;
        restForced = false;
        restStartTime = 0;
        restDuration = 0;
        gameEnded = false;
        arrivalCutsceneSeen = false;
        awakeningSeen = false;
        currentPath = "forest";

        // Reset every registered path without assuming a future path exists.
        Object.keys(paths).forEach(pathName => {
            const path = paths[pathName];

            if ("progress" in path) path.progress = 0;
            if ("completed" in path) path.completed = false;
            if ("active" in path) path.active = pathName === "forest";
            if ("lastUpdateTime" in path) path.lastUpdateTime = Date.now();

            if (pathName === "forest") path.encounterTime = 45;
            if (pathName === "ashHills") path.encounterTime = 45;
            if (pathName === "cave") path.encounterTime = 60;
        });

        if (typeof resetVillage === "function") {
            resetVillage();
        }

        const log = document.getElementById("log");
        const villageLog = document.getElementById("villageLog");

        if (log) log.innerHTML = "";
        if (villageLog) villageLog.innerHTML = "";

        // Put the UI back on the starting forest screen.
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
        document.getElementById("xpBarText").textContent = "0 / 150 XP";
        document.getElementById("forestText").textContent = "0:00 / 5:00";
        document.getElementById("restBar").style.width = "0%";
        document.getElementById("restText").textContent = "Rest when you need to recover.";

        const ashRestBar = document.getElementById("ashHillsRestBar");
        if (ashRestBar) ashRestBar.style.width = "0%";

        document.getElementById("restButton").disabled = false;
        document.getElementById("leaveButton").disabled = true;

        updateForest();
        updateRest();

        const resetSave = getGameSaveData(Date.now());

        // The account save is authoritative. If the server revision changed
        // between the last load and this reset, reload the latest revision
        // and retry the reset instead of restoring the old 5:00 forest.
        if (currentSupabaseUser) {
            let saved = await saveRemoteGame(resetSave);

            if (!saved) {
                await loadRemoteGame();

                // Re-apply the reset after loading the latest server state.
                player.hp = 40;
                player.maxHp = 40;
                player.attack = 8;
                player.level = 1;
                player.xp = 0;
                player.xpToNext = 50;
                player.gold = 0;
                resting = false;
                restForced = false;
                restStartTime = 0;
                restDuration = 0;
                gameEnded = false;
                arrivalCutsceneSeen = false;
                awakeningSeen = false;
                currentPath = "forest";

                Object.keys(paths).forEach(pathName => {
                    const path = paths[pathName];
                    if ("progress" in path) path.progress = 0;
                    if ("completed" in path) path.completed = false;
                    if ("active" in path) path.active = pathName === "forest";
                    if ("lastUpdateTime" in path) path.lastUpdateTime = Date.now();
                    if (pathName === "forest") path.encounterTime = 45;
                    if (pathName === "ashHills") path.encounterTime = 45;
                    if (pathName === "cave") path.encounterTime = 60;
                });

                if (typeof resetVillage === "function") resetVillage();

                saved = await saveRemoteGame(getGameSaveData(Date.now()));
            }

            if (!saved) {
                throw new Error("The reset could not be saved to the cloud.");
            }
        } else {
            localStorage.setItem(SAVE_KEY, JSON.stringify(resetSave));
        }

        // Do not queue another old-state save after the reset.
        pendingRemoteSave = null;

        location.reload();
    } catch (error) {
        console.error("Reset failed:", error);
        setAccountStatus("Reset failed: " + (error.message || "Please try again."));
    }
}

// Keep Reset Save callable from HTML buttons even if another script changes the event listeners.\nwindow.resetGame = resetGame;

document.addEventListener("DOMContentLoaded", () => {
    updateHP();
    updateGold();

    if (resting) {
        resumeRest();
    }

    document.getElementById("levelText").textContent = player.level;
    document.getElementById("attackText").textContent = player.attack;

    const resetButton = document.getElementById("resetButton");
    if (resetButton) {
        resetButton.addEventListener("click", resetGame);
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
