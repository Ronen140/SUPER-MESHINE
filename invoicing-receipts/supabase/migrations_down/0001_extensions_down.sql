-- Down for 0001_extensions.sql
-- Safe only once every migration that depends on these extensions (0002-000N) has
-- already been rolled back — run down scripts in strict reverse order.

drop extension if exists moddatetime;
drop extension if exists citext;
drop extension if exists pgcrypto;
