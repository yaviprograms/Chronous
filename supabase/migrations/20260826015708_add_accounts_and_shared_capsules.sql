-- Account profiles and shared capsule access.
-- Profiles expose only display names and generated handles; email remains in auth.users.

create schema if not exists chronous_private;
revoke all on schema chronous_private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  username text not null unique check (
    char_length(username) between 3 and 40
    and username ~ '^[a-z0-9_]+$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;

create policy "authenticated users can discover profiles"
on public.profiles for select
to authenticated
using (true);

create policy "users can update their own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create or replace function chronous_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  profile_name text;
begin
  base_username := lower(
    regexp_replace(
      split_part(coalesce(new.email, 'keeper'), '@', 1),
      '[^a-zA-Z0-9_]+',
      '',
      'g'
    )
  );

  if char_length(base_username) < 2 then
    base_username := 'keeper';
  end if;

  profile_name := left(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Chronous keeper'
    ),
    80
  );

  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    profile_name,
    left(base_username, 30) || '_' || substr(replace(new.id::text, '-', ''), 1, 8)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function chronous_private.handle_new_user()
from public, anon, authenticated;

drop trigger if exists chronous_on_auth_user_created on auth.users;
create trigger chronous_on_auth_user_created
after insert on auth.users
for each row execute function chronous_private.handle_new_user();

insert into public.profiles (id, display_name, username)
select
  u.id,
  left(
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Chronous keeper'
    ),
    80
  ),
  left(
    case
      when char_length(
        lower(regexp_replace(split_part(coalesce(u.email, 'keeper'), '@', 1), '[^a-zA-Z0-9_]+', '', 'g'))
      ) >= 2
      then lower(regexp_replace(split_part(coalesce(u.email, 'keeper'), '@', 1), '[^a-zA-Z0-9_]+', '', 'g'))
      else 'keeper'
    end,
    30
  ) || '_' || substr(replace(u.id::text, '-', ''), 1, 8)
from auth.users as u
on conflict (id) do nothing;

create table public.capsule_members (
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role = 'viewer'),
  created_at timestamptz not null default now(),
  primary key (capsule_id, user_id),
  constraint capsule_member_not_inviter check (user_id <> invited_by)
);

create index capsule_members_user_idx on public.capsule_members (user_id, capsule_id);
create index capsule_members_inviter_idx on public.capsule_members (invited_by, capsule_id);

alter table public.capsule_members enable row level security;

revoke all on public.capsule_members from anon, authenticated;
grant select on public.capsule_members to authenticated;

create policy "participants can read relevant memberships"
on public.capsule_members for select
to authenticated
using (
  user_id = (select auth.uid())
  or invited_by = (select auth.uid())
);

create or replace function public.invite_capsule_member(
  p_capsule_id uuid,
  p_username text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_profile public.profiles;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.capsules as c
    where c.id = p_capsule_id
      and c.user_id = caller_id
      and c.status = 'draft'
  ) then
    raise exception 'Only the owner can invite friends to a draft capsule';
  end if;

  select p.* into target_profile
  from public.profiles as p
  where p.username = lower(regexp_replace(btrim(p_username), '^@', ''));

  if target_profile.id is null then
    raise exception 'No Chronous account uses handle @%', p_username;
  end if;

  if target_profile.id = caller_id then
    raise exception 'You already own this capsule';
  end if;

  insert into public.capsule_members (capsule_id, user_id, invited_by)
  values (p_capsule_id, target_profile.id, caller_id)
  on conflict (capsule_id, user_id) do nothing;

  return jsonb_build_object(
    'id', target_profile.id,
    'display_name', target_profile.display_name,
    'username', target_profile.username
  );
end;
$$;

revoke all on function public.invite_capsule_member(uuid, text) from public, anon;
grant execute on function public.invite_capsule_member(uuid, text) to authenticated;

drop policy "owners can read capsule metadata" on public.capsules;
create policy "participants can read capsule metadata"
on public.capsules for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.capsule_members as m
    where m.capsule_id = id
      and m.user_id = (select auth.uid())
  )
);

drop policy "owners can read revealed items" on public.capsule_items;
create policy "participants can read revealed items"
on public.capsule_items for select
to authenticated
using (
  exists (
    select 1
    from public.capsules as c
    where c.id = capsule_id
      and (
        (
          c.user_id = (select auth.uid())
          and (c.status = 'draft' or c.open_at <= now())
        )
        or (
          c.open_at <= now()
          and exists (
            select 1
            from public.capsule_members as m
            where m.capsule_id = c.id
              and m.user_id = (select auth.uid())
          )
        )
      )
  )
);

drop policy "owners can read their audit trail" on public.capsule_events;
create policy "participants can read their audit trail"
on public.capsule_events for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.capsule_members as m
    where m.capsule_id = capsule_events.capsule_id
      and m.user_id = (select auth.uid())
  )
);

create or replace function public.reveal_capsule(p_capsule_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  capsule_record public.capsules;
  items_payload jsonb;
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select * into capsule_record
  from public.capsules as c
  where c.id = p_capsule_id
    and (
      c.user_id = caller_id
      or exists (
        select 1
        from public.capsule_members as m
        where m.capsule_id = c.id and m.user_id = caller_id
      )
    )
  for update;

  if capsule_record.id is null then
    raise exception 'Capsule not found';
  end if;
  if capsule_record.status = 'draft' then
    raise exception 'Draft capsules cannot be revealed';
  end if;
  if capsule_record.open_at > now() then
    raise exception 'Capsule is not ready to open';
  end if;

  if capsule_record.opened_at is null then
    update public.capsules
    set status = 'opened', opened_at = now()
    where id = p_capsule_id
    returning * into capsule_record;

    insert into public.capsule_events (capsule_id, user_id, event_type)
    values (capsule_record.id, caller_id, 'opened');
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(i) - 'capsule_id' order by i.position, i.id),
    '[]'::jsonb
  )
  into items_payload
  from public.capsule_items as i
  where i.capsule_id = p_capsule_id;

  return jsonb_build_object(
    'capsule', to_jsonb(capsule_record),
    'items', items_payload,
    'trusted_time', now()
  );
end;
$$;

revoke all on function public.reveal_capsule(uuid) from public, anon;
grant execute on function public.reveal_capsule(uuid) to authenticated;

drop policy "owners can read available capsule media" on storage.objects;
create policy "participants can read available capsule media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'capsule-media'
  and exists (
    select 1
    from public.capsules as c
    where c.id = ((storage.foldername(name))[2])::uuid
      and c.user_id = ((storage.foldername(name))[1])::uuid
      and (
        (
          c.user_id = (select auth.uid())
          and (c.status = 'draft' or c.open_at <= now())
        )
        or (
          c.open_at <= now()
          and exists (
            select 1
            from public.capsule_members as m
            where m.capsule_id = c.id
              and m.user_id = (select auth.uid())
          )
        )
      )
  )
);
