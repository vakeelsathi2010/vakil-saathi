-- Prevent the same real mobile number from being attached to multiple advocates.
-- The placeholder used before first-login setup is intentionally excluded.
create unique index if not exists advocates_unique_real_phone
  on advocates (phone)
  where phone <> '0000000000';
