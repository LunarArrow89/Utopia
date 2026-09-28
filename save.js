const SAVE_KEY = "whisperingWoodsSave";
const SAVE_VERSION = 3;

const SUPABASE_URL = "https://pfwjljbugjgfbmrtzcid.supabase.co";
const SUPABASE_KEY = "sb_publishable_YkIw0Q-nJNrXF47tPruRYQ_51mBVWuB";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentSupabaseUser = null;
let remoteSaveTimer = null;
let remoteSaveInProgress = false;
let pendingRemoteSave = null;
let lastRemoteSaveAt = 0;
let remoteSaveRevision = 0;

function cloneSaveData(data) {
    return JSON.parse(JSON.stringify(data));
}

function getGameSaveData(savedAt = Date.now()) {
    return {
        version: SAVE_VERSION,
        player: cloneSaveData(player),
        paths: cloneSaveData(paths),
        currentPath,
        resting,
        restStartTime: Number(typeof restStartTime !== "undefined" ? restStartTime : 0),
        restDuration: Number(typeof restDuration !== "undefined" ? restDuration : 0),
        restForced: Boolean(typeof restForced !== "undefined" ? restForced : false),
        gameEnded,
        village: cloneSaveData(village),
        arrivalCutsceneSeen: Boolean(arrivalCutsceneSeen),
        savedAt
    };
}

function queueRemoteSave(saveData) {
    if (!currentSupabaseUser) return;

    pendingRemoteSave = cloneSaveData(saveData);

    if (remoteSaveTimer || remoteSaveInProgress) return;

    const wait = Math.max(0, 2000 - (Date.now() - lastRemoteSaveAt));

    remoteSaveTimer = setTimeout(async () => {
        remoteSaveTimer = null;
        if (!pendingRemoteSave) return;

        const dataToSave = pendingRemoteSave;
        pendingRemoteSave = null;
        remoteSaveInProgress = true;
        lastRemoteSaveAt = Date.now();

        await saveRemoteGame(dataToSave);

        remoteSaveInProgress = false;

        if (pendingRemoteSave) queueRemoteSave(pendingRemoteSave);
    }, wait);
}

function saveGame() {
    const now = Date.now();

    if (gameEnded) {
        if (paths.forest?.completed) paths.forest.lastUpdateTime = now;
        if (paths.ashHills?.completed) paths.ashHills.lastUpdateTime = now;
    }

    const saveData = getGameSaveData(now);

    // Keep a local backup too. The cloud save is authoritative after login,
    // but this prevents a refresh during a pending network write from
    // immediately throwing away the newest state.
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch (error) {
        console.warn("Local save failed:", error);
    }

    queueRemoteSave(saveData);
}

async function saveRemoteGame(saveData = getGameSaveData()) {
    if (!currentSupabaseUser) return false;

    const dataToSave = cloneSaveData(saveData);
    dataToSave.version = SAVE_VERSION;
    dataToSave.savedAt = Date.now();

    try {
        const { data, error } = await supabaseClient.rpc("save_game_state", {
            p_save_data: dataToSave,
            p_expected_revision: remoteSaveRevision
        });

        if (error) throw error;

        if (data?.conflict) {
            remoteSaveRevision = Number(data.save_revision || 0);

            if (data.save_data) {
                applySaveData(data.save_data);
                refreshGameUI();
            }

            return false;
        }

        if (!data || !data.save_data) {
            throw new Error("The server did not return the saved game.");
        }

        remoteSaveRevision = Number(data.save_revision || remoteSaveRevision);

        // IMPORTANT: do NOT apply the returned server copy here.
        // It is the exact state we just sent, and applying it during a
        // delayed save could overwrite newer local XP/HP/level changes that
        // happened while the request was in flight.
        return true;
    } catch (error) {
        console.error("Cloud save failed:", error);
        setAccountStatus("Account save failed. Retrying automatically...");
        pendingRemoteSave = dataToSave;
        return false;
    }
}

async function loadRemoteGame() {
    if (!currentSupabaseUser) return false;

    try {
        const { data, error } = await supabaseClient
            .from("game_saves")
            .select("save_data, save_revision")
            .eq("user_id", currentSupabaseUser.id)
            .maybeSingle();

        if (error) throw error;
        if (!data || !data.save_data) return false;

        remoteSaveRevision = Number(data.save_revision || 0);
        applySaveData(data.save_data);
        refreshGameUI();
        return true;
    } catch (error) {
        console.error("Cloud load failed:", error);
        setAccountStatus("Cloud load failed. Retrying...");
        return false;
    }
}

function applySaveData(data) {
    if (!data) return;

    Object.assign(player, data.player || {});

    Object.keys(paths).forEach(pathName => {
        if (data.paths && data.paths[pathName]) {
            Object.assign(paths[pathName], data.paths[pathName]);
        }
    });

    if (typeof data.currentPath === "string") currentPath = data.currentPath;
    resting = Boolean(data.resting);

    if (typeof restStartTime !== "undefined") restStartTime = Number(data.restStartTime || 0);
    if (typeof restDuration !== "undefined") restDuration = Number(data.restDuration || 0);
    if (typeof restForced !== "undefined") restForced = Boolean(data.restForced);

    gameEnded = Boolean(data.gameEnded);

    if (typeof data.arrivalCutsceneSeen === "boolean") {
        arrivalCutsceneSeen = data.arrivalCutsceneSeen;
    }

    if (data.village) {
        village.unlocked = Boolean(data.village.unlocked);
        village.housesBuilt = Number(data.village.housesBuilt || 0);
        Object.assign(village.resources, data.village.resources || {});
        Object.assign(village.quests, data.village.quests || {});
        Object.assign(village.buildings, data.village.buildings || {});
        Object.assign(village.walk, data.village.walk || {});
    }
}

