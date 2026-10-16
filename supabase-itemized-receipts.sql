-- Run in Supabase SQL Editor before using the new itemized receipt checkout.
-- Preserves existing gw_sales and historical records.
create table if not exists public.gw_sale_receipt_details (
 sale_id text primary key,
 items jsonb not null default '[]'::jsonb,
 recorded_at timestamptz not null default now()
);
alter table public.gw_sale_receipt_details enable row level security;
revoke all on public.gw_sale_receipt_details from public, anon, authenticated;

create or replace function public.gw_record_sale_detailed(
 p_token text,p_employee uuid,p_total numeric,p_count integer,p_fulfillment text,p_items jsonb
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_sale text;
begin
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>100
 then raise exception 'Invalid receipt items'; end if;
 -- Serializes concurrent detailed checkouts so the inserted sale can be identified safely.
 perform pg_advisory_xact_lock(98274631);
 perform public.gw_record_sale(p_token,p_employee,p_total,p_count,p_fulfillment);
 select s.id::text into v_sale from public.gw_sales s
 where s.employee_id=p_employee and s.total=p_total
 and s.created_at >= transaction_timestamp()-interval '2 minutes'
 order by s.created_at desc,s.id desc limit 1;
 if v_sale is null then raise exception 'Could not locate recorded sale for receipt'; end if;
 insert into public.gw_sale_receipt_details(sale_id,items) values(v_sale,p_items)
 on conflict(sale_id) do update set items=excluded.items;
end$$;

create or replace function public.gw_sale_receipt_items(p_token text,p_sale text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_items jsonb;
begin
 if not public.gw_mdt_can(p_token,'sales_history') then raise exception 'Access denied'; end if;
 select d.items into v_items from public.gw_sale_receipt_details d where d.sale_id=p_sale;
 return coalesce(v_items,'[]'::jsonb);
end$$;
revoke all on function public.gw_record_sale_detailed(text,uuid,numeric,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.gw_record_sale_detailed(text,uuid,numeric,integer,text,jsonb) to anon,authenticated;
revoke all on function public.gw_sale_receipt_items(text,text) from public,anon,authenticated;
grant execute on function public.gw_sale_receipt_items(text,text) to anon,authenticated;
