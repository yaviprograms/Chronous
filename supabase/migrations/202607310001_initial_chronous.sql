-- Chronous: metadata remains visible to its owner; sealed payloads do not.
create extension if not exists pgcrypto with schema extensions;

create type public.capsule_type as enum ('letter', 'goals', 'memories', 'predictions');
create type public.capsule_status as enum ('draft', 'sealed', 'opened');
create type public.capsule_item_type as enum ('letter', 'goal', 'prediction', 'photo');

create table public.capsules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 60),
  subtitle text not null default '',
  capsule_type public.capsule_type not null,
  recipient text not null default 'Future me' check (char_length(recipient) between 1 and 80),
  open_at timestamptz not null,
  status public.capsule_status not null default 'draft',
  accent text not null default '#9D8CFF',
  emoji text not null default '✦',
  reminder_enabled boolean not null default true,
  item_counts jsonb not null default '{"letter":0,"goals":0,"predictions":0,"photos":0}'::jsonb,
  sealed_at timestamptz,
  opened_at timestamptz,
  seal_hash text,
  created_at timestamptz not null default now(),
  constraint future_open_when_sealed check (status = 'draft' or open_at > created_at),
  constraint sealed_state_is_consistent check (
    (status = 'draft' and sealed_at is null and seal_hash is null)
    or (status in ('sealed', 'opened') and sealed_at is not null and seal_hash is not null)
  ),
  constraint opened_state_is_consistent check (
    (status <> 'opened' and opened_at is null)
    or (status = 'opened' and opened_at is not null)
  ),
  constraint item_counts_is_object check (
    jsonb_typeof(item_counts) = 'object'
  )
);

create index capsules_user_open_idx on public.capsules (user_id, open_at);

create table public.capsule_items (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  item_type public.capsule_item_type not null,
  position integer not null default 0 check (position >= 0),
  body text check (body is null or char_length(body) <= 50000),
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint item_has_content check (body is not null or storage_path is not null),
  unique (capsule_id, position, item_type)
);

create index capsule_items_capsule_idx on public.capsule_items (capsule_id, position);

create table public.capsule_events (
  id bigint generated always as identity primary key,
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'sealed', 'opened')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index capsule_events_capsule_time_idx
on public.capsule_events (capsule_id, occurred_at desc);

create index capsule_events_user_time_idx
on public.capsule_events (user_id, occurred_at desc);

alter table public.capsules enable row level security;
alter table public.capsule_items enable row level security;
alter table public.capsule_events enable row level security;

create policy "owners can read capsule metadata"
on public.capsules for select
to authenticated
using (user_id = (select auth.uid()));

create policy "owners can create draft capsules"
on public.capsules for insert
to authenticated
with check (user_id = (select auth.uid()) and status = 'draft');

create policy "owners can edit drafts"
on public.capsules for update
to authenticated
using (user_id = (select auth.uid()) and status = 'draft')
with check (user_id = (select auth.uid()) and status = 'draft');

create policy "owners can delete drafts"
on public.capsules for delete
to authenticated
using (user_id = (select auth.uid()) and status = 'draft');

create policy "owners can add draft items"
on public.capsule_items for insert
to authenticated
with check (
  exists (
    select 1 from public.capsules c
    where c.id = capsule_id
      and c.user_id = (select auth.uid())
      and c.status = 'draft'
  )
);

create policy "owners can edit draft items"
on public.capsule_items for update
to authenticated
using (
  exists (
    select 1 from public.capsules c
    where c.id = capsule_id
      and c.user_id = (select auth.uid())
      and c.status = 'draft'
  )
)
with check (
  exists (
    select 1 from public.capsules c
    where c.id = capsule_id
      and c.user_id = (select auth.uid())
      and c.status = 'draft'
  )
);

create policy "owners can delete draft items"
on public.capsule_items for delete
to authenticated
using (
  exists (
    select 1 from public.capsules c
    where c.id = capsule_id
      and c.user_id = (select auth.uid())
      and c.status = 'draft'
  )
);

