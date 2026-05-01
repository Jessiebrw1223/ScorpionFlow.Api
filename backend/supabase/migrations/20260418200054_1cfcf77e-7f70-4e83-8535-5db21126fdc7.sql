-- Drop the policies that reference auth.users (which causes "permission denied for table users")
DROP POLICY IF EXISTS "invited users view own invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "invited users update own invitations" ON public.team_invitations;

-- Recreate using auth.email() which is safe and does not require access to auth.users
CREATE POLICY "invited users view own invitations"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (lower(email) = lower(auth.email()));

CREATE POLICY "invited users update own invitations"
ON public.team_invitations
FOR UPDATE
TO authenticated
USING (lower(email) = lower(auth.email()));