-- Create events table
create table events (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  date timestamp with time zone not null,
  status text check (status in ('UPCOMING', 'ACTIVE', 'COMPLETED')) default 'UPCOMING',
  description text
);

-- Enable RLS for events
alter table events enable row level security;

-- Policies for events
create policy "Allow public read access on events"
  on events for select
  to public
  using (true);

create policy "Allow authenticated insert on events"
  on events for insert
  to authenticated
  with check (true);

create policy "Allow authenticated update on events"
  on events for update
  to authenticated
  using (true);

create policy "Allow authenticated delete on events"
  on events for delete
  to authenticated
  using (true);

-- Add event_id to drinks table
alter table drinks 
add column event_id uuid references events(id) on delete cascade;

-- Update drinks policies if needed (optional, existing policies cover generic access, 
-- but we might want to ensure event_id is handled. RLS applies to rows, so existing 'true' policies still work).
