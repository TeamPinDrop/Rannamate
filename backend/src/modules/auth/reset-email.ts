const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Password-reset email in RANNAMATE colours. Plain-text part included for every mail client. */
export function resetEmail({ name, link, minutes }: { name: string; link: string; minutes: number }) {
  const hi = name ? `Hi ${name},` : 'Hi,';
  const text = `${hi}\n\nSomeone (hopefully you) asked to reset the password for your RANNAMATE account.\n\nSet a new password here (the link works once and expires in ${minutes} minutes):\n${link}\n\nIf you didn't ask for this, you can ignore this email — your password stays the same.\n\n— RANNAMATE · Your Kitchen. Your Mood. Your Mate.`;
  const html = `<!doctype html><html><body style="margin:0;background:#F5DABF;font-family:Manrope,Segoe UI,Helvetica,Arial,sans-serif;color:#22110F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FDF7F1;border-radius:24px;padding:36px 32px">
<tr><td style="font-family:Georgia,serif;letter-spacing:4px;color:#6C151E;font-weight:700;font-size:14px">RANNAMATE</td></tr>
<tr><td style="padding-top:22px;font-family:Georgia,serif;font-size:26px;color:#0F3D3A">Reset your password</td></tr>
<tr><td style="padding-top:14px;font-size:15px;line-height:1.6">${esc(hi)}<br>Someone (hopefully you) asked to reset the password for your RANNAMATE account.</td></tr>
<tr><td style="padding:26px 0"><a href="${esc(link)}" style="display:inline-block;background:#6C151E;color:#FDF7F1;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">Choose a new password</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#0F3D3A">The link works once and expires in ${minutes} minutes. If you didn't ask for this, ignore this email — your password stays the same.</td></tr>
<tr><td style="padding-top:22px;font-size:12px;color:#6b5a52">Your Kitchen. Your Mood. Your Mate.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: 'Reset your RANNAMATE password', text, html };
}
