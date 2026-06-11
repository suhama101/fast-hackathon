CREATE TABLE IF NOT EXISTS public.users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  full_name text not null,
  role text not null default 'recruiter',
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
