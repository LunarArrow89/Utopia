const village = {
    unlocked: false,
    housesBuilt: 0,
    quests: {
        getToVillage: { completed: false, claimed: false },
        makeTwoHouses: { completed: false, claimed: false }
    },
    resources: { wood: 0, stone: 0, food: 0 },
    buildings: { campfire: false, shelter: false, workshop: false },
    walk: { active: false, startTime: 0, lastRewardCount: 0, nextEncounterTime: 30, duration: 20 * 60 * 1000 }
};

const buildingCosts = {
    campfire: { wood: 10, stone: 5 },
    shelter: { wood: 20, stone: 10 },
    workshop: { wood: 35, stone: 25 }
};

const buildingNames = {
    campfire: "Campfire",
    shelter: "Shelter",
    workshop: "Workshop"
};

function showArrivalScene() {
    const scene = document.getElementById("arrivalScene");
    const forestGame = document.getElementById("forestGame");
    const text = document.getElementById("arrivalText");
    const button = document.getElementById("arrivalContinue");

    if (!scene || !text || !button) return;

    if (forestGame) forestGame.classList.add("hidden");

    text.textContent = "You leave the Whispering Woods behind...";
    button.textContent = "Continue";
    button.dataset.step = "1";

    scene.classList.remove("hidden");
}

function nextArrivalLine() {
    const text = document.getElementById("arrivalText");
    const button = document.getElementById("arrivalContinue");

    if (button.dataset.step === "1") {
        text.textContent =
            "Beyond the trees, you see an old village. Broken homes stand quietly among the weeds.";
        button.dataset.step = "2";
        return;
    }

    if (button.dataset.step === "2") {
        text.textContent =
            "No one seems to live here anymore. But perhaps it does not have to stay that way.";
        button.dataset.step = "3";
        return;
    }

    village.unlocked = true;
    gameEnded = true;
    document.getElementById("arrivalScene").classList.add("hidden");
    showVillage();
    addVillageLog("You found Oakshade Village.");
    addVillageLog("Gather resources and begin rebuilding.");
    saveGame();
}

