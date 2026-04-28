REVOKE EXECUTE ON FUNCTION public.mark_video_dead(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_video_alive(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_ban_user(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_unban_user(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_video_dead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_video_alive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid) TO authenticated;
