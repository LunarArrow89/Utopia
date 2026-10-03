let ashHillsCutsceneSeen = false;

function showAshHillsCutscene() {
    gameEnded = true;
    ashHillsCutsceneSeen = false;

    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("villageScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    document.getElementById("questScreen")?.classList.add("hidden");
    document.getElementById("storyScreen")?.classList.add("hidden");
    document.getElementById("mainTabs")?.classList.add("hidden");

    const scene = document.getElementById("ashHillsCutscene");
    if (!scene) {
        finishAshHillsCutscene();
        return;
    }

    scene.classList.remove("hidden");
    scene.setAttribute("aria-hidden", "false");
}

function finishAshHillsCutscene() {
    ashHillsCutsceneSeen = true;
    document.getElementById("ashHillsCutscene")?.classList.add("hidden");
    document.getElementById("ashHillsCutscene")?.setAttribute("aria-hidden", "true");

    gameEnded = true;
    currentPath = "village";

    if (village.unlocked) {
        showVillage();
        addVillageLog("The rescued civilian has safely returned to Oakshade Village.");
    }

    saveGame();
    refreshGameUI();
}

// Load the simpler enemy-selection travel system after the main game scripts.
(function loadTravelSystem() {
    function load() {
        if (document.querySelector('script[data-utopia-travel-system]')) return;
        const script = document.createElement("script");
        script.src = "./travelSystem.js?v=1";
        script.dataset.utopiaTravelSystem = "true";
        document.body.appendChild(script);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", load, { once: true });
    } else {
        load();
    }
})();
