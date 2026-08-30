-- Down for 0011_create_business.sql

revoke execute on function public.create_business(text, public.entity_type, text, text, text)
  from authenticated;

drop function public.create_business(text, public.entity_type, text, text, text);
