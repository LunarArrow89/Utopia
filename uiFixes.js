/* Simple Utopia tab navigation */
(function () {
    "use strict";

    const TAB_KEY = "utopiaActiveTab";

    function walking() {
        return typeof window.villageWalkIsActive === "function"
            ? window.villageWalkIsActive()
            : !!window.village?.walk?.active;
    }

    function get(id) {
        return document.getElementById(id);
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

        story?.classList.toggle("active", active === "story");
        story?.setAttribute("aria-selected", String(active === "story"));

        village?.classList.toggle("active", active === "village");
        village?.setAttribute("aria-selected", String(active === "village"));

        if (walk) {
            const showWalkTab = walking() || active === "walk";
            walk.classList.toggle("active", active === "walk");
            walk.classList.toggle("hidden", !showWalkTab);
            walk.style.display = showWalkTab ? "" : "none";
            walk.setAttribute("aria-hidden", String(!showWalkTab));
            walk.setAttribute("aria-selected", String(active === "walk"));
        }
    }

    function showStory() {
        const el = get("storyScreen");
        if (!el) return;

        hideAll();
        el.classList.remove("hidden");
        el.style.display = "block";

        updateTabs("story");
        localStorage.setItem(TAB_KEY, "story");
    }

    function showVillage() {
        const el = get("villageScreen");
        if (!el || (window.village && !village.unlocked)) return;

        hideAll();
        el.classList.remove("hidden");
        el.style.display = "block";
        el.classList.toggle("walk-view-only", walking());

        updateTabs("village");
        localStorage.setItem(TAB_KEY, "village");

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
        localStorage.setItem(TAB_KEY, "walk");

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
            event.stopImmediatePropagation();
            showStory();
        } else if (button.id === "villageMainTab") {
            event.preventDefault();
            event.stopImmediatePropagation();
            showVillage();
        } else if (button.id === "walkMainTab") {
            event.preventDefault();
            event.stopImmediatePropagation();
            showWalk();
    }, true);

    window.__utopiaStoryTab = showStory;
    window.__utopiaVillageTab = showVillage;
    window.__utopiaWalkTab = showWalk;
    window.__utopiaQuestScreen = showQuests;
    window.updateMainTabs = updateTabs;

    document.addEventListener("DOMContentLoaded", function () {
        setInterval(function () {
            updateTabs(localStorage.getItem(TAB_KEY) || "village");
        }, 500);
    });
})();
