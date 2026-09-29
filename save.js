const SAVE_KEY = "utopiaSave";
const SAVE_VERSION = 5;

const SUPABASE_URL = "https://pfwjljbugjgfbmrtzcid.supabase.co";
const SUPABASE_KEY = "sb_publishable_YkIw0Q-nJNrXF47tPruRYQ_51mBVWuB";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentSupabaseUser = null;
let remoteSaveTimer = null;
let remoteSaveInProgress = false;
let pendingRemoteSave = null;
let lastRemoteSaveAt = 0;
let remoteSaveRevision = 0;
let remoteSavePromise = null;

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
        awakeningSeen: Boolean(typeof awakeningSeen !== "undefined" ? awakeningSeen : false),
        savedAt
    };
}

function saveLocalBackup(saveData) {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch (error) {
        console.warn("Local save failed:", error);
    }
}

function queueRemoteSave(saveData) {
    if (!currentSupabaseUser) return;

    pendingRemoteSave = cloneSaveData(saveData);

    if (remoteSaveTimer || remoteSaveInProgress) return;

    const wait = Math.max(0, 1000 - (Date.now() - lastRemoteSaveAt));

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
    const saveData = getGameSaveData(now);

    // Always keep the newest complete state locally.
    saveLocalBackup(saveData);

    // Then synchronize that exact state to the signed-in account.
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
            // The server-side idle engine can update save_revision while the
            // browser is open. Do not throw away the player's newest HP/XP/
            // path progress in that case. Refresh the revision, then retry
            // the exact newest browser state once.
            remoteSaveRevision = Number(data.save_revision || 0);

            const retry = await supabaseClient.rpc("save_game_state", {
                p_save_data: dataToSave,
                p_expected_revision: remoteSaveRevision
            });

            if (retry.error) throw retry.error;
            if (retry.data?.conflict) {
                remoteSaveRevision = Number(retry.data.save_revision || remoteSaveRevision);
                throw new Error("Cloud save conflict could not be resolved.");
            }

            remoteSaveRevision = Number(
                retry.data?.save_revision || remoteSaveRevision
            );

            return true;
        }

        if (!data || !data.save_data) {
            throw new Error("The server did not return the saved game.");
        }

        remoteSaveRevision = Number(data.save_revision || remoteSaveRevision);
        return true;
    } catch (error) {
        console.error("RPC cloud save failed:", error);

        // If the server-side RPC has not been installed yet, fall back to
        // the game_saves table so account progress can still be stored.
        // The server idle engine still needs the SQL file installed for
        // progress while the device is completely offline.
        const message = String(error?.message || "").toLowerCase();
        const rpcMissing =
            message.includes("save_game_state") ||
            message.includes("function") && message.includes("does not exist");

        if (rpcMissing) {
            try {
                const { data, error: fallbackError } = await supabaseClient
                    .from("game_saves")
                    .upsert(
                        {
                            user_id: currentSupabaseUser.id,
                            save_data: dataToSave,
                            updated_at: new Date().toISOString()
                        },
                        { onConflict: "user_id" }
                    )
                    .select("save_data, save_revision")
                    .single();

                if (fallbackError) throw fallbackError;

                remoteSaveRevision = Number(data?.save_revision || remoteSaveRevision);
                return true;
            } catch (fallbackError) {
                console.error("Direct account save failed:", fallbackError);
                setAccountStatus("Account save failed. Check the Supabase setup.");
            }
        } else {
            setAccountStatus("Account save failed. Retrying automatically...");
        }

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

        if (!data || !data.save_data) {
            return false;
        }

        remoteSaveRevision = Number(data.save_revision || 0);

        const remoteSave = data.save_data;
        let localSave = null;

        try {
            const rawLocal = localStorage.getItem(SAVE_KEY);
            if (rawLocal) localSave = JSON.parse(rawLocal);
        } catch (error) {
            console.warn("Could not read local save for cloud reconciliation:", error);
        }

        const remoteTime = Number(remoteSave?.savedAt || 0);
        const localTime = Number(localSave?.savedAt || 0);

        // Never let an older cloud copy overwrite a newer local copy.
        // This was the main reason progress could appear to vanish after
        // refreshing or switching devices.
        if (localSave && localTime > remoteTime) {
            applySaveData(localSave);
            pendingRemoteSave = cloneSaveData(localSave);
            queueRemoteSave(localSave);
        } else {
            applySaveData(remoteSave);
            saveLocalBackup(remoteSave);
        }

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

    if (typeof data.currentPath === "string") {
        currentPath = data.currentPath;
    }

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

    if (typeof data.arrivalCutsceneSeen === "boolean") {
        arrivalCutsceneSeen = data.arrivalCutsceneSeen;
    }

    if (typeof data.awakeningSeen === "boolean") {
        awakeningSeen = data.awakeningSeen;
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
    // Supabase can take a moment to restore the saved browser session.
    // Wait briefly before deciding that the player is logged out.
    let user = null;

    for (let attempt = 0; attempt < 10; attempt++) {
        const { data } = await supabaseClient.auth.getSession();
        user = data?.session?.user || null;

        if (user) break;

        await new Promise(resolve => setTimeout(resolve, 150));
    }

    currentSupabaseUser = user;

    if (!currentSupabaseUser) {
        return false;
    }

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

    // A missing cloud save does NOT mean the user is logged out.
    // The account session is the login state; a save row may simply not
    // exist yet for a new account.
    // Do not let a slow/broken cloud-save request make a logged-in
    // player look like they are stuck on the account screen.
    let loadedRemote = false;

    try {
        loadedRemote = await Promise.race([
            loadRemoteGame(),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);
    } catch (error) {
        console.warn("Cloud save load timed out:", error);
    }

    if (!loadedRemote) {
        try {
            const local = localStorage.getItem(SAVE_KEY);
            if (local) {
                applySaveData(JSON.parse(local));
            }
        } catch (error) {
            console.warn("Local save restore failed:", error);
        }
    }

    // The Supabase session is the login state. A cloud-save problem must
    // never send an authenticated player back through requireLogin().
    currentSupabaseUser = user;
    updateAccountUI();

    // Restore an active Whispering Woods walk after loading the save.
    if (typeof village !== "undefined" && village.walk?.active && typeof resumeVillageWalk === "function") {
        resumeVillageWalk();
    }

    return true;
}

async function flushSaveNow() {
    if (!currentSupabaseUser) return true;

    if (remoteSaveTimer) {
        clearTimeout(remoteSaveTimer);
        remoteSaveTimer = null;
    }

    const newest = getGameSaveData(Date.now());
    saveLocalBackup(newest);
    pendingRemoteSave = newest;

    if (remoteSaveInProgress && remoteSavePromise) {
        await remoteSavePromise;
    }

    if (pendingRemoteSave && !remoteSaveInProgress) {
        const next = pendingRemoteSave;
        pendingRemoteSave = null;

        remoteSaveInProgress = true;
        lastRemoteSaveAt = Date.now();

        remoteSavePromise = saveRemoteGame(next);

        try {
            await remoteSavePromise;
        } finally {
            remoteSavePromise = null;
            remoteSaveInProgress = false;
        }
    }

    return !pendingRemoteSave;
}

function requireLogin() {
    document.getElementById("forestGame")?.classList.add("hidden");
    document.getElementById("awakeningScene")?.classList.add("hidden");
    document.getElementById("storyScreen")?.classList.add("hidden");
    document.getElementById("arrivalScene")?.classList.add("hidden");
        document.getElementById("awakeningScene")?.classList.add("hidden");
        document.getElementById("storyScreen")?.classList.add("hidden");
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
        message.textContent =
            currentSupabaseUser.user_metadata?.username ||
            "Your account is connected.";
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

    try {
        await supabaseClient.rpc("process_idle_games", {
            p_user_id: currentSupabaseUser.id
        });
    } catch (error) {
        console.warn("Server idle processing unavailable during sign-in:", error);
    }

    await loadRemoteGame();

    if (typeof resumeRest === "function" && resting) {
        resumeRest();
    }

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
        options: {
            data: { username }
        }
    });

    if (error) {
        setAccountStatus(
            error.message.toLowerCase().includes("already")
                ? "That username is already taken."
                : error.message
        );
        return;
    }

    if (!data.user || !data.session) {
        setAccountStatus("Account created, but automatic sign-in is disabled. In Supabase, turn OFF Confirm email, then try again.");
        return;
    }

    currentSupabaseUser = data.user;

    // New accounts get an immediate complete save, including every path
    // and every player stat.
    const initialSave = getGameSaveData(Date.now());
    saveLocalBackup(initialSave);

    const saved = await saveRemoteGame(initialSave);

    if (!saved) {
        setAccountStatus("Account created, but the first cloud save failed. It will retry automatically.");
    }

    updateAccountUI();
    unlockLogin();
    refreshGameUI();
    setAccountStatus("Account created and cloud save connected!");
}

