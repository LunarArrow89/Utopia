function resolveBattle(enemy) {
    const playerPower = player.attack + Math.floor(Math.random() * 6);
    const enemyPower = enemy.attack;

    if (playerPower >= enemyPower) {
        return {
            won: true,
            damageTaken: 0
        };
    }

    return {
        won: false,
        damageTaken: enemyPower - playerPower
    };
}

function startBattle(enemyList) {
    if (!enemyList || enemyList.length === 0) return;

    const enemy = enemyList[Math.floor(Math.random() * enemyList.length)];
    const result = resolveBattle(enemy);

    if (result.won) {
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
