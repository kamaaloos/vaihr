-- Add invoice_number column to invoices table
ALTER TABLE invoices
ADD COLUMN invoice_number TEXT NOT NULL UNIQUE;

-- Create a function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    date_part TEXT;
    random_part TEXT;
    new_invoice_number TEXT;
BEGIN
    -- Get current date in YYYYMM format
    date_part := to_char(CURRENT_DATE, 'YYYYMM');
    
    -- Generate a random 4-digit number
    random_part := lpad(floor(random() * 10000)::text, 4, '0');
    
    -- Combine to form invoice number
    new_invoice_number := 'INV-' || date_part || '-' || random_part;
    
    RETURN new_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically set invoice_number before insert
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Keep trying until we get a unique invoice number
    LOOP
        NEW.invoice_number := generate_invoice_number();
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM invoices WHERE invoice_number = NEW.invoice_number
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS set_invoice_number_trigger ON invoices;
CREATE TRIGGER set_invoice_number_trigger
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_number();

-- Update the invoice creation policy to include invoice_number
DROP POLICY IF EXISTS "Drivers can create invoices for completed jobs" ON invoices;

CREATE POLICY "Drivers can create invoices for completed jobs" ON invoices
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User is a driver
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'driver'
        )
        -- Driver ID matches the current user ID
        AND driver_id = auth.uid()
        -- Referenced job exists and is completed
        AND EXISTS (
            SELECT 1 FROM jobs
            WHERE jobs.id = job_id
            AND jobs.status = 'completed'
            AND jobs.driver_id = auth.uid()
        )
        -- Admin ID is set from the job
        AND EXISTS (
            SELECT 1 FROM jobs
            WHERE jobs.id = job_id
            AND jobs.admin_id = admin_id
        )
        -- Invoice number is set (will be handled by trigger)
        AND invoice_number IS NOT NULL
    ); 