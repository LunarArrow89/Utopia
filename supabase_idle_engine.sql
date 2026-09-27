-- Utopia server-side idle engine
-- Run this entire file once in Supabase Dashboard -> SQL Editor.
--
-- This moves time-based idle processing into Postgres so the game
-- can continue progressing while every browser/device is closed.


-- ============================================================
-- SERVER-SIDE IDLE PROCESSOR
-- ============================================================

-- This timestamp lives OUTSIDE save_data so browser saves cannot
-- reset the server's offline clock.
alter table if exists public.game_saves
add column if not exists idle_last_processed_at bigint;

alter table if exists public.game_saves
add column if not exists save_revision bigint not null default 0;

create or replace function public.process_idle_games(p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    r record;

    d jsonb;
    p jsonb;
    paths jsonb;
    forest jsonb;
    ash jsonb;
    cave jsonb;
    village jsonb;
    walk jsonb;

    server_last_ms bigint;

    now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);

    target_id uuid;

    elapsed integer;
    old_progress integer;
    target_progress integer;
    encounter integer;

    damage integer;
    enemy_attack integer;
    enemy_xp integer;
    enemy_gold integer;

    rest_start bigint;
    rest_duration bigint;
    rest_elapsed bigint;

    xp_needed integer;
    new_level integer;
    new_attack integer;
    new_max_hp integer;
    current_xp integer;

    reward_count integer;
    old_reward_count integer;

    walk_elapsed integer;
    walk_capped integer;
    walk_encounter integer;
    walk_duration_seconds bigint;

