// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any

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
        // Create Supabase client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

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

        // Generate email content
        const emailContent = generateEmailContent(otpCode, userName || 'User', purpose || 'verification')

        // Send email using Resend (you can replace this with your preferred email service)
        const emailResponse = await sendEmail({
            to: email,
            subject: subject,
            html: emailContent,
            from: 'noreply@vaihtoratti.com' // Replace with your verified domain
        })

        if (emailResponse.success) {
            console.log(`OTP email sent successfully to ${email}`)
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'OTP email sent successfully',
                    emailId: emailResponse.emailId
                }),
                {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        } else {
            console.error('Failed to send OTP email:', emailResponse.error)
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Failed to send email',
                    details: emailResponse.error
                }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

    } catch (error) {
        console.error('Error in send-otp-email function:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : String(error)
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})

function generateEmailContent(otpCode: string, userName: string, purpose: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OTP Verification</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background-color: #ffffff;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                width: 60px;
                height: 60px;
                margin: 0 auto 20px;
                background-color: #6949FF;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                font-weight: bold;
            }
            .title {
                font-size: 28px;
                font-weight: bold;
                color: #333;
                margin-bottom: 10px;
            }
            .subtitle {
                font-size: 16px;
                color: #666;
            }
            .otp-container {
                background-color: #F0F8FF;
                border: 2px solid #6949FF;
                border-radius: 12px;
                padding: 30px;
                text-align: center;
                margin: 30px 0;
            }
            .otp-label {
                font-size: 16px;
                color: #666;
                margin-bottom: 15px;
            }
            .otp-code {
                font-size: 36px;
                font-weight: bold;
                color: #6949FF;
                letter-spacing: 8px;
                font-family: 'Courier New', monospace;
                margin: 15px 0;
            }
            .otp-info {
                font-size: 14px;
                color: #666;
                margin-top: 15px;
            }
            .content {
                margin: 30px 0;
            }
            .content p {
                font-size: 16px;
                color: #555;
                margin-bottom: 15px;
            }
            .warning {
                background-color: #FFF3CD;
                border: 1px solid #FFEAA7;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
            }
            .warning p {
                color: #856404;
                font-size: 14px;
                margin: 0;
            }
            .footer {
                text-align: center;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #eee;
            }
            .footer p {
                font-size: 14px;
                color: #888;
                margin: 5px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">V</div>
                <h1 class="title">Verify Your Email</h1>
                <p class="subtitle">Your OTP verification code</p>
            </div>

            <div class="otp-container">
                <div class="otp-label">Your verification code is:</div>
                <div class="otp-code">${otpCode}</div>
                <div class="otp-info">
                    This code will expire in 10 minutes
                </div>
            </div>

            <div class="content">
                <p>Hello ${userName},</p>
                <p>You requested a verification code for your account. Use the code above to complete your ${purpose}.</p>
                
                <div class="warning">
                    <p><strong>Security Notice:</strong> Never share this code with anyone. Our team will never ask for your verification code.</p>
                </div>

                <p>If you didn't request this code, please ignore this email or contact our support team if you have concerns.</p>
            </div>

            <div class="footer">
                <p>© 2024 Vaihtoratti. All rights reserved.</p>
                <p>If you have any questions, please contact our support team.</p>
            </div>
        </div>
    </body>
    </html>
  `
}

async function sendEmail({ to, subject, html, from }: {
    to: string;
    subject: string;
    html: string;
    from: string;
}): Promise<{ success: boolean; emailId?: string; error?: string }> {
    try {
        // Option 1: Using Mailgun (recommended for production)
        const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY')
        const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN')

        if (mailgunApiKey && mailgunDomain) {
            const mailgunUrl = `https://api.mailgun.net/v3/${mailgunDomain}/messages`

            const formData = new FormData()
            formData.append('from', from)
            formData.append('to', to)
            formData.append('subject', subject)
            formData.append('html', html)

            const response = await fetch(mailgunUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
                },
                body: formData,
            })

            if (response.ok) {
                const data = await response.json()
                return { success: true, emailId: data.id }
            } else {
                const error = await response.text()
                return { success: false, error: error }
            }
        }

        // Option 2: Using Resend (fallback)
        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        if (resendApiKey) {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: from,
                    to: [to],
                    subject: subject,
                    html: html,
                }),
            })

            if (response.ok) {
                const data = await response.json()
                return { success: true, emailId: data.id }
            } else {
                const error = await response.text()
                return { success: false, error: error }
            }
        }

        // Option 3: Development mode (no email service configured)
        console.log(`[DEV] Would send email to ${to} with subject: ${subject}`)
        console.log(`[DEV] OTP Code: ${html.match(/<div class="otp-code">(.*?)<\/div>/)?.[1] || 'N/A'}`)

        // Simulate successful email sending for development
        return { success: true, emailId: 'dev-email-id' }

    } catch (error) {
        console.error('Email sending error:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
}
