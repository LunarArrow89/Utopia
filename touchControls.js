/* UTOPIA TOUCH CONTROLS
   All game buttons get a real touchend path so phone taps do not depend on
   the browser's delayed synthetic click. One touch produces one action.
*/
(function () {
    "use strict";

    let lastTouchTime = 0;

    function handleTouch(event) {
        const button = event.target && event.target.closest
            ? event.target.closest("button")
            : null;

        if (!button || button.disabled) return;

        // Whispering Woods already has its own touch handler.
        if (button.id === "takeWalkButton") return;

        const now = Date.now();
        if (now - lastTouchTime < 350) {
            event.preventDefault();
            return;
        }
        lastTouchTime = now;

        event.preventDefault();
        event.stopPropagation();

        // The existing onclick/addEventListener("click") code remains the
        // single action implementation. We trigger it from the touch.
        button.click();
    }

    function closeAwaySummary() {
        document.getElementById("awaySummaryOverlay")?.classList.add("hidden");
    }

    function init() {
        document.addEventListener("touchend", handleTouch, { passive: false, capture: true });

        const close = document.getElementById("awaySummaryClose");
        if (close) {
            close.addEventListener("touchend", function (event) {
                event.preventDefault();
                event.stopPropagation();
                closeAwaySummary();
            }, { passive: false });
        }

        document.querySelectorAll("button").forEach(button => {
            button.style.touchAction = "manipulation";
            button.style.webkitTapHighlightColor = "transparent";
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
