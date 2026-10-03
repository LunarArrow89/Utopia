const player = {
    hp: 40, maxHp: 40, attack: 8, level: 1, xp: 0, xpToNext: 150, gold: 0,
    equipmentAttackBonus: 0, equipmentMaxHpBonus: 0
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
    if (hpBar) hpBar.style.width = `${Math.max(0, Math.min(100, player.hp / player.maxHp * 100))}%`;
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
    bar.style.width = progress / duration * 100 + "%";
    text.textContent = Math.floor(progress / 60) + ":" + String(Math.floor(progress % 60)).padStart(2, "0") + " / " + Math.floor(duration / 60) + ":" + String(duration % 60).padStart(2, "0");
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
    if (xpBar) xpBar.style.width = `${player.xp / player.xpToNext * 100}%`;
    if (levelText) levelText.textContent = player.level;
    if (attackText) attackText.textContent = player.attack;
    if (typeof updateVillageUI === "function") updateVillageUI();
    if (typeof updateVillageWalkUI === "function") updateVillageWalkUI();
    if (typeof updateAshHillsUI === "function") updateAshHillsUI();
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
    screen.innerHTML = `<div style="position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;background:radial-gradient(circle at center,#3b1010 0%,#120505 55%,#050202 100%);color:#fff;font-family:Georgia,'Times New Roman',serif;"><div style="font-size:11px;letter-spacing:5px;color:#e87979;margin-bottom:14px;">DEFEATED</div><h1 style="font-size:64px;margin:0 0 8px;color:#ffb0b0;text-shadow:0 0 24px rgba(255,60,60,.45);">Slain</h1><p style="font-size:20px;margin:0 0 30px;color:#d9b0b0;">Rest a bit</p><div style="width:min(360px,80vw);height:14px;background:#210909;border:1px solid #6e2929;border-radius:999px;overflow:hidden;"><div id="restScreenBar" style="height:100%;width:0;background:#d44747;transition:width .3s linear;"></div></div><div id="restScreenText" style="margin-top:10px;font-size:13px;color:#d9b0b0;">0:00 remaining</div></div>`;
    document.body.appendChild(screen);
    return screen;
}

function showRestScreen() {
    const screen = ensureRestScreen();
    ["mainTabs","forestGame","villageScreen","travelScreen","questScreen","villageWalkScreen","ashHillsScreen","arrivalScene","storyScreen"].forEach(id => document.getElementById(id)?.classList.add("hidden"));
    screen.classList.remove("hidden");
    document.body.classList.add("is-resting");
}

function hideRestScreen() {
    document.getElementById("restScreen")?.classList.add("hidden");
    document.body.classList.remove("is-resting");
}

function finishRest() {
    clearInterval(restTimer); restTimer = null;
    player.hp = player.maxHp;
    resting = false; restForced = false; restStartTime = 0; restDuration = 0; gameEnded = false;
    hideRestScreen();
    const status = document.getElementById("statusText"); if (status) status.textContent = "Walking";
    const restText = document.getElementById("restText"); if (restText) restText.textContent = "Rest when you need to recover.";
    ["restBar","ashHillsRestBar","villageWalkRestBar"].forEach(id => { const bar = document.getElementById(id); if (bar) bar.style.width = "0%"; });
    const restButton = document.getElementById("restButton"); const leaveButton = document.getElementById("leaveButton");
    if (restButton) restButton.disabled = false;
    if (leaveButton) leaveButton.disabled = true;
    updateHP(); saveGame();
}

function runRestTimer() {
    clearInterval(restTimer);
    const tick = () => {
        if (!resting || restDuration <= 0) return;
        const elapsed = Math.max(0, Date.now() - restStartTime);
        const progress = Math.min(1, elapsed / restDuration);
        const remaining = Math.max(0, restDuration - elapsed);
        const text = `${Math.floor(remaining / 60000)}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2,"0")} remaining`;
        const screenText = document.getElementById("restScreenText");
        const screenBar = document.getElementById("restScreenBar");
        if (screenText) screenText.textContent = text;
        if (screenBar) screenBar.style.width = progress * 100 + "%";
        ["restText","villageWalkRestText","ashHillsRestText"].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = text; });
        ["restBar","ashHillsRestBar","villageWalkRestBar"].forEach(id => { const bar = document.getElementById(id); if (bar) bar.style.width = progress * 100 + "%"; });
        if (progress >= 1) finishRest();
    };
    tick();
    if (resting) restTimer = setInterval(tick, 1000);
}

function startRest(force = false) {
    if (resting) { showRestScreen(); return; }
    const missingHp = Math.max(0, player.maxHp - player.hp);
    if (missingHp <= 0) { addLog("You don't need to rest."); return; }
    resting = true; restForced = force;
    restDuration = missingHp * 3 * 60 * 1000;
    restStartTime = Date.now();
    gameEnded = true;
    const status = document.getElementById("statusText"); if (status) status.textContent = "Resting";
    const restButton = document.getElementById("restButton"); const leaveButton = document.getElementById("leaveButton");
    if (restButton) restButton.disabled = true;
    if (leaveButton) leaveButton.disabled = true;
    addLog(force ? "You were slain. Resting until fully healed." : "You are resting until fully healed.");
    showRestScreen(); saveGame(); runRestTimer();
}

