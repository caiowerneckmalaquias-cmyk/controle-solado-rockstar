import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pybcwjrjxvshugxxlaoy.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5YmN3anJqeHZzaHVneHhsYW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTQ4OTgsImV4cCI6MjA4OTM3MDg5OH0.8BDtx-uUWQmJfOG7DiZsP-ThDQmlkomJ_eJik8Ty6Ik";

export const supabase = createClient(supabaseUrl, supabaseKey);