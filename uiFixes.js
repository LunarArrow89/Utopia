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
        const walkRunning = typeof window.villageWalkIsActive === "function"
            ? window.villageWalkIsActive()
            : !!window.village?.walk?.active;

        story?.classList.toggle("active", active === "story");
        village?.classList.toggle("active", active === "village");
        story?.setAttribute("aria-selected", active === "story" ? "true" : "false");
        village?.setAttribute("aria-selected", active === "village" ? "true" : "false");

        const walkActive = active === "walk";
        walk?.classList.toggle("active", walkActive);
        walk?.classList.toggle("hidden", !walkRunning && !walkActive);
        walk?.setAttribute("aria-selected", walkActive ? "true" : "false");

        if (village) {
            village.disabled = false;
            village.setAttribute("aria-disabled", "false");
        }
    }

    function hideScreens() {
        ["forestGame", "storyScreen", "villageScreen", "villageWalkScreen", "questScreen", "villageTabs", "arrivalScene", "ashHillsScreen"].forEach(id => {
            const screen = document.getElementById(id);
            if (screen) {
                screen.classList.remove("walk-active");
                screen.classList.add("hidden");
                screen.style.display = "none";
            }
        });
    }

    function showStory() {
        const story = document.getElementById("storyScreen");
        if (!story || (typeof gameInitialized !== "undefined" && !gameInitialized)) return;
        hideScreens();
        story.classList.remove("hidden");
        story.style.display = "block";
        updateMainTabs("story");
        localStorage.setItem(TAB_KEY, "story");
        if (window.village?.walk?.active) story.querySelectorAll("button").forEach(button => button.disabled = true);
    }

    function showVillageMain() {
        if (typeof village !== "undefined" && !village.unlocked) return;
        const screen = document.getElementById("villageScreen");
        if (!screen) return;
        hideScreens();
        screen.classList.remove("hidden");
        screen.style.display = "block";
        if (window.village?.walk?.active) screen.classList.add("walk-view-only");
        else screen.classList.remove("walk-view-only");
        updateMainTabs("village");
        localStorage.setItem(TAB_KEY, "village");
        if (typeof updateVillageUI === "function") updateVillageUI();
        if (typeof updateQuests === "function") updateQuests();
    }

    function showWalkMain() {
        if (!window.village?.walk?.active) return;
        hideScreens();
        const walk = document.getElementById("villageWalkScreen");
        if (!walk) return;
        walk.classList.remove("hidden");
        walk.classList.add("walk-active");
        walk.style.display = "block";
        const walkTab = document.getElementById("walkMainTab");
        if (walkTab) {
            walkTab.classList.remove("hidden");
            walkTab.style.display = "";
            walkTab.setAttribute("aria-hidden", "false");
        }
        updateMainTabs("walk");
        localStorage.setItem(TAB_KEY, "walk");
        if (typeof updateVillageWalkUI === "function") updateVillageWalkUI();
    }

    function showQuestMain() {
        if (typeof village === "undefined" || !village.unlocked || village.walk.active) return;

        const quest = document.getElementById("questScreen");
        if (!quest) return;

        hideScreens();
        quest.classList.remove("hidden");
        quest.classList.remove("walk-active");
        quest.style.display = "block";
        quest.style.removeProperty("z-index");

        document.getElementById("mainTabs")?.classList.add("hidden");
        document.getElementById("villageTabs")?.classList.add("hidden");

        if (typeof updateQuests === "function") updateQuests();
    }

    function restoreMainTab() {
        if (typeof gameInitialized !== "undefined" && !gameInitialized) return;
        if (typeof awakeningSeen !== "undefined" && !awakeningSeen) return;
        if (typeof village !== "undefined" && !village.unlocked) return;
        const saved = localStorage.getItem(TAB_KEY);
        if (saved === "story") showStory();
        else if (saved === "walk" && window.village?.walk?.active) showWalkMain();
        else showVillageMain();
    }

    function keepWalkTabVisible() {
        if (!window.village?.walk?.active) return;
        const tab = document.getElementById("walkMainTab");
        if (!tab) return;
        tab.classList.remove("hidden");
        tab.style.display = "";
        tab.setAttribute("aria-hidden", "false");
    }

    function wireButtons() {
        if (window.__utopiaNavigationWired) return;
        window.__utopiaNavigationWired = true;

        document.addEventListener("click", event => {
            const target = event.target.closest?.("button");
            if (!target) return;

            if (target.id === "storyMainTab") {
                event.preventDefault(); event.stopImmediatePropagation(); showStory(); return;
            }
            if (target.id === "villageMainTab") {
                event.preventDefault(); event.stopImmediatePropagation(); showVillageMain(); return;
            }
            if (target.id === "walkMainTab") {
                event.preventDefault(); event.stopImmediatePropagation(); showWalkMain(); return;
            }
            if (target.id === "leaveVillageWalkButton") {
                event.preventDefault(); event.stopImmediatePropagation();
                if (typeof window.leaveVillageWalk === "function") window.leaveVillageWalk();
                return;
            }
            if (target.getAttribute("onclick")?.includes("showQuestScreen")) {
                event.preventDefault(); event.stopImmediatePropagation(); showQuestMain(); return;
            }
        }, true);
    }

    function finishLoginBootstrap() {
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
    window.__utopiaWalkTab = showWalkMain;
    window.__utopiaQuestScreen = showQuestMain;
    window.updateMainTabs = updateMainTabs;

    document.addEventListener("DOMContentLoaded", () => {
        wireButtons();
        setInterval(keepWalkTabVisible, 500);
        let attempts = 0;
        const authTimer = setInterval(() => {
            attempts++;
            if (finishLoginBootstrap() || attempts >= 40) clearInterval(authTimer);
        }, 250);
    });
})();