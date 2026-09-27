function startBattle(enemyList) {
    if (!enemyList || enemyList.length === 0) return;

    const enemy = enemyList[Math.floor(Math.random() * enemyList.length)];
    const damageTaken = Math.max(0, enemy.attack - player.attack);

    if (damageTaken <= 0) {
        addLog(`You defeated ${enemy.name}.`);
        player.gold += enemy.gold;
        giveXP(enemy.xp);
    } else {
        player.hp -= damageTaken;
        addLog(`${enemy.name} attacked you for ${damageTaken} damage.`);

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
