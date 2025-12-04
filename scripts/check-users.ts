import { supabaseMigration } from '../src/config/supabaseMigration';

async function checkUsers() {
    try {
        console.log('Fetching users from database...');
        const { data, error } = await supabaseMigration
            .from('users')
            .select('id, email, role, expo_push_token');

        if (error) {
            console.error('Error fetching users:', error);
            return;
        }

        console.log('\nCurrent users in the database:');
        console.log(JSON.stringify(data, null, 2));

        // Check for users without push tokens
        const usersWithoutToken = data?.filter(user => !user.expo_push_token);
        if (usersWithoutToken?.length) {
            console.log('\nUsers without push tokens:');
            console.log(JSON.stringify(usersWithoutToken, null, 2));
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

checkUsers(); 