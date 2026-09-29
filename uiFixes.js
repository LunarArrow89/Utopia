/* Utopia UI reliability fixes */
(function () {
    "use strict";

    function updateMainTabs(active) {
        const tabs = document.getElementById("mainTabs");
        if (!tabs) return;
        tabs.classList.remove("hidden");
        const story = document.getElementById("storyMainTab");
        const village = document.getElementById("villageMainTab");
        if (story) {
            story.classList.toggle("active", active === "story");
            story.setAttribute("aria-selected", active === "story" ? "true" : "false");
        }
        if (village) {
            village.classList.toggle("active", active === "village");
            village.setAttribute("aria-selected", active === "village" ? "true" : "false");
        }
    }

    function hideAllMainScreens() {
        document.getElementById("forestGame")?.classList.add("hidden");
        document.getElementById("storyScreen")?.classList.add("hidden");
        document.getElementById("villageScreen")?.classList.add("hidden");
        document.getElementById("villageWalkScreen")?.classList.add("hidden");
        document.getElementById("questScreen")?.classList.add("hidden");
        document.getElementById("villageTabs")?.classList.add("hidden");
        document.getElementById("arrivalScene")?.classList.add("hidden");
        document.getElementById("ashHillsScreen")?.classList.add("hidden");
    }

    function showMainForest() {
        hideAllMainScreens();
        document.getElementById("forestGame")?.classList.remove("hidden");
        updateMainTabs("village");
        if (typeof refreshGameUI === "function") refreshGameUI();
        if (typeof updateForest === "function") updateForest();
    }

    function showStory() {
        const story = document.getElementById("storyScreen");
        const villageScreen = document.getElementById("villageScreen");
        if (!story) return;

        hideAllMainScreens();
        villageScreen?.classList.add("hidden");
        story.classList.remove("hidden");

        // Story and Village are two screens in the exact same spot.
        story.style.display = "block";
        if (villageScreen) villageScreen.style.display = "none";

        document.getElementById("villageTabs")?.classList.add("hidden");
        updateMainTabs("story");
    }

    function showVillageMain() {
        // Main Village tab must always be able to return from Story.
        if (typeof village !== "undefined" && !village.unlocked) return;

        hideAllMainScreens();

        const villageScreen = document.getElementById("villageScreen");
        if (!villageScreen) return;

        const storyScreen = document.getElementById("storyScreen");

        villageScreen.classList.remove("hidden");
        villageScreen.style.display = "block";
        storyScreen?.classList.add("hidden");
        if (storyScreen) storyScreen.style.display = "none";
        document.getElementById("mainTabs")?.classList.remove("hidden");

        updateMainTabs("village");

        if (typeof updateVillageUI === "function") updateVillageUI();
        if (typeof updateQuests === "function") updateQuests();
    }

    function wireButtons() {
        // Use one delegated click handler for navigation. This survives
        // screen redraws and prevents duplicate listeners from breaking tabs.
        if (window.__utopiaNavigationWired) return;
        window.__utopiaNavigationWired = true;

        document.addEventListener("click", (event) => {
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
                showVillageMain();
                return;
            }

            if (target.id === "villageTabButton") {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (typeof showVillageTab === "function") showVillageTab();
                return;
            }

            if (target.id === "walkTabButton") {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (typeof showVillageWalkTab === "function") showVillageWalkTab();
                return;
            }

            if (target.id === "leaveVillageWalkButton") {
                event.preventDefault();
                event.stopPropagation();
                if (typeof leaveVillageWalk === "function") leaveVillageWalk();
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
        } else {
            document.getElementById("mainTabs")?.classList.add("hidden");
        }

        return true;
    }

    window.__utopiaStoryTab = showStory;
    window.__utopiaVillageTab = showVillageMain;

    document.addEventListener("DOMContentLoaded", () => {
        const storyTab = document.getElementById("storyMainTab");
        const villageTab = document.getElementById("villageMainTab");

        if (storyTab) storyTab.onclick = (event) => {
            event.preventDefault();
            showStory();
        };

        if (villageTab) villageTab.onclick = (event) => {
            event.preventDefault();
            showVillageMain();
        };

        wireButtons();

        // Do not show navigation until initializeGame() has restored the
        // account save and decided whether the Awakening should be shown.

        // Wait for initializeGame() to finish restoring the save before
        // touching any game screen.
        let attempts = 0;
        const authTimer = setInterval(() => {
            attempts++;
            if (finishLoginBootstrap() || attempts >= 40) {
                clearInterval(authTimer);
            }
        }, 250);
    });
})();
