-- Green Wonderland catalog options: flavors and strains for POS selection.
-- Safe to run more than once.
alter table public.products add column if not exists options jsonb not null default '[]'::jsonb;
comment on column public.products.options is 'Available customer-selectable product variants, e.g. vape flavors and premium flower strains.';
