function resolveBattle(enemy) {
    const damageTaken = Math.max(0, enemy.attack - player.attack);

    return {
        damageTaken,
        defeated: damageTaken <= 0
    };
}

function startBattle(enemyList) {
    if (!enemyList || enemyList.length === 0) return;

    const enemy = enemyList[Math.floor(Math.random() * enemyList.length)];
    const result = resolveBattle(enemy);

    if (result.defeated) {
        addLog(`You defeated ${enemy.name}.`);
        player.gold += enemy.gold;
        giveXP(enemy.xp);
    } else {
        player.hp -= result.damageTaken;
        addLog(`${enemy.name} attacked you for ${result.damageTaken} damage.`);

        if (player.hp <= 0) {
            player.hp = 0;
            addLog(`${enemy.name} defeated you.`);
            startRest(true);

            const villageWalkLog = document.getElementById("villageWalkLog");
            if (villageWalkLog) {
                const entry = document.createElement("div");
                entry.className = "log-entry";
                entry.textContent = "You were defeated. Forced rest: 20 minutes.";
                villageWalkLog.appendChild(entry);
                villageWalkLog.scrollTop = villageWalkLog.scrollHeight;
            }

            const ashHillsLog = document.getElementById("ashHillsLog");
            if (ashHillsLog) addAshHillsLog("You were defeated. Forced rest: 20 minutes.");
        }
    }

    updateHP();
    updateGold();
}

function addAshHillsLog(message) {
    const log = document.getElementById("ashHillsLog");
    if (!log) return;

    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.textContent = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    while (log.children.length > 20) {
        log.firstElementChild.remove();
    }
}

function startAshBattle() {
    if (!paths.ashHills.active || paths.ashHills.completed) return;

    startBattle(ashEnemies);
    updateAshHillsUI();
}
