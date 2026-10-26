'use strict';
// A short, secret-free cause for a failed Google connection: logged on the server and put in the redirect so a failure
// can be diagnosed without exposing provider detail. Never returns the raw message.
function linkFailureReason(error) {
  const provider = error?.response?.data?.error;
  if (typeof provider === 'string' && /^[a-z_]{1,40}$/.test(provider)) return provider;
  const code = error?.code == null ? '' : String(error.code);
  if (/^[A-Za-z0-9_]{1,40}$/.test(code)) return code.toLowerCase();
  const message = String(error?.message || '');
  if (message.includes('أعد ربط')) return 'no_refresh_token';
  if (message.includes('الإرسال')) return 'send_scope_missing';
  if (message.includes('Google identity')) return 'identity_unavailable';
  if (message.includes('Session changed')) return 'session_changed';
  return (String(error?.name || 'error').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30)) || 'error';
}
module.exports = { linkFailureReason };
