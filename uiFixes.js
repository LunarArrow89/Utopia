/* Simple Utopia tab navigation */
(function () {
    "use strict";

    const TAB_KEY = "utopiaActiveTab";

    function get(id) {
        return document.getElementById(id);
    }

    function walking() {
        if (typeof window.villageWalkIsActive === "function") {
            return window.villageWalkIsActive();
        }
        return !!window.village?.walk?.active;
    }

    function hideAll() {
        [
            "forestGame",
            "storyScreen",
            "villageScreen",
            "villageWalkScreen",
            "questScreen",
            "arrivalScene",
            "ashHillsScreen"
        ].forEach(id => {
            const el = get(id);
            if (!el) return;
            el.classList.add("hidden");
            el.classList.remove("walk-active");
            el.classList.remove("walk-view-only");
            el.style.display = "none";
        });
    }

    function updateTabs(active) {
        const bar = get("mainTabs");
        if (!bar) return;

        bar.classList.remove("hidden");

        const story = get("storyMainTab");
        const village = get("villageMainTab");
        const walk = get("walkMainTab");
        const showWalk = walking() || active === "walk";

        story?.classList.toggle("active", active === "story");
        story?.setAttribute("aria-selected", String(active === "story"));

        village?.classList.toggle("active", active === "village");
        village?.setAttribute("aria-selected", String(active === "village"));

        if (walk) {
            walk.classList.toggle("active", active === "walk");
            walk.classList.toggle("hidden", !showWalk);
            walk.style.display = showWalk ? "" : "none";
            walk.setAttribute("aria-selected", String(active === "walk"));
        }
    }

    function saveTab(tab) {
        try {
            localStorage.setItem(TAB_KEY, tab);
        } catch (error) {
            console.log("Could not save active tab.", error);
        }
    }

    function showStory() {
        const el = get("storyScreen");
        if (!el) return;

        hideAll();
        el.classList.remove("hidden");
        el.style.display = "block";
        updateTabs("story");
        saveTab("story");
    }

    function showVillage() {
        const el = get("villageScreen");
        if (!el) return;
        if (window.village && !window.village.unlocked) return;

        hideAll();
        el.classList.remove("hidden");
        el.style.display = "block";
        el.classList.toggle("walk-view-only", walking());
        updateTabs("village");
        saveTab("village");

        if (typeof updateVillageUI === "function") {
            updateVillageUI();
        }
    }

    function showWalk() {
        const el = get("villageWalkScreen");
        if (!el || !walking()) return;

        hideAll();
        el.classList.remove("hidden");
        el.classList.add("walk-active");
        el.style.display = "block";
        updateTabs("walk");
        saveTab("walk");

        if (typeof updateVillageWalkUI === "function") {
            updateVillageWalkUI();
        }
    }

    function showQuests() {
        const el = get("questScreen");
        if (!el || walking()) return;

        hideAll();
        el.classList.remove("hidden");
        el.style.display = "flex";

        if (typeof updateQuests === "function") {
            updateQuests();
        }

        updateTabs("village");
    }

    document.addEventListener("click", function (event) {
        const button = event.target.closest?.("button");
        if (!button) return;

        if (button.id === "storyMainTab") {
            event.preventDefault();
            event.stopPropagation();
            showStory();
            return;
        }

        if (button.id === "villageMainTab") {
            event.preventDefault();
            event.stopPropagation();
            showVillage();
            return;
        }

        if (button.id === "walkMainTab") {
            event.preventDefault();
            event.stopPropagation();
            showWalk();
        }
    }, true);

    window.__utopiaStoryTab = showStory;
    window.__utopiaVillageTab = showVillage;
    window.__utopiaWalkTab = showWalk;
    window.__utopiaQuestScreen = showQuests;
    window.updateMainTabs = updateTabs;

    document.addEventListener("DOMContentLoaded", function () {
        const savedTab = localStorage.getItem(TAB_KEY);
        if (savedTab) {
            updateTabs(savedTab);
        }
    });
})();
