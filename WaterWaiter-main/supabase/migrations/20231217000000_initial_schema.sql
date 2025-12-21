-- Create drinks table
create table drinks (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  quantity integer default 0,
  description text
);

-- Enable Row Level Security
alter table drinks enable row level security;

-- Create Policy: Allow public read access
create policy "Allow public read access"
on drinks for select
to public
using (true);

-- Create Policy: Allow authenticated insert
create policy "Allow authenticated insert"
on drinks for insert
to authenticated
with check (true);

-- Create Policy: Allow authenticated update
create policy "Allow authenticated update"
on drinks for update
to authenticated
using (true);

-- Create Policy: Allow authenticated delete
create policy "Allow authenticated delete"
on drinks for delete
to authenticated
using (true);
