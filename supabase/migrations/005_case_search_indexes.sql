-- Indexes used by CaseSearch filters and sorting.
create index if not exists cases_advocate_created_idx on cases (advocate_id, created_at desc);
create index if not exists cases_advocate_status_idx on cases (advocate_id, status);
create index if not exists cases_advocate_type_idx on cases (advocate_id, case_type);
create index if not exists cases_advocate_court_idx on cases (advocate_id, court_name);
create index if not exists hearings_case_date_idx on hearings (case_id, hearing_date);
create index if not exists clients_advocate_name_idx on clients (advocate_id, full_name);
