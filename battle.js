function resolveBattle(enemy) {
    const luckyHit = Math.random() < 0.12;
    const glancingHit = !luckyHit && Math.random() < 0.18;
    const baseDamage = Math.max(0, enemy.attack - player.attack);

    return {
        damageTaken: glancingHit ? Math.max(1, Math.ceil(baseDamage / 2)) : baseDamage,
        defeated: baseDamage <= 0,
        luckyHit,
        glancingHit
    };
}

function startBattle(enemyList) {
    if (!enemyList || enemyList.length === 0 || resting) return;

    const enemy = enemyList[Math.floor(Math.random() * enemyList.length)];
    const result = resolveBattle(enemy);

    if (result.defeated) {
        const xpReward = result.luckyHit ? enemy.xp * 2 : enemy.xp;
        const goldReward = result.luckyHit ? enemy.gold * 2 : enemy.gold;
        addLog(result.luckyHit
            ? `Lucky strike! You defeated ${enemy.name} and found extra loot.`
            : `You defeated ${enemy.name}.`);
        player.gold += goldReward;
        giveXP(xpReward);
    } else {
        player.hp -= result.damageTaken;
        addLog(result.glancingHit
            ? `${enemy.name} hit you, but you only took ${result.damageTaken} damage.`
            : `${enemy.name} attacked you for ${result.damageTaken} damage.`);

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
    if (!paths.ashHills.active || paths.ashHills.completed || resting) return;

    startBattle(ashEnemies);
    updateAshHillsUI();
}
