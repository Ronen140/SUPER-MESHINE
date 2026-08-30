-- Down for 0017_log_event_revert.sql — restores 0016_log_event_and_fixes.sql's
-- `public.log_event()` verbatim, including the `v_is_service_role` branch and the
-- `service_role` EXECUTE grant. Deliberately reintroduces the reverted extension; correct
-- behavior for a down migration.

create or replace function public.log_event(
  p_business_id uuid,
  p_action      text,
  p_table_name  text default null,
  p_record_id   uuid default null,
  p_meta        jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_service_role boolean;
begin
  v_is_service_role := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', ''
  ) = 'service_role';

  if p_action not in ('download', 'view_public', 'export',
                      'consent_grant', 'consent_revoke', 'key_create', 'key_revoke')
    then raise exception 'INV_BAD_EVENT: % is not a loggable event', p_action
      using errcode = 'P0001';
  end if;

  if v_is_service_role then
    -- Server-side caller holding the service_role key (e.g. api/keygen.py, right after
    -- writing business_signing_keys) — already the most-trusted role in this system
    -- (ADR-INV-001 §D5); there is no auth.uid() to check membership against for a request
    -- that never carried an end-user session.
    insert into public.audit_log (business_id, actor_type, actor_id, action,
                                  table_name, record_id, after_data)
    values (p_business_id, 'service', null, p_action, p_table_name, p_record_id, p_meta);
    return;
  end if;

  if not app.has_role(p_business_id, array['owner', 'editor', 'viewer', 'accountant']::public.member_role[])
    then raise exception 'INV_FORBIDDEN: not a member of this business'
      using errcode = 'P0001';
  end if;

  insert into public.audit_log (business_id, actor_type, actor_id, action,
                                table_name, record_id, after_data)
  values (p_business_id, 'user', auth.uid(), p_action, p_table_name, p_record_id, p_meta);
end;
$$;

revoke execute on function public.log_event(uuid, text, text, uuid, jsonb) from public, anon;
grant  execute on function public.log_event(uuid, text, text, uuid, jsonb) to authenticated, service_role;
