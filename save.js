const SAVE_KEY = "whisperingWoodsSave";

const SUPABASE_URL = "https://pfwjljbugjgfbmrtzcid.supabase.co";
const SUPABASE_KEY = "sb_publishable_YkIw0Q-nJNrXF47tPruRYQ_51mBVWuB";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let currentSupabaseUser = null;
let remoteSaveTimer = null;

function getGameSaveData() {
    return {
        player,
        paths,
        currentPath,
        resting,
        gameEnded,
        village
    };
}

function saveGame() {
    // Store the moment this save represents so idle progress can be calculated later.
    const saveData = getGameSaveData();
    saveData.savedAt = Date.now();

    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));

    if (!currentSupabaseUser) return;

    clearTimeout(remoteSaveTimer);
    remoteSaveTimer = setTimeout(() => {
        saveRemoteGame(saveData);
    }, 1000);
}

async function saveRemoteGame(saveData = getGameSaveData()) {
    if (!currentSupabaseUser) return;

    try {
        const { data: existing, error: findError } = await supabaseClient
            .from("game_saves")
            .select("id")
            .eq("user_id", currentSupabaseUser.id)
            .maybeSingle();

        if (findError) throw findError;

        if (existing) {
            const { error } = await supabaseClient
                .from("game_saves")
                .update({
                    save_data: saveData,
                    updated_at: new Date().toISOString()
                })
                .eq("id", existing.id);

            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from("game_saves")
                .insert({
                    user_id: currentSupabaseUser.id,
                    save_data: saveData
                });

            if (error) throw error;
        }
    } catch (error) {
        console.error("Cloud save failed:", error);
        setAccountStatus("Cloud save failed. Your local save is still safe.");
    }
}

async function loadRemoteGame() {
    if (!currentSupabaseUser) return false;

    try {
        const { data, error } = await supabaseClient
            .from("game_saves")
            .select("save_data")
            .eq("user_id", currentSupabaseUser.id)
            .maybeSingle();

        if (error) throw error;
        if (!data || !data.save_data) return false;

        applySaveData(data.save_data);
        localStorage.setItem(SAVE_KEY, JSON.stringify(data.save_data));

        return true;
    } catch (error) {
        console.error("Cloud load failed:", error);
        setAccountStatus("Cloud load failed. Your local save is still being used.");
        return false;
    }
}

function applySaveData(data) {
    Object.assign(player, data.player || {});

    // Older saves do not have savedAt, so simply use the current time for them.
    const savedAt = Number(data.savedAt || Date.now());
    const now = Date.now();
    const offlineSeconds = Math.max(0, Math.floor((now - savedAt) / 1000));

    // Offline idle time is applied by each path's catchUp() function.
    // Do not advance while a cutscene/rest is paused.
    if (offlineSeconds > 0 && typeof applyOfflineProgress === "function") {
        applyOfflineProgress(offlineSeconds);
    }

    Object.keys(paths).forEach(pathName => {
        if (data.paths && data.paths[pathName]) {
            Object.assign(paths[pathName], data.paths[pathName]);
        }
    });

    if (typeof data.currentPath === "string") currentPath = data.currentPath;
    resting = Boolean(data.resting);
    gameEnded = Boolean(data.gameEnded);

    if (data.village) {
        village.unlocked = Boolean(data.village.unlocked);
        village.housesBuilt = Number(data.village.housesBuilt || 0);
        Object.assign(village.resources, data.village.resources || {});
        Object.assign(village.quests, data.village.quests || {});
        Object.assign(village.buildings, data.village.buildings || {});
        Object.assign(village.walk, data.village.walk || {});
    }
}

function loadLocalGame() {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return false;

    try {
        applySaveData(JSON.parse(saved));
        return true;
    } catch (error) {
        console.error("Failed to load local save:", error);
        localStorage.removeItem(SAVE_KEY);
        return false;
    }
}

async function loadGame() {
    loadLocalGame();

    const { data: { user } } = await supabaseClient.auth.getUser();
    currentSupabaseUser = user || null;

    if (currentSupabaseUser) {
        await loadRemoteGame();
    }
}

