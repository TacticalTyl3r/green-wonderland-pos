-- Green Wonderland: store a public HTTPS image URL for each catalog product.
-- Safe to run again.
alter table public.products
  add column if not exists image_url text;

comment on column public.products.image_url is
  'Optional public HTTPS URL for the product photo displayed in the POS catalog.';
