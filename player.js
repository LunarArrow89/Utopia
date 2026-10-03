const player = {
    hp: 40,
    maxHp: 40,
    attack: 8,
    level: 1,
    xp: 0,
    xpToNext: 150,
    gold: 0,
    equipmentAttackBonus: 0,
    equipmentMaxHpBonus: 0
};

let resting = false;
let gameEnded = false;

function addLog(message) {
    const log = document.getElementById("log");
    if (!log) return;
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.textContent = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

function updateHP() {
    const hpText = document.getElementById("hpText");
    const hpBarText = document.getElementById("hpBarText");
    const hpBar = document.getElementById("hpBar");
    if (hpText) hpText.textContent = `${player.hp} / ${player.maxHp}`;
    if (hpBarText) hpBarText.textContent = `${player.hp} / ${player.maxHp} HP`;
    if (hpBar) hpBar.style.width = `${Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100))}%`;
    if (typeof updateVillageWalkUI === "function") updateVillageWalkUI();
    if (typeof updateAshHillsUI === "function") updateAshHillsUI();
}

function updateGold() {
    const goldText = document.getElementById("goldText");
    if (goldText) goldText.textContent = player.gold;
}

function updateForest() {
    const path = paths?.forest;
    const bar = document.getElementById("forestBar");
    const text = document.getElementById("forestText");
    if (!path || !bar || !text) return;
    const duration = Math.max(1, Number(path.duration) || 300);
    const progress = Math.max(0, Math.min(duration, Number(path.progress) || 0));
    bar.style.width = (progress / duration) * 100 + "%";
    const minutes = Math.floor(progress / 60);
    const seconds = Math.floor(progress % 60);
    text.textContent = minutes + ":" + String(seconds).padStart(2, "0") + " / " + Math.floor(duration / 60) + ":" + String(duration % 60).padStart(2, "0");
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
    const xpText = document.getElementById("xpBarText");
    const xpBar = document.getElementById("xpBar");
    const levelText = document.getElementById("levelText");
    const attackText = document.getElementById("attackText");
    if (xpText) xpText.textContent = `${player.xp} / ${player.xpToNext} XP`;
    if (xpBar) xpBar.style.width = `${(player.xp / player.xpToNext) * 100}%`;
    if (levelText) levelText.textContent = player.level;
    if (attackText) attackText.textContent = player.attack;
    updateHP();
    if (typeof updateVillageUI === "function") updateVillageUI();
    saveGame();
}

let restTimer = null;
let restStartTime = 0;
let restDuration = 0;
let restForced = false;

function ensureRestScreen() {
    let screen = document.getElementById("restScreen");
    if (screen) return screen;

    screen = document.createElement("div");
    screen.id = "restScreen";
    screen.className = "rest-screen hidden";
    screen.innerHTML = `
        <div class="rest-screen-box">
            <div class="rest-screen-kicker">DEFEATED</div>
            <h1>Slain</h1>
            <p>Rest a bit</p>
            <div class="rest-screen-bar"><div id="restScreenBar"></div></div>
            <div id="restScreenText">0:00 remaining</div>
        </div>`;
    document.body.appendChild(screen);
    return screen;
}

function showRestScreen() {
    const screen = ensureRestScreen();
    ["mainTabs", "forestGame", "villageScreen", "travelScreen", "questScreen", "villageWalkScreen", "ashHillsScreen", "arrivalScene", "storyScreen"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });
    screen.classList.remove("hidden");
    document.body.classList.add("is-resting");
}

function hideRestScreen() {
    document.getElementById("restScreen")?.classList.add("hidden");
    document.body.classList.remove("is-resting");
}

function finishRest() {
    clearInterval(restTimer);
    restTimer = null;
    player.hp = player.maxHp;
    resting = false;
    restForced = false;
    restStartTime = 0;
    restDuration = 0;
    hideRestScreen();
    const status = document.getElementById("statusText");
    if (status) status.textContent = "Walking";
    const restText = document.getElementById("restText");
    if (restText) restText.textContent = "Rest when you need to recover.";
    ["restBar", "ashHillsRestBar", "villageWalkRestBar"].forEach(id => {
        const bar = document.getElementById(id);
        if (bar) bar.style.width = "0%";
    });
    const restButton = document.getElementById("restButton");
    const leaveButton = document.getElementById("leaveButton");
    if (restButton) restButton.disabled = false;
    if (leaveButton) leaveButton.disabled = true;
    updateHP();
    saveGame();
}

function runRestTimer() {
    clearInterval(restTimer);
    const tick = () => {
        if (!resting || restDuration <= 0) return;
        const elapsed = Math.max(0, Date.now() - restStartTime);
        const progress = Math.min(1, elapsed / restDuration);
        const remaining = Math.max(0, restDuration - elapsed);
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const text = `${minutes}:${String(seconds).padStart(2, "0")} remaining`;
        const screenText = document.getElementById("restScreenText");
        const screenBar = document.getElementById("restScreenBar");
        if (screenText) screenText.textContent = text;
        if (screenBar) screenBar.style.width = progress * 100 + "%";
        const restText = document.getElementById("restText");
        if (restText) restText.textContent = text;
        const villageRest = document.getElementById("villageWalkRestText");
        if (villageRest) villageRest.textContent = text;
        const ashRest = document.getElementById("ashHillsRestText");
        if (ashRest) ashRest.textContent = text;
        ["restBar", "ashHillsRestBar", "villageWalkRestBar"].forEach(id => {
            const bar = document.getElementById(id);
            if (bar) bar.style.width = progress * 100 + "%";
        });
        if (progress >= 1) finishRest();
    };
    tick();
    if (resting) restTimer = setInterval(tick, 1000);
}

function startRest(force = false) {
    if (resting) {
        showRestScreen();
        return;
    }

    const missingHp = Math.max(0, player.maxHp - player.hp);
    if (missingHp <= 0) {
        addLog("You don't need to rest.");
        return;
    }

    resting = true;
    restForced = force;
    // Rest duration is based on missing HP: every missing HP costs 3 minutes.
    restDuration = missingHp * 3 * 60 * 1000;
    restStartTime = Date.now();
    gameEnded = true;

    const status = document.getElementById("statusText");
    if (status) status.textContent = "Resting";
    const restButton = document.getElementById("restButton");
    const leaveButton = document.getElementById("leaveButton");
    if (restButton) restButton.disabled = true;
    if (leaveButton) leaveButton.disabled = true;

    addLog(force ? "You were slain. Resting until fully healed." : "You are resting until fully healed.");
    showRestScreen();
    saveGame();
    runRestTimer();
}

function resumeRest() {
    if (!resting) return;
    if (!restStartTime || !restDuration) {
        resting = false;
        restForced = false;
        hideRestScreen();
        return;
    }
    if (Date.now() - restStartTime >= restDuration) {
        finishRest();
        return;
    }
    gameEnded = true;
    showRestScreen();
    runRestTimer();
}

function updateRest() {
    if (resting) runRestTimer();
}

function leaveRest() {
    // Rest is now a complete recovery screen and cannot be cancelled.
    return;
}
