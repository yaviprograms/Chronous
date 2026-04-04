-- Persistent friend requests and accepted friendships.
create type public.friendship_status as enum ('pending', 'accepted');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendship_users_differ check (requester_id <> addressee_id),
  constraint friendship_response_consistent check (
    (status = 'pending' and responded_at is null)
    or (status = 'accepted' and responded_at is not null)
  )
);

create unique index friendships_unordered_pair_idx
on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create index friendships_requester_status_idx
on public.friendships (requester_id, status, created_at desc);

create index friendships_addressee_status_idx
on public.friendships (addressee_id, status, created_at desc);

alter table public.friendships enable row level security;

revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

create policy "participants can read their friendships"
on public.friendships for select
to authenticated
using (
  requester_id = (select auth.uid())
  or addressee_id = (select auth.uid())
);

create or replace function public.send_friend_request(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_profile public.profiles;
  relationship public.friendships;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select p.* into target_profile
  from public.profiles as p
  where p.username = lower(regexp_replace(btrim(p_username), '^@', ''));

  if target_profile.id is null then
    raise exception 'No Chronous account uses that handle';
  end if;
  if target_profile.id = caller_id then
    raise exception 'You cannot add yourself as a friend';
  end if;

  select f.* into relationship
  from public.friendships as f
  where (f.requester_id = caller_id and f.addressee_id = target_profile.id)
     or (f.requester_id = target_profile.id and f.addressee_id = caller_id)
  for update;

  if relationship.id is null then
    insert into public.friendships (requester_id, addressee_id)
    values (caller_id, target_profile.id)
    returning * into relationship;
  elsif relationship.status = 'pending' and relationship.addressee_id = caller_id then
    update public.friendships
    set status = 'accepted', responded_at = now()
    where id = relationship.id
    returning * into relationship;
  end if;

  return jsonb_build_object(
    'id', relationship.id,
    'status', relationship.status,
    'profile', jsonb_build_object(
      'id', target_profile.id,
      'display_name', target_profile.display_name,
      'username', target_profile.username
    )
  );
end;
$$;

revoke all on function public.send_friend_request(text) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;

create or replace function public.respond_friend_request(
  p_friendship_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  relationship public.friendships;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select f.* into relationship
  from public.friendships as f
  where f.id = p_friendship_id
    and f.addressee_id = caller_id
    and f.status = 'pending'
  for update;

  if relationship.id is null then
    raise exception 'Pending friend request not found';
  end if;

  if p_accept then
    update public.friendships
    set status = 'accepted', responded_at = now()
    where id = relationship.id;
  else
    delete from public.friendships where id = relationship.id;
  end if;
end;
$$;

revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

create or replace function public.remove_friendship(p_friendship_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.friendships
  where id = p_friendship_id
    and (requester_id = caller_id or addressee_id = caller_id);

  if not found then
    raise exception 'Friendship not found';
  end if;
end;
$$;

revoke all on function public.remove_friendship(uuid) from public, anon;
grant execute on function public.remove_friendship(uuid) to authenticated;

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
    raise exception 'Friend not found';
  end if;

  if not exists (
    select 1
    from public.friendships as f
    where f.status = 'accepted'
      and (
        (f.requester_id = caller_id and f.addressee_id = target_profile.id)
        or (f.requester_id = target_profile.id and f.addressee_id = caller_id)
      )
  ) then
    raise exception 'Only accepted friends can share a capsule';
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
