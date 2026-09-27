const SAVE_KEY = "whisperingWoodsSave";
const SAVE_VERSION = 3;

const SUPABASE_URL = "https://pfwjljbugjgfbmrtzcid.supabase.co";
const SUPABASE_KEY = "sb_publishable_YkIw0Q-nJNrXF47tPruRYQ_51mBVWuB";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let currentSupabaseUser = null;
let remoteSaveTimer = null;
let remoteSaveInProgress = false;
let pendingRemoteSave = null;
let lastRemoteSaveAt = 0;

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
        savedAt
    };
}

function writeLocalSave(saveData) {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch (error) {
        console.error("Local save failed:", error);
    }
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

        if (pendingRemoteSave) {
            queueRemoteSave(pendingRemoteSave);
        }
    }, wait);
}

function saveGame() {
    const now = Date.now();

    // Completed paths must not accumulate offline time after they finish.
    if (gameEnded) {
        if (paths.forest?.completed) paths.forest.lastUpdateTime = now;
        if (paths.ashHills?.completed) paths.ashHills.lastUpdateTime = now;
    }

    const saveData = getGameSaveData(now);
    writeLocalSave(saveData);
    queueRemoteSave(saveData);
}

async function saveRemoteGame(saveData = getGameSaveData()) {
    if (!currentSupabaseUser) return false;

    const dataToSave = cloneSaveData(saveData);
    dataToSave.version = SAVE_VERSION;
    dataToSave.savedAt = Number(dataToSave.savedAt || Date.now());

    try {
        const { data: existing, error: findError } = await supabaseClient
            .from("game_saves")
            .select("id, save_data")
            .eq("user_id", currentSupabaseUser.id)
            .maybeSingle();

        if (findError) throw findError;

        const remoteTime = Number(existing?.save_data?.savedAt || 0);

        // Never overwrite a newer cloud save with an older request.
        if (existing && remoteTime > dataToSave.savedAt) {
            return false;
        }

        if (existing) {
            const { error } = await supabaseClient
                .from("game_saves")
                .update({
                    save_data: dataToSave,
                    updated_at: new Date().toISOString()
                })
                .eq("id", existing.id)
                .eq("user_id", currentSupabaseUser.id);

            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from("game_saves")
                .insert({
                    user_id: currentSupabaseUser.id,
                    save_data: dataToSave
                });

            if (error) throw error;
        }

        return true;
    } catch (error) {
        console.error("Cloud save failed:", error);
        setAccountStatus("Cloud save failed. Retrying automatically...");
        pendingRemoteSave = dataToSave;
        return false;
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

        const remoteSave = data.save_data;

        // Supabase is the authoritative save for logged-in accounts.
        // The server-side idle engine may have progressed this save while
        // every device was closed, so never let an older browser copy win
        // just because its local savedAt timestamp is newer.
        applySaveData(remoteSave);
        writeLocalSave(remoteSave);

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

    if (typeof restStartTime !== "undefined") {
        restStartTime = Number(data.restStartTime || 0);
    }

    if (typeof restDuration !== "undefined") {
        restDuration = Number(data.restDuration || 0);
    }

    if (typeof restForced !== "undefined") {
        restForced = Boolean(data.restForced);
    }

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

    if (!currentSupabaseUser) {
        return false;
    }

    // Ask the server to process this account before loading it.
    // This is only a safety/instant-sync call; Supabase Cron also runs
    // the same server-side idle engine every minute while all devices are off.
    try {
        const { error } = await supabaseClient.rpc("process_idle_games", {
            p_user_id: currentSupabaseUser.id
        });

        if (error) {
            console.warn("Server idle processing failed:", error);
        }
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
        message.textContent = currentSupabaseUser.email || "Your account is connected.";
        signInButton?.classList.add("hidden");
        signUpButton?.classList.add("hidden");
        signOutButton?.classList.remove("hidden");
        setAccountStatus("Your game saves automatically to your account.");
    } else {
        document.getElementById("accountCloseButton")?.classList.add("hidden");
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

    catchUpPathsWhileAway();

    if (typeof catchUpVillageWalk === "function") {
        catchUpVillageWalk();
    }

    if (typeof resumeRest === "function" && resting) {
        resumeRest();
    }

    updateAccountUI();
    unlockLogin();
    refreshGameUI();

    // Save the post-offline catch-up immediately so another device can see it.
    await saveRemoteGame(getGameSaveData(Date.now()));
    lastRemoteSaveAt = Date.now();

    setAccountStatus(hadRemoteSave
        ? "Cloud save loaded and offline progress caught up!"
        : "Account connected. Your current game is now saved online.");
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

        catchUpPathsWhileAway();

        if (typeof catchUpVillageWalk === "function") {
            catchUpVillageWalk();
        }

        await saveRemoteGame(getGameSaveData(Date.now()));
        lastRemoteSaveAt = Date.now();

        updateAccountUI();
        unlockLogin();
        refreshGameUI();
        setAccountStatus("Account created and cloud save connected!");
    } else {
        setAccountStatus("Account created. Check your email to confirm your account, then sign in.");
    }
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
