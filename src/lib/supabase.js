// Supabase client singleton. Extracted from NASCARHub.jsx (phase 2).
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://xhywifoacvdwkrzunzpg.supabase.co";


export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoeXdpZm9hY3Zkd2tyenVuenBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3ODc2MTUsImV4cCI6MjA4NjM2MzYxNX0.rSF8GAI-yRMq63NAzQk3bsz6J9BIANE2ZOO34nYoT3M";


export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Log a timestamped usage event to the usage_events table (for date-range filtering)