-- This is the core lock: PostgREST cannot return payload rows before trusted DB time.
create policy "owners can read revealed items"
on public.capsule_items for select
to authenticated
using (
  exists (
    select 1 from public.capsules c
    where c.id = capsule_id
      and c.user_id = (select auth.uid())
      and (c.status = 'draft' or c.open_at <= now())
  )
);

create policy "owners can read their audit trail"
on public.capsule_events for select
to authenticated
using (user_id = (select auth.uid()));

revoke all on public.capsules, public.capsule_items, public.capsule_events
from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.capsules to authenticated;
grant select, insert, update, delete on public.capsule_items to authenticated;
grant select on public.capsule_events to authenticated;

create or replace function public.seal_capsule(p_capsule_id uuid)
returns public.capsules
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.capsules;
  payload_text text;
  caller_id uuid := (select auth.uid());
  sealed_counts jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select string_agg(
    concat_ws('|', i.item_type::text, i.position::text, coalesce(i.body, ''), coalesce(i.storage_path, '')),
    '||' order by i.position, i.id
  )
  into payload_text
  from public.capsule_items as i
  where i.capsule_id = p_capsule_id;

  if payload_text is null then
    raise exception 'A capsule needs at least one item before sealing';
  end if;

  select jsonb_build_object(
    'letter', count(*) filter (where i.item_type = 'letter'),
    'goals', count(*) filter (where i.item_type = 'goal'),
    'predictions', count(*) filter (where i.item_type = 'prediction'),
    'photos', count(*) filter (where i.item_type = 'photo')
  )
  into sealed_counts
  from public.capsule_items as i
  where i.capsule_id = p_capsule_id;

  update public.capsules c
  set
    status = 'sealed',
    sealed_at = now(),
    item_counts = sealed_counts,
    seal_hash = encode(
      extensions.digest(
        concat_ws('|', c.id::text, c.user_id::text, c.open_at::text, payload_text),
        'sha256'
      ),
      'hex'
    )
  where c.id = p_capsule_id
    and c.user_id = caller_id
    and c.status = 'draft'
    and c.open_at > now() + interval '10 minutes'
  returning * into result;

  if result.id is null then
    raise exception 'Capsule cannot be sealed or its unlock date is too soon';
  end if;

  insert into public.capsule_events (capsule_id, user_id, event_type)
  values (result.id, caller_id, 'sealed');

  return result;
end;
$$;

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
  from public.capsules c
  where c.id = p_capsule_id and c.user_id = caller_id
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
  from public.capsule_items i
  where i.capsule_id = p_capsule_id;

  return jsonb_build_object(
    'capsule', to_jsonb(capsule_record),
    'items', items_payload,
    'trusted_time', now()
  );
end;
$$;

revoke all on function public.seal_capsule(uuid) from public, anon;
revoke all on function public.reveal_capsule(uuid) from public, anon;
grant execute on function public.seal_capsule(uuid) to authenticated;
grant execute on function public.reveal_capsule(uuid) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'capsule-media',
  'capsule-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Expected object path: <user_id>/<capsule_id>/<filename>
create policy "owners can upload draft capsule media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'capsule-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.capsules c
    where c.id = ((storage.foldername(name))[2])::uuid
      and c.user_id = (select auth.uid())
      and c.status = 'draft'
  )
);

create policy "owners can read available capsule media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'capsule-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.capsules c
    where c.id = ((storage.foldername(name))[2])::uuid
      and c.user_id = (select auth.uid())
      and (c.status = 'draft' or c.open_at <= now())
  )
);

create policy "owners can update draft capsule media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'capsule-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.capsules c
    where c.id = ((storage.foldername(name))[2])::uuid
      and c.user_id = (select auth.uid())
      and c.status = 'draft'
  )
)
with check (
  bucket_id = 'capsule-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.capsules c
    where c.id = ((storage.foldername(name))[2])::uuid
      and c.user_id = (select auth.uid())
      and c.status = 'draft'
  )
);

create policy "owners can delete draft capsule media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'capsule-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.capsules c
    where c.id = ((storage.foldername(name))[2])::uuid
      and c.user_id = (select auth.uid())
      and c.status = 'draft'
  )
);
