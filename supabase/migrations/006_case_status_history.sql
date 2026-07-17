-- Case status events are stored in case_history; this index keeps timelines fast.
create index if not exists case_history_case_created_idx on case_history (case_id, created_at desc);
create index if not exists cases_advocate_status_created_idx on cases (advocate_id, status, created_at desc);
