-- Apply after the application-owned migration. No secrets or elevated API access.
SELECT cron.schedule('multigame-daily-publication','*/5 * * * *','SELECT multigame.publish_daily_challenges()');
