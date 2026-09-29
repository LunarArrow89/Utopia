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

        document.getElementById("takeWalkButton")?.addEventListener("click", () => {
            if (typeof showVillageWalkTab === "function") showVillageWalkTab(true);
        });

        document.getElementById("leaveVillageWalkButton")?.addEventListener("click", () => {
            if (typeof leaveVillageWalk === "function") leaveVillageWalk();
        });

        document.getElementById("villageTabButton")?.addEventListener("click", () => {
            if (typeof showVillageTab === "function") showVillageTab();
            updateMainTabs("village");
        });

        document.getElementById("walkTabButton")?.addEventListener("click", () => {
            if (typeof showVillageWalkTab === "function") showVillageWalkTab();
            updateMainTabs("village");
        });

        document.getElementById("accountButton")?.addEventListener("click", () => {
            if (typeof showAccountScreen === "function") showAccountScreen();
        });

        document.getElementById("accountButtonVillage")?.addEventListener("click", () => {
            if (typeof showAccountScreen === "function") showAccountScreen();
        });

        document.getElementById("resetButton")?.addEventListener("click", () => {
            if (typeof resetGame === "function") resetGame();
        });

        document.getElementById("villageResetButton")?.addEventListener("click", () => {
            if (typeof resetGame === "function") resetGame();
        });
    }

    function finishLoginBootstrap() {
        if (typeof currentSupabaseUser === "undefined" || !currentSupabaseUser) return false;
        if (typeof gameInitialized !== "undefined" && gameInitialized) return true;

        if (typeof gameInitialized !== "undefined") gameInitialized = true;

        document.getElementById("accountScreen")?.classList.remove("login-required");
        document.getElementById("accountScreen")?.classList.add("hidden");
        document.getElementById("mainTabs")?.classList.remove("hidden");

        if (typeof awakeningSeen !== "undefined" && !awakeningSeen) {
            if (typeof showAwakening === "function") showAwakening();
        } else if (typeof village !== "undefined" && village.unlocked && paths?.forest?.completed) {
            if (typeof showVillage === "function") showVillage();
        } else {
            showMainForest();
        }

        if (typeof refreshGameUI === "function") refreshGameUI();
        return true;
    }

    document.addEventListener("DOMContentLoaded", () => {
        wireButtons();

        const mainTabs = document.getElementById("mainTabs");
        if (mainTabs) mainTabs.classList.remove("hidden");

        // Auth restoration can finish after the initial game bootstrap.
        // Keep checking briefly so a valid session never leaves the login
        // overlay permanently stuck on screen.
        let attempts = 0;
        const authTimer = setInterval(() => {
            attempts++;
            if (finishLoginBootstrap() || attempts >= 40) {
                clearInterval(authTimer);
            }
        }, 250);
    });
})();
