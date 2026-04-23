-- Shared capsules stay as visible drafts while invited friends contribute.
alter table public.capsules
add column collaborative boolean not null default false;

alter table public.capsule_items
add column contributor_id uuid references auth.users(id) on delete restrict;

update public.capsule_items as i
set contributor_id = c.user_id
from public.capsules as c
where c.id = i.capsule_id;

alter table public.capsule_items
alter column contributor_id set default auth.uid(),
alter column contributor_id set not null;

create index capsule_items_contributor_idx
on public.capsule_items (contributor_id, capsule_id);

drop policy "owners can add draft items" on public.capsule_items;
drop policy "owners can delete draft items" on public.capsule_items;
drop policy "participants can read revealed items" on public.capsule_items;

create policy "participants can add their own draft contributions"
on public.capsule_items for insert
to authenticated
with check (
  contributor_id = (select auth.uid())
  and exists (
    select 1
    from public.capsules as c
    where c.id = capsule_id
      and c.status = 'draft'
      and (
        c.user_id = (select auth.uid())
        or (
          c.collaborative
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

create policy "contributors and owners can delete draft contributions"
on public.capsule_items for delete
to authenticated
using (
  exists (
    select 1
    from public.capsules as c
    where c.id = capsule_id
      and c.status = 'draft'
      and (
        c.user_id = (select auth.uid())
        or (
          c.collaborative
          and contributor_id = (select auth.uid())
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

create policy "participants can read drafts and revealed items"
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
          ((c.status = 'draft' and c.collaborative) or c.open_at <= now())
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

create or replace function public.add_capsule_contribution(
  p_capsule_id uuid,
  p_body text
)
returns public.capsule_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_position integer;
  result public.capsule_items;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'A contribution cannot be empty';
  end if;
  if char_length(p_body) > 5000 then
    raise exception 'A contribution must be 5000 characters or fewer';
  end if;
  if not exists (
    select 1
    from public.capsules as c
    where c.id = p_capsule_id
      and c.status = 'draft'
      and c.collaborative
      and (
        c.user_id = (select auth.uid())
        or exists (
          select 1
          from public.capsule_members as m
          where m.capsule_id = c.id
            and m.user_id = (select auth.uid())
        )
      )
  ) then
    raise exception 'This collaborative capsule is unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_capsule_id::text, 0)
  );

  select coalesce(max(i.position), -1) + 1
  into next_position
  from public.capsule_items as i
  where i.capsule_id = p_capsule_id;

  insert into public.capsule_items (
    capsule_id,
    contributor_id,
    item_type,
    position,
    body,
    metadata
  )
  values (
    p_capsule_id,
    (select auth.uid()),
    'letter',
    next_position,
    btrim(p_body),
    jsonb_build_object('collaborative', true)
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.add_capsule_contribution(uuid, text) from public, anon;
grant execute on function public.add_capsule_contribution(uuid, text) to authenticated;

-- Invited collaborators need the same draft-only access to photos as they have
-- to text items. Sealed media remains unavailable to every participant until
-- the database unlock time has passed.
drop policy "participants can read available capsule media" on storage.objects;
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
          ((c.status = 'draft' and c.collaborative) or c.open_at <= now())
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
