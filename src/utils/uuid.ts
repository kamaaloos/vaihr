import { supabase } from '../config/supabase';

/**
 * Converts a Firebase ID to a UUID or validates an existing UUID.
 * First checks if the input is already a UUID, then tries to find the user directly,
 * and finally falls back to id_mappings table.
 */
export const convertToUUID = async (id: string): Promise<string> => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // If it's already a UUID, return it
    if (uuidPattern.test(id)) {
        return id;
    }

    // First try to get the user directly from the users table
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('firebase_id', id)
        .single();

    if (!userError && userData?.id) {
        return userData.id;
    }

    // If that fails, try the id_mappings table
    const { data: mappingData, error: mappingError } = await supabase
        .from('id_mappings')
        .select('new_id')
        .eq('old_id', id)
        .single();

    if (!mappingError && mappingData?.new_id) {
        return mappingData.new_id;
    }

    // If both lookups fail, throw an error
    console.error('Failed to find UUID mapping:', { userError, mappingError });
    throw new Error(`Could not find UUID for ID: ${id}`);
};

export default { convertToUUID }; 