async function loadGame() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    currentSupabaseUser = user || null;

    if (!currentSupabaseUser) return false;

    try {
        const { error } = await supabaseClient.rpc("process_idle_games", {
            p_user_id: currentSupabaseUser.id
        });
        if (error) console.warn("Server idle processing failed:", error);
    } catch (error) {
        console.warn("Server idle processing unavailable:", error);
    }

    await loadRemoteGame();
    return true;
}

function requireLogin() {
    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("arrivalScene")?.classList.add("hidden");
    document.getElementById("villageScreen")?.classList.add("hidden");
    document.getElementById("villageWalkScreen")?.classList.add("hidden");
    document.getElementById("ashHillsScreen")?.classList.add("hidden");
    document.getElementById("questScreen")?.classList.add("hidden");
    document.getElementById("villageTabs")?.classList.add("hidden");

    const accountScreen = document.getElementById("accountScreen");
    accountScreen?.classList.remove("hidden");
    accountScreen?.classList.add("login-required");

    updateAccountUI();
    setAccountStatus("You must sign in or create an account to play Utopia.");
}

function unlockLogin() {
    document.getElementById("accountScreen")?.classList.remove("login-required");
    hideAccountScreen();
}

function setAccountStatus(message) {
    const status = document.getElementById("accountStatus");
    if (status) status.textContent = message;
}

function getUsername() {
    return document.getElementById("accountUsername")?.value.trim() || "";
}

function usernameToInternalEmail(username) {
    return username.toLowerCase() + "@utopia.invalid";
}

function validUsername(username) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function updateAccountUI() {
    const title = document.getElementById("accountTitle");
    const message = document.getElementById("accountMessage");
    const signInButton = document.getElementById("signInButton");
    const signUpButton = document.getElementById("signUpButton");
    const signOutButton = document.getElementById("signOutButton");

    if (!title || !message) return;

    if (currentSupabaseUser) {
        document.getElementById("accountCloseButton")?.classList.remove("hidden");
        title.textContent = "Cloud Save Connected";
        message.textContent = currentSupabaseUser.user_metadata?.username || "Your account is connected.";
        signInButton?.classList.add("hidden");
        signUpButton?.classList.add("hidden");
        signOutButton?.classList.remove("hidden");
        setAccountStatus("Your game saves automatically to your account.");
    } else {
        document.getElementById("accountCloseButton")?.classList.add("hidden");
        title.textContent = "Sign In";
        message.textContent = "Use your username and password to keep your save on every device.";
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
    const username = getUsername();
    const password = document.getElementById("accountPassword")?.value;

    if (!validUsername(username)) {
        setAccountStatus("Username must be 3-20 characters using letters, numbers, or underscores.");
        return;
    }

    if (!password) {
        setAccountStatus("Enter your password.");
        return;
    }

    setAccountStatus("Signing in...");

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: usernameToInternalEmail(username),
        password
    });

    if (error) {
        setAccountStatus("Username or password is incorrect.");
        return;
    }

    currentSupabaseUser = data.user;
    await loadRemoteGame();

    if (typeof resumeRest === "function" && resting) resumeRest();

    updateAccountUI();
    unlockLogin();
    refreshGameUI();
    setAccountStatus("Cloud save loaded!");
}

async function signUp() {
    const username = getUsername();
    const password = document.getElementById("accountPassword")?.value;

    if (!validUsername(username)) {
        setAccountStatus("Username must be 3-20 characters using letters, numbers, or underscores.");
        return;
    }
    if (!password) {
        setAccountStatus("Enter your password.");
        return;
    }
    if (password.length < 6) {
        setAccountStatus("Your password must be at least 6 characters.");
        return;
    }

    setAccountStatus("Creating account...");

    const { data, error } = await supabaseClient.auth.signUp({
        email: usernameToInternalEmail(username),
        password,
        options: { data: { username } }
    });

    if (error) {
        setAccountStatus(error.message.toLowerCase().includes("already") ? "That username is already taken." : error.message);
        return;
    }

    if (!data.user || !data.session) {
        setAccountStatus("Account created, but automatic sign-in is disabled. In Supabase, turn OFF Confirm email, then try again.");
        return;
    }

    currentSupabaseUser = data.user;
    lastRemoteSaveAt = Date.now();
    updateAccountUI();
    unlockLogin();
    saveGame();
    refreshGameUI();
    setAccountStatus("Account created and cloud save connected!");
}

async function signOut() {
    await supabaseClient.auth.signOut();
    currentSupabaseUser = null;
    requireLogin();
}

function refreshGameUI() {
    updateHP();
    updateGold();
    updateForest();

    document.getElementById("levelText").textContent = player.level;
    document.getElementById("attackText").textContent = player.attack;
    document.getElementById("xpBarText").textContent = `${player.xp} / ${player.xpToNext} XP`;
    document.getElementById("xpBar").style.width = `${(player.xp / player.xpToNext) * 100}%`;

    if (typeof updateVillageUI === "function") updateVillageUI();
    if (typeof updateVillageWalkUI === "function") updateVillageWalkUI();

    if (paths.forest.completed && !arrivalCutsceneSeen) {
        showArrivalScene();
    } else if (village.unlocked && paths.forest.completed) {
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
