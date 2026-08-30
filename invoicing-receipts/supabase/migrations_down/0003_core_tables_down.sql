-- Down for 0003_core_tables.sql — reverse dependency order.

drop table if exists customer_document_consents;

drop trigger if exists items_set_updated_at on items;
drop table if exists items;

drop trigger if exists customers_set_updated_at on customers;
drop table if exists customers;

drop table if exists business_signing_keys;

drop trigger if exists business_members_min_owner_trg on business_members;
drop function if exists public.enforce_business_min_owner();
drop table if exists business_members;

drop trigger if exists businesses_set_updated_at on businesses;
drop table if exists businesses;

drop table if exists vat_rates;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();
drop table if exists users;

drop function if exists public.set_updated_at();
