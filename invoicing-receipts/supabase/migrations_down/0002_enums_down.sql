-- Down for 0002_enums.sql
-- Safe only once every table column of these types has been dropped (0003+ downs must run first).
-- Order doesn't matter between these 9 types (no enum-to-enum dependency), but listed in the
-- same order as the up migration for readability.

drop type if exists actor_type;
drop type if exists consent_channel;
drop type if exists pdf_status;
drop type if exists member_role;
drop type if exists vat_treatment;
drop type if exists payment_method;
drop type if exists document_status;
drop type if exists document_type;
drop type if exists entity_type;
