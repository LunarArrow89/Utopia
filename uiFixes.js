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
        if (typeof gameInitialized !== "undefined" && !gameInitialized) return;
        hideAllMainScreens();
        document.getElementById("storyScreen")?.classList.remove("hidden");
        document.getElementById("villageTabs")?.classList.add("hidden");
        updateMainTabs("story");
    }

    function showVillageMain() {
        if (typeof village === "undefined" || !village.unlocked) return;
        if (typeof showVillageTab === "function") showVillageTab();
        updateMainTabs("village");
    }

    function wireButtons() {
        document.getElementById("storyMainTab")?.addEventListener("click", showStory);
        document.getElementById("villageMainTab")?.addEventListener("click", showVillageMain);

        document.getElementById("restButton")?.addEventListener("click", () => {
            if (typeof startRest === "function") startRest(false);
        });

        document.getElementById("leaveButton")?.addEventListener("click", () => {
            if (typeof leaveRest === "function") leaveRest();
        });

        document.getElementById("arrivalContinue")?.addEventListener("click", () => {
            if (typeof nextArrivalLine === "function") nextArrivalLine();
        });

        document.getElementById("leaveVillageWalkButton")?.addEventListener("click", () => {
            if (typeof leaveVillageWalk === "function") leaveVillageWalk();
        });

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

    document.addEventListener("DOMContentLoaded", () => {
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
