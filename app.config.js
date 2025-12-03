import 'dotenv/config';
import appJson from './app.json';

export default {
  ...appJson,
  expo: {
    ...appJson.expo,
    owner: "mayloos",
    plugins: [
      "expo-asset",
      "expo-video"
    ],
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceKey: process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      eas: {
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID
      }
    }
  }
}; 