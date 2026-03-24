// utils/scheduler.js — Runs scheduled emails
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { generateEmail } = require('./ai');
const { sendEmail } = require('./gmail');
const { syncReplies } = require('./replyTracker');

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

function startScheduler() {
  // Check every minute
  cron.schedule('* * * * *', async () => {
    const now = Date.now();

    const jobs = db.prepare(`
      SELECT sj.*, c.name as company_name, c.email as company_email,
             c.field, c.location
      FROM scheduled_jobs sj
      JOIN companies c ON c.id = sj.company_id
      WHERE sj.status = 'pending' AND sj.scheduled_at <= ?
    `).all(now);

    for (const job of jobs) {
      try {
        const user = db.prepare('SELECT * FROM users WHERE id=?').get(job.user_id);
        const cv = db.prepare('SELECT * FROM cv_profiles WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(job.user_id);
        const tpl = db.prepare('SELECT * FROM templates WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(job.user_id);

        if (!user || !cv) {
          db.prepare("UPDATE scheduled_jobs SET status='failed' WHERE id=?").run(job.id);
          continue;
        }

        const company = { name: job.company_name, email: job.company_email, field: job.field, location: job.location };
        const email = await generateEmail({ cv: cv.content, company, instructions: tpl?.instructions, subjectTemplate: tpl?.subject_template });

        const logId = uuidv4();
        const trackingUrl = `${BASE_URL}/track/open/${logId}.gif`;
        const attachment = cv?.pdf_data ? {
          data: cv.pdf_data,
          filename: cv.filename || 'CV.pdf',
          mimeType: 'application/pdf'
        } : null;

        const result = await sendEmail({ user, to: company.email, subject: email.subject, body: email.body, trackingPixelUrl: trackingUrl, attachment });

        db.prepare("UPDATE scheduled_jobs SET status='sent' WHERE id=?").run(job.id);
        db.prepare("UPDATE companies SET status='sent' WHERE id=?").run(job.company_id);
        db.prepare(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,message_id,thread_id)
          VALUES(?,?,?,?,?,?,?,?,?,?)`)
          .run(logId, job.user_id, job.company_id, job.company_name, job.company_email, email.subject, email.body, 'sent', result.messageId, result.threadId);

        console.log(`✅ Scheduled email sent to ${job.company_email}`);
      } catch (err) {
        db.prepare("UPDATE scheduled_jobs SET status='failed' WHERE id=?").run(job.id);
        db.prepare("UPDATE companies SET status='failed' WHERE id=?").run(job.company_id);
        console.error(`❌ Scheduled email failed for ${job.company_email}:`, err.message);
      }
    }
  });

  console.log('⏰ Scheduler started — checking every minute for scheduled emails');

  // Check for replies every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('🔄 Background: Syncing Gmail replies...');
    await syncReplies();
  });
}

module.exports = { startScheduler };
