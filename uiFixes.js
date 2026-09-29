/* Utopia UI reliability fixes */
(function () {
    "use strict";

    const TAB_KEY = "utopiaActiveTab";

    function updateMainTabs(active) {
        const tabs = document.getElementById("mainTabs");
        if (!tabs) return;

        tabs.classList.remove("hidden");

        const story = document.getElementById("storyMainTab");
        const village = document.getElementById("villageMainTab");
        const walk = document.getElementById("walkMainTab");

        story?.classList.toggle("active", active === "story");
        village?.classList.toggle("active", active === "village");

        story?.setAttribute("aria-selected", active === "story" ? "true" : "false");
        village?.setAttribute("aria-selected", active === "village" ? "true" : "false");
        walk?.classList.toggle("active", active === "walk");
        walk?.classList.toggle("hidden", active !== "walk");
        walk?.setAttribute("aria-selected", active === "walk" ? "true" : "false");
        if (village) {
            village.disabled = false;
            village.setAttribute("aria-disabled", "false");
        }
    }

    function hideScreens() {
        [
            "forestGame",
            "storyScreen",
            "villageScreen",
            "villageWalkScreen",
            "questScreen",
            "villageTabs",
            "arrivalScene",
            "ashHillsScreen"
        ].forEach(id => document.getElementById(id)?.classList.add("hidden"));
    }

    function showStory() {
        const story = document.getElementById("storyScreen");
        if (!story) return;
        if (typeof gameInitialized !== "undefined" && !gameInitialized) return;

        hideScreens();

        const village = document.getElementById("villageScreen");
        story.classList.remove("hidden");
        story.style.display = "block";
        if (village) village.style.display = "none";

        updateMainTabs("story");
        localStorage.setItem(TAB_KEY, "story");
        if (typeof village !== "undefined" && village.walk.active) {
            story.querySelectorAll("button").forEach(button => button.disabled = true);
        }
    }

    function showVillageMain() {
        if (typeof village !== "undefined" && !village.unlocked) return;

        const screen = document.getElementById("villageScreen");
        if (!screen) return;

        hideScreens();

        const story = document.getElementById("storyScreen");
        screen.classList.remove("hidden");
        screen.style.display = "block";
        if (story) {
            story.classList.add("hidden");
            story.style.display = "none";
        }

        updateMainTabs("village");
        localStorage.setItem(TAB_KEY, "village");
        if (typeof village !== "undefined" && village.walk.active) {
            document.getElementById("villageScreen")?.classList.add("walk-view-only");
        }

        if (typeof updateVillageUI === "function") updateVillageUI();
        if (typeof updateQuests === "function") updateQuests();
    }

    function restoreMainTab() {
        if (typeof gameInitialized !== "undefined" && !gameInitialized) return;
        if (typeof awakeningSeen !== "undefined" && !awakeningSeen) return;
        if (typeof village !== "undefined" && !village.unlocked) return;

        const saved = localStorage.getItem(TAB_KEY);
        if (saved === "story") {
            showStory();
        } else if (saved === "walk" && typeof village !== "undefined" && village.walk.active) {
            showVillageWalkTab(false);
        } else {
            showVillageMain();
        }
    }

    function wireButtons() {
        if (window.__utopiaNavigationWired) return;
        window.__utopiaNavigationWired = true;

        document.addEventListener("click", event => {
            const target = event.target.closest?.("button");
            if (!target) return;

            if (target.id === "storyMainTab") {
                event.preventDefault();
                event.stopImmediatePropagation();
                showStory();
                return;
            }

            if (target.id === "villageMainTab") {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (target.disabled) return;
                showVillageMain();
                return;
            }

            if (target.id === "walkMainTab") {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (typeof village !== "undefined" && village.walk.active && typeof showVillageWalkTab === "function") {
                    showVillageWalkTab(false);
                }
                return;
            }

            if (target.id === "restButton") {
                event.preventDefault();
                if (typeof startRest === "function") startRest(false);
                return;
            }

            if (target.id === "leaveButton") {
                event.preventDefault();
                if (typeof leaveRest === "function") leaveRest();
                return;
            }

            if (target.id === "arrivalContinue") {
                event.preventDefault();
                if (typeof nextArrivalLine === "function") nextArrivalLine();
            }
        }, true);
    }

    function finishLoginBootstrap() {
        // initializeGame() is the ONLY place allowed to restore the game.
        // This prevents the auth watcher from showing the first-time
        // awakening before the cloud/local save has finished loading.
        if (typeof gameInitialized === "undefined" || !gameInitialized) return false;

        document.getElementById("accountScreen")?.classList.add("hidden");
        document.getElementById("accountScreen")?.classList.remove("login-required");
        if (awakeningSeen) {
            document.getElementById("mainTabs")?.classList.remove("hidden");
            restoreMainTab();
        } else {
            document.getElementById("mainTabs")?.classList.add("hidden");
        }

        return true;
    }

    window.__utopiaStoryTab = showStory;
    window.__utopiaVillageTab = showVillageMain;

    document.addEventListener("DOMContentLoaded", () => {
        wireButtons();

        let attempts = 0;
        const authTimer = setInterval(() => {
            attempts++;

            if (finishLoginBootstrap() || attempts >= 40) {
                clearInterval(authTimer);
            }
        }, 250);
    });
;
})();
