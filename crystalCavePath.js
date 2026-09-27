const caveEnemies = [
    { name: "Cave Bat", hp: 20, attack: 11, xp: 14, gold: 6 },
    { name: "Crystal Slime", hp: 25, attack: 14, xp: 20, gold: 9 },
    { name: "Stone Crawler", hp: 30, attack: 16, xp: 24, gold: 11 }
];

registerPath("cave", {
    name: "Crystal Cave",
    progress: 0,
    duration: 420,
    encounterTime: 60,
    completed: false
});
