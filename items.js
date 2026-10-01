const ITEM_RARITIES = ["Common", "Uncommon", "Rare", "Epic"];
const ITEM_BONUSES = [
    { name: "Health", stat: "maxHp", amount: 10, text: "+10 Max HP" },
    { name: "Strength", stat: "attack", amount: 2, text: "+2 Attack" }
];
const ITEM_TYPES = ["Rags", "Shirt", "Sweater", "Boots"];
const ITEM_DESCRIPTORS = ["Cool", "Funny", "Dumb"];
const LOOT_BOX_COSTS = { Common: 25, Uncommon: 75, Rare: 200, Epic: 500 };

// Random-stat ranges get stronger with rarity.
const RANDOM_STAT_RANGES = {
    Common: { attack: [1, 2], maxHp: [5, 10] },
    Uncommon: { attack: [2, 4], maxHp: [10, 20] },
    Rare: { attack: [4, 7], maxHp: [20, 35] },
    Epic: { attack: [7, 12], maxHp: [35, 55] }
};

function ensureGearState() {
    if (!Array.isArray(player.inventory)) player.inventory = [];
    if (!Object.prototype.hasOwnProperty.call(player, "equipped")) player.equipped = null;
    if (!Number.isFinite(Number(player.equipmentAttackBonus))) player.equipmentAttackBonus = 0;
    if (!Number.isFinite(Number(player.equipmentMaxHpBonus))) player.equipmentMaxHpBonus = 0;
}

function randomItemPart(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomStat(rarity) {
    const ranges = RANDOM_STAT_RANGES[rarity];
    const stat = Math.random() < 0.5 ? "attack" : "maxHp";
    const amount = randomInt(ranges[stat][0], ranges[stat][1]);

    return {
        stat,
        amount,
        text: stat === "attack" ? "+" + amount + " Attack" : "+" + amount + " Max HP"
    };
}

function generateItem(rarity) {
    ensureGearState();
    const chosenRarity = rarity || randomItemPart(ITEM_RARITIES);
    const descriptor = randomItemPart(ITEM_DESCRIPTORS);
    const type = randomItemPart(ITEM_TYPES);

    // Half the items use the original named bonus system.
    // The other half get a completely random stat whose power depends on rarity.
    const hasBonusWord = Math.random() < 0.5;
    const bonus = hasBonusWord ? randomItemPart(ITEM_BONUSES) : null;
    const randomStat = hasBonusWord ? null : generateRandomStat(chosenRarity);
    const stat = bonus || randomStat;

    return {
        id: "item-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        rarity: chosenRarity,
        descriptor,
        type,
        bonus: bonus ? { ...bonus } : null,
        randomStat: randomStat ? { ...randomStat } : null,
        stat: stat ? { ...stat } : null,
        name: "(" + chosenRarity + ") " + descriptor + " " + type + (bonus ? " of " + bonus.name : "")
    };
}

function getEquippedBonuses() {
    ensureGearState();
    const item = player.equipped;
    const stat = item && (item.stat || item.bonus || item.randomStat);
    return {
        attack: stat && stat.stat === "attack" ? Number(stat.amount) : 0,
        maxHp: stat && stat.stat === "maxHp" ? Number(stat.amount) : 0
    };
}

function applyEquippedStats() {
    ensureGearState();
    const next = getEquippedBonuses();
    const oldAttack = Number(player.equipmentAttackBonus || 0);
    const oldHp = Number(player.equipmentMaxHpBonus || 0);

    player.attack += next.attack - oldAttack;
    player.maxHp += next.maxHp - oldHp;
    if (next.maxHp > oldHp) player.hp += next.maxHp - oldHp;
    player.hp = Math.min(player.hp, player.maxHp);
    player.equipmentAttackBonus = next.attack;
    player.equipmentMaxHpBonus = next.maxHp;
}

function equipItem(itemId) {
    ensureGearState();
    const item = player.inventory.find(entry => entry.id === itemId);
    if (!item) return;

    player.equipped = item;
    applyEquippedStats();
    updateHP();
    if (typeof updateVillageUI === "function") updateVillageUI();
    if (typeof updateVillageWalkUI === "function") updateVillageWalkUI();
    if (typeof updateAshHillsUI === "function") updateAshHillsUI();
    if (typeof addVillageLog === "function") addVillageLog("Equipped " + item.name + ".");
    updateEquipmentUI();
    saveGame();
}

function buyLootBox(rarity) {
    ensureGearState();
    const cost = LOOT_BOX_COSTS[rarity];
    if (!cost) return;

    if (player.gold < cost) {
        if (typeof addVillageLog === "function") addVillageLog("You don't have enough gold for the " + rarity.toLowerCase() + " loot box.");
        return;
    }

    player.gold -= cost;
    const item = generateItem(rarity);
    player.inventory.unshift(item);

    if (typeof addVillageLog === "function") addVillageLog("You opened a " + rarity + " loot box and found " + item.name + "!");
    updateGold();
    updateEquipmentUI();
    saveGame();
}

function updateEquipmentUI() {
    ensureGearState();

    const inventory = document.getElementById("inventoryList");
    if (!inventory) return;

    const equipped = document.getElementById("equippedItemText");
    const stats = document.getElementById("equipmentBonusText");

    if (equipped) equipped.textContent = player.equipped ? player.equipped.name : "Nothing equipped";

    if (stats) {
        const bonus = getEquippedBonuses();
        const parts = [];
        if (bonus.maxHp) parts.push("+" + bonus.maxHp + " Max HP");
        if (bonus.attack) parts.push("+" + bonus.attack + " Attack");
        stats.textContent = parts.length ? parts.join(" · ") : "No bonus";
    }

    inventory.innerHTML = "";

    if (!player.inventory.length) {
        inventory.innerHTML = '<div class="empty-inventory">No gear yet. Buy a loot box!</div>';
        return;
    }

    player.inventory.forEach(item => {
        const card = document.createElement("div");
        card.className = "item-card";
        const stat = item.stat || item.bonus || item.randomStat;
        const statText = stat ? stat.text : "No stat bonus";
        const equippedNow = player.equipped && player.equipped.id === item.id;

        card.innerHTML = '<div class="item-info"><strong class="item-rarity-' + item.rarity.toLowerCase() + '">' + item.name + '</strong><span>' + statText + '</span></div><button type="button" ' + (equippedNow ? "disabled" : "") + '>' + (equippedNow ? "Equipped" : "Equip") + '</button>';
        card.querySelector("button").addEventListener("click", () => equipItem(item.id));
        inventory.appendChild(card);
    });
}

function resetItems() {
    ensureGearState();
    player.inventory = [];
    player.equipped = null;
    player.equipmentAttackBonus = 0;
    player.equipmentMaxHpBonus = 0;
}

ensureGearState();
window.generateItem = generateItem;
window.buyLootBox = buyLootBox;
window.equipItem = equipItem;
window.updateEquipmentUI = updateEquipmentUI;
window.resetItems = resetItems;
