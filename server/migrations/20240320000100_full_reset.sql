-- 1. Drop all dependent tables
DROP TABLE IF EXISTS plant_care_tasks CASCADE;
DROP TABLE IF EXISTS care_tasks CASCADE;
DROP TABLE IF EXISTS care_history CASCADE;
DROP TABLE IF EXISTS plant_health_metrics CASCADE;
DROP TABLE IF EXISTS recommendations CASCADE;
DROP TABLE IF EXISTS ai_care_tips CASCADE;
DROP TABLE IF EXISTS plants CASCADE;

-- 2. Recreate plants table with UUID primary key
CREATE TABLE plants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    species TEXT,
    acquired_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'healthy',
    last_watered TIMESTAMP WITH TIME ZONE,
    water_frequency_days INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Recreate plant_care_tasks table
CREATE TABLE plant_care_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('watering', 'fertilizing', 'pruning')),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'skipped')),
    completed_at TIMESTAMP WITH TIME ZONE,
    last_care_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Recreate care_tasks table (example schema, adjust as needed)
CREATE TABLE care_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_date TIMESTAMP WITH TIME ZONE,
    skipped BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Recreate care_history table (example schema, adjust as needed)
CREATE TABLE care_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    notes TEXT,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Recreate plant_health_metrics table (example schema, adjust as needed)
CREATE TABLE plant_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL UNIQUE REFERENCES plants(id) ON DELETE CASCADE,
    water_level INTEGER DEFAULT 100,
    light_level INTEGER DEFAULT 100,
    overall_health INTEGER DEFAULT 100,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Recreate recommendations table (example schema, adjust as needed)
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
    recommendation_type TEXT NOT NULL,
    message TEXT NOT NULL,
    applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Recreate ai_care_tips table (example schema, adjust as needed)
CREATE TABLE ai_care_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    category TEXT NOT NULL,
    tip TEXT NOT NULL,
    source TEXT DEFAULT 'AI_Groq',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Add indexes for performance
CREATE INDEX idx_plant_care_tasks_plant_id ON plant_care_tasks(plant_id);
CREATE INDEX idx_plant_care_tasks_due_date ON plant_care_tasks(due_date);
CREATE INDEX idx_plant_care_tasks_status ON plant_care_tasks(status);

-- 10. Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_plant_care_tasks_updated_at
    BEFORE UPDATE ON plant_care_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plants_updated_at
    BEFORE UPDATE ON plants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_care_tasks_updated_at
    BEFORE UPDATE ON care_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_care_tips_updated_at
    BEFORE UPDATE ON ai_care_tips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 