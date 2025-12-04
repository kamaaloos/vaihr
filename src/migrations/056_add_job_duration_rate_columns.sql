-- Add duration_minutes and rate_per_hour columns to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS rate_per_hour DECIMAL(10,2);

-- Update existing rows to calculate duration_minutes from duration string
UPDATE jobs
SET duration_minutes = CASE
    WHEN duration ~ '^\d+\s*(day|days)$' THEN
        CAST(REGEXP_REPLACE(duration, '\D', '', 'g') AS INTEGER) * 8 * 60
    WHEN duration ~ '^\d+\s*(hour|hours|h)$' THEN
        CAST(REGEXP_REPLACE(duration, '\D', '', 'g') AS INTEGER) * 60
    ELSE 0
END,
rate_per_hour = CASE
    WHEN rate ~ '^\d+(\.\d+)?$' THEN
        CAST(REGEXP_REPLACE(rate, '[^\d.]', '', 'g') AS DECIMAL(10,2))
    ELSE 0
END
WHERE duration_minutes IS NULL OR rate_per_hour IS NULL;

-- Add check constraints
ALTER TABLE jobs
ADD CONSTRAINT jobs_duration_minutes_check CHECK (duration_minutes > 0),
ADD CONSTRAINT jobs_rate_per_hour_check CHECK (rate_per_hour > 0); 