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
