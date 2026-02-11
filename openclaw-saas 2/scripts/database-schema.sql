-- OpenClaw SaaS Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Servers table
CREATE TABLE IF NOT EXISTS servers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  instance_id VARCHAR(255) UNIQUE, -- AWS EC2 instance ID
  instance_type VARCHAR(50) NOT NULL DEFAULT 't3.micro', -- t3.micro, t3.small, etc.
  plan_type VARCHAR(50) NOT NULL DEFAULT 'basic', -- basic, standard, professional, business
  status VARCHAR(50) NOT NULL DEFAULT 'provisioning', -- provisioning, pending, running, stopped, stopping, starting, terminated, failed
  ip_address VARCHAR(50), -- Public IP address
  private_ip VARCHAR(50), -- Private IP address
  region VARCHAR(50) DEFAULT 'us-east-1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table (for future payment integration)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  plan_type VARCHAR(50) NOT NULL, -- basic, standard, professional, business
  status VARCHAR(50) NOT NULL DEFAULT 'trial', -- trial, active, cancelled, expired, past_due
  payment_provider VARCHAR(50), -- dodopay, stripe, etc.
  payment_provider_id VARCHAR(255), -- ID from payment provider
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking table (for billing)
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hours_running DECIMAL(10, 2) DEFAULT 0,
  date DATE NOT NULL,
  instance_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(server_id, date)
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email_notifications BOOLEAN DEFAULT true,
  default_region VARCHAR(50) DEFAULT 'us-east-1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_servers_user_id ON servers(user_id);
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_servers_instance_id ON servers(instance_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_logs_server_id ON usage_logs(server_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_date ON usage_logs(date);

-- Enable Row Level Security
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for servers table
CREATE POLICY "Users can view own servers" 
  ON servers FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own servers" 
  ON servers FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own servers" 
  ON servers FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own servers" 
  ON servers FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for subscriptions table
CREATE POLICY "Users can view own subscriptions" 
  ON subscriptions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" 
  ON subscriptions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" 
  ON subscriptions FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS Policies for usage_logs table
CREATE POLICY "Users can view own usage logs" 
  ON usage_logs FOR SELECT 
  USING (auth.uid() = user_id);

-- RLS Policies for user_preferences table
CREATE POLICY "Users can view own preferences" 
  ON user_preferences FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" 
  ON user_preferences FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
  ON user_preferences FOR UPDATE 
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_servers_updated_at BEFORE UPDATE ON servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default user preferences on user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_preferences (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- View for server statistics (optional, for analytics)
CREATE OR REPLACE VIEW server_stats AS
SELECT 
    user_id,
    COUNT(*) as total_servers,
    COUNT(*) FILTER (WHERE status = 'running') as running_servers,
    COUNT(*) FILTER (WHERE status = 'stopped') as stopped_servers,
    COUNT(*) FILTER (WHERE status IN ('provisioning', 'pending')) as provisioning_servers
FROM servers
GROUP BY user_id;

COMMENT ON TABLE servers IS 'Stores information about user OpenClaw servers';
COMMENT ON TABLE subscriptions IS 'Stores subscription and payment information';
COMMENT ON TABLE usage_logs IS 'Tracks server usage for billing purposes';
COMMENT ON TABLE user_preferences IS 'Stores user preferences and settings';
