-- Utopia server-side idle engine
-- Run this file once in Supabase Dashboard -> SQL Editor.
-- It moves time-based idle processing into Postgres, so it continues
-- while every browser/device is closed.

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
    reward_count integer;
    old_reward_count integer;
    walk_elapsed integer;
    walk_capped integer;
    walk_encounter integer;
    rest_start bigint;
    rest_duration bigint;
    rest_elapsed bigint;
    xp_gain integer;
    xp_needed integer;
    new_level integer;
    new_attack integer;
    new_max_hp integer;
    current_xp integer;
begin
    -- A browser may process only its own account.
    if p_user_id is not null then
        if auth.uid() is null or auth.uid() <> p_user_id then
            raise exception 'Not allowed to process another account';
        end if;
        target_id := p_user_id;
    else
        target_id := null;
    end if;

    for r in
        select id, user_id, save_data
        from public.game_saves
        where target_id is null or user_id = target_id
    loop
        d := r.save_data;
        p := coalesce(d->'player', '{}'::jsonb);
        paths := coalesce(d->'paths', '{}'::jsonb);
        forest := coalesce(paths->'forest', '{}'::jsonb);
        ash := coalesce(paths->'ashHills', '{}'::jsonb);
        cave := coalesce(paths->'cave', '{}'::jsonb);
        village := coalesce(d->'village', '{}'::jsonb);
        walk := coalesce(village->'walk', '{}'::jsonb);

        -- ============================================================
        -- RESTING: server time completes rests even with zero devices on.
        -- ============================================================
        if coalesce((d->>'resting')::boolean, false) then
            rest_start := coalesce((d->>'restStartTime')::bigint, now_ms);
            rest_duration := coalesce((d->>'restDuration')::bigint, 0);
            rest_elapsed := now_ms - rest_start;

            if rest_duration > 0 and rest_elapsed >= rest_duration then
                p := jsonb_set(p, '{hp}', coalesce(p->'maxHp', '0'::jsonb));
                d := jsonb_set(d, '{resting}', 'false'::jsonb);
                d := jsonb_set(d, '{restForced}', 'false'::jsonb);
                d := jsonb_set(d, '{restStartTime}', '0'::jsonb);
                d := jsonb_set(d, '{restDuration}', '0'::jsonb);

                -- Walking starts when the rest finishes, not at the old
                -- timestamp from before the rest.
                if coalesce((d->>'currentPath') = 'forest', false) then
                    forest := jsonb_set(forest, '{lastUpdateTime}', to_jsonb(now_ms));
                end if;

                if coalesce((ash->>'active')::boolean, false) then
                    ash := jsonb_set(ash, '{lastUpdateTime}', to_jsonb(now_ms));
                end if;
            end if;
        end if;

        -- ============================================================
        -- FOREST
        -- ============================================================
        if not coalesce((forest->>'completed')::boolean, false)
           and not coalesce((village->>'unlocked')::boolean, false)
           and not coalesce((d->>'gameEnded')::boolean, false)
           and not coalesce((d->>'resting')::boolean, false)
           and coalesce(d->>'currentPath', 'forest') = 'forest'
        then
            elapsed := floor((now_ms - coalesce((forest->>'lastUpdateTime')::bigint, now_ms)) / 1000);

            if elapsed > 0 then
                old_progress := coalesce((forest->>'progress')::integer, 0);
                target_progress := least(coalesce((forest->>'duration')::integer, 300), old_progress + elapsed);
                encounter := coalesce((forest->>'encounterTime')::integer, 45);

                while encounter <= target_progress and encounter > old_progress loop
                    -- Four current forest enemies:
                    -- Corrupt Druid 6/6/2, Goblin 5/8/3,
                    -- Blight 7/7/4, Slime 6/9/3.
                    case floor(random() * 4)::integer
                        when 0 then enemy_attack := 6; enemy_xp := 6; enemy_gold := 2;
                        when 1 then enemy_attack := 5; enemy_xp := 8; enemy_gold := 3;
                        when 2 then enemy_attack := 7; enemy_xp := 7; enemy_gold := 4;
                        else enemy_attack := 6; enemy_xp := 9; enemy_gold := 3;
                    end case;

                    damage := greatest(0, enemy_attack - coalesce((p->>'attack')::integer, 0));

                    if damage = 0 then
                        p := jsonb_set(p, '{gold}', to_jsonb(coalesce((p->>'gold')::integer, 0) + enemy_gold));
                        xp_gain := enemy_xp;
                        current_xp := coalesce((p->>'xp')::integer, 0) + xp_gain;
                        xp_needed := coalesce((p->>'xpToNext')::integer, 50);
                        new_level := coalesce((p->>'level')::integer, 1);
                        new_attack := coalesce((p->>'attack')::integer, 8);
                        new_max_hp := coalesce((p->>'maxHp')::integer, 40);

                        while current_xp >= xp_needed loop
                            current_xp := current_xp - xp_needed;
                            xp_needed := xp_needed + 25;
                            new_level := new_level + 1;
                            new_attack := new_attack + 1;
                            new_max_hp := new_max_hp + 3;
                        end loop;

                        p := jsonb_set(p, '{xp}', to_jsonb(current_xp));
                        p := jsonb_set(p, '{xpToNext}', to_jsonb(xp_needed));
                        p := jsonb_set(p, '{level}', to_jsonb(new_level));
                        p := jsonb_set(p, '{attack}', to_jsonb(new_attack));
                        p := jsonb_set(p, '{maxHp}', to_jsonb(new_max_hp));
                        p := jsonb_set(p, '{hp}', to_jsonb(least(new_max_hp, coalesce((p->>'hp')::integer, new_max_hp) + 3));
                    else
                        p := jsonb_set(p, '{hp}', to_jsonb(greatest(0, coalesce((p->>'hp')::integer, 0) - damage)));

                        if coalesce((p->>'hp')::integer, 0) <= 0 then
                            rest_duration := greatest(0, coalesce((p->>'maxHp')::integer, 40)) * 30000;
                            d := jsonb_set(d, '{resting}', 'true'::jsonb);
                            d := jsonb_set(d, '{restForced}', 'true'::jsonb);
                            d := jsonb_set(d, '{restStartTime}', to_jsonb(now_ms));
                            d := jsonb_set(d, '{restDuration}', to_jsonb(rest_duration));
                            forest := jsonb_set(forest, '{progress}', to_jsonb(encounter));
                            forest := jsonb_set(forest, '{lastUpdateTime}', to_jsonb(now_ms));
                            exit;
                        end if;
                    end if;

                    encounter := encounter + 30 + floor(random() * 31)::integer;
                end loop;

                if not coalesce((d->>'resting')::boolean, false) then
                    forest := jsonb_set(forest, '{progress}', to_jsonb(target_progress));
                    forest := jsonb_set(forest, '{encounterTime}', to_jsonb(encounter));
                    forest := jsonb_set(forest, '{lastUpdateTime}', to_jsonb(now_ms));

                    if target_progress >= coalesce((forest->>'duration')::integer, 300) then
                        forest := jsonb_set(forest, '{completed}', 'true'::jsonb);
                        d := jsonb_set(d, '{gameEnded}', 'true'::jsonb);
                    end if;
                end if;
            end if;
        end if;

        -- ============================================================
        -- ASH HILLS
        -- ============================================================
        if coalesce((ash->>'active')::boolean, false)
           and not coalesce((ash->>'completed')::boolean, false)
           and not coalesce((d->>'resting')::boolean, false)
        then
            elapsed := floor((now_ms - coalesce((ash->>'lastUpdateTime')::bigint, now_ms)) / 1000);

            if elapsed > 0 then
                old_progress := coalesce((ash->>'progress')::integer, 0);
                target_progress := least(coalesce((ash->>'duration')::integer, 2700), old_progress + elapsed);
                encounter := coalesce((ash->>'encounterTime')::integer, 45);

                while encounter <= target_progress and encounter > old_progress loop
                    case floor(random() * 4)::integer
                        when 0 then enemy_attack := 17; enemy_xp := 28; enemy_gold := 12;
                        when 1 then enemy_attack := 19; enemy_xp := 32; enemy_gold := 15;
                        when 2 then enemy_attack := 21; enemy_xp := 38; enemy_gold := 18;
                        else enemy_attack := 23; enemy_xp := 45; enemy_gold := 22;
                    end case;

                    damage := greatest(0, enemy_attack - coalesce((p->>'attack')::integer, 0));

                    if damage = 0 then
                        p := jsonb_set(p, '{gold}', to_jsonb(coalesce((p->>'gold')::integer, 0) + enemy_gold));
                        current_xp := coalesce((p->>'xp')::integer, 0) + enemy_xp;
                        xp_needed := coalesce((p->>'xpToNext')::integer, 50);
                        new_level := coalesce((p->>'level')::integer, 1);
                        new_attack := coalesce((p->>'attack')::integer, 8);
                        new_max_hp := coalesce((p->>'maxHp')::integer, 40);

                        while current_xp >= xp_needed loop
                            current_xp := current_xp - xp_needed;
                            new_level := new_level + 1;
                            new_attack := new_attack + 1;
                            new_max_hp := new_max_hp + 3;
                        end loop;

                        p := jsonb_set(p, '{xp}', to_jsonb(current_xp));
                        p := jsonb_set(p, '{xpToNext}', to_jsonb(xp_needed));
                        p := jsonb_set(p, '{level}', to_jsonb(new_level));
                        p := jsonb_set(p, '{attack}', to_jsonb(new_attack));
                        p := jsonb_set(p, '{maxHp}', to_jsonb(new_max_hp));
                        p := jsonb_set(p, '{hp}', to_jsonb(least(new_max_hp, coalesce((p->>'hp')::integer, new_max_hp) + 3));
                    else
                        p := jsonb_set(p, '{hp}', to_jsonb(greatest(0, coalesce((p->>'hp')::integer, 0) - damage)));

                        if coalesce((p->>'hp')::integer, 0) <= 0 then
                            rest_duration := greatest(0, coalesce((p->>'maxHp')::integer, 40)) * 30000;
                            d := jsonb_set(d, '{resting}', 'true'::jsonb);
                            d := jsonb_set(d, '{restForced}', 'true'::jsonb);
                            d := jsonb_set(d, '{restStartTime}', to_jsonb(now_ms));
                            d := jsonb_set(d, '{restDuration}', to_jsonb(rest_duration));
                            ash := jsonb_set(ash, '{progress}', to_jsonb(encounter));
                            ash := jsonb_set(ash, '{lastUpdateTime}', to_jsonb(now_ms));
                            exit;
                        end if;
                    end if;

                    encounter := encounter + 30 + floor(random() * 31)::integer;
                end loop;

                if not coalesce((d->>'resting')::boolean, false) then
                    ash := jsonb_set(ash, '{progress}', to_jsonb(target_progress));
                    ash := jsonb_set(ash, '{encounterTime}', to_jsonb(encounter));
                    ash := jsonb_set(ash, '{lastUpdateTime}', to_jsonb(now_ms));

                    if target_progress >= coalesce((ash->>'duration')::integer, 2700) then
                        ash := jsonb_set(ash, '{completed}', 'true'::jsonb);
                        ash := jsonb_set(ash, '{active}', 'false'::jsonb);
                        d := jsonb_set(d, '{gameEnded}', 'true'::jsonb);
                    end if;
                end if;
            end if;
        end if;

        -- ============================================================
        -- VILLAGE WALK
        -- ============================================================
        walk := coalesce(village->'walk', '{}'::jsonb);

        if coalesce((walk->>'active')::boolean, false)
           and not coalesce((d->>'resting')::boolean, false)
        then
            walk_elapsed := floor((now_ms - coalesce((walk->>'startTime')::bigint, now_ms)) / 1000);
            walk_capped := least(walk_elapsed, coalesce((walk->>'duration')::integer, 1200));

            old_reward_count := coalesce((walk->>'lastRewardCount')::integer, 0);
            reward_count := floor(walk_capped / 15);

            if reward_count > old_reward_count then
                for i in 1..(reward_count - old_reward_count) loop
                    case floor(random() * 3)::integer
                        when 0 then village := jsonb_set(village, '{resources,wood}',
                            to_jsonb(coalesce((village#>>'{resources,wood}')::integer, 0) + 1));
                        when 1 then village := jsonb_set(village, '{resources,stone}',
                            to_jsonb(coalesce((village#>>'{resources,stone}')::integer, 0) + 1));
                        else village := jsonb_set(village, '{resources,food}',
                            to_jsonb(coalesce((village#>>'{resources,food}')::integer, 0) + 1));
                    end case;
                end loop;
                walk := jsonb_set(walk, '{lastRewardCount}', to_jsonb(reward_count));
            end if;

            walk_encounter := coalesce((walk->>'nextEncounterTime')::integer, 30);

            while walk_encounter <= walk_capped loop
                -- Current village walk enemies are resolved with the same
                -- attack comparison as the browser battle system.
                case floor(random() * 3)::integer
                    when 0 then enemy_attack := 11; enemy_xp := 12; enemy_gold := 5;
                    when 1 then enemy_attack := 12; enemy_xp := 16; enemy_gold := 7;
                    else enemy_attack := 14; enemy_xp := 20; enemy_gold := 9;
                end case;

                damage := greatest(0, enemy_attack - coalesce((p->>'attack')::integer, 0));

                if damage = 0 then
                    p := jsonb_set(p, '{gold}', to_jsonb(coalesce((p->>'gold')::integer, 0) + enemy_gold));
                    current_xp := coalesce((p->>'xp')::integer, 0) + enemy_xp;
                    xp_needed := coalesce((p->>'xpToNext')::integer, 50);
                    new_level := coalesce((p->>'level')::integer, 1);
                    new_attack := coalesce((p->>'attack')::integer, 8);
                    new_max_hp := coalesce((p->>'maxHp')::integer, 40);

                    while current_xp >= xp_needed loop
                        current_xp := current_xp - xp_needed;
                        xp_needed := xp_needed + 25;
                        new_level := new_level + 1;
                        new_attack := new_attack + 1;
                        new_max_hp := new_max_hp + 3;
                    end loop;

                    p := jsonb_set(p, '{xp}', to_jsonb(current_xp));
                    p := jsonb_set(p, '{xpToNext}', to_jsonb(xp_needed));
                    p := jsonb_set(p, '{level}', to_jsonb(new_level));
                    p := jsonb_set(p, '{attack}', to_jsonb(new_attack));
                    p := jsonb_set(p, '{maxHp}', to_jsonb(new_max_hp));
                    p := jsonb_set(p, '{hp}', to_jsonb(least(new_max_hp, coalesce((p->>'hp')::integer, new_max_hp) + 3));
                else
                    p := jsonb_set(p, '{hp}', to_jsonb(greatest(0, coalesce((p->>'hp')::integer, 0) - damage)));

                    if coalesce((p->>'hp')::integer, 0) <= 0 then
                        p := jsonb_set(p, '{hp}', coalesce(p->'maxHp', '40'::jsonb));
                    end if;
                end if;

                walk_encounter := walk_encounter + 30 + floor(random() * 31)::integer;
            end loop;

            walk := jsonb_set(walk, '{nextEncounterTime}', to_jsonb(walk_encounter));

            if walk_elapsed >= coalesce((walk->>'duration')::integer, 1200) then
                walk := jsonb_set(walk, '{active}', 'false'::jsonb);
            end if;
        end if;

        village := jsonb_set(village, '{walk}', walk);
        paths := jsonb_set(paths, '{forest}', forest);
        paths := jsonb_set(paths, '{ashHills}', ash);
        paths := jsonb_set(paths, '{cave}', cave);
        d := jsonb_set(d, '{player}', p);
        d := jsonb_set(d, '{paths}', paths);
        d := jsonb_set(d, '{village}', village);
        d := jsonb_set(d, '{savedAt}', to_jsonb(now_ms));

        update public.game_saves
        set save_data = d,
            updated_at = clock_timestamp()
        where id = r.id;
    end loop;
end;
$$;

-- The game can ask the server to process only the signed-in account
-- immediately after opening, without processing anyone else's save.
grant execute on function public.process_idle_games(uuid) to authenticated;

-- The scheduled job processes every account once per minute.
-- Enable Supabase Cron/pg_cron first if it is not already enabled.
select cron.schedule(
    'utopia-idle-engine',
    '* * * * *',
    $$select public.process_idle_games();$$
);
