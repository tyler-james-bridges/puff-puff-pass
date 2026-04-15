create table if not exists passes (
  id text primary key,
  handle text not null,
  message text,
  amount_usd numeric(10, 6) not null,
  tx_hash text,
  payment_signature text not null,
  displaced_handle text,
  rank_after integer not null,
  status text not null,
  vibe_tag text not null,
  gain_line text not null,
  loss_line text,
  created_at timestamptz not null default now()
);

create index if not exists passes_created_at_idx on passes (created_at desc);
create index if not exists passes_handle_idx on passes (handle);

create table if not exists holder_state (
  id integer primary key,
  current_handle text,
  total_passes integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into holder_state (id, current_handle, total_passes)
values (1, null, 0)
on conflict (id) do nothing;

create table if not exists leaderboard_stats (
  handle text primary key,
  total_passes integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  first_takes integer not null default 0,
  has_taken_before boolean not null default false,
  last_pass_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

