-- Down for 0012_storage_buckets.sql

drop policy if exists business_assets_insert on storage.objects;
drop policy if exists business_assets_read on storage.objects;
drop policy if exists documents_bucket_read on storage.objects;

delete from storage.buckets where id in ('documents', 'business-assets');
