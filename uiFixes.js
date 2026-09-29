/* Utopia UI reliability fixes */
(function () {
    "use strict";

    function showMainForest() {
        document.getElementById("storyScreen")?.classList.add("hidden");
        document.getElementById("forestGame")?.classList.remove("hidden");
        document.querySelectorAll(".top-tab").forEach((button, index) => {
            button.classList.toggle("active", index === 0);
            button.setAttribute("aria-selected", index === 0 ? "true" : "false");
        });
        if (typeof refreshGameUI === "function") refreshGameUI();
        if (typeof updateForest === "function") updateForest();
    }

    function showStory() {
        if (typeof gameInitialized !== "undefined" && !gameInitialized) return;
        document.getElementById("forestGame")?.classList.add("hidden");
        document.getElementById("storyScreen")?.classList.remove("hidden");
        document.querySelectorAll(".top-tab").forEach((button, index) => {
            button.classList.toggle("active", index === 1);
            button.setAttribute("aria-selected", index === 1 ? "true" : "false");
        });
    }

    function wireButtons() {
        const forestTab = document.querySelector(".top-tab:nth-child(1)");
        const storyTab = document.querySelector(".top-tab:nth-child(2)");

        forestTab?.addEventListener("click", showMainForest);
        storyTab?.addEventListener("click", showStory);

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
        });

        document.getElementById("walkTabButton")?.addEventListener("click", () => {
            if (typeof showVillageWalkTab === "function") showVillageWalkTab();
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
