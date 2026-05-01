
CREATE OR REPLACE FUNCTION public.get_plan_user_limit(_plan public.subscription_plan)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 5
    WHEN 'starter' THEN 10
    WHEN 'pro' THEN 999999
    WHEN 'business' THEN 999999
  END;
$$;
