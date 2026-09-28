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
    queueRemoteSave(saveData);
}

async function saveRemoteGame(saveData = getGameSaveData()) {
    if (!currentSupabaseUser) return false;

    const dataToSave = cloneSaveData(saveData);
    dataToSave.version = SAVE_VERSION;
    dataToSave.savedAt = Date.now();

    try {
        // All writes go through one server-side RPC. The database stamps
        // the save with server time and advances its revision, so a stale
        // browser/device cannot silently overwrite a newer cloud save.
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
        applySaveData(data.save_data);

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

        const remoteSave = data.save_data;
        remoteSaveRevision = Number(data.save_revision || 0);

        // Supabase is the authoritative save for the signed-in account.
        // The server-side idle engine may have progressed this save while
        // every device was closed, so never let an older browser copy win
        // just because its local savedAt timestamp is newer.
        applySaveData(remoteSave);
        // Immediately refresh every visible part of the game from the
        // cloud-loaded state. This is especially important after the
        // server-side idle engine progressed the game while the device
        // was closed.
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

async function loadGame() {
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
        message.textContent = "Sign in to keep your Utopia save tied to this account and use it on another device.";
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

async function resendConfirmationEmail() {
    const email = document.getElementById("accountEmail")?.value.trim();

    if (!email) {
        setAccountStatus("Enter your email first.");
        return;
    }

    setAccountStatus("Sending confirmation email...");

    const { error } = await supabaseClient.auth.resend({
        type: "signup",
        email,
        options: {
            emailRedirectTo: "https://lunararrow89.github.io/Utopia/"
        }
    });

    if (error) {
        setAccountStatus(error.message);
        return;
    }

    setAccountStatus("Confirmation email sent! Check your inbox.");
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

    // Process offline time on the server before loading the save.
    // This keeps sign-in consistent with normal game startup.
    try {
        const { error: idleError } = await supabaseClient.rpc("process_idle_games", {
            p_user_id: currentSupabaseUser.id
        });

        if (idleError) {
            console.warn("Server idle processing failed during sign-in:", idleError);
        }
    } catch (error) {
        console.warn("Server idle processing unavailable during sign-in:", error);
    }

    const hadRemoteSave = await loadRemoteGame();

    if (typeof resumeRest === "function" && resting) {
        resumeRest();
    }

    updateAccountUI();
    unlockLogin();
    refreshGameUI();

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
        password,
        options: {
            emailRedirectTo: "https://lunararrow89.github.io/Utopia/"
        }
    });

    if (error) {
        setAccountStatus(error.message);
        return;
    }

    if (data.user && data.session) {
        currentSupabaseUser = data.user;

        // A new account starts with a fresh game. Do not copy another
        // account's device-local state into the new account.
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
    document.getElementById("resendConfirmationButton")?.addEventListener("click", resendConfirmationEmail);
    document.getElementById("signOutButton")?.addEventListener("click", signOut);

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        currentSupabaseUser = session?.user || null;
        updateAccountUI();
    });
});