async function signOut() {
    await flushSaveNow();
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

    // refreshGameUI only redraws data. Screen navigation belongs to the
    // tab/cutscene functions so a timer tick can never kick the player
    // out of Story, Village, or Walk.
}

document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "hidden") {
        await flushSaveNow();
    } else {
        // Reconcile elapsed idle time first, then redraw. Do not overwrite
        // the local state just because the tab became visible.
        if (currentSupabaseUser) {
            loadGame().then(() => {
                if (typeof resumeRest === "function" && resting) {
                    resumeRest();
                }
                refreshGameUI();
            });
        }
    }
});

window.addEventListener("pagehide", () => {
    const newest = getGameSaveData(Date.now());
    saveLocalBackup(newest);
});

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("accountButton")?.addEventListener("click", showAccountScreen);
    document.getElementById("accountButtonVillage")?.addEventListener("click", showAccountScreen);
    document.getElementById("signInButton")?.addEventListener("click", signIn);
    document.getElementById("signUpButton")?.addEventListener("click", signUp);
    document.getElementById("signOutButton")?.addEventListener("click", signOut);

    // Auth events update account state only. initializeGame() is the single
    // owner of initial save restoration and screen selection.
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        currentSupabaseUser = session?.user || null;
        updateAccountUI();

        if (!currentSupabaseUser && gameInitialized) {
            requireLogin();
        }
    });
});
