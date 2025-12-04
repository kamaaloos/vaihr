import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
    email: string;
    otpCode: string;
    subject?: string;
    template?: string;
    userName?: string;
    purpose?: string;
}

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { email, otpCode, subject = 'Your OTP Code', template = 'otp', userName, purpose }: EmailRequest = await req.json()

        if (!email || !otpCode) {
            return new Response(
                JSON.stringify({ error: 'Email and OTP code are required' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        console.log(`📧 [EDGE FUNCTION] OTP Request for ${email}: ${otpCode}`)
        console.log(`📧 [EDGE FUNCTION] Purpose: ${purpose || 'verification'}`)
        console.log(`📧 [EDGE FUNCTION] Subject: ${subject}`)

        // For development, we'll always return success
        // In production, you would integrate with your email service here

        // Simulate email sending delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        console.log(`📧 [EDGE FUNCTION] OTP email "sent" successfully to ${email}`)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'OTP email sent successfully',
                emailId: `dev-${Date.now()}`,
                otpCode: otpCode // Include OTP in response for development
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('Error in send-otp-email function:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: 'Internal server error',
                details: error.message
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
