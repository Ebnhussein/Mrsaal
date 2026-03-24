// utils/replyTracker.js — Syncs Gmail replies
const { google } = require('googleapis');
const db = require('./db');
const { buildAuthClient } = require('./gmail');

async function syncReplies() {
  try {
    // 1. Get logs with thread_id that are not marked as replied
    const pendingLogs = db.prepare(`
      SELECT * FROM email_log 
      WHERE thread_id IS NOT NULL 
      AND replied = 0 
      AND channel = 'email'
      AND status = 'sent'
    `).all();

    if (pendingLogs.length === 0) return;

    // Group by user
    const userGroups = {};
    pendingLogs.forEach(log => {
      if (!userGroups[log.user_id]) userGroups[log.user_id] = [];
      userGroups[log.user_id].push(log);
    });

    for (const userId in userGroups) {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!user) continue;

      const auth = buildAuthClient(user);
      const gmail = google.gmail({ version: 'v1', auth });
      const logs = userGroups[userId];

      for (const log of logs) {
        try {
          // Check the thread for new messages
          const res = await gmail.users.threads.get({ userId: 'me', id: log.thread_id });
          const messages = res.data.messages || [];

          // If there's more than 1 message, or message ID is different
          const replies = messages.filter(m => m.id !== log.message_id);

          if (replies.length > 0) {
            // Get last message snippet as reply preview
            const lastMsg = messages[messages.length - 1];
            const snippet = lastMsg.snippet || 'رد جديد وصل بخصوص طلبك';

            db.prepare('UPDATE email_log SET replied = 1, reply_text = ? WHERE id = ?')
              .run(snippet, log.id);
            
            console.log(`📩 Thread ${log.thread_id}: New reply detected!`);
          }
        } catch (e) {
          if (e.code === 404) {
            // Thread might have been deleted, ignore
          } else {
            throw e;
          }
        }
      }
    }
  } catch (err) {
    console.error('Reply Tracker Cron Error:', err.message);
  }
}

module.exports = { syncReplies };
