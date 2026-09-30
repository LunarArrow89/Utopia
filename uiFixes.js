/* UTOPIA UI CONTROLLER
   One system owns the main tabs. Game systems can update their data,
   but they do not fight over which screen is visible.
*/
(function () {
    "use strict";

    const TAB_KEY = "utopiaActiveTab";
    const SCREEN_IDS = [
        "forestGame",
        "storyScreen",
        "villageScreen",
        "villageWalkScreen",
        "questScreen",
        "arrivalScene",
        "ashHillsScreen"
    ];

    const $ = id => document.getElementById(id);

    function isWalking() {
        return !!window.village?.walk?.active;
    }

    function hideScreens() {
        SCREEN_IDS.forEach(id => {
            const screen = $(id);
            if (!screen) return;
            screen.classList.add("hidden");
            screen.classList.remove("walk-active");
        });
    }

    function setActiveTab(tab) {
        const tabs = $("mainTabs");
        if (!tabs) return;

        tabs.classList.remove("hidden");

        const story = $("storyMainTab");
        const village = $("villageMainTab");
        const walk = $("walkMainTab");
        const walkVisible = isWalking();

        story?.classList.toggle("active", tab === "story");
        village?.classList.toggle("active", tab === "village");
        story?.setAttribute("aria-selected", String(tab === "story"));
        village?.setAttribute("aria-selected", String(tab === "village"));

        if (walk) {
            walk.classList.toggle("hidden", !walkVisible);
            walk.style.display = walkVisible ? "" : "none";
            walk.classList.toggle("active", tab === "walk");
            walk.setAttribute("aria-selected", String(tab === "walk"));
        }
    }

    function remember(tab) {
        try { localStorage.setItem(TAB_KEY, tab); } catch (_) {}
    }

    function showStory() {
        if (!window.gameInitialized && !window.village?.unlocked) return;
        hideScreens();
        $("storyScreen")?.classList.remove("hidden");
        setActiveTab("story");
        remember("story");
    }

    function showVillage() {
        if (!window.village?.unlocked) return;
        hideScreens();
        $("villageScreen")?.classList.remove("hidden");
        $("villageScreen")?.classList.toggle("walk-view-only", isWalking());
        setActiveTab("village");
        remember("village");
        if (typeof updateVillageUI === "function") updateVillageUI();
    }

    function showWalk() {
        if (!isWalking()) return;
        hideScreens();
        const screen = $("villageWalkScreen");
        screen?.classList.remove("hidden");
        screen?.classList.add("walk-active");
        setActiveTab("walk");
        remember("walk");
        if (typeof updateVillageWalkUI === "function") updateVillageWalkUI();
    }

    function showQuests() {
        if (!window.village?.unlocked || isWalking()) return;
        hideScreens();
        $("questScreen")?.classList.remove("hidden");
        setActiveTab("village");
        if (typeof updateQuests === "function") updateQuests();
    }

    /* Replace the old competing global screen functions. */
    window.showVillage = showVillage;
    window.showVillageTab = showVillage;
    window.showVillageWalkTab = function (startWalk) {
        if (startWalk && typeof startVillageWalk === "function" && !isWalking()) {
            startVillageWalk();
            return;
        }
        showWalk();
    };
    window.showStoryScreen = showStory;
    window.showQuestScreen = showQuests;

    function connectButtons() {
        const story = $("storyMainTab");
        const village = $("villageMainTab");
        const walk = $("walkMainTab");

        if (story) story.onclick = showStory;
        if (village) village.onclick = showVillage;
        if (walk) walk.onclick = showWalk;

        const questButton = $("questButton");
        if (questButton) questButton.onclick = showQuests;

        const questClose = document.querySelector(".quest-close");
        if (questClose) {
            questClose.onclick = function () {
                if (isWalking()) showWalk();
                else showVillage();
            };
        }
    }

    function addSpacingFixes() {
        if ($("utopiaSpacingFixes")) return;

        const style = document.createElement("style");
        style.id = "utopiaSpacingFixes";
        style.textContent = `
            .main-tabs { gap: 12px !important; }
            .main-tab { padding: 10px 16px !important; }
            .village-header { gap: 28px !important; padding-bottom: 28px !important; }
            .village-header-actions { gap: 14px !important; }
            .village-content { gap: 26px !important; padding-top: 28px !important; }
            .village-player-stats { margin-bottom: 22px !important; gap: 12px !important; }
            .village-panel-title { margin-bottom: 15px !important; }
            .village-panel + .village-panel { margin-top: 8px !important; }
            .resource-grid { gap: 12px !important; }
            .building-list { gap: 12px !important; }
            .building-card { gap: 18px !important; padding: 13px !important; }
            .buttons { gap: 12px !important; margin-top: 13px !important; }
            .section { padding: 16px !important; }
            .health-xp { gap: 18px !important; }

            @media (max-width: 700px) {
                .village-header { gap: 18px !important; }
                .village-content { gap: 18px !important; }
                .main-tabs { gap: 7px !important; }
                .main-tab { padding: 9px 11px !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function init() {
        connectButtons();
        addSpacingFixes();
        if (isWalking()) setActiveTab("walk");
        else if (window.village?.unlocked) setActiveTab("village");
    }

    window.updateMainTabs = setActiveTab;
    window.__utopiaStoryTab = showStory;
    window.__utopiaVillageTab = showVillage;
    window.__utopiaWalkTab = showWalk;
    window.__utopiaQuestScreen = showQuests;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
