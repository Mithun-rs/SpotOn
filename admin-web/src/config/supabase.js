import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://osmaacxxvcadjzppxrdb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zbWFhY3h4dmNhZGp6cHB4cmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1Njg4MDQsImV4cCI6MjEwMTE0NDgwNH0.CRzwPZRdOUradcmySnRixnp3nAj6YL6xWQWy5Z1eOHg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
