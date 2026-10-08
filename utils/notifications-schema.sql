CREATE TABLE IF NOT EXISTS notification_preferences (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 settings JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS notification_staff (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notifications (
 id BIGSERIAL PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL,category TEXT NOT NULL,target JSONB NOT NULL DEFAULT '{}',
 data JSONB NOT NULL DEFAULT '{}',group_key TEXT NOT NULL,event_count INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),read_at TIMESTAMPTZ,
 UNIQUE(user_id,group_key)
);
CREATE INDEX IF NOT EXISTS notifications_owner_time ON notifications(user_id,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE TABLE IF NOT EXISTS notification_events (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,event_key TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,event_key)
);
CREATE TABLE IF NOT EXISTS notification_push_jobs (
 notification_id BIGINT PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
 revision TIMESTAMPTZ NOT NULL,due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS notification_push_subscriptions (
 endpoint_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 subscription TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notification_push_owner ON notification_push_subscriptions(user_id);
CREATE TABLE IF NOT EXISTS notification_push_config(id INTEGER PRIMARY KEY CHECK(id=1),credentials TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notification_releases (
 id TEXT PRIMARY KEY,title_ar TEXT NOT NULL,title_en TEXT NOT NULL,body_ar TEXT NOT NULL,body_en TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- The domain event and its notification commit in the same transaction.
-- Event keys prevent receipt retries and reply synchronisations duplicating alerts.
CREATE OR REPLACE FUNCTION mrsaal_notify(owner_id TEXT,event_key_arg TEXT,kind_arg TEXT,category_arg TEXT,target_arg JSONB,data_arg JSONB,aggregate_arg BOOLEAN DEFAULT FALSE)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE prefs JSONB; inserted_key TEXT; group_arg TEXT; notification_id_arg BIGINT; revision_arg TIMESTAMPTZ;
BEGIN
 SELECT settings INTO prefs FROM notification_preferences WHERE user_id=owner_id;
 IF COALESCE((prefs->'types'->>kind_arg)::BOOLEAN,TRUE)=FALSE THEN RETURN NULL; END IF;
 INSERT INTO notification_events(user_id,event_key) VALUES(owner_id,event_key_arg) ON CONFLICT DO NOTHING RETURNING event_key INTO inserted_key;
 IF inserted_key IS NULL THEN RETURN NULL; END IF;
 group_arg:=CASE WHEN aggregate_arg THEN kind_arg||':'||FLOOR(EXTRACT(EPOCH FROM NOW())/300)::TEXT ELSE event_key_arg END;
 INSERT INTO notifications(user_id,kind,category,target,data,group_key)
 VALUES(owner_id,kind_arg,category_arg,target_arg,data_arg,group_arg)
 ON CONFLICT(user_id,group_key) DO UPDATE SET event_count=notifications.event_count+1,target=EXCLUDED.target,data=EXCLUDED.data,updated_at=NOW(),read_at=NULL
 RETURNING id,updated_at INTO notification_id_arg,revision_arg;
 IF COALESCE((prefs->>'browser')::BOOLEAN,FALSE) THEN
  INSERT INTO notification_push_jobs(notification_id,revision,due_at) VALUES(notification_id_arg,revision_arg,NOW()+INTERVAL '5 seconds')
  ON CONFLICT(notification_id) DO UPDATE SET revision=EXCLUDED.revision,due_at=LEAST(notification_push_jobs.due_at,EXCLUDED.due_at),attempts=0;
 END IF;
 RETURN notification_id_arg;
END;$$;
CREATE OR REPLACE FUNCTION mrsaal_log_notifications() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE oldrow JSONB; newrow JSONB; target_arg JSONB; data_arg JSONB; reply_key TEXT;
BEGIN
 oldrow:=CASE WHEN TG_OP='INSERT' THEN '{}'::JSONB ELSE to_jsonb(OLD) END; newrow:=to_jsonb(NEW);
 target_arg:=jsonb_build_object('page','report','logId',NEW.id);
 data_arg:=jsonb_build_object('company',LEFT(COALESCE(NEW.company_name,''),120),'channel',NEW.channel);
 IF NEW.status IN ('failed','uncertain') AND oldrow->>'status' IS DISTINCT FROM NEW.status THEN
  PERFORM mrsaal_notify(NEW.user_id,'log:'||NEW.id||':failed','send_failed','messages',target_arg,data_arg||jsonb_build_object('uncertain',NEW.status='uncertain','reason',LEFT(COALESCE(newrow->>'reason',''),250)));
 END IF;
 IF NEW.channel='email' AND COALESCE(NEW.open_count,0)>0 AND COALESCE((oldrow->>'open_count')::INTEGER,0)=0 THEN
  PERFORM mrsaal_notify(NEW.user_id,'log:'||NEW.id||':opened','email_open','messages',target_arg,data_arg,TRUE);
 END IF;
 IF NEW.channel='whatsapp' AND newrow->>'whatsapp_delivered_at' IS NOT NULL AND oldrow->>'whatsapp_delivered_at' IS NULL THEN
  PERFORM mrsaal_notify(NEW.user_id,'log:'||NEW.id||':delivered','wa_delivered','messages',target_arg,data_arg,TRUE);
 END IF;
 IF NEW.channel='whatsapp' AND newrow->>'whatsapp_read_at' IS NOT NULL AND oldrow->>'whatsapp_read_at' IS NULL THEN
  PERFORM mrsaal_notify(NEW.user_id,'log:'||NEW.id||':read','wa_read','messages',target_arg,data_arg,TRUE);
 END IF;
 IF COALESCE(NEW.replied,0)=1 AND (
  COALESCE((oldrow->>'replied')::INTEGER,0)=0 OR
  newrow->>'reply_message_id' IS DISTINCT FROM oldrow->>'reply_message_id' OR
  newrow->>'whatsapp_reply_at' IS DISTINCT FROM oldrow->>'whatsapp_reply_at' OR
  newrow->>'whatsapp_reply_message_id' IS DISTINCT FROM oldrow->>'whatsapp_reply_message_id') THEN
  reply_key:=CASE WHEN NEW.channel='whatsapp' THEN COALESCE(newrow->>'whatsapp_reply_message_id',newrow->>'whatsapp_reply_at',md5(COALESCE(NEW.reply_text,''))) ELSE COALESCE(newrow->>'reply_message_id',md5(COALESCE(NEW.reply_text,''))) END;
  PERFORM mrsaal_notify(NEW.user_id,'log:'||NEW.id||':reply:'||reply_key,CASE WHEN NEW.channel='whatsapp' THEN 'wa_reply' ELSE 'email_reply' END,'messages',target_arg,data_arg);
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS mrsaal_log_notify ON email_log;
CREATE TRIGGER mrsaal_log_notify AFTER INSERT OR UPDATE ON email_log FOR EACH ROW EXECUTE FUNCTION mrsaal_log_notifications();
CREATE OR REPLACE FUNCTION mrsaal_ticket_notifications() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE staff_id TEXT;
BEGIN
 IF TG_OP='INSERT' THEN
  FOR staff_id IN SELECT user_id FROM notification_staff WHERE user_id<>NEW.user_id LOOP
   PERFORM mrsaal_notify(staff_id,'ticket:'||NEW.id||':new','admin_ticket','admin',jsonb_build_object('page','ticket','ticketId',NEW.id),jsonb_build_object('subject',LEFT(NEW.subject,120)));
  END LOOP;
 ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
  PERFORM mrsaal_notify(NEW.user_id,'ticket:'||NEW.id||':status:'||NEW.updated_at::TEXT,'ticket_status','support',jsonb_build_object('page','ticket','ticketId',NEW.id),jsonb_build_object('subject',LEFT(NEW.subject,120),'status',NEW.status));
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS mrsaal_ticket_notify ON support_tickets;
CREATE TRIGGER mrsaal_ticket_notify AFTER INSERT OR UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION mrsaal_ticket_notifications();
CREATE OR REPLACE FUNCTION mrsaal_ticket_reply_notifications() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE ticket support_tickets%ROWTYPE; staff_id TEXT;
BEGIN
 SELECT * INTO ticket FROM support_tickets WHERE id=NEW.ticket_id;
 IF NEW.staff AND NEW.user_id<>ticket.user_id THEN
  PERFORM mrsaal_notify(ticket.user_id,'ticket-reply:'||NEW.id,'ticket_reply','support',jsonb_build_object('page','ticket','ticketId',ticket.id),jsonb_build_object('subject',LEFT(ticket.subject,120)));
 ELSIF NOT NEW.staff THEN
  FOR staff_id IN SELECT user_id FROM notification_staff WHERE user_id<>NEW.user_id LOOP
   PERFORM mrsaal_notify(staff_id,'ticket-reply:'||NEW.id,'admin_ticket_reply','admin',jsonb_build_object('page','ticket','ticketId',ticket.id),jsonb_build_object('subject',LEFT(ticket.subject,120)));
  END LOOP;
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS mrsaal_ticket_reply_notify ON support_messages;
CREATE TRIGGER mrsaal_ticket_reply_notify AFTER INSERT ON support_messages FOR EACH ROW EXECUTE FUNCTION mrsaal_ticket_reply_notifications();
CREATE OR REPLACE FUNCTION mrsaal_job_notifications() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE kind_arg TEXT;
BEGIN
 IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
 kind_arg:=CASE NEW.status WHEN 'processing' THEN 'schedule_started' WHEN 'sent' THEN 'schedule_done' WHEN 'failed' THEN 'schedule_failed' WHEN 'uncertain' THEN 'schedule_failed' WHEN 'skipped' THEN 'schedule_skipped' ELSE NULL END;
 IF kind_arg IS NOT NULL THEN
  PERFORM mrsaal_notify(NEW.user_id,'job:'||NEW.id||':'||NEW.status,kind_arg,'messages',jsonb_build_object('page','report','logId',NEW.log_id),jsonb_build_object('companyId',NEW.company_id),TRUE);
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS mrsaal_job_notify ON scheduled_jobs;
CREATE TRIGGER mrsaal_job_notify AFTER UPDATE ON scheduled_jobs FOR EACH ROW EXECUTE FUNCTION mrsaal_job_notifications();
CREATE OR REPLACE FUNCTION mrsaal_error_notifications() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE n INTEGER; staff_id TEXT; bucket TEXT;
BEGIN
 SELECT COUNT(*) INTO n FROM support_events WHERE user_id=NEW.user_id AND area=NEW.area AND created_at>=NOW()-INTERVAL '10 minutes';
 bucket:=FLOOR(EXTRACT(EPOCH FROM NOW())/600)::TEXT;
 IF n>=3 THEN
  FOR staff_id IN SELECT user_id FROM notification_staff WHERE user_id<>NEW.user_id LOOP
   PERFORM mrsaal_notify(staff_id,'errors:'||NEW.user_id||':'||NEW.area||':'||bucket,'admin_errors','admin',jsonb_build_object('page','admin-support'),jsonb_build_object('area',NEW.area,'status',NEW.status));
  END LOOP;
 END IF;
 IF NEW.area IN ('providers','writing','email','whatsapp','accounts') AND NEW.status>=400 THEN
  PERFORM mrsaal_notify(NEW.user_id,'issue:'||NEW.area||':'||bucket,'connection_issue','messages',jsonb_build_object('page','settings','section',CASE WHEN NEW.area IN ('providers','writing') THEN 'ai' ELSE 'channels' END),jsonb_build_object('area',NEW.area,'status',NEW.status));
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS mrsaal_error_notify ON support_events;
CREATE TRIGGER mrsaal_error_notify AFTER INSERT ON support_events FOR EACH ROW EXECUTE FUNCTION mrsaal_error_notifications();
