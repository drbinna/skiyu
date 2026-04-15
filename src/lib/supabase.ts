import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mkqiqkqgnywosbneibqx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rcWlxa3Fnbnl3b3NibmVpYnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTAyMDYsImV4cCI6MjA5MTc2NjIwNn0.UWQ6ovMHwX_LWarO_cBNG_we837pt0m3NPEJbd2ZWTo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
