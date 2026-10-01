/* UTOPIA MAIN NAVIGATION
   One simple controller owns the Story, Village, and Walk screens.
   Each tab replaces the previous screen.
*/
(function () {
    "use strict";

    const SCREEN_IDS = [
        "forestGame",
        "storyScreen",
        "villageScreen",
        "travelScreen",
        "villageWalkScreen",
        "questScreen",
        "arrivalScene",
        "ashHillsScreen"
    ];

    const $ = id => document.getElementById(id);

    function isWalking() {
        return typeof window.villageWalkIsActive === "function"
            ? window.villageWalkIsActive()
            : false;
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
        const village = $("villageMainTab");
        const walk = $("walkMainTab");
        const walkVisible = isWalking();

        story?.classList.toggle("active", active === "story");
        village?.classList.toggle("active", active === "village");
        story?.setAttribute("aria-selected", String(active === "story"));
        village?.setAttribute("aria-selected", String(active === "village"));

        if (walk) {
            walk.classList.toggle("hidden", !walkVisible);
            walk.style.display = walkVisible ? "" : "none";
            walk.classList.toggle("active", active === "walk");
            walk.setAttribute("aria-selected", String(active === "walk"));
        }
    }

    function showScreen(id, tab) {
        const screen = $(id);
        if (!screen) return;

        hideAllScreens();
        screen.classList.remove("hidden");

        if (tab === "village" && isWalking()) {
            screen.classList.add("walk-view-only");
        }

        if (tab === "walk") {
            screen.classList.add("walk-active");
        }

        updateTabButtons(tab);

        try {
            localStorage.setItem("utopiaActiveTab", tab);
        } catch (_) {}
    }

    function showStory() {
        showScreen("storyScreen", "story");
    }

    function showVillage() {
        showScreen("villageScreen", "village");
        if (typeof updateVillageUI === "function") updateVillageUI();
    }

function showTravel() {
        if (typeof village !== "undefined" && !village.unlocked) return;
        showScreen("travelScreen", "village");
        if (typeof updateVillageUI === "function") updateVillageUI();
    }

    function showWalk() {
        if (!isWalking()) return;
        showScreen("villageWalkScreen", "walk");
        if (typeof updateVillageWalkUI === "function") updateVillageWalkUI();
    }

    function showQuests() {
        showScreen("questScreen", "village");
        if (typeof updateQuests === "function") updateQuests();
    }

    function connectTabs() {
        const story = $("storyMainTab");
        const village = $("villageMainTab");
        const walk = $("walkMainTab");
        const travel = $("travelButton");
        const travelBack = $("travelBackButton");

        if (story) {
            story.onclick = function (event) {
                event.preventDefault();
                showStory();
            };
        }

        if (travel) {
            travel.onclick = function (event) {
                event.preventDefault();
                showTravel();
            };
        }

        if (travelBack) {
            travelBack.onclick = function (event) {
                event.preventDefault();
                showVillage();
            };
        }

        if (village) {
            village.onclick = function (event) {
                event.preventDefault();
                showVillage();
            };
        }

        if (walk) {
            walk.onclick = function (event) {
                event.preventDefault();
                showWalk();
            };
        }

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
            .health-xp { gap: 18px !important; }
            .travel-options {
                display: flex;
                flex-direction: column;
                gap: 14px;
                margin-top: 16px;
            }
            .travel-screen {
                min-height: 100vh;
                padding: 28px 18px 40px;
            }
            .travel-screen-box {
                width: min(900px, 100%);
                margin: 0 auto;
                padding: 28px;
                border-radius: 20px;
                background: rgba(0,0,0,.18);
            }
            .travel-screen-box h1 {
                margin: 8px 0 6px;
            }
            .travel-screen-subtitle {
                margin: 0 0 24px;
                opacity: .82;
            }
            .travel-back-button {
                margin-bottom: 18px;
            }
            .travel-screen .travel-options {
                margin-top: 0;
            }
            .travel-option {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 18px;
                padding: 16px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 14px;
                background: rgba(0,0,0,.16);
            }
            .travel-option-info {
                display: flex;
                flex-direction: column;
                gap: 7px;
                min-width: 0;
            }
            .travel-option-info strong { font-size: 1.05rem; }
            .travel-option-info span, .travel-option-info small { line-height: 1.45; }
            .travel-option button { flex-shrink: 0; }
            @media (max-width: 700px) {
                .travel-option {
                    flex-direction: column;
                    align-items: stretch;
                }
                .travel-option button { width: 100%; }
            }
            @media (max-width: 700px) {
                #mainTabs { gap: 7px !important; }
                #mainTabs .main-tab { padding: 9px 11px !important; }
                .village-content { gap: 18px !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function init() {
        connectTabs();
        addSpacing();

        let savedTab = "village";

        try {
            savedTab = localStorage.getItem("utopiaActiveTab") || "village";
        } catch (_) {}

        // Restore the screen that was open when the game was closed.
        if (savedTab === "walk" && isWalking()) {
            showWalk();
        } else if (savedTab === "story") {
            showStory();
        } else if (savedTab === "travel") {
            showTravel();
        } else {
            showVillage();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