begin

    -- ============================================================
    -- ACCOUNT CHECK
    -- ============================================================

    -- If a user ID was supplied, only process that user's save.
    -- This is used when the player opens the game.
    --
    -- When p_user_id is NULL, Cron processes every saved account.

    if p_user_id is not null then

        if auth.uid() is null or auth.uid() <> p_user_id then
            raise exception 'Not allowed to process another account';
        end if;

        target_id := p_user_id;

    else

        target_id := null;

    end if;


    -- ============================================================
    -- LOAD GAME SAVES
    -- ============================================================

    for r in
        select id, user_id, save_data, idle_last_processed_at, save_revision
        from public.game_saves
        where target_id is null
           or user_id = target_id
        for update
    loop

        d := coalesce(r.save_data, '{}'::jsonb);

        -- Use the database-owned clock. If this is an older save,
        -- initialize it from the last browser save exactly once.
        server_last_ms := coalesce(
            r.idle_last_processed_at,
            (d->>'savedAt')::bigint,
            now_ms
        );

        if server_last_ms <= 0 then
            server_last_ms := now_ms;
        end if;

        p := coalesce(
            d->'player',
            '{}'::jsonb
        );

        paths := coalesce(
            d->'paths',
            '{}'::jsonb
        );

        forest := coalesce(
            paths->'forest',
            '{}'::jsonb
        );

        ash := coalesce(
            paths->'ashHills',
            '{}'::jsonb
        );

        cave := coalesce(
            paths->'cave',
            '{}'::jsonb
        );

        village := coalesce(
            d->'village',
            '{}'::jsonb
        );

        walk := coalesce(
            village->'walk',
            '{}'::jsonb
        );


        -- ============================================================
        -- RESTING
        -- ============================================================

        -- Rest continues even when every browser/device is closed.

        if coalesce(
            (d->>'resting')::boolean,
            false
        ) then

            rest_start := coalesce(
                (d->>'restStartTime')::bigint,
                now_ms
            );

            rest_duration := coalesce(
                (d->>'restDuration')::bigint,
                0
            );

            rest_elapsed := now_ms - rest_start;


            if rest_duration > 0
               and rest_elapsed >= rest_duration
            then

                -- Fully heal the player.
                p := jsonb_set(
                    p,
                    '{hp}',
                    coalesce(
                        p->'maxHp',
                        '0'::jsonb
                    )
                );


                d := jsonb_set(
                    d,
                    '{resting}',
                    'false'::jsonb
                );

                d := jsonb_set(
                    d,
                    '{restForced}',
                    'false'::jsonb
                );

                d := jsonb_set(
                    d,
                    '{restStartTime}',
                    '0'::jsonb
                );

                d := jsonb_set(
                    d,
                    '{restDuration}',
                    '0'::jsonb
                );


                -- Restart forest timing from the moment rest ends.
                if coalesce(
                    d->>'currentPath',
                    'forest'
                ) = 'forest'
                then

                    forest := jsonb_set(
                        forest,
                        '{lastUpdateTime}',
                        to_jsonb(now_ms)
                    );

                end if;


                -- Restart Ash Hills timing from the moment rest ends.
                if coalesce(
                    (ash->>'active')::boolean,
                    false
                )
                then

                    ash := jsonb_set(
                        ash,
                        '{lastUpdateTime}',
                        to_jsonb(now_ms)
                    );

                end if;

            end if;

        end if;

        -- Rest time is handled by restStartTime/restDuration, so it must
        -- never also become path progress. The next idle tick starts now.
        if coalesce((d->>'resting')::boolean, false) then
            server_last_ms := now_ms;
        end if;


        -- ============================================================
        -- FOREST
        -- ============================================================

        if not coalesce(
            (forest->>'completed')::boolean,
            false
        )

        and not coalesce(
            (village->>'unlocked')::boolean,
            false
        )

        and not coalesce(
            (d->>'gameEnded')::boolean,
            false
        )

        and not coalesce(
            (d->>'resting')::boolean,
            false
        )

        and coalesce(
            d->>'currentPath',
            'forest'
        ) = 'forest'

        then

            elapsed := floor(
                (
                    now_ms
                    -
                    server_last_ms
                ) / 1000
            );


            if elapsed > 0 then

                old_progress := coalesce(
                    (forest->>'progress')::integer,
                    0
                );

                target_progress := least(
                    coalesce(
                        (forest->>'duration')::integer,
                        300
                    ),
                    old_progress + elapsed
                );

                encounter := coalesce(
                    (forest->>'encounterTime')::integer,
                    45
                );


                -- Process every missed encounter.
                while encounter <= target_progress
                  and encounter > old_progress
                loop

                    -- Forest enemies:
                    --
                    -- Corrupt Druid: 6 attack / 6 XP / 2 gold
                    -- Goblin:        5 attack / 8 XP / 3 gold
                    -- Blight:        7 attack / 7 XP / 4 gold
                    -- Slime:         6 attack / 9 XP / 3 gold

                    case floor(random() * 4)::integer

                        when 0 then
                            enemy_attack := 6;
                            enemy_xp := 6;
                            enemy_gold := 2;

                        when 1 then
                            enemy_attack := 5;
                            enemy_xp := 8;
                            enemy_gold := 3;

                        when 2 then
                            enemy_attack := 7;
                            enemy_xp := 7;
                            enemy_gold := 4;

                        else
                            enemy_attack := 6;
                            enemy_xp := 9;
                            enemy_gold := 3;

                    end case;


                    damage := greatest(
                        0,
                        enemy_attack
                        -
                        coalesce(
                            (p->>'attack')::integer,
                            0
                        )
                    );


                    -- ==================================================
                    -- PLAYER WINS
                    -- ==================================================

                    if damage = 0 then

                        -- Gold reward.
                        p := jsonb_set(
                            p,
                            '{gold}',
                            to_jsonb(
                                coalesce(
                                    (p->>'gold')::integer,
                                    0
                                )
                                +
                                enemy_gold
                            )
                        );


                        -- XP reward.
                        current_xp :=
                            coalesce(
                                (p->>'xp')::integer,
                                0
                            )
                            +
                            enemy_xp;


                        xp_needed := coalesce(
                            (p->>'xpToNext')::integer,
                            50
                        );

                        new_level := coalesce(
                            (p->>'level')::integer,
                            1
                        );

                        new_attack := coalesce(
                            (p->>'attack')::integer,
                            8
                        );

                        new_max_hp := coalesce(
                            (p->>'maxHp')::integer,
                            40
                        );


                        -- Level up as many times as necessary.
                        while current_xp >= xp_needed loop

                            current_xp :=
                                current_xp - xp_needed;

                            xp_needed :=
                                xp_needed + 25;

                            new_level :=
                                new_level + 1;

                            new_attack :=
                                new_attack + 1;

                            new_max_hp :=
                                new_max_hp + 3;

                        end loop;


                        p := jsonb_set(
                            p,
                            '{xp}',
                            to_jsonb(current_xp)
                        );

                        p := jsonb_set(
                            p,
                            '{xpToNext}',
                            to_jsonb(xp_needed)
                        );

                        p := jsonb_set(
                            p,
                            '{level}',
                            to_jsonb(new_level)
                        );

                        p := jsonb_set(
                            p,
                            '{attack}',
                            to_jsonb(new_attack)
                        );

                        p := jsonb_set(
                            p,
                            '{maxHp}',
                            to_jsonb(new_max_hp)
                        );


                        -- Heal 3 HP from a level-up.
                        p := jsonb_set(
                            p,
                            '{hp}',
                            to_jsonb(
                                least(
                                    new_max_hp,
                                    coalesce(
                                        (p->>'hp')::integer,
                                        new_max_hp
                                    )
                                    +
                                    3
                                )
                            )
                        );


                    -- ==================================================
                    -- PLAYER TAKES DAMAGE
                    -- ==================================================

                    else

                        p := jsonb_set(
                            p,
                            '{hp}',
                            to_jsonb(
                                greatest(
                                    0,
                                    coalesce(
                                        (p->>'hp')::integer,
                                        0
                                    )
                                    -
                                    damage
                                )
                            )
                        );


                        -- Player was defeated.
                        if coalesce(
                            (p->>'hp')::integer,
                            0
                        ) <= 0
                        then

                            -- Forced rest.
                            --
                            -- 30 seconds for each missing HP.
                            rest_duration :=
                                greatest(
                                    0,
                                    coalesce(
                                        (p->>'maxHp')::integer,
                                        40
                                    )
                                )
                                *
                                10000;


                            d := jsonb_set(
                                d,
                                '{resting}',
                                'true'::jsonb
                            );

                            d := jsonb_set(
                                d,
                                '{restForced}',
                                'true'::jsonb
                            );

                            d := jsonb_set(
                                d,
                                '{restStartTime}',
                                to_jsonb(now_ms)
                            );

                            d := jsonb_set(
                                d,
                                '{restDuration}',
                                to_jsonb(rest_duration)
                            );


                            forest := jsonb_set(
                                forest,
                                '{progress}',
                                to_jsonb(encounter)
                            );

                            forest := jsonb_set(
                                forest,
                                '{lastUpdateTime}',
                                to_jsonb(now_ms)
                            );


                            -- Stop processing forest encounters
                            -- until the rest finishes.
                            exit;

                        end if;

                    end if;


                    -- Next encounter: 30-60 seconds later.
                    encounter :=
                        encounter
                        +
                        30
                        +
                        floor(random() * 31)::integer;

                end loop;


                -- Continue normal forest movement if not resting.
                if not coalesce(
                    (d->>'resting')::boolean,
                    false
                )
                then

                    forest := jsonb_set(
                        forest,
                        '{progress}',
                        to_jsonb(target_progress)
                    );

                    forest := jsonb_set(
                        forest,
                        '{encounterTime}',
                        to_jsonb(encounter)
                    );

                    forest := jsonb_set(
                        forest,
                        '{lastUpdateTime}',
                        to_jsonb(now_ms)
                    );


                    -- Forest completed.
                    if target_progress >= coalesce(
                        (forest->>'duration')::integer,
                        300
                    )
                    then

                        forest := jsonb_set(
                            forest,
                            '{completed}',
                            'true'::jsonb
                        );

                        d := jsonb_set(
                            d,
                            '{gameEnded}',
                            'true'::jsonb
                        );

                    end if;

                end if;

            end if;

        end if;


        -- ============================================================
        -- ASH HILLS
        -- ============================================================

        if coalesce(
            (ash->>'active')::boolean,
            false
        )

        and not coalesce(
            (ash->>'completed')::boolean,
            false
        )

        and not coalesce(
            (d->>'resting')::boolean,
            false
        )

        then

            elapsed := floor(
                (
                    now_ms
                    -
                    server_last_ms
                ) / 1000
            );


            if elapsed > 0 then

                old_progress := coalesce(
                    (ash->>'progress')::integer,
                    0
                );

                target_progress := least(
                    coalesce(
                        (ash->>'duration')::integer,
                        2700
                    ),
                    old_progress + elapsed
                );

                encounter := coalesce(
                    (ash->>'encounterTime')::integer,
                    45
                );


                while encounter <= target_progress
                  and encounter > old_progress
                loop

                    case floor(random() * 4)::integer

                        when 0 then
                            enemy_attack := 17;
                            enemy_xp := 28;
                            enemy_gold := 12;

                        when 1 then
                            enemy_attack := 19;
                            enemy_xp := 32;
                            enemy_gold := 15;

                        when 2 then
                            enemy_attack := 21;
                            enemy_xp := 38;
                            enemy_gold := 18;

                        else
                            enemy_attack := 23;
                            enemy_xp := 45;
                            enemy_gold := 22;

                    end case;


                    damage := greatest(
                        0,
                        enemy_attack
                        -
                        coalesce(
                            (p->>'attack')::integer,
                            0
                        )
                    );


                    -- Player wins.
                    if damage = 0 then

                        p := jsonb_set(
                            p,
                            '{gold}',
                            to_jsonb(
                                coalesce(
                                    (p->>'gold')::integer,
                                    0
                                )
                                +
                                enemy_gold
                            )
                        );


                        current_xp :=
                            coalesce(
                                (p->>'xp')::integer,
                                0
                            )
                            +
                            enemy_xp;


                        xp_needed := coalesce(
                            (p->>'xpToNext')::integer,
                            50
                        );

                        new_level := coalesce(
                            (p->>'level')::integer,
                            1
                        );

                        new_attack := coalesce(
                            (p->>'attack')::integer,
                            8
                        );

                        new_max_hp := coalesce(
                            (p->>'maxHp')::integer,
                            40
                        );


                        -- Level ups.
                        while current_xp >= xp_needed loop

                            current_xp :=
                                current_xp - xp_needed;

                            xp_needed :=
                                xp_needed + 25;

                            new_level :=
                                new_level + 1;

                            new_attack :=
                                new_attack + 1;

                            new_max_hp :=
                                new_max_hp + 3;

                        end loop;


                        p := jsonb_set(
                            p,
                            '{xp}',
                            to_jsonb(current_xp)
                        );

                        p := jsonb_set(
                            p,
                            '{xpToNext}',
                            to_jsonb(xp_needed)
                        );

                        p := jsonb_set(
                            p,
                            '{level}',
                            to_jsonb(new_level)
                        );

                        p := jsonb_set(
                            p,
                            '{attack}',
                            to_jsonb(new_attack)
                        );

                        p := jsonb_set(
                            p,
                            '{maxHp}',
                            to_jsonb(new_max_hp)
                        );


                        p := jsonb_set(
                            p,
                            '{hp}',
                            to_jsonb(
                                least(
                                    new_max_hp,
                                    coalesce(
                                        (p->>'hp')::integer,
                                        new_max_hp
                                    )
                                    +
                                    3
                                )
                            )
                        );


                    else

                        p := jsonb_set(
                            p,
                            '{hp}',
                            to_jsonb(
                                greatest(
                                    0,
                                    coalesce(
                                        (p->>'hp')::integer,
                                        0
                                    )
                                    -
                                    damage
                                )
                            )
                        );


                        if coalesce(
                            (p->>'hp')::integer,
                            0
                        ) <= 0
                        then

                            rest_duration :=
                                greatest(
                                    0,
                                    coalesce(
                                        (p->>'maxHp')::integer,
                                        40
                                    )
                                )
                                *
                                10000;


                            d := jsonb_set(
                                d,
                                '{resting}',
                                'true'::jsonb
                            );

                            d := jsonb_set(
                                d,
                                '{restForced}',
                                'true'::jsonb
                            );

                            d := jsonb_set(
                                d,
                                '{restStartTime}',
                                to_jsonb(now_ms)
                            );

                            d := jsonb_set(
                                d,
                                '{restDuration}',
                                to_jsonb(rest_duration)
                            );


                            ash := jsonb_set(
                                ash,
                                '{progress}',
                                to_jsonb(encounter)
                            );

                            ash := jsonb_set(
                                ash,
                                '{lastUpdateTime}',
                                to_jsonb(now_ms)
                            );


                            exit;

                        end if;

                    end if;


                    encounter :=
                        encounter
                        +
                        30
                        +
                        floor(random() * 31)::integer;

                end loop;


                if not coalesce(
                    (d->>'resting')::boolean,
                    false
                )
                then

                    ash := jsonb_set(
                        ash,
                        '{progress}',
                        to_jsonb(target_progress)
                    );

                    ash := jsonb_set(
                        ash,
                        '{encounterTime}',
                        to_jsonb(encounter)
                    );

                    ash := jsonb_set(
                        ash,
                        '{lastUpdateTime}',
                        to_jsonb(now_ms)
                    );


                    if target_progress >= coalesce(
                        (ash->>'duration')::integer,
                        2700
                    )
                    then

                        ash := jsonb_set(
                            ash,
                            '{completed}',
                            'true'::jsonb
                        );

                        ash := jsonb_set(
                            ash,
                            '{active}',
                            'false'::jsonb
                        );

                        d := jsonb_set(
                            d,
                            '{gameEnded}',
                            'true'::jsonb
                        );

                    end if;

                end if;

            end if;

        end if;


        -- ============================================================
        -- VILLAGE WALK
        -- ============================================================

        walk := coalesce(
            village->'walk',
            '{}'::jsonb
        );


        if coalesce(
            (walk->>'active')::boolean,
            false
        )

        and not coalesce(
            (d->>'resting')::boolean,
            false
        )

        then

            walk_elapsed := floor(
                (
                    now_ms
                    -
                    server_last_ms
                ) / 1000
            );


            -- The browser stores village walk duration in milliseconds,
            -- while the idle engine works in seconds. Accept either format
            -- so existing saves continue to work correctly.
            walk_duration_seconds := coalesce(
                (walk->>'duration')::bigint,
                1200
            );

            if walk_duration_seconds > 10000 then
                walk_duration_seconds := floor(
                    walk_duration_seconds / 1000
                );
            end if;

            walk_capped := least(
                walk_elapsed,
                walk_duration_seconds
            );


            -- ========================================================
            -- VILLAGE WALK RESOURCES
            -- ========================================================

            old_reward_count := coalesce(
                (walk->>'lastRewardCount')::integer,
                0
            );

            reward_count := floor(
                walk_capped / 15
            );


            if reward_count > old_reward_count then

                for i in 1..(
                    reward_count - old_reward_count
                )
                loop

                    case floor(random() * 3)::integer

                        when 0 then

                            village := jsonb_set(
                                village,
                                '{resources,wood}',
                                to_jsonb(
                                    coalesce(
                                        (village#>>'{resources,wood}')::integer,
                                        0
                                    )
                                    +
                                    1
                                )
                            );

                        when 1 then

                            village := jsonb_set(
                                village,
                                '{resources,stone}',
                                to_jsonb(
                                    coalesce(
                                        (village#>>'{resources,stone}')::integer,
                                        0
                                    )
                                    +
                                    1
                                )
                            );

                        else

                            village := jsonb_set(
                                village,
                                '{resources,food}',
                                to_jsonb(
                                    coalesce(
                                        (village#>>'{resources,food}')::integer,
                                        0
                                    )
                                    +
                                    1
                                )
                            );

                    end case;

                end loop;


                walk := jsonb_set(
                    walk,
                    '{lastRewardCount}',
                    to_jsonb(reward_count)
                );

            end if;


            -- ========================================================
            -- VILLAGE WALK ENCOUNTERS
            -- ========================================================

            walk_encounter := coalesce(
                (walk->>'nextEncounterTime')::integer,
                30
            );


            while walk_encounter <= walk_capped loop

                -- Village enemies:
                --
                -- Wandering Wolf: 11 attack / 12 XP / 5 gold
                -- Moss Goblin:    12 attack / 16 XP / 7 gold
                -- Wild Boar:      14 attack / 20 XP / 9 gold

                case floor(random() * 3)::integer

                    when 0 then
                        enemy_attack := 11;
                        enemy_xp := 12;
                        enemy_gold := 5;

                    when 1 then
                        enemy_attack := 12;
                        enemy_xp := 16;
                        enemy_gold := 7;

                    else
                        enemy_attack := 14;
                        enemy_xp := 20;
                        enemy_gold := 9;

                end case;


                damage := greatest(
                    0,
                    enemy_attack
                    -
                    coalesce(
                        (p->>'attack')::integer,
                        0
                    )
                );


                -- Player wins.
                if damage = 0 then

                    p := jsonb_set(
                        p,
                        '{gold}',
                        to_jsonb(
                            coalesce(
                                (p->>'gold')::integer,
                                0
                            )
                            +
                            enemy_gold
                        )
                    );


                    current_xp :=
                        coalesce(
                            (p->>'xp')::integer,
                            0
                        )
                        +
                        enemy_xp;


                    xp_needed := coalesce(
                        (p->>'xpToNext')::integer,
                        50
                    );

                    new_level := coalesce(
                        (p->>'level')::integer,
                        1
                    );

                    new_attack := coalesce(
                        (p->>'attack')::integer,
                        8
                    );

                    new_max_hp := coalesce(
                        (p->>'maxHp')::integer,
                        40
                    );


                    while current_xp >= xp_needed loop

                        current_xp :=
                            current_xp - xp_needed;

                        xp_needed :=
                            xp_needed + 25;

                        new_level :=
                            new_level + 1;

                        new_attack :=
                            new_attack + 1;

                        new_max_hp :=
                            new_max_hp + 3;

                    end loop;


                    p := jsonb_set(
                        p,
                        '{xp}',
                        to_jsonb(current_xp)
                    );

                    p := jsonb_set(
                        p,
                        '{xpToNext}',
                        to_jsonb(xp_needed)
                    );

                    p := jsonb_set(
                        p,
                        '{level}',
                        to_jsonb(new_level)
                    );

                    p := jsonb_set(
                        p,
                        '{attack}',
                        to_jsonb(new_attack)
                    );

                    p := jsonb_set(
                        p,
                        '{maxHp}',
                        to_jsonb(new_max_hp)
                    );


                    p := jsonb_set(
                        p,
                        '{hp}',
                        to_jsonb(
                            least(
                                new_max_hp,
                                coalesce(
                                    (p->>'hp')::integer,
                                    new_max_hp
                                )
                                +
                                3
                            )
                        )
                    );


                else

                    p := jsonb_set(
                        p,
                        '{hp}',
                        to_jsonb(
                            greatest(
                                0,
                                coalesce(
                                    (p->>'hp')::integer,
                                    0
                                )
                                -
                                damage
                            )
                        )
                    );


                    -- Keep the existing village-walk behavior:
                    -- a defeat heals the player rather than ending the walk.

                    if coalesce(
                        (p->>'hp')::integer,
                        0
                    ) <= 0
                    then

                        p := jsonb_set(
                            p,
                            '{hp}',
                            coalesce(
                                p->'maxHp',
                                '40'::jsonb
                            )
                        );

                    end if;

                end if;


                walk_encounter :=
                    walk_encounter
                    +
                    30
                    +
                    floor(random() * 31)::integer;

            end loop;


            walk := jsonb_set(
                walk,
                '{nextEncounterTime}',
                to_jsonb(walk_encounter)
            );


            -- Village walk finished.
            if walk_elapsed >= walk_duration_seconds
            then

                walk := jsonb_set(
                    walk,
                    '{active}',
                    'false'::jsonb
                );

            end if;

        end if;


        -- ============================================================
        -- SAVE EVERYTHING
        -- ============================================================

        village := jsonb_set(
            village,
            '{walk}',
            walk
        );


        paths := jsonb_set(
            paths,
            '{forest}',
            forest
        );

        paths := jsonb_set(
            paths,
            '{ashHills}',
            ash
        );

        paths := jsonb_set(
            paths,
            '{cave}',
            cave
        );


        d := jsonb_set(
            d,
            '{player}',
            p
        );

        d := jsonb_set(
            d,
            '{paths}',
            paths
        );

        d := jsonb_set(
            d,
            '{village}',
            village
        );

        d := jsonb_set(
            d,
            '{savedAt}',
            to_jsonb(now_ms)
        );


        -- Write the processed game back to Supabase.
        update public.game_saves

        set
            save_data = d,
            updated_at = clock_timestamp(),
            idle_last_processed_at = now_ms,
            save_revision = coalesce(r.save_revision, 0) + 1

        where id = r.id;


    end loop;

end;
$$;


-- ============================================================
-- SERVER-AUTHORITATIVE SAVE RPC
-- ============================================================
--
-- The browser never writes game_saves directly anymore.
-- Each write is checked against a server-side revision number.
-- This prevents an old device/browser from overwriting progress
-- that happened on another device or while the device was off.

create or replace function public.save_game_state(
    p_save_data jsonb,
    p_expected_revision bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $
declare
    uid uuid := (select auth.uid());
    existing public.game_saves%rowtype;
    new_data jsonb;
    now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
    new_revision bigint;
begin
    if uid is null then
        raise exception 'You must be signed in to save Utopia.';
    end if;

    new_data := coalesce(p_save_data, '{}'::jsonb);

    new_data := jsonb_set(
        new_data,
        '{savedAt}',
        to_jsonb(now_ms)
    );

    select *
    into existing
    from public.game_saves
    where user_id = uid
    for update;

    if not found then
        new_revision := 1;

        insert into public.game_saves (
            user_id,
            save_data,
            updated_at,
            idle_last_processed_at,
            save_revision
        )
        values (
            uid,
            new_data,
            clock_timestamp(),
            now_ms,
            new_revision
        );

        return jsonb_build_object(
            'conflict', false,
            'save_data', new_data,
            'save_revision', new_revision
        );
    end if;

    if coalesce(existing.save_revision, 0) <> coalesce(p_expected_revision, 0) then
        return jsonb_build_object(
            'conflict', true,
            'save_data', existing.save_data,
            'save_revision', coalesce(existing.save_revision, 0)
        );
    end if;

    new_revision := coalesce(existing.save_revision, 0) + 1;

    update public.game_saves
    set
        save_data = new_data,
        updated_at = clock_timestamp(),
        idle_last_processed_at = now_ms,
        save_revision = new_revision
    where id = existing.id;

    return jsonb_build_object(
        'conflict', false,
        'save_data', new_data,
        'save_revision', new_revision
    );
end;
$;

grant execute
on function public.save_game_state(jsonb, bigint)
to authenticated;


-- ============================================================
-- PERMISSION FOR SIGNED-IN PLAYERS
-- ============================================================

grant execute
on function public.process_idle_games(uuid)
to authenticated;


-- ============================================================
-- CRON JOB
-- ============================================================

-- Make sure Supabase Cron is available for the project.
create extension if not exists pg_cron;

-- The job runs once every minute.
--
-- If the job already exists, Supabase Cron replaces the job
-- with the same name.

select cron.schedule(
    'utopia-idle-engine',
    '* * * * *',
    $$select public.process_idle_games();$$
);
