// @ts-ignore
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import * as nodemailer from 'nodemailer';
// @ts-ignore
import * as dotenv from 'dotenv';
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface InvoiceData {
    driverDetails: {
        email: string;
        companyInfo?: {
            companyName?: string;
        };
    };
    driverName: string;
    jobTitle: string;
    amount: number;
    invoiceNumber: string;
    status?: string;
}

dotenv.config();

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

export const onInvoiceCreated = async (invoice: InvoiceData) => {
    if (!invoice) return;

    const { driverDetails, jobTitle, amount, invoiceNumber } = invoice;

    try {
        // Send email to driver
        await transporter.sendMail({
            from: '"Vaihtoratti" <noreply@vaihtoratti.com>',
            to: driverDetails.email,
            subject: `Invoice Generated - ${invoiceNumber}`,
            html: `
                <h1>Invoice Generated</h1>
                <p>Your invoice has been generated for the job: ${jobTitle}</p>
                <p>Invoice Number: ${invoiceNumber}</p>
                <p>Amount: €${amount.toFixed(2)}</p>
                <p>Please log in to the app to view the full invoice details and download the PDF.</p>
            `,
        });

        // Fetch admin emails
        const { data: admins, error } = await supabase
            .from('users')
            .select('email')
            .eq('role', 'admin');

        if (error) throw error;

        const adminEmails = admins.map(admin => admin.email);

        if (adminEmails.length > 0) {
            await transporter.sendMail({
                from: '"Vaihtoratti" <noreply@vaihtoratti.com>',
                to: adminEmails.join(', '),
                subject: `New Invoice Generated - ${invoiceNumber}`,
                html: `
                    <h1>New Invoice Generated</h1>
                    <p>A new invoice has been generated:</p>
                    <p>Invoice Number: ${invoiceNumber}</p>
                    <p>Driver: ${driverDetails.companyInfo?.companyName || invoice.driverName}</p>
                    <p>Job: ${jobTitle}</p>
                    <p>Amount: €${amount.toFixed(2)}</p>
                    <p>Please log in to the admin panel to review the invoice.</p>
                `,
            });
        }
    } catch (error) {
        console.error('Error sending invoice emails:', error);
    }
};

export const onInvoiceUpdated = async (beforeData: InvoiceData, afterData: InvoiceData) => {
    if (!beforeData || !afterData) return;

    // Only send notification if status changed to 'paid'
    if (afterData.status === 'paid' && beforeData.status !== 'paid') {
        const { driverDetails, jobTitle, amount, invoiceNumber } = afterData;

        try {
            // Send email to driver
            await transporter.sendMail({
                from: '"Vaihtoratti" <noreply@vaihtoratti.com>',
                to: driverDetails.email,
                subject: `Invoice Paid - ${invoiceNumber}`,
                html: `
                    <h1>Invoice Paid</h1>
                    <p>Your invoice has been marked as paid:</p>
                    <p>Invoice Number: ${invoiceNumber}</p>
                    <p>Job: ${jobTitle}</p>
                    <p>Amount: €${amount.toFixed(2)}</p>
                    <p>Thank you for your service!</p>
                `,
            });

            // Fetch admin emails
            const { data: admins, error } = await supabase
                .from('users')
                .select('email')
                .eq('role', 'admin');

            if (error) throw error;

            const adminEmails = admins.map(admin => admin.email);

            if (adminEmails.length > 0) {
                await transporter.sendMail({
                    from: '"Vaihtoratti" <noreply@vaihtoratti.com>',
                    to: adminEmails.join(', '),
                    subject: `Invoice Status Updated - ${invoiceNumber}`,
                    html: `
                        <h1>Invoice Status Updated</h1>
                        <p>An invoice has been marked as paid:</p>
                        <p>Invoice Number: ${invoiceNumber}</p>
                        <p>Driver: ${driverDetails.companyInfo?.companyName || afterData.driverName}</p>
                        <p>Job: ${jobTitle}</p>
                        <p>Amount: €${amount.toFixed(2)}</p>
                    `,
                });
            }
        } catch (error) {
            console.error('Error sending invoice status update emails:', error);
        }
    }
};
