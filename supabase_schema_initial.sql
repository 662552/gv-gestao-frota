create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,full_name text,role text not null default 'consulta' check(role in ('administrador','operador','consulta')));
create table if not exists public.vehicles(id uuid primary key default gen_random_uuid(),plate text not null unique,category text not null check(category in ('carro','moto')),ownership_group text not null default 'empresa',model text,renavam text,chassis text,city text,driver_name text,status text not null default 'ativo',created_at timestamptz default now());
create table if not exists public.fuelings(id uuid primary key default gen_random_uuid(),occurred_on date not null,vehicle_id uuid references public.vehicles(id),driver_name text,city text,odometer numeric,amount numeric(12,2),liters numeric(12,3),classification text not null check(classification in ('PRODUÇÃO','FIXO')),created_at timestamptz default now());
create table if not exists public.production_records(id uuid primary key default gen_random_uuid(),occurred_on date not null,team text,quantity numeric,notes text);
create table if not exists public.maintenance_records(id uuid primary key default gen_random_uuid(),vehicle_id uuid references public.vehicles(id),opened_on date default current_date,description text not null,status text default 'aberta',amount numeric(12,2));
create table if not exists public.documents(id uuid primary key default gen_random_uuid(),vehicle_id uuid references public.vehicles(id),document_type text not null,expires_on date,notes text);
create table if not exists public.fixed_fund_reports(id uuid primary key default gen_random_uuid(),employee_name text not null,job_title text,period_start date,period_end date,cost_center text,approval_responsible text,advance_amount numeric(12,2) default 0);
create table if not exists public.fixed_fund_items(id uuid primary key default gen_random_uuid(),report_id uuid not null references public.fixed_fund_reports(id) on delete cascade,expense_date date not null,description text not null,category text,receipt_number text,amount_spent numeric(12,2) default 0);
alter table public.profiles enable row level security;alter table public.vehicles enable row level security;alter table public.fuelings enable row level security;alter table public.production_records enable row level security;alter table public.maintenance_records enable row level security;alter table public.documents enable row level security;alter table public.fixed_fund_reports enable row level security;alter table public.fixed_fund_items enable row level security;
create policy "auth profiles read" on public.profiles for select to authenticated using(true);
create policy "auth vehicles" on public.vehicles for all to authenticated using(true) with check(true);
create policy "auth fuelings" on public.fuelings for all to authenticated using(true) with check(true);
create policy "auth production" on public.production_records for all to authenticated using(true) with check(true);
create policy "auth maintenance" on public.maintenance_records for all to authenticated using(true) with check(true);
create policy "auth documents" on public.documents for all to authenticated using(true) with check(true);
create policy "auth fund reports" on public.fixed_fund_reports for all to authenticated using(true) with check(true);
create policy "auth fund items" on public.fixed_fund_items for all to authenticated using(true) with check(true);
-- Base de desenvolvimento: antes de dados reais, restringir RLS por perfil e proteger dados pessoais.
