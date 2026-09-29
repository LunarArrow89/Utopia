const whisperingWoodsEnemies = [
    { name: "Lost Wolf", attack: 7, xp: 12, gold: 5 },
    { name: "Forest Goblin", attack: 9, xp: 15, gold: 7 },
    { name: "Shadow Spider", attack: 11, xp: 18, gold: 8 },
    { name: "Angry Boar", attack: 10, xp: 20, gold: 10 },
    { name: "Dark Slime", attack: 6, xp: 10, gold: 4 }
];

const WHISPERING_WOODS_RESOURCE_TIME = 15000;
const WHISPERING_WOODS_ENCOUNTER_TIME = 45000;

let arrivalCutsceneSeen = false;

const village = {
    unlocked: false,
    housesBuilt: 0,
    quests: {
        getToVillage: { completed: false, claimed: false },
        makeTwoHouses: { completed: false, claimed: false },
        reachAshLevel: { completed: false, claimed: false },
        rescueCivilian: { completed: false, claimed: false }
    },
    resources: { wood: 0, stone: 0, food: 0 },
    buildings: { campfire: false, shelter: false, workshop: false },
    walk: { active: false, startTime: 0, lastUpdateTime: 0, lastRewardCount: 0, nextEncounterTime: 45, duration: 0 }
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
    // The arrival scene is a real pause screen. Nothing should progress
    // while the player is reading it.
    gameEnded = true;
    setVillageTabsVisible(false);
    const scene = document.getElementById("arrivalScene");
    const forestGame = document.getElementById("forestGame");
    const text = document.getElementById("arrivalText");
    const button = document.getElementById("arrivalContinue");

    if (!scene || !text || !button) return;

    if (forestGame) forestGame.classList.add("hidden");

    text.textContent = "You leave the forest behind...";
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

    arrivalCutsceneSeen = true;
    village.unlocked = true;
    gameEnded = true;
    document.getElementById("arrivalScene").classList.add("hidden");
    showVillage();
    addVillageLog("You found Oakshade Village.");
    addVillageLog("Gather resources and begin rebuilding.");
    saveGame();
}

function showQuestScreen() {
    setVillageTabsVisible(false);
    const screen = document.getElementById("questScreen");
    if (!screen || !village.unlocked) return;

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

    if (village.unlocked) {
        showVillage();
    } else {
        document.getElementById("forestGame")?.classList.remove("hidden");
    }
}

function updateQuests() {
    if (village.unlocked) village.quests.getToVillage.completed = true;
    if (village.housesBuilt >= 2) village.quests.makeTwoHouses.completed = true;
    if (village.housesBuilt >= 2 && player.level >= 3) village.quests.reachAshLevel.completed = true;
    if (paths.ashHills.completed) village.quests.rescueCivilian.completed = true;

    const villageQuest = document.getElementById("questVillage");
    const houseQuest = document.getElementById("questHouses");
    const ashLevelQuest = document.getElementById("questAshLevel");
    const rescueQuest = document.getElementById("questRescue");
    const villageReward = document.getElementById("questVillageReward");
    const houseReward = document.getElementById("questHousesReward");
    const ashLevelReward = document.getElementById("questAshLevelReward");
    const rescueReward = document.getElementById("questRescueReward");
    const villageClaimButton = document.querySelector("#questVillage button");
    const houseClaimButton = document.querySelector("#questHouses button");
    const ashLevelClaimButton = document.querySelector("#questAshLevel button");
    const rescueClaimButton = document.querySelector("#questRescue button");

    if (villageQuest) villageQuest.classList.toggle("completed", village.quests.getToVillage.claimed);
    if (houseQuest) houseQuest.classList.toggle("completed", village.quests.makeTwoHouses.claimed);
    if (ashLevelQuest) {
        ashLevelQuest.classList.toggle("hidden", village.housesBuilt < 2);
        ashLevelQuest.classList.toggle("completed", village.quests.reachAshLevel.claimed);
    }
    if (rescueQuest) {
        rescueQuest.classList.toggle("hidden", village.housesBuilt < 2);
        rescueQuest.classList.toggle("completed", village.quests.rescueCivilian.claimed);
    }
    if (villageReward) villageReward.textContent = village.quests.getToVillage.claimed ? "✓ Claimed" : "Reward: 6 Gold";
    if (houseReward) houseReward.textContent = village.quests.makeTwoHouses.claimed ? "✓ Claimed" : "Reward: 15 Gold";
    if (ashLevelReward) ashLevelReward.textContent = village.quests.reachAshLevel.claimed ? "✓ Claimed" : "Reward: 25 Gold";
    if (rescueReward) rescueReward.textContent = village.quests.rescueCivilian.claimed ? "✓ Claimed" : "Reward: 50 Gold";

    /* Quest buttons open their story instead of immediately claiming. */
    if (villageClaimButton) villageClaimButton.disabled = village.quests.getToVillage.claimed;
    if (houseClaimButton) houseClaimButton.disabled = village.quests.makeTwoHouses.claimed;
    if (ashLevelClaimButton) ashLevelClaimButton.disabled = village.quests.reachAshLevel.claimed;
    if (rescueClaimButton) rescueClaimButton.disabled = village.quests.rescueCivilian.claimed;
}

