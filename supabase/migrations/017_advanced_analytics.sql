alter table public.advocate_subscriptions drop constraint if exists advocate_subscriptions_plan_check;
alter table public.advocate_subscriptions add constraint advocate_subscriptions_plan_check check (plan in ('free', 'strategy_monthly', 'ocr_monthly', 'analytics_monthly', 'pro_monthly'));
