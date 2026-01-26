-- Supabase default privileges grant broad table rights to API roles.
-- RLS does not apply to TRUNCATE, so explicitly keep only app-required actions.
revoke all on public.capsules, public.capsule_items, public.capsule_events
from anon, authenticated;

grant select, insert, update, delete on public.capsules to authenticated;
grant select, insert, update, delete on public.capsule_items to authenticated;
grant select on public.capsule_events to authenticated;
