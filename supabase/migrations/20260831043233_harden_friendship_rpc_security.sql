-- Run friendship writes with caller privileges and let RLS enforce ownership.
grant insert (requester_id, addressee_id, status, responded_at)
on public.friendships to authenticated;
grant update (status, responded_at)
on public.friendships to authenticated;
grant delete on public.friendships to authenticated;

create policy "users can send pending friend requests"
on public.friendships for insert
to authenticated
with check (
  requester_id = (select auth.uid())
  and addressee_id <> (select auth.uid())
  and status = 'pending'
  and responded_at is null
);

create policy "recipients can accept pending friend requests"
on public.friendships for update
to authenticated
using (
  addressee_id = (select auth.uid())
  and status = 'pending'
)
with check (
  addressee_id = (select auth.uid())
  and status = 'accepted'
  and responded_at is not null
);

create policy "participants can remove friendships"
on public.friendships for delete
to authenticated
using (
  requester_id = (select auth.uid())
  or addressee_id = (select auth.uid())
);

alter function public.send_friend_request(text) security invoker;
alter function public.respond_friend_request(uuid, boolean) security invoker;
alter function public.remove_friendship(uuid) security invoker;

grant insert (capsule_id, user_id, invited_by, role)
on public.capsule_members to authenticated;

create policy "owners can invite accepted friends to drafts"
on public.capsule_members for insert
to authenticated
with check (
  invited_by = (select auth.uid())
  and user_id <> (select auth.uid())
  and exists (
    select 1
    from public.capsules as c
    where c.id = capsule_id
      and c.user_id = (select auth.uid())
      and c.status = 'draft'
  )
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

alter function public.invite_capsule_member(uuid, text) security invoker;
