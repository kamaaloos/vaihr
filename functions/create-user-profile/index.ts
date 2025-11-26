// Supabase Edge Function to create user profile with service role
// This bypasses RLS by using the service role key

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Create Supabase client with service role key
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const { userId, email, name, role } = await req.json()

        // Create user profile with service role (bypasses RLS)
        const { data, error } = await supabaseAdmin
            .from('users')
            .insert({
                id: userId,
                email: email,
                name: name,
                role: role,
                email_verified: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()

        if (error) {
            console.error('Error creating user profile:', error)
            return new Response(
                JSON.stringify({ error: error.message }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        return new Response(
            JSON.stringify({ success: true, data }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('Error in create-user-profile function:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})