function resumeRest() {
    if (!resting) return;
    if (!restStartTime || !restDuration) { resting = false; restForced = false; hideRestScreen(); return; }
    if (Date.now() - restStartTime >= restDuration) { finishRest(); return; }
    gameEnded = true; showRestScreen(); runRestTimer();
}

function updateRest() { if (resting) runRestTimer(); }
function leaveRest() { return; }

async function resetGame() {
    if (!confirm("Are you sure you want to reset your save? This cannot be undone.")) return;
    setAccountStatus("Resetting your profile...");
    try {
        if (remoteSaveTimer) { clearTimeout(remoteSaveTimer); remoteSaveTimer = null; }
        pendingRemoteSave = null;
        const waitUntil = Date.now() + 2000;
        while (remoteSaveInProgress && Date.now() < waitUntil) await new Promise(resolve => setTimeout(resolve,50));
        remoteSaveInProgress = false; clearInterval(restTimer); restTimer = null;
        if (typeof villageWalkTimer !== "undefined") { clearInterval(villageWalkTimer); villageWalkTimer = null; }
        try { localStorage.removeItem("utopiaWalkActive"); } catch(e) {}
        player.hp=40; player.maxHp=40; player.attack=8; player.level=1; player.xp=0; player.xpToNext=150; player.gold=0; player.equipmentAttackBonus=0; player.equipmentMaxHpBonus=0;
        if (typeof resetItems === "function") resetItems();
        resting=false; restForced=false; restStartTime=0; restDuration=0; gameEnded=false; arrivalCutsceneSeen=false; awakeningSeen=false; currentPath="forest"; hideRestScreen();
        try { localStorage.removeItem("utopiaWalkActive"); localStorage.setItem("utopiaActiveTab","village"); } catch(e) {}
        Object.keys(paths).forEach(pathName => { const path=paths[pathName]; if("progress" in path) path.progress=0; if("completed" in path) path.completed=false; if("rescueCompleted" in path) path.rescueCompleted=false; if("active" in path) path.active=pathName==="forest"; if("lastUpdateTime" in path) path.lastUpdateTime=Date.now(); if(pathName==="forest") path.encounterTime=45; if(pathName==="ashHills") path.encounterTime=45; if(pathName==="cave") path.encounterTime=60; });
        if (typeof resetVillage === "function") resetVillage();
        document.getElementById("log")?.replaceChildren(); document.getElementById("villageLog")?.replaceChildren();
        document.getElementById("forestGame")?.classList.remove("hidden"); document.getElementById("villageScreen")?.classList.add("hidden"); document.getElementById("villageWalkScreen")?.classList.add("hidden"); document.getElementById("travelScreen")?.classList.add("hidden"); document.getElementById("questScreen")?.classList.add("hidden"); document.getElementById("ashHillsScreen")?.classList.add("hidden"); document.getElementById("arrivalScene")?.classList.add("hidden");
        updateHP(); updateGold(); updateForest();
        const levelText=document.getElementById("levelText"); if(levelText) levelText.textContent=player.level;
        const attackText=document.getElementById("attackText"); if(attackText) attackText.textContent=player.attack;
        const status=document.getElementById("statusText"); if(status) status.textContent="Walking";
        const xpBar=document.getElementById("xpBar"); if(xpBar) xpBar.style.width="0%";
        const xpText=document.getElementById("xpBarText"); if(xpText) xpText.textContent="0 / 150 XP";
        const restBar=document.getElementById("restBar"); if(restBar) restBar.style.width="0%";
        const restText=document.getElementById("restText"); if(restText) restText.textContent="Rest when you need to recover.";
        const restButton=document.getElementById("restButton"); if(restButton) restButton.disabled=false;
        const leaveButton=document.getElementById("leaveButton"); if(leaveButton) leaveButton.disabled=true;
        const resetSave=getGameSaveData(Date.now());
        if(currentSupabaseUser){const saved=await saveRemoteGame(resetSave);if(!saved)throw new Error("The reset could not be saved to the cloud.");}else localStorage.setItem(SAVE_KEY,JSON.stringify(resetSave));
        pendingRemoteSave=null; location.reload();
    } catch(error){console.error("Reset failed:",error);setAccountStatus("Reset failed: "+(error.message||"Please try again."));}
}
window.resetGame=resetGame;

document.addEventListener("DOMContentLoaded",()=>{
    updateHP(); updateGold(); if(resting) resumeRest();
    const levelText=document.getElementById("levelText"); if(levelText) levelText.textContent=player.level;
    const attackText=document.getElementById("attackText"); if(attackText) attackText.textContent=player.attack;
    const resetButton=document.getElementById("resetButton"); if(resetButton) resetButton.addEventListener("click",resetGame);
    const restButton=document.getElementById("restButton"); if(restButton) restButton.addEventListener("click",()=>startRest(false));
    const leaveButton=document.getElementById("leaveButton"); if(leaveButton) leaveButton.addEventListener("click",leaveRest);
});
