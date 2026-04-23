-- Break the capsules <-> capsule_members RLS cycle with one narrowly scoped
-- owner lookup in an unexposed schema. The helper binds authorization to the
-- caller's auth.uid() and returns only a boolean.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_draft_capsule_owner(p_capsule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.capsules as c
      where c.id = p_capsule_id
        and c.user_id = (select auth.uid())
        and c.status = 'draft'
    );
$$;

revoke all on function private.is_draft_capsule_owner(uuid) from public, anon;
grant execute on function private.is_draft_capsule_owner(uuid) to authenticated;

drop policy "owners can invite accepted friends to drafts"
on public.capsule_members;

create policy "owners can invite accepted friends to drafts"
on public.capsule_members for insert
to authenticated
with check (
  invited_by = (select auth.uid())
  and user_id <> (select auth.uid())
  and (select private.is_draft_capsule_owner(capsule_id))
  and exists (
    select 1
    from public.friendships as f
    where f.status = 'accepted'
      and (
        (f.requester_id = (select auth.uid()) and f.addressee_id = user_id)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = user_id)
      )
  )
);
