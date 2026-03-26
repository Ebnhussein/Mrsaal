// utils/replyTracker.js
const { google } = require('googleapis');
const { all, run, get } = require('./db');
const { buildAuthClient } = require('./gmail');

async function syncReplies() {
  try {
    const pendingLogs = await all(
      `SELECT * FROM email_log
       WHERE thread_id IS NOT NULL
         AND replied = 0
         AND channel = 'email'
         AND status = 'sent'`,
      []
    );

    if (!pendingLogs.length) return;

    const userGroups = {};
    pendingLogs.forEach(log => {
      if (!userGroups[log.user_id]) userGroups[log.user_id] = [];
      userGroups[log.user_id].push(log);
    });

    for (const userId in userGroups) {
      const user = await get('SELECT * FROM users WHERE id=$1', [userId]);
      if (!user) continue;

      const auth  = buildAuthClient(user);
      const gmail = google.gmail({ version: 'v1', auth });
      const logs  = userGroups[userId];

      for (const log of logs) {
        try {
          const res      = await gmail.users.threads.get({ userId: 'me', id: log.thread_id });
          const messages = res.data.messages || [];
          const replies  = messages.filter(m => m.id !== log.message_id);

          if (replies.length > 0) {
            const lastMsg = messages[messages.length - 1];
            const snippet = lastMsg.snippet || 'رد جديد وصل بخصوص طلبك';
            await run(
              'UPDATE email_log SET replied=1, reply_text=$1 WHERE id=$2',
              [snippet, log.id]
            );
          }
        } catch (e) {
          if (e.code !== 404) throw e;
        }
      }
    }
  } catch (err) {
    console.error('Reply Tracker Cron Error:', err.message);
  }
}

module.exports = { syncReplies };