function showQuestScreen() {
    const screen = document.getElementById("questScreen");
    if (!screen || !village.unlocked || !paths.forest.completed) return;

    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("villageScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    document.getElementById("arrivalScene")?.classList.add("hidden");

    updateQuests();
    screen.classList.remove("hidden");
}

function hideQuestScreen() {
    const screen = document.getElementById("questScreen");
    if (!screen) return;

    screen.classList.add("hidden");

    if (village.unlocked && paths.forest.completed) {
        showVillage();
    } else if (!paths.forest.completed) {
        document.getElementById("forestGame")?.classList.remove("hidden");
    }
}

function updateQuests() {
    if (village.unlocked) village.quests.getToVillage.completed = true;
    if (village.housesBuilt >= 2) village.quests.makeTwoHouses.completed = true;

    const villageQuest = document.getElementById("questVillage");
    const houseQuest = document.getElementById("questHouses");
    const villageReward = document.getElementById("questVillageReward");
    const houseReward = document.getElementById("questHousesReward");
    const villageClaimButton = document.querySelector("#questVillage button");
    const houseClaimButton = document.querySelector("#questHouses button");

    if (villageQuest) villageQuest.classList.toggle("completed", village.quests.getToVillage.claimed);
    if (houseQuest) houseQuest.classList.toggle("completed", village.quests.makeTwoHouses.claimed);
    if (villageReward) villageReward.textContent = village.quests.getToVillage.claimed ? "✓ Claimed" : "Reward: 6 Gold";
    if (houseReward) houseReward.textContent = village.quests.makeTwoHouses.claimed ? "✓ Claimed" : "Reward: 15 Gold";

    if (villageClaimButton) {
        villageClaimButton.disabled =
            !village.quests.getToVillage.completed ||
            village.quests.getToVillage.claimed;
    }

    if (houseClaimButton) {
        houseClaimButton.disabled =
            !village.quests.makeTwoHouses.completed ||
            village.quests.makeTwoHouses.claimed;
    }
}

function claimQuest(type) {
    const quest = village.quests[type];
    if (!quest || !quest.completed || quest.claimed) return;

    const rewards = { getToVillage: 6, makeTwoHouses: 15 };
    player.gold += rewards[type];
    quest.claimed = true;

    addVillageLog("Quest complete! You earned " + rewards[type] + " gold.");
    updateGold();
    updateVillageUI();
    updateQuests();
    saveGame();
}

function updateVillageTabs(activeTab) {
    const villageButton = document.getElementById("villageTabButton");
    const walkButton = document.getElementById("walkTabButton");

    if (villageButton) {
        const active = activeTab === "village";
        villageButton.classList.toggle("active", active);
        villageButton.setAttribute("aria-selected", String(active));
    }

    if (walkButton) {
        const active = activeTab === "walk";
        walkButton.classList.toggle("active", active);
        walkButton.setAttribute("aria-selected", String(active));
    }
}

function showVillageTab() {
    if (!village.unlocked || !paths.forest.completed) return;

    document.getElementById("arrivalScene")?.classList.add("hidden");
    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("questScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    document.getElementById("villageScreen")?.classList.remove("hidden");
    updateVillageTabs("village");

    updateVillageTabs("village");
    updateVillageUI();
}

function showVillageWalkTab(startWalk = false) {
    if (!village.unlocked || !paths.forest.completed) return;

    document.getElementById("arrivalScene")?.classList.add("hidden");
    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("questScreen")?.classList.add("hidden");
    document.getElementById("villageScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.remove("hidden");

    updateVillageTabs("walk");

    if (startWalk && !village.walk.active) {
        startVillageWalk();
        return;
    }

    updateVillageWalkUI();
}

function showVillage() {
    const hub = document.getElementById("villageScreen");
    if (!hub) return;

    document.getElementById("arrivalScene")?.classList.add("hidden");
    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    hub.classList.remove("hidden");
    updateVillageTabs("village");
    updateVillageUI();
    updateQuests();
}

function addVillageLog(message) {
    const log = document.getElementById("villageLog");
    if (!log) return;

    const entry = document.createElement("div");
    entry.textContent = message;
    log.prepend(entry);

    while (log.children.length > 8) {
        log.lastElementChild.remove();
    }
}

function gatherResource(type) {
    if (!village.unlocked || !village.walk.active) return;

    const amounts = { wood: 2, stone: 2, food: 1 };
    const amount = amounts[type] || 1;
    village.resources[type] += amount;

    addVillageLog(`You gathered ${amount} ${type}.`);
    updateVillageUI();
    saveGame();
}

function canBuild(type) {
    const cost = buildingCosts[type];
    return Object.keys(cost).every(resource =>
        village.resources[resource] >= cost[resource]
    );
}

function buildBuilding(type) {
    if (!village.unlocked || village.buildings[type]) return;

    if (!canBuild(type)) {
        addVillageLog(`You don't have enough resources for the ${buildingNames[type]}.`);
        return;
    }

    Object.entries(buildingCosts[type]).forEach(([resource, amount]) => {
        village.resources[resource] -= amount;
    });

    village.buildings[type] = true;
    addVillageLog(`You rebuilt the ${buildingNames[type]}.`);
    updateVillageUI();
    saveGame();
}

function getHouseCost() {
    return {
        wood: 20 * Math.pow(2, village.housesBuilt),
        stone: 10 * Math.pow(2, village.housesBuilt)
    };
}

function buildHouse() {
    if (!village.unlocked) return;

    const cost = getHouseCost();

    if (village.resources.wood < cost.wood || village.resources.stone < cost.stone) {
        addVillageLog("You don't have enough resources to build a house.");
        return;
    }

    village.resources.wood -= cost.wood;
    village.resources.stone -= cost.stone;
    village.housesBuilt++;

    addVillageLog("You built House #" + village.housesBuilt + ".");
    updateVillageUI();
    updateQuests();
    saveGame();
}

let villageWalkTimer = null;

function updateVillageUI() {
    const screen = document.getElementById("villageScreen");
    if (!screen) return;

    document.getElementById("woodText").textContent = village.resources.wood;
    document.getElementById("stoneText").textContent = village.resources.stone;
    document.getElementById("foodText").textContent = village.resources.food;

    document.getElementById("villageHpText").textContent = player.hp + " / " + player.maxHp;
    document.getElementById("villageAttackText").textContent = player.attack;
    document.getElementById("villageLevelText").textContent = player.level;
    document.getElementById("villageGoldText").textContent = player.gold;

    const walkButton = document.getElementById("takeWalkButton");
    if (walkButton) {
        walkButton.disabled = village.walk.active;
        walkButton.textContent = village.walk.active ? "Walking..." : "Take a Walk";
    }

    const houseCost = getHouseCost();
    const houseCostText = document.getElementById("houseCostText");
    const houseButton = document.getElementById("houseBuildButton");
    const houseCount = document.getElementById("houseCountText");

    if (houseCostText) houseCostText.textContent = houseCost.wood + " wood · " + houseCost.stone + " stone";
    if (houseCount) houseCount.textContent = village.housesBuilt;
    if (houseButton) houseButton.disabled =
        village.resources.wood < houseCost.wood ||
        village.resources.stone < houseCost.stone;

    updateQuests();

    Object.keys(village.buildings).forEach(type => {
        const card = document.getElementById(`${type}Building`);
        const button = document.getElementById(`${type}BuildButton`);
        if (!card || !button) return;

        const built = village.buildings[type];
        card.classList.toggle("built", built);
        button.disabled = built || !canBuild(type);
        button.textContent = built ? "Built" : "Build";
    });
}

function startVillageWalk() {
    if (!village.unlocked || village.walk.active) return;

    clearInterval(villageWalkTimer);

    village.walk.active = true;
    village.walk.startTime = Date.now();
    village.walk.lastRewardCount = 0;
    village.walk.nextEncounterTime = 30 + Math.floor(Math.random() * 31);

    document.getElementById("villageScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.remove("hidden");
    updateVillageTabs("walk");

    updateVillageWalkUI();
    addVillageLog("You set out for a 20 minute walk.");
    saveGame();

    clearInterval(villageWalkTimer);
    villageWalkTimer = setInterval(updateVillageWalk, 1000);
    updateVillageWalk();
}

function updateVillageWalk() {
    if (!village.walk.active) return;

    const elapsed = Date.now() - village.walk.startTime;
    const progress = Math.min(1, elapsed / village.walk.duration);

    const bar = document.getElementById("villageWalkBar");
    const text = document.getElementById("villageWalkText");
    const next = document.getElementById("nextWalkRewardText");

    if (bar) bar.style.width = (progress * 100) + "%";

    const remaining = Math.max(0, village.walk.duration - elapsed);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    if (text) text.textContent = minutes + ":" + String(seconds).padStart(2, "0") + " remaining";

    const rewardCount = Math.floor(elapsed / 15000);

    while (village.walk.lastRewardCount < rewardCount) {
        village.walk.lastRewardCount++;

        const resources = ["wood", "stone", "food"];
        const resource = resources[Math.floor(Math.random() * resources.length)];

        village.resources[resource]++;
        addVillageWalkLog("You found 1 " + resource + ".");
    }

    if (elapsed >= village.walk.nextEncounterTime * 1000) {
        villageWalkBattle();
        village.walk.nextEncounterTime =
            Math.floor(elapsed / 1000) + 30 + Math.floor(Math.random() * 31);
    }

    if (next) {
        const secondsUntilReward = 15 - Math.floor((elapsed % 15000) / 1000);
        next.textContent = secondsUntilReward + " seconds until your next resource";
    }

    updateVillageWalkUI();

    if (elapsed >= village.walk.duration) {
        finishVillageWalk();
    } else {
        saveGame();
    }
}

function villageWalkBattle() {
    const enemy = enemies[Math.floor(Math.random() * enemies.length)];
    const damageTaken = Math.max(0, enemy.attack - player.attack);

    if (damageTaken <= 0) {
        addVillageWalkLog("You defeated " + enemy.name + ".");
        player.gold += enemy.gold;
        giveXP(enemy.xp);
    } else {
        player.hp -= damageTaken;
        addVillageWalkLog(enemy.name + " attacked you for " + damageTaken + " damage.");

        if (player.hp <= 0) {
            player.hp = 0;
            addVillageWalkLog(enemy.name + " defeated you.");
            villageWalkRest();
        }
    }

    updateHP();
    updateGold();
    updateVillageWalkUI();
}

function villageWalkRest() {
    const missingHp = Math.max(0, player.maxHp - player.hp);

    if (missingHp <= 0) return;

    const restDuration = missingHp * 0.5 * 60 * 1000;
    const startTime = Date.now();

    clearInterval(villageWalkTimer);

    const bar = document.getElementById("villageWalkRestBar");
    const text = document.getElementById("villageWalkRestText");

    if (text) text.textContent = "Forced Rest";

    const timer = setInterval(() => {
        const progress = Math.min(1, (Date.now() - startTime) / restDuration);

        if (bar) bar.style.width = (progress * 100) + "%";

        if (progress >= 1) {
            clearInterval(timer);
            player.hp = player.maxHp;

            if (bar) bar.style.width = "0%";
            if (text) text.textContent = "Rested! The walk continues.";

            updateHP();
            saveGame();

            villageWalkTimer = setInterval(updateVillageWalk, 1000);
        }
    }, 1000);
}

function updateVillageWalkUI() {
    const hpText = document.getElementById("villageWalkHpText");
    const hpBar = document.getElementById("villageWalkHpBar");
    const xpText = document.getElementById("villageWalkXpText");
    const xpBar = document.getElementById("villageWalkXpBar");
    const goldText = document.getElementById("villageWalkGoldText");
    const level = document.getElementById("villageWalkLevelText");
    const attack = document.getElementById("villageWalkAttackText");

    if (hpText) hpText.textContent = player.hp + " / " + player.maxHp;
    if (hpBar) hpBar.style.width = (player.hp / player.maxHp * 100) + "%";
    if (xpText) xpText.textContent = player.xp + " / " + player.xpToNext + " XP";
    if (xpBar) xpBar.style.width = (player.xp / player.xpToNext * 100) + "%";
    if (goldText) goldText.textContent = player.gold;
    if (level) level.textContent = player.level;
    if (attack) attack.textContent = player.attack;
}

function addVillageWalkLog(message) {
    const log = document.getElementById("villageWalkLog");
    if (!log) return;

    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.textContent = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    while (log.children.length > 20) {
        log.firstElementChild.remove();
    }
}

function leaveVillageWalk() {
    if (!village.walk.active) return;

    village.walk.active = false;
    clearInterval(villageWalkTimer);
    villageWalkTimer = null;

    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    document.getElementById("villageScreen")?.classList.remove("hidden");

    addVillageLog("You returned to Oakshade Village.");
    updateVillageUI();
    saveGame();
}

function finishVillageWalk() {
    if (!village.walk.active) return;

    village.walk.active = false;
    clearInterval(villageWalkTimer);
    villageWalkTimer = null;

    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    document.getElementById("villageScreen")?.classList.remove("hidden");

    addVillageLog("You finished your 20 minute walk and returned to Oakshade Village.");
    updateVillageUI();
    saveGame();
}

function resetVillage() {
    village.unlocked = false;
    village.housesBuilt = 0;
    village.quests = {
        getToVillage: { completed: false, claimed: false },
        makeTwoHouses: { completed: false, claimed: false }
    };
    village.resources = { wood: 0, stone: 0, food: 0 };
    village.buildings = { campfire: false, shelter: false, workshop: false };
    village.walk = { active: false, startTime: 0, lastRewardCount: 0, nextEncounterTime: 30, duration: 20 * 60 * 1000 };
    clearInterval(villageWalkTimer);
    villageWalkTimer = null;
    document.getElementById("villageWalkScreen")?.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("arrivalContinue")?.addEventListener("click", nextArrivalLine);

    document.querySelectorAll("[data-gather]").forEach(button => {
        button.addEventListener("click", () => gatherResource(button.dataset.gather));
    });

    document.querySelectorAll("[data-build]").forEach(button => {
        button.addEventListener("click", () => buildBuilding(button.dataset.build));
    });

    document.getElementById("takeWalkButton")?.addEventListener("click", startVillageWalk);
    document.getElementById("leaveVillageWalkButton")?.addEventListener("click", leaveVillageWalk);

    updateVillageUI();

    if (village.walk.active) {
        document.getElementById("villageScreen")?.classList.add("hidden");
        document.getElementById("villageWalkScreen")?.classList.remove("hidden");
        clearInterval(villageWalkTimer);
        villageWalkTimer = setInterval(updateVillageWalk, 1000);
        updateVillageWalk();
    }
});