function claimQuest(type) {
    const quest = village.quests[type];
    if (!quest || !quest.completed || quest.claimed) return;

    const rewards = {
        getToVillage: 6,
        makeTwoHouses: 15,
        reachAshLevel: 25,
        rescueCivilian: 50
    };
    player.gold += rewards[type];
    quest.claimed = true;

    addVillageLog("Quest complete! You earned " + rewards[type] + " gold.");
    updateGold();
    updateVillageUI();
    updateQuests();
    saveGame();
}

function setVillageTabsVisible(visible) {
    const tabs = document.getElementById("villageTabs");
    if (tabs) {
        tabs.classList.add("hidden");
        tabs.setAttribute("aria-hidden", "true");
    }
    const mainTabs = document.getElementById("mainTabs");
    if (mainTabs) mainTabs.classList.remove("hidden");
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
    if (!village.unlocked) return;

    setVillageTabsVisible(false);
    if (typeof updateMainTabs === "function") updateMainTabs("walk");

    document.getElementById("arrivalScene")?.classList.add("hidden");
    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("questScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    document.getElementById("ashHillsScreen")?.classList.add("hidden");
    document.getElementById("villageScreen")?.classList.remove("hidden");
    document.getElementById("villageScreen")?.style.removeProperty("z-index");
    updateVillageTabs("village");
    updateVillageUI();

    if (village.walk.active) {
        document.getElementById("villageScreen")?.classList.add("walk-view-only");
    } else {
        document.getElementById("villageScreen")?.classList.remove("walk-view-only");
    }
}

function showVillageWalkTab(startWalk = false) {
    if (!village.walk.active && !startWalk) return;

    setVillageTabsVisible(true);
    if (typeof updateMainTabs === "function") updateMainTabs("village");

    document.getElementById("arrivalScene")?.classList.add("hidden");
    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("questScreen")?.classList.add("hidden");
    document.getElementById("villageScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.remove("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("walk-active");

    updateVillageTabs("walk");
    const walkMainTab = document.getElementById("walkMainTab");
    if (walkMainTab) {
        walkMainTab.classList.remove("hidden");
        walkMainTab.style.display = "block";
        walkMainTab.setAttribute("aria-hidden", "false");
    }
    if (typeof updateMainTabs === "function") updateMainTabs("walk");
    if (walkMainTab) {
        walkMainTab.classList.remove("hidden");
        walkMainTab.style.display = "";
    }
    try {
        localStorage.setItem("utopiaActiveTab", "walk");
        localStorage.setItem("utopiaWalkActive", "true");
    } catch (error) {}

    if (startWalk && !village.walk.active) {
        startVillageWalk();
        return;
    }

    updateVillageWalkUI();
}

function healAtVillage() {
    if (player.hp >= player.maxHp) return;

    player.hp = player.maxHp;
    updateHP();
    addVillageLog("You rested in Oakshade Village and fully recovered your HP.");
}

function showVillage() {
    setVillageTabsVisible(true);
    if (typeof updateMainTabs === "function") updateMainTabs("village");
    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    document.getElementById("ashHillsScreen")?.classList.add("hidden");
    const hub = document.getElementById("villageScreen");
    if (!hub) return;

    document.getElementById("arrivalScene")?.classList.add("hidden");
    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    hub.classList.remove("hidden");
    updateVillageTabs("village");
    healAtVillage();
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
    if (!village.unlocked || village.walk.active) return;

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
    if (!village.unlocked || village.walk.active || village.buildings[type]) return;

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
    if (!village.unlocked || village.walk.active) return;

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

window.villageWalkIsActive = function () {
    return !!village.walk?.active;
};

function updateVillageUI() {
    setVillageTabsVisible(village.unlocked);
    const screen = document.getElementById("villageScreen");
    if (!screen) return;

    // While walking, the Village can be viewed but nothing in it can be used.
    const walking = village.walk.active;
    screen.classList.toggle("walk-view-only", walking);
    screen.querySelectorAll("button").forEach(button => {
        button.disabled = walking;
    });

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

    const ashButton = document.getElementById("ashHillsButton");
    if (ashButton) {
        if (village.housesBuilt < 2) {
            ashButton.disabled = true;
            ashButton.textContent = "Build 2 Houses First";
        } else if (paths.ashHills.completed) {
            ashButton.disabled = false;
            ashButton.textContent = "Ash Hills Completed";
        } else if (paths.ashHills.active) {
            ashButton.disabled = false;
            ashButton.textContent = "Continue Ash Hills";
        } else if (player.level < paths.ashHills.levelRequirement) {
            ashButton.disabled = true;
            ashButton.textContent = "Requires Level " + paths.ashHills.levelRequirement;
        } else {
            ashButton.disabled = false;
            ashButton.textContent = "Enter Ash Hills";
        }
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

function resumeVillageWalk() {
    if (!village.walk.active) return;

    currentPath = "villageWalk";
    gameEnded = false;

    // This is the authoritative local marker for an active endless walk.
    // It is separate from the currently visible tab.
    try {
        localStorage.setItem("utopiaWalkActive", "true");
        localStorage.setItem("utopiaActiveTab", "walk");
    } catch (error) {}

    clearInterval(villageWalkTimer);

    document.getElementById("villageWalkScreen")?.classList.add("walk-active");
    document.getElementById("villageWalkScreen")?.classList.remove("hidden");

    const walkMainTab = document.getElementById("walkMainTab");
    if (walkMainTab) {
        walkMainTab.classList.remove("hidden");
        walkMainTab.style.display = "";
        walkMainTab.setAttribute("aria-hidden", "false");
    }

    updateVillageTabs("walk");
    if (typeof updateMainTabs === "function") updateMainTabs("walk");

    updateVillageWalkUI();
    villageWalkTimer = setInterval(updateVillageWalk, 1000);
    updateVillageWalk();
}

function startVillageWalk() {
    if (!village.unlocked || village.walk.active) return;

    setVillageTabsVisible(true);

    clearInterval(villageWalkTimer);

    village.walk.active = true;
    village.walk.startTime = Date.now();
    village.walk.lastUpdateTime = village.walk.startTime;
    village.walk.lastRewardCount = 0;
    village.walk.nextEncounterTime = 45;
    currentPath = "villageWalk";
    gameEnded = false;

    try {
        localStorage.setItem("utopiaWalkActive", "true");
        localStorage.setItem("utopiaActiveTab", "walk");
    } catch (error) {}

    document.getElementById("villageScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.remove("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("walk-active");

    updateVillageTabs("walk");
    if (typeof updateMainTabs === "function") updateMainTabs("walk");
    try { localStorage.setItem("utopiaActiveTab", "walk"); } catch (error) {}

    updateVillageWalkUI();
    addVillageLog("You set out on an endless village walk. Return whenever you want.");
    saveGame();

    clearInterval(villageWalkTimer);
    villageWalkTimer = setInterval(updateVillageWalk, 1000);
    updateVillageWalk();
}

function updateVillageWalk() {
    if (!village.walk.active) return;

    const now = Date.now();
    const elapsed = Math.max(0, now - village.walk.startTime);

    // The village walk is infinite. There is no path timer or completion.
    const bar = document.getElementById("villageWalkBar");
    const text = document.getElementById("villageWalkText");

    if (bar) {
        bar.style.width = "0%";
        bar.parentElement?.classList.add("hidden");
    }

    if (text) {
        const totalSeconds = Math.floor(elapsed / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            text.textContent = hours + "h " + minutes + "m " + seconds + "s";
        } else {
            text.textContent = minutes + "m " + seconds + "s";
        }
    }

    const rewardCount = Math.floor(elapsed / WHISPERING_WOODS_RESOURCE_TIME);

    while (village.walk.lastRewardCount < rewardCount) {
        village.walk.lastRewardCount++;

        const resources = ["wood", "stone", "food"];
        const resource = resources[Math.floor(Math.random() * resources.length)];

        village.resources[resource]++;
        addVillageWalkLog("You found 1 " + resource + ".");
    }

    if (elapsed >= village.walk.nextEncounterTime * 1000) {
        villageWalkBattle();
        village.walk.nextEncounterTime += 45;
    }

    if (next) {
        const secondsUntilResource = 15 - Math.floor((elapsed % WHISPERING_WOODS_RESOURCE_TIME) / 1000);
        const secondsUntilEnemy = Math.max(0, village.walk.nextEncounterTime - Math.floor(elapsed / 1000));
        next.textContent = secondsUntilResource + "s until resource • " + secondsUntilEnemy + "s until enemy";
    }

    updateVillageWalkUI();
    village.walk.lastUpdateTime = now;
    saveGame();
}

function catchUpVillageWalk() {
    if (!village.walk.active) return;

    const now = Date.now();
    const lastUpdate = Number(village.walk.lastUpdateTime) || Number(village.walk.startTime) || now;
    const elapsed = Math.max(0, now - lastUpdate);
    const totalAway = Math.max(0, now - lastUpdate);
    const showSummary = totalAway >= 15 * 60 * 1000;

    if (elapsed < 1000) {
        updateVillageWalkUI();
        return;
    }

    // Process everything that happened while the game was closed in one quick batch.
    const resourceCount = Math.floor(elapsed / WHISPERING_WOODS_RESOURCE_TIME);
    let wood = 0;
    let stone = 0;
    let food = 0;

    for (let i = 0; i < resourceCount; i++) {
        const resource = ["wood", "stone", "food"][Math.floor(Math.random() * 3)];
        if (resource === "wood") wood++;
        if (resource === "stone") stone++;
        if (resource === "food") food++;
    }

    village.resources.wood += wood;
    village.resources.stone += stone;
    village.resources.food += food;

    const encounterCount = Math.floor(elapsed / WHISPERING_WOODS_ENCOUNTER_TIME);
    let totalXp = 0;
    let totalGold = 0;
    let totalDamage = 0;
    let defeated = false;

    for (let i = 0; i < encounterCount; i++) {
        const enemy = whisperingWoodsEnemies[Math.floor(Math.random() * whisperingWoodsEnemies.length)];
        const damage = Math.max(0, enemy.attack - player.attack);

        if (damage <= 0) {
            totalXp += enemy.xp;
            totalGold += enemy.gold;
        } else {
            totalDamage += damage;

            if (player.hp - totalDamage <= 0) {
                defeated = true;
                break;
            }
        }
    }

    if (totalXp > 0) giveXP(totalXp);
    if (totalGold > 0) player.gold += totalGold;

    if (totalDamage > 0 && !defeated) {
        player.hp = Math.max(0, player.hp - totalDamage);
    }

    // One short summary instead of hundreds of individual log entries.
    const summary = [];
    if (wood) summary.push(wood + " wood");
    if (stone) summary.push(stone + " stone");
    if (food) summary.push(food + " food");

    if (summary.length) {
        addVillageWalkLog("While you were away, you found " + summary.join(", ") + ".");
    }

    if (encounterCount > 0) {
        if (defeated) {
            player.hp = 0;
            addVillageWalkLog("While you were away, you were defeated and must rest for 25 minutes.");
            villageWalkRest();
        } else if (totalXp > 0 || totalGold > 0 || totalDamage > 0) {
            addVillageWalkLog(
                "While you were away, you fought " + encounterCount +
                " encounter" + (encounterCount === 1 ? "" : "s") +
                (totalXp ? ", gained " + totalXp + " XP" : "") +
                (totalGold ? ", gained " + totalGold + " gold" : "") +
                (totalDamage ? ", and lost " + totalDamage + " HP" : "") +
                "."
            );
        }
    }

    if (showSummary) {
        const popup = document.getElementById("awaySummaryOverlay");
        const popupText = document.getElementById("awaySummaryText");

        if (popup && popupText) {
            const lines = [
                "You were away for " + Math.floor(totalAway / 60000) + " minutes.",
                summary.length ? "Resources: " + summary.join(", ") : "Resources: none",
                encounterCount ? "Encounters: " + encounterCount : "Encounters: none",
                totalXp ? "XP gained: " + totalXp : "XP gained: none",
                totalGold ? "Gold gained: " + totalGold : "Gold gained: none",
                totalDamage ? "HP lost: " + totalDamage : "HP lost: none"
            ];

            if (defeated) {
                lines.push("You were defeated and must rest for 25 minutes.");
            }

            popupText.textContent = lines.join("\n");
            popup.classList.remove("hidden");
        }
    }

    village.walk.lastUpdateTime = now;
    village.walk.startTime = Number(village.walk.startTime) || now;
    village.walk.lastRewardCount += resourceCount;
    village.walk.nextEncounterTime = Math.max(
        village.walk.nextEncounterTime,
        Math.floor((now - village.walk.startTime) / 1000) + 45
    );

    updateHP();
    updateGold();
    updateVillageUI();
    saveGame();
}

function villageWalkBattle() {
    const enemy = whisperingWoodsEnemies[Math.floor(Math.random() * whisperingWoodsEnemies.length)];
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

    // Being defeated always forces a full 25-minute rest.
    const restDuration = 25 * 60 * 1000;
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
    const hpBarText = document.getElementById("villageWalkHpBarText");
    const xpText = document.getElementById("villageWalkXpText");
    const xpBar = document.getElementById("villageWalkXpBar");
    const goldText = document.getElementById("villageWalkGoldText");
    const woodText = document.getElementById("villageWalkWoodText");
    const stoneText = document.getElementById("villageWalkStoneText");
    const foodText = document.getElementById("villageWalkFoodText");
    const level = document.getElementById("villageWalkLevelText");
    const attack = document.getElementById("villageWalkAttackText");

    if (hpText) hpText.textContent = player.hp + " / " + player.maxHp;
    if (hpBar) hpBar.style.width = (player.hp / player.maxHp * 100) + "%";
    if (hpBarText) hpBarText.textContent = player.hp + " / " + player.maxHp + " HP";
    if (xpText) xpText.textContent = player.xp + " / " + player.xpToNext + " XP";
    if (xpBar) xpBar.style.width = (player.xp / player.xpToNext * 100) + "%";
    if (goldText) goldText.textContent = player.gold;
    if (woodText) woodText.textContent = village.resources.wood;
    if (stoneText) stoneText.textContent = village.resources.stone;
    if (foodText) foodText.textContent = village.resources.food;
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
    currentPath = "village";
    try {
        localStorage.setItem("utopiaActiveTab", "village");
        localStorage.removeItem("utopiaWalkActive");
    } catch (error) {}
    clearInterval(villageWalkTimer);
    villageWalkTimer = null;

    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.remove("walk-active");
    document.getElementById("villageScreen")?.classList.remove("hidden");
    document.getElementById("villageScreen")?.classList.remove("walk-view-only");
    updateVillageTabs("village");
    if (typeof updateMainTabs === "function") updateMainTabs("village");

    addVillageLog("You returned to Oakshade Village.");
    updateVillageUI();
    saveGame();
}

function finishVillageWalk() {
    // Village walks are endless now. Kept as a compatibility function.
    if (village.walk.active) {
        leaveVillageWalk();
    }
}

function resetVillage() {
    setVillageTabsVisible(false);
    village.unlocked = false;
    village.housesBuilt = 0;
    village.quests = {
        getToVillage: { completed: false, claimed: false },
        makeTwoHouses: { completed: false, claimed: false },
        reachAshLevel: { completed: false, claimed: false },
        rescueCivilian: { completed: false, claimed: false }
    };
    village.resources = { wood: 0, stone: 0, food: 0 };
    village.buildings = { campfire: false, shelter: false, workshop: false };
    village.walk = { active: false, startTime: 0, lastUpdateTime: 0, lastRewardCount: 0, nextEncounterTime: 45, duration: 0 };
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

    document.getElementById("awaySummaryClose")?.addEventListener("click", () => {
        document.getElementById("awaySummaryOverlay")?.classList.add("hidden");
    });

    updateVillageUI();

    if (village.walk.active) {
        setVillageTabsVisible(true);
        document.getElementById("villageScreen")?.classList.add("hidden");
        document.getElementById("villageWalkScreen")?.classList.remove("hidden");
        document.getElementById("villageWalkScreen")?.classList.add("walk-active");
        updateVillageTabs("walk");
        if (typeof updateMainTabs === "function") updateMainTabs("walk");
        clearInterval(villageWalkTimer);
        villageWalkTimer = setInterval(updateVillageWalk, 1000);
        updateVillageWalk();
    }
});


/* QUEST STORY DIALOGUES */
const questStories = {
    getToVillage: {
        title: "A Place to Call Home",
        story: "After surviving the the forest, you discover Oakshade Village. Its homes are broken and its streets are quiet, but the village could become a safe place again.",
        objective: "Objective: Reach and enter Oakshade Village.",
        reward: "Reward: 6 Gold"
    },
    makeTwoHouses: {
        title: "Rebuild the Village",
        story: "The empty houses tell you that Oakshade needs more than a traveler passing through. If you can rebuild two homes, there may finally be a place for people to return to.",
        objective: "Objective: Build 2 houses in Oakshade Village.",
        reward: "Reward: 15 Gold"
    },
    reachAshLevel: {
        title: "The Road to Ash Hills",
        story: "A villager points toward the burned hills beyond the forest. The road is dangerous, so you will need to grow stronger before you can safely travel there.",
        objective: "Objective: Reach Level 3.",
        reward: "Reward: 25 Gold"
    },
    rescueCivilian: {
        title: "Someone Beyond the Hills",
        story: "A worried villager tells you that someone is trapped somewhere beyond Ash Hills. The path is long and dangerous, but bringing them home could give Oakshade hope again.",
        objective: "Objective: Complete Ash Hills and rescue the civilian.",
        reward: "Reward: 50 Gold"
    }
};

let openQuestStoryId = null;

function openQuestStory(questId) {
    if (!village.unlocked || !questStories[questId]) return;

    const quest = questStories[questId];
    openQuestStoryId = questId;

    const overlay = document.getElementById("questStoryOverlay");
    const title = document.getElementById("questStoryTitle");
    const story = document.getElementById("questStoryText");
    const objective = document.getElementById("questStoryObjective");
    const reward = document.getElementById("questStoryReward");
    const action = document.getElementById("questStoryAction");

    if (!overlay) return;

    title.textContent = quest.title;
    story.textContent = quest.story;
    objective.textContent = quest.objective;
    reward.textContent = quest.reward;

    const state = village.quests[questId];
    if (state?.claimed) {
        action.textContent = "Completed";
        action.disabled = true;
    } else if (state?.completed) {
        action.textContent = "Claim Reward";
        action.disabled = false;
    } else {
        action.textContent = "Accept Quest";
        action.disabled = false;
    }

    overlay.classList.remove("hidden");
}

function closeQuestStory() {
    document.getElementById("questStoryOverlay")?.classList.add("hidden");
    openQuestStoryId = null;
}

function acceptQuestFromStory() {
    if (!openQuestStoryId) return;

    const state = village.quests[openQuestStoryId];
    if (!state) return;

    if (state.completed && !state.claimed) {
        claimQuest(openQuestStoryId);
        openQuestStory(openQuestStoryId);
        return;
    }

    closeQuestStory();
    addVillageLog("Quest accepted: " + questStories[openQuestStoryId].title + ".");
}