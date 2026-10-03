/* UTOPIA TRAVEL SYSTEM
   Travel is now an enemy-selection screen instead of a walking timer.
*/
(function () {
    "use strict";

    const routes = {
        woods: {
            name: "Whispering Woods", icon: "🌲",
            description: "Choose an enemy. Defeat them for XP, gold, and a chance at gear.",
            enemies: [
                { name: "Lost Wolf", attack: 7, xp: 12, gold: 5 },
                { name: "Forest Goblin", attack: 9, xp: 15, gold: 7 },
                { name: "Shadow Spider", attack: 11, xp: 18, gold: 8 },
                { name: "Angry Boar", attack: 10, xp: 20, gold: 10 },
                { name: "Dark Slime", attack: 6, xp: 10, gold: 4 }
            ]
        },
        ash: {
            name: "Ash Hills", icon: "🔥",
            description: "A dangerous red wasteland. Choose your target instead of waiting for an encounter.",
            enemies: [
                { name: "Ash Hound", attack: 21, xp: 28, gold: 12 },
                { name: "Cinder Goblin", attack: 23, xp: 32, gold: 15 },
                { name: "Burnt Stalker", attack: 25, xp: 38, gold: 18 },
                { name: "Ash Brute", attack: 27, xp: 45, gold: 22 }
            ]
        }
    };

    let selectedRoute = "woods";

    function getTravelState() {
        if (!window.utopiaTravelState) window.utopiaTravelState = { ashVictories: 0 };
        return window.utopiaTravelState;
    }

    function canUseAshHills() {
        return typeof village !== "undefined" && village.housesBuilt >= 2 &&
            typeof player !== "undefined" && player.level >= 3;
    }

    function travelLog(message) {
        const log = document.getElementById("travelBattleLog");
        if (!log) return;
        const entry = document.createElement("div");
        entry.className = "log-entry";
        entry.textContent = message;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
        while (log.children.length > 20) log.firstElementChild.remove();
    }

    function rarityRoll() {
        const roll = Math.random();
        return roll < 0.65 ? "Common" : roll < 0.9 ? "Uncommon" : roll < 0.98 ? "Rare" : "Epic";
    }

    let currentBattle = null;

    function finishBattleVictory() {
        if (!currentBattle) return;
        const enemy = currentBattle.enemy;
        player.gold += enemy.gold;
        if (typeof giveXP === "function") giveXP(enemy.xp);
        travelLog("🏆 You defeated " + enemy.name + "! +" + enemy.xp + " XP, +" + enemy.gold + " gold.");

        if (typeof generateItem === "function" && Array.isArray(player.inventory) && Math.random() < 0.12) {
            const item = generateItem(rarityRoll());
            player.inventory.unshift(item);
            travelLog("🎒 You found " + item.name + "!");
            if (typeof updateEquipmentUI === "function") updateEquipmentUI();
        }

        if (selectedRoute === "ash" && !paths.ashHills.rescueCompleted) {
            const state = getTravelState();
            state.ashVictories++;
            if (state.ashVictories >= 5) {
                paths.ashHills.completed = true;
                paths.ashHills.rescueCompleted = true;
                paths.ashHills.active = false;
                if (typeof village !== "undefined" && village.quests) village.quests.rescueCivilian.completed = true;
                travelLog("🧑 You found the trapped civilian!");
                travelLog("🏠 You rescued them and brought them back to Oakshade.");
                if (typeof updateQuests === "function") updateQuests();
                if (typeof updateVillageUI === "function") updateVillageUI();
            }
        }

        currentBattle = null;
        if (typeof updateHP === "function") updateHP();
        if (typeof updateGold === "function") updateGold();
        if (typeof updateVillageUI === "function") updateVillageUI();
        if (typeof saveGame === "function") saveGame();
        renderRoute();
    }

    function enemyTurn() {
        if (!currentBattle || typeof player === "undefined") return;
        const enemy = currentBattle.enemy;
        let damage = Math.max(1, enemy.attack - Math.floor(player.attack * 0.35));

        if (currentBattle.defending) {
            damage = Math.max(1, Math.floor(damage * 0.5));
            currentBattle.defending = false;
            travelLog("🛡️ Your guard reduced the damage.");
        }

        if (Math.random() < 0.12) {
            damage *= 2;
            travelLog("💥 " + enemy.name + " landed a critical hit!");
        }

        player.hp = Math.max(0, player.hp - damage);
        travelLog("🔥 " + enemy.name + " hit you for " + damage + " damage.");

        if (player.hp <= 0) {
            player.hp = 0;
            travelLog("You were defeated by " + enemy.name + ".");
            currentBattle = null;
            if (typeof updateHP === "function") updateHP();
            if (typeof saveGame === "function") saveGame();
            if (typeof startRest === "function") startRest(true);
            return;
        }

        renderBattle();
    }

    function battleAction(action) {
        if (!currentBattle || typeof player === "undefined") return;
        if (typeof resting !== "undefined" && resting) return;

        const enemy = currentBattle.enemy;

        if (action === "attack") {
            let damage = Math.max(1, player.attack + Math.floor(Math.random() * 5) - 2);
            if (Math.random() < 0.15) {
                damage *= 2;
                travelLog("⚡ Critical hit!");
            }
            currentBattle.enemyHp = Math.max(0, currentBattle.enemyHp - damage);
            travelLog("⚔️ You attacked " + enemy.name + " for " + damage + " damage.");

            if (currentBattle.enemyHp <= 0) {
                finishBattleVictory();
                return;
            }
            enemyTurn();
        } else if (action === "defend") {
            currentBattle.defending = true;
            travelLog("🛡️ You brace yourself. The next attack will deal reduced damage.");
            enemyTurn();
        } else if (action === "recover") {
            const heal = Math.max(2, Math.floor(player.maxHp * 0.15));
            const oldHp = player.hp;
            player.hp = Math.min(player.maxHp, player.hp + heal);
            travelLog("💚 You recovered " + (player.hp - oldHp) + " HP.");
            enemyTurn();
        } else if (action === "flee") {
            if (Math.random() < 0.7) {
                travelLog("🏃 You escaped from " + enemy.name + ".");
                currentBattle = null;
                renderRoute();
                return;
            }
            travelLog("❌ You couldn't escape!");
            enemyTurn();
        }

        if (typeof updateHP === "function") updateHP();
        if (typeof updateVillageUI === "function") updateVillageUI();
        if (typeof saveGame === "function") saveGame();
    }

    function startBattle(enemy) {
        if (!enemy || typeof player === "undefined") return;
        if (typeof resting !== "undefined" && resting) return;

        currentBattle = {
            enemy,
            enemyHp: enemy.hp || Math.max(12, enemy.attack * 3),
            defending: false
        };

        travelLog("⚔️ You encountered " + enemy.name + "!");
        renderBattle();
    }

    function renderBattle() {
        const screen = document.getElementById("travelScreen");
        if (!screen || !currentBattle) return;

        const enemy = currentBattle.enemy;
        const enemyHp = currentBattle.enemyHp;
        const enemyMaxHp = enemy.hp || Math.max(12, enemy.attack * 3);
        const hpPercent = Math.max(0, Math.min(100, (enemyHp / enemyMaxHp) * 100));

        screen.innerHTML = `
            <div class="travel-screen-box travel-selection-box battle-screen ${selectedRoute === "ash" ? "ash-travel" : "woods-travel"}">
                <button id="battleBackButton" class="travel-back-button" type="button">← Run Away</button>
                <div class="village-kicker">BATTLE</div>
                <h1>${selectedRoute === "ash" ? "🔥" : "⚔️"} ${enemy.name}</h1>
                <p class="travel-screen-subtitle">Choose an action. The enemy responds after every move.</p>

                <div class="battle-combatants">
                    <div class="combatant-card player-combatant">
                        <span>🧑 You</span>
                        <strong>${player.hp} / ${player.maxHp} HP</strong>
                        <small>⚔️ ${player.attack} Attack</small>
                    </div>
                    <div class="battle-vs">VS</div>
                    <div class="combatant-card enemy-combatant">
                        <span>👾 ${enemy.name}</span>
                        <strong>${enemyHp} / ${enemyMaxHp} HP</strong>
                        <small>⚔️ ${enemy.attack} Attack</small>
                    </div>
                </div>

                <div class="bar battle-hp-bar"><div class="bar-fill" style="width:${hpPercent}%"></div></div>

                <div class="battle-actions">
                    <button type="button" data-battle-action="attack">⚔️ Attack</button>
                    <button type="button" data-battle-action="defend">🛡️ Defend</button>
                    <button type="button" data-battle-action="recover">💚 Recover</button>
                    <button type="button" data-battle-action="flee">🏃 Flee</button>
                </div>

                <div class="travel-log-panel">
                    <div class="village-panel-title">📖 Battle Log</div>
                    <div id="travelBattleLog" class="log"></div>
                </div>
            </div>`;

        document.getElementById("battleBackButton")?.addEventListener("click", () => battleAction("flee"));
        screen.querySelectorAll("[data-battle-action]").forEach(button => {
            button.addEventListener("click", () => battleAction(button.dataset.battleAction));
        });
    }

    function fightEnemy(enemy) {
        startBattle(enemy);
    }

    function selectRoute(route) {
        if (route === "ash" && !canUseAshHills()) return;
        selectedRoute = route;
        renderRoute();
    }

    function renderRoute() {
        const screen = document.getElementById("travelScreen");
        if (!screen) return;
        const route = routes[selectedRoute];
        const ashUnlocked = canUseAshHills();
        const state = getTravelState();
        const rescueDone = !!(paths && paths.ashHills && paths.ashHills.rescueCompleted);

        screen.innerHTML = `
            <div class="travel-screen-box travel-selection-box ${selectedRoute === "ash" ? "ash-travel" : "woods-travel"}">
                <button id="travelBackButton" class="travel-back-button" type="button">← Back to Village</button>
                <div class="village-kicker">TRAVEL</div>
                <h1>${route.icon} ${route.name}</h1>
                <p class="travel-screen-subtitle">${route.description}</p>
                <div class="travel-route-switcher">
                    <button type="button" id="woodsRouteButton" class="${selectedRoute === "woods" ? "active" : ""}">🌲 Whispering Woods</button>
                    <button type="button" id="ashRouteButton" class="${selectedRoute === "ash" ? "active" : ""}" ${ashUnlocked ? "" : "disabled"}>🔥 Ash Hills${ashUnlocked ? "" : " — Requires Level 3 + 2 Houses"}</button>
                </div>
                ${selectedRoute === "ash" && !rescueDone ? `<div class="ash-mission">Civilian rescue: <strong>${Math.min(state.ashVictories, 5)}/5 victories</strong><span>Defeat five Ash Hills enemies to find and rescue the civilian. After that, Ash Hills becomes endless.</span></div>` : ""}
                ${selectedRoute === "ash" && rescueDone ? `<div class="ash-mission complete">🧑 Civilian rescued. Ash Hills is now endless.</div>` : ""}
                <div class="travel-player-card">
                    <div><strong>❤️ HP</strong><span>${player.hp} / ${player.maxHp}</span></div>
                    <div><strong>⚔️ Attack</strong><span>${player.attack}</span></div>
                    <div><strong>⭐ Level</strong><span>${player.level}</span></div>
                    <div><strong>💰 Gold</strong><span>${player.gold}</span></div>
                </div>
                <div class="enemy-title">Choose an enemy</div>
                <div class="enemy-selection-grid">
                    ${route.enemies.map((enemy, index) => `
                        <button type="button" class="enemy-choice" data-enemy-index="${index}">
                            <span class="enemy-icon">${selectedRoute === "ash" ? "🔺" : "👾"}</span>
                            <span class="enemy-info"><strong>${enemy.name}</strong><small>⚔️ ${enemy.attack} Attack</small><small>⭐ ${enemy.xp} XP · 💰 ${enemy.gold} Gold</small></span>
                            <span class="fight-label">Fight</span>
                        </button>`).join("")}
                </div>
                <div class="travel-log-panel"><div class="village-panel-title">⚔️ Battle Log</div><div id="travelBattleLog" class="log"></div></div>
            </div>`;

        document.getElementById("travelBackButton")?.addEventListener("click", () => { if (typeof showVillage === "function") showVillage(); });
        document.getElementById("woodsRouteButton")?.addEventListener("click", () => selectRoute("woods"));
        document.getElementById("ashRouteButton")?.addEventListener("click", () => selectRoute("ash"));
        screen.querySelectorAll(".enemy-choice").forEach(button => button.addEventListener("click", () => fightEnemy(route.enemies[Number(button.dataset.enemyIndex)])));
    }

    function showTravelSelection() {
        if (typeof village !== "undefined" && !village.unlocked) return;
        if (typeof resting !== "undefined" && resting) return;
        const screen = document.getElementById("travelScreen");
        if (!screen) return;
        ["arrivalScene", "forestGame", "villageScreen", "villageWalkScreen", "questScreen", "ashHillsScreen"].forEach(id => document.getElementById(id)?.classList.add("hidden"));
        screen.classList.remove("hidden", "walk-active");
        try { localStorage.setItem("utopiaActiveTab", "village"); } catch (_) {}
        renderRoute();
    }

    window.showTravel = showTravelSelection;
    window.selectTravelRoute = selectRoute;
    window.fightSelectedEnemy = fightEnemy;

    function addTravelStyles() {
        if (document.getElementById("travelSelectionStyles")) return;
        const style = document.createElement("style");
        style.id = "travelSelectionStyles";
        style.textContent = `
            .travel-selection-box { max-width:760px !important; }
            .travel-route-switcher { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:18px 0; }
            .travel-route-switcher button { min-height:52px; border:1px solid rgba(255,255,255,.12); border-radius:14px; background:rgba(0,0,0,.18); color:inherit; font-weight:700; cursor:pointer; }
            .travel-route-switcher button.active { border-color:rgba(255,255,255,.35); background:rgba(255,255,255,.08); }
            .travel-route-switcher button:disabled { opacity:.45; cursor:not-allowed; }
            .travel-player-card { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:18px 0; }
            .travel-player-card div { display:flex; flex-direction:column; gap:4px; padding:11px; border-radius:12px; background:rgba(0,0,0,.16); }
            .travel-player-card span { opacity:.8; }
            .battle-combatants { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:10px; margin:18px 0 12px; }
            .combatant-card { padding:15px; border:1px solid rgba(255,255,255,.14); border-radius:15px; background:rgba(0,0,0,.2); display:flex; flex-direction:column; gap:5px; }
            .combatant-card strong { font-size:1.05rem; }
            .combatant-card small { opacity:.75; }
            .battle-vs { font-weight:900; opacity:.7; }
            .battle-hp-bar { margin:8px 0 18px; }
            .battle-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:16px 0; }
            .battle-actions button { min-height:54px; border:1px solid rgba(255,255,255,.14); border-radius:14px; background:rgba(0,0,0,.2); color:inherit; font-weight:800; cursor:pointer; touch-action:manipulation; }
            .battle-actions button:hover,.battle-actions button:focus-visible { transform:translateY(-1px); border-color:rgba(255,255,255,.35); }
            .enemy-title { font-size:1.15rem; font-weight:800; margin:22px 0 10px; }
            .enemy-selection-grid { display:grid; gap:10px; }
            .enemy-choice { width:100%; display:grid; grid-template-columns:42px 1fr auto; align-items:center; gap:12px; text-align:left; padding:13px; border:1px solid rgba(255,255,255,.1); border-radius:14px; background:rgba(0,0,0,.18); color:inherit; cursor:pointer; }
            .enemy-choice:hover,.enemy-choice:focus-visible { border-color:rgba(255,255,255,.3); transform:translateY(-1px); }
            .enemy-icon { font-size:1.4rem; text-align:center; }
            .enemy-info { display:flex; flex-direction:column; gap:3px; }
            .enemy-info small { opacity:.75; }
            .fight-label { font-weight:800; padding:8px 12px; border-radius:10px; background:rgba(255,255,255,.1); }
            .ash-travel { background:linear-gradient(180deg,rgba(100,12,12,.28),rgba(20,0,0,.12)); }
            .ash-travel .travel-route-switcher button.active { border-color:#d44747; background:rgba(180,30,30,.22); }
            .ash-mission { margin:14px 0; padding:13px; border-radius:13px; background:rgba(160,25,25,.18); border:1px solid rgba(220,70,70,.25); display:flex; flex-direction:column; gap:5px; }
            .ash-mission.complete { border-color:rgba(90,190,110,.3); background:rgba(30,100,45,.15); }
            .travel-log-panel { margin-top:20px; }
            @media (max-width:650px) { .travel-route-switcher,.travel-player-card { grid-template-columns:1fr 1fr; } .enemy-choice { grid-template-columns:34px 1fr; } .fight-label { grid-column:2; justify-self:start; } }
        `;
        document.head.appendChild(style);
    }

    function init() {
        addTravelStyles();
        // Disable the old timer-based walks so they cannot compete with the new system.
        if (typeof village !== "undefined" && village.walk) village.walk.active = false;
        if (typeof paths !== "undefined" && paths.ashHills) paths.ashHills.active = false;
        try { localStorage.removeItem("utopiaWalkActive"); } catch (_) {}
        const oldTravel = document.getElementById("travelButton");
        if (oldTravel) oldTravel.onclick = showTravelSelection;
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