function setAccountStatus(message) {
    const status = document.getElementById("accountStatus");
    if (status) status.textContent = message;
}

function updateAccountUI() {
    const title = document.getElementById("accountTitle");
    const message = document.getElementById("accountMessage");
    const signInButton = document.getElementById("signInButton");
    const signUpButton = document.getElementById("signUpButton");
    const signOutButton = document.getElementById("signOutButton");

    if (!title || !message) return;

    if (currentSupabaseUser) {
        title.textContent = "Cloud Save Connected";
        message.textContent = currentSupabaseUser.email || "Your account is connected.";
        signInButton?.classList.add("hidden");
        signUpButton?.classList.add("hidden");
        signOutButton?.classList.remove("hidden");
        setAccountStatus("Your game saves automatically to Supabase.");
    } else {
        title.textContent = "Sign In";
        message.textContent = "Sign in to save your Utopia progress online and use it on another device.";
        signInButton?.classList.remove("hidden");
        signUpButton?.classList.remove("hidden");
        signOutButton?.classList.add("hidden");
    }
}

function showAccountScreen() {
    document.getElementById("accountScreen")?.classList.remove("hidden");
    updateAccountUI();
}

function hideAccountScreen() {
    document.getElementById("accountScreen")?.classList.add("hidden");
}

async function signIn() {
    const email = document.getElementById("accountEmail")?.value.trim();
    const password = document.getElementById("accountPassword")?.value;

    if (!email || !password) {
        setAccountStatus("Enter your email and password.");
        return;
    }

    setAccountStatus("Signing in...");

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        setAccountStatus(error.message);
        return;
    }

    currentSupabaseUser = data.user;
    const hadRemoteSave = await loadRemoteGame();

    updateAccountUI();
    refreshGameUI();

    if (hadRemoteSave) {
        setAccountStatus("Cloud save loaded!");
    } else {
        await saveRemoteGame();
        setAccountStatus("Account connected. Your current game is now saved online.");
    }
}

async function signUp() {
    const email = document.getElementById("accountEmail")?.value.trim();
    const password = document.getElementById("accountPassword")?.value;

    if (!email || !password) {
        setAccountStatus("Enter an email and password.");
        return;
    }

    if (password.length < 6) {
        setAccountStatus("Your password must be at least 6 characters.");
        return;
    }

    setAccountStatus("Creating account...");

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
    }, {
        emailRedirectTo: "https://lunararrow89.github.io/Utopia/"
    });

    if (error) {
        setAccountStatus(error.message);
        return;
    }

    if (data.user && data.session) {
        currentSupabaseUser = data.user;
        await saveRemoteGame();
        updateAccountUI();
        setAccountStatus("Account created and cloud save connected!");
    } else {
        setAccountStatus("Account created. Check your email to confirm your account, then sign in.");
    }
}

async function signOut() {
    await supabaseClient.auth.signOut();
    currentSupabaseUser = null;
    updateAccountUI();
    setAccountStatus("Signed out. Your local save is still on this device.");
}

function refreshGameUI() {
    updateHP();
    updateGold();
    updateForest();

    document.getElementById("levelText").textContent = player.level;
    document.getElementById("attackText").textContent = player.attack;
    document.getElementById("xpBarText").textContent =
        `${player.xp} / ${player.xpToNext} XP`;
    document.getElementById("xpBar").style.width =
        `${(player.xp / player.xpToNext) * 100}%`;

    if (typeof updateVillageUI === "function") updateVillageUI();
    if (typeof updateVillageWalkUI === "function") updateVillageWalkUI();

    if (village.unlocked && paths.forest.completed) {
        showVillage();
    } else if (paths.forest.completed) {
        showArrivalScene();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("accountButton")?.addEventListener("click", showAccountScreen);
    document.getElementById("accountButtonVillage")?.addEventListener("click", showAccountScreen);
    document.getElementById("signInButton")?.addEventListener("click", signIn);
    document.getElementById("signUpButton")?.addEventListener("click", signUp);
    document.getElementById("signOutButton")?.addEventListener("click", signOut);

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        currentSupabaseUser = session?.user || null;
        updateAccountUI();
    });
});
