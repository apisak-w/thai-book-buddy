-- Restrict admin RPC functions to service_role only.
-- These functions are called exclusively from Next.js API routes
-- that use a service-role Supabase client + admin password check.
-- Closes #31.

-- admin_get_publisher_stats()
REVOKE ALL ON FUNCTION admin_get_publisher_stats() FROM public, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_publisher_stats() TO service_role;

-- admin_get_dau()
REVOKE ALL ON FUNCTION admin_get_dau() FROM public, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_dau() TO service_role;

-- admin_get_top_books(integer)
REVOKE ALL ON FUNCTION admin_get_top_books(integer) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_top_books(integer) TO service_role;

-- admin_get_global_demographics()
REVOKE ALL ON FUNCTION admin_get_global_demographics() FROM public, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_global_demographics() TO service_role;

-- admin_get_publisher_demographics(uuid)
REVOKE ALL ON FUNCTION admin_get_publisher_demographics(uuid) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_publisher_demographics(uuid) TO service_role;
