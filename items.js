const ITEM_RARITIES=["Common","Uncommon","Rare","Epic"];
const ITEM_BONUSES=[{name:"Health",stat:"maxHp",amount:10,text:"+10 Max HP"},{name:"Strength",stat:"attack",amount:2,text:"+2 Attack"}];
const ITEM_TYPES=["Rags","Shirt","Sweater","Gun"];
const ITEM_DESCRIPTORS=["Cool","Funny","Dumb"];
const LOOT_BOX_COSTS={Common:25,Uncommon:75,Rare:200,Epic:500};

const gearState={inventory:[],equipped:null};

function randomItemPart(list){return list[Math.floor(Math.random()*list.length)];}
function generateItem(rarity=randomItemPart(ITEM_RARITIES)){
    const bonus=Math.random()<0.5?randomItemPart(ITEM_BONUSES):null;
    const descriptor=randomItemPart(ITEM_DESCRIPTORS);
    const type=randomItemPart(ITEM_TYPES);
    return {id:"item-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),rarity,descriptor,type,bonus:bonus?{...bonus}:null,name:`(${rarity}) ${descriptor} ${type}${bonus?" of "+bonus.name:""}`};
}
function getEquippedBonuses(){
    const bonus=gearState.equipped?.bonus;
    return {attack:bonus?.stat==="attack"?Number(bonus.amount):0,maxHp:bonus?.stat==="maxHp"?Number(bonus.amount):0};
}
function applyEquippedStats(){
    const next=getEquippedBonuses();
    const oldAttack=Number(player.equipmentAttackBonus||0);
    const oldHp=Number(player.equipmentMaxHpBonus||0);
    player.attack+=next.attack-oldAttack;
    player.maxHp+=next.maxHp-oldHp;
    if(next.maxHp>oldHp) player.hp+=next.maxHp-oldHp;
    player.hp=Math.min(player.hp,player.maxHp);
    player.equipmentAttackBonus=next.attack;
    player.equipmentMaxHpBonus=next.maxHp;
}
function equipItem(itemId){
    const item=gearState.inventory.find(entry=>entry.id===itemId);
    if(!item)return;
    gearState.equipped=item; applyEquippedStats();
    updateHP?.(); updateGold?.(); updateVillageUI?.(); updateVillageWalkUI?.(); updateAshHillsUI?.(); addVillageLog?.("Equipped "+item.name+"."); saveGame();
}
function unequipItem(){
    gearState.equipped=null; applyEquippedStats();
    updateHP?.(); updateVillageUI?.(); updateVillageWalkUI?.(); updateAshHillsUI?.(); addVillageLog?.("You unequipped your gear."); saveGame();
}
function buyLootBox(rarity){
    const cost=LOOT_BOX_COSTS[rarity];
    if(!cost||typeof player==="undefined")return;
    if(player.gold<cost){addVillageLog?.("You don't have enough gold for the "+rarity.toLowerCase()+" loot box.");return;}
    player.gold-=cost;
    const item=generateItem(rarity);
    gearState.inventory.unshift(item);
    addVillageLog?.("You opened a "+rarity+" loot box and found "+item.name+"!");
    updateGold?.(); updateEquipmentUI?.(); saveGame();
}
function updateEquipmentUI(){
    const inventory=document.getElementById("inventoryList");
    const equipped=document.getElementById("equippedItemText");
    const stats=document.getElementById("equipmentBonusText");
    if(!inventory)return;
    if(equipped)equipped.textContent=gearState.equipped?gearState.equipped.name:"Nothing equipped";
    if(stats){const bonus=getEquippedBonuses();const parts=[];if(bonus.maxHp)parts.push("+"+bonus.maxHp+" Max HP");if(bonus.attack)parts.push("+"+bonus.attack+" Attack");stats.textContent=parts.length?parts.join(" · "):"No bonus";}
    inventory.innerHTML="";
    if(!gearState.inventory.length){inventory.innerHTML='<div class="empty-inventory">No gear yet. Buy a loot box!</div>';return;}
    gearState.inventory.forEach(item=>{
        const card=document.createElement("div"); card.className="item-card";
        const bonusText=item.bonus?item.bonus.text:"No stat bonus";
        const equippedNow=gearState.equipped?.id===item.id;
        card.innerHTML=`<div class="item-info"><strong class="item-rarity-${item.rarity.toLowerCase()}">${item.name}</strong><span>${bonusText}</span></div><button type="button" ${equippedNow?"disabled":""}>${equippedNow?"Equipped":"Equip"}</button>`;
        card.querySelector("button")?.addEventListener("click",()=>equipItem(item.id));
        inventory.appendChild(card);
    });
}
function resetItems(){gearState.inventory=[];gearState.equipped=null;player.equipmentAttackBonus=0;player.equipmentMaxHpBonus=0;}
window.generateItem=generateItem;window.buyLootBox=buyLootBox;window.equipItem=equipItem;window.unequipItem=unequipItem;window.updateEquipmentUI=updateEquipmentUI;window.resetItems=resetItems;