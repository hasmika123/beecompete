// Anti-bot honeypot: an off-screen, aria-hidden text field that real users never see or tab to,
// but naive form-filling bots complete. Render one per public form; check it on the server with
// isHoneypotTripped(form) (apps/web) and silently drop the submit when it's filled. One home for the
// field name + the offscreen technique so all forms stay consistent.
export const HONEYPOT_FIELD = 'website';

export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
