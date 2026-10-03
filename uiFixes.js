/* UTOPIA MAIN NAVIGATION
   One simple controller owns the Story, Village, and Walk screens.
   Each tab replaces the previous screen.
*/
(function () {
    "use strict";

    const SCREEN_IDS = [
        "forestGame", "storyScreen", "villageScreen", "travelScreen",
        "villageWalkScreen", "questScreen", "arrivalScene", "ashHillsScreen"
    ];

    const $ = id => document.getElementById(id);

    function isWalking() {
        const villageWalking = typeof village !== "undefined" && village.walk && village.walk.active === true;
        const savedWalking = localStorage.getItem("utopiaWalkActive") === "true";
        const ashWalking = typeof paths !== "undefined" && paths.ashHills?.active === true;
        return !!(villageWalking || savedWalking || ashWalking);
    }

    function hideAllScreens() {
        SCREEN_IDS.forEach(id => {
            const screen = $(id);
            if (!screen) return;
            screen.classList.add("hidden");
            screen.classList.remove("walk-active", "walk-view-only");
        });
    }

    function updateTabButtons(active) {
        const bar = $("mainTabs");
        if (!bar) return;
        bar.classList.remove("hidden");

        const story = $("storyMainTab");
        const villageButton = $("villageMainTab");
        const walk = $("walkMainTab");
        const walking = isWalking();

        story?.classList.toggle("active", active === "story");
        villageButton?.classList.toggle("active", active === "village");
        story?.setAttribute("aria-selected", String(active === "story"));
        villageButton?.setAttribute("aria-selected", String(active === "village"));

        if (walk) {
            walk.classList.remove("hidden");
            walk.style.display = walking ? "" : "none";
            walk.classList.toggle("active", active === "walk");
            walk.setAttribute("aria-selected", String(active === "walk"));
        }
    }

    function showScreen(id, tab) {
        const screen = $(id);
        if (!screen) return;
        hideAllScreens();
        screen.classList.remove("hidden");
        if (tab === "village" && isWalking()) screen.classList.add("walk-view-only");
        if (tab === "walk") screen.classList.add("walk-active");
        updateTabButtons(tab);
        try { localStorage.setItem("utopiaActiveTab", tab); } catch (_) {}
    }

    function showStory() { showScreen("storyScreen", "story"); }

    function showVillage() {
        showScreen("villageScreen", "village");
        if (typeof updateVillageUI === "function") updateVillageUI();
    }

    function showTravel() {
        if (typeof village !== "undefined" && !village.unlocked) return;

        // The Travel system owns the inside of the Travel screen.
        // Do not replace its renderer with the main-tab controller.
        if (typeof window.showTravelSelection === "function") {
            window.showTravelSelection();
            updateTabButtons("village");
            return;
        }

        showScreen("travelScreen", "village");
        if (typeof updateVillageUI === "function") updateVillageUI();
    }

    function showWalk() {
        if (!isWalking()) return;
        if (typeof paths !== "undefined" && paths.ashHills?.active) {
            showScreen("ashHillsScreen", "walk");
            if (typeof updateAshHillsUI === "function") updateAshHillsUI();
            return;
        }
        showScreen("villageWalkScreen", "walk");
        if (typeof updateVillageWalkUI === "function") updateVillageWalkUI();
    }

    function showQuests() {
        showScreen("questScreen", "village");
        if (typeof updateQuests === "function") updateQuests();
    }

    function connectTabs() {
        const story = $("storyMainTab");
        const villageButton = $("villageMainTab");
        const walk = $("walkMainTab");
        const travel = $("travelButton");
        const travelBack = $("travelBackButton");
        if (story) story.onclick = e => { e.preventDefault(); showStory(); };
        if (villageButton) villageButton.onclick = e => { e.preventDefault(); showVillage(); };
        if (walk) walk.onclick = e => { e.preventDefault(); showWalk(); };
        if (travel) travel.onclick = e => { e.preventDefault(); showTravel(); };
        if (travelBack) travelBack.onclick = e => { e.preventDefault(); showVillage(); };
        const quest = $("questButton");
        if (quest) quest.onclick = showQuests;
    }

    window.showStoryScreen = showStory;
    window.showVillage = showVillage;
    window.showTravel = showTravel;
    window.showVillageTab = showVillage;
    window.showVillageWalkTab = showWalk;
    window.showQuestScreen = showQuests;
    window.updateMainTabs = updateTabButtons;

    function addSpacing() {
        if ($("utopiaSpacingFixes")) return;
        const style = document.createElement("style");
        style.id = "utopiaSpacingFixes";
        style.textContent = `
            #mainTabs { gap: 12px !important; padding: 10px !important; }
            #mainTabs .main-tab { margin: 0 !important; padding: 10px 16px !important; }
            .village-content { gap: 26px !important; padding-top: 28px !important; }
            .village-header { gap: 28px !important; padding-bottom: 28px !important; }
            .village-header-actions { gap: 14px !important; }
            .village-panel + .village-panel { margin-top: 10px !important; }
            .resource-grid, .building-list { gap: 12px !important; }
            .building-card { gap: 18px !important; padding: 13px !important; }
            .building-actions { display:flex !important; align-items:center !important; justify-content:flex-end !important; gap:8px !important; flex:0 0 auto !important; white-space:nowrap !important; }
            .building-actions span { display:inline-flex !important; align-items:center !important; justify-content:center !important; min-width:54px !important; padding:6px 8px !important; border:1px solid #4a5d47 !important; border-radius:999px !important; background:#172119 !important; color:#aebcaf !important; font-size:10px !important; line-height:1 !important; }
            .building-actions button { flex:0 0 62px !important; width:62px !important; }
            .health-xp { gap:18px !important; }
            .travel-options { display:flex; flex-direction:column; gap:14px; margin-top:16px; }
            .travel-screen { min-height:100vh; padding:28px 18px 40px; }
            .travel-screen-box { width:min(900px,100%); margin:0 auto; padding:28px; border-radius:20px; background:rgba(0,0,0,.18); }
            .travel-screen-box h1 { margin:8px 0 6px; }
            .travel-screen-subtitle { margin:0 0 24px; opacity:.82; }
            .travel-back-button { margin-bottom:18px; }
            .travel-screen .travel-options { margin-top:0; }
            .travel-option { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:16px; border:1px solid rgba(255,255,255,.10); border-radius:14px; background:rgba(0,0,0,.16); }
            .travel-option-info { display:flex; flex-direction:column; gap:7px; min-width:0; }
            .travel-option-info strong { font-size:1.05rem; }
            .travel-option-info span,.travel-option-info small { line-height:1.45; }
            .travel-option button { flex-shrink:0; }
            @media (max-width:700px) { .travel-option { flex-direction:column; align-items:stretch; } .travel-option button { width:100%; } #mainTabs { gap:7px !important; } #mainTabs .main-tab { padding:9px 11px !important; } .village-content { gap:18px !important; } }
        `;
        document.head.appendChild(style);
    }

    /* EXPLORATION EVENTS
       Small, occasional discoveries make endless walks more than a timer.
       They do not run while resting and use the existing gear system. */
    const DISCOVERY_COOLDOWN = 120000;
    const discoveryState = { last: 0 };

    const discoveries = [
        () => ({ text: "You found an abandoned campsite. There is 8 gold left in the ashes.", gold: 8 }),
        () => ({ text: "You found a useful bundle of supplies.", resources: { wood: 2, stone: 2, food: 2 } }),
        () => ({ text: "You discovered a hidden trail. You found 12 gold.", gold: 12 }),
        () => ({ text: "You found a strange old map. It might be useful later." }),
        () => ({ text: "You discovered an old supply crate. You found 3 wood and 3 stone.", resources: { wood: 3, stone: 3 } }),
        () => ({ text: "You found a forgotten weapon case!", gear: true })
    ];

    function logDiscovery(text) {
        if (typeof addVillageWalkLog === "function") addVillageWalkLog("✨ " + text);
        else if (typeof addVillageLog === "function") addVillageLog("✨ " + text);
    }

    function triggerDiscovery() {
        if (typeof resting !== "undefined" && resting) return;
        const now = Date.now();
        if (now - discoveryState.last < DISCOVERY_COOLDOWN) return;
        if (Math.random() > 0.18) return;
        discoveryState.last = now;

        const event = discoveries[Math.floor(Math.random() * discoveries.length)]();
        if (event.gold) player.gold += event.gold;
        if (event.resources && typeof village !== "undefined") {
            Object.entries(event.resources).forEach(([type, amount]) => {
                if (village.resources[type] !== undefined) village.resources[type] += amount;
            });
        }
        if (event.gear && typeof generateItem === "function" && Array.isArray(player.inventory)) {
            const rarity = Math.random() < 0.65 ? "Common" : Math.random() < 0.8 ? "Uncommon" : "Rare";
            const item = generateItem(rarity);
            player.inventory.unshift(item);
            logDiscovery("You found " + item.name + "!");
            if (typeof updateEquipmentUI === "function") updateEquipmentUI();
        } else {
            logDiscovery(event.text);
        }
        if (typeof updateGold === "function") updateGold();
        if (typeof updateVillageUI === "function") updateVillageUI();
        if (typeof updateVillageWalkUI === "function") updateVillageWalkUI();
        if (typeof updateAshHillsUI === "function") updateAshHillsUI();
        if (typeof saveGame === "function") saveGame();
    }

    function hookExploration() {
        if (window.__utopiaExplorationHooked) return;
        window.__utopiaExplorationHooked = true;

        const originalVillageWalk = window.updateVillageWalk;
        if (typeof originalVillageWalk === "function") {
            window.updateVillageWalk = function () {
                const result = originalVillageWalk.apply(this, arguments);
                if (typeof village !== "undefined" && village.walk?.active) triggerDiscovery();
                return result;
            };
        }

        const originalAsh = window.updateAshHills;
        if (typeof originalAsh === "function") {
            window.updateAshHills = function () {
                const result = originalAsh.apply(this, arguments);
                if (typeof paths !== "undefined" && paths.ashHills?.active) triggerDiscovery();
                return result;
            };
        }
    }

    function init() {
        connectTabs();
        addSpacing();
        hookExploration();
        let savedTab = "village";
        try { savedTab = localStorage.getItem("utopiaActiveTab") || "village"; } catch (_) {}
        if (savedTab === "walk" && isWalking()) showWalk();
        else if (savedTab === "story") showStory();
        else if (savedTab === "travel") showTravel();
        else showVillage();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
    else init();
})();
