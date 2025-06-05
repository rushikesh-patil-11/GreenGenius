-- Create plant_care_tasks table
CREATE TABLE IF NOT EXISTS plant_care_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('watering', 'fertilizing', 'pruning')),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_plant_care_tasks_plant_id ON plant_care_tasks(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_care_tasks_due_date ON plant_care_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_plant_care_tasks_status ON plant_care_tasks(status);

-- Add trigger for updated_at
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