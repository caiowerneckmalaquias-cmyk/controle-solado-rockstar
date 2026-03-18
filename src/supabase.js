import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pybcwjrjxvshugxxlaoy.supabase.co'
const supabaseKey = 'sb_publishable_-h6J-EwssGMgpc--OjaiMQ_EkrSp0uz'

export const supabase = createClient(supabaseUrl, supabaseKey)