let awakeningSeen = false;

function showAwakening() {
    const scene=document.getElementById("awakeningScene"), text=document.getElementById("awakeningText"), button=document.getElementById("awakeningContinue");
    if(!scene||!text||!button)return;
    gameEnded=true;
    document.getElementById("forestGame")?.classList.add("hidden");
    text.textContent="You wake up in a quiet, unfamiliar village.";
    button.dataset.step="1";
    button.textContent="Continue";
    scene.classList.remove("hidden");
}
function nextAwakeningLine() {
    const scene=document.getElementById("awakeningScene"), text=document.getElementById("awakeningText"), button=document.getElementById("awakeningContinue");
    if(!scene||!text||!button)return;
    if(button.dataset.step==="1"){text.textContent="The air is cold. You cannot remember how you got here.";button.dataset.step="2";return;}
    if(button.dataset.step==="2"){text.textContent="Around you are worn buildings, empty streets, and signs that this village was abandoned long ago.";button.dataset.step="3";return;}
    if(button.dataset.step==="3"){text.textContent="You step outside and look around. Something tells you that this place needs you.";button.dataset.step="4";button.textContent="Enter the Village";return;}
    awakeningSeen=true; gameEnded=false; scene.classList.add("hidden"); document.getElementById("villageScreen")?.classList.remove("hidden");
    addLog("You wake in the village."); saveGame(); refreshGameUI(); updateForest();
}
function showStoryScreen(){if(!gameInitialized)return;document.getElementById("forestGame")?.classList.add("hidden");document.getElementById("storyScreen")?.classList.remove("hidden");document.querySelectorAll(".top-tab").forEach(b=>b.classList.remove("active"));document.querySelector(".top-tab:nth-child(2)")?.classList.add("active");}
function hideStoryScreen(){document.getElementById("storyScreen")?.classList.add("hidden");showForestTab();}
function showForestTab(){document.getElementById("storyScreen")?.classList.add("hidden");document.getElementById("forestGame")?.classList.remove("hidden");document.querySelectorAll(".top-tab").forEach(b=>b.classList.remove("active"));document.querySelector(".top-tab:nth-child(1)")?.classList.add("active");refreshGameUI();updateForest();}

let gameInitialized = false;
let lastProgressSave = 0;

async function initializeGame() {
    const loggedIn = await loadGame();

    if (!loggedIn) {
        requireLogin();
        return;
    }

    // loadGame() has now finished applying the cloud/local save.
    // Only after that point may we decide whether the first-time
    // awakening should be shown.

    // Do NOT replace an existing forest timestamp with Date.now().
    // That timestamp is what lets the forest calculate elapsed time.
    const path = paths.forest;

    if (path) {
        path.duration = Number(path.duration) || 300;
        path.progress = Math.max(0, Math.min(path.duration, Number(path.progress) || 0));

        if (!Number(path.lastUpdateTime)) {
            path.lastUpdateTime = Date.now();
        }
    }

    gameInitialized = true;
    lastProgressSave = Date.now();

    if (!awakeningSeen) {
        showAwakening();
        return;
    }

    // Catch up using the saved timestamp first. This makes progress survive
    // refreshes even if the server idle RPC is not installed yet.
    if (!gameEnded && !resting && path && !path.completed) {
        catchUpPathWhileAway("forest");
        updatePath("forest");
    }

    refreshGameUI();

    if (paths.ashHills?.active && currentPath === "ashHills") {
        showAshHills();
    } else if (village.walk.active && currentPath === "villageWalk") {
        showVillageWalkTab();
    } else if (currentPath === "forest" && !paths.forest.completed) {
        document.getElementById("forestGame")?.classList.remove("hidden");
    } else if (currentPath === "village" && village.unlocked) {
        showVillage();
    }

    updateForest();
}

document.addEventListener("DOMContentLoaded", initializeGame);

function tick() {
    if (!gameInitialized) return;

    // The Forest owns its own elapsed-time clock. Do not gate it on
    // village.unlocked or currentPath; those flags can change screens while
    // the forest save still needs to display its real progress.
    if (!gameEnded && !resting && paths.forest && !paths.forest.completed) {
        updatePath("forest");
    }

    updateForest();

    if (!village.unlocked) {
        updateRest();
    }

    const now = Date.now();
    if (now - lastProgressSave >= 2000) {
        lastProgressSave = now;
        saveGame();
    }
}

setInterval(tick, 1000);

// Catch up immediately when a phone/browser wakes the page.
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !gameInitialized) return;

    // Save immediately when the player leaves the page/tab.
    if (typeof saveGame === "function") saveGame();

    if (!gameEnded && !resting && paths.forest && !paths.forest.completed) {
        catchUpPathWhileAway("forest");
        updatePath("forest");
    }

    updateForest();
    refreshGameUI();
});

window.addEventListener("pageshow", () => {
    if (!gameInitialized) return;

    if (!gameEnded && !resting && paths.forest && !paths.forest.completed) {
        updatePath("forest");
    }

    updateForest();
});


window.addEventListener("pagehide", () => {
    if (typeof saveGame === "function") saveGame();
});

window.addEventListener("beforeunload", () => {
    if (typeof saveGame === "function") saveGame();
});
