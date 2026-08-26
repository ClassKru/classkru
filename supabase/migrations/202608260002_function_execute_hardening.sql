-- Explicit RPC allowlist for the QR attendance and join-activity backends.
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default, so every
-- function must revoke that implicit grant before granting intended API roles.

begin;

revoke execute on function public.join_activity_create_session(text, text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.join_activity_update_session(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.join_activity_set_phase(text, text) from public, anon, authenticated;
revoke execute on function public.join_activity_get_session(text) from public, anon, authenticated;
revoke execute on function public.join_activity_register(text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.join_activity_submit_answer(text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.join_activity_teacher_snapshot(text) from public, anon, authenticated;

grant execute on function public.join_activity_create_session(text, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.join_activity_update_session(text, text, text, jsonb) to authenticated;
grant execute on function public.join_activity_set_phase(text, text) to authenticated;
grant execute on function public.join_activity_teacher_snapshot(text) to authenticated;
grant execute on function public.join_activity_get_session(text) to anon, authenticated;
grant execute on function public.join_activity_register(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.join_activity_submit_answer(text, uuid, text, text) to anon, authenticated;

revoke execute on function public.attendance_qr_create_session(text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.attendance_qr_get_session(text) from public, anon, authenticated;
revoke execute on function public.attendance_qr_mark_present(text, text, text) from public, anon, authenticated;
revoke execute on function public.attendance_qr_teacher_snapshot(text) from public, anon, authenticated;
revoke execute on function public.attendance_qr_close_session(text) from public, anon, authenticated;

grant execute on function public.attendance_qr_create_session(text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.attendance_qr_teacher_snapshot(text) to authenticated;
grant execute on function public.attendance_qr_close_session(text) to authenticated;
grant execute on function public.attendance_qr_get_session(text) to anon, authenticated;
grant execute on function public.attendance_qr_mark_present(text, text, text) to anon, authenticated;

commit;
