import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../config/supabase';
import { supabaseMigration } from '../config/supabaseMigration';
import Toast from 'react-native-toast-message';

interface Terms {
  content: string;
  version: string;
  lastUpdated: string;
}

export default function TermsOfServiceScreen() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [englishTerms, setEnglishTerms] = useState<Terms | null>(null);
  const [finnishTerms, setFinnishTerms] = useState<Terms | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching terms from Supabase...');

      // First, try to fetch with language column (new structure)
      let { data: terms, error: fetchError } = await supabase
        .from('terms')
        .select('*')
        .in('language', ['english', 'finnish']);

      // If that fails due to missing language column, try without it (old structure)
      if (fetchError && fetchError.code === '42703' && fetchError.message.includes('language')) {
        console.log('Language column not found, trying alternative query...');
        const { data: altTerms, error: altError } = await supabase
          .from('terms')
          .select('*');

        if (altError) {
          console.error('Alternative fetch error:', altError);
          throw altError;
        }

        // If we get data without language column, treat it as English content
        if (altTerms && altTerms.length > 0) {
          const term = altTerms[0]; // Take the first (and likely only) term
          setEnglishTerms({
            content: term.content || term.terms_content || 'Terms of service content not available.',
            version: term.version || '1.0.0',
            lastUpdated: term.last_updated || term.updated_at || new Date().toISOString()
          });
          setFinnishTerms({
            content: 'Käyttöehtojen sisältö ei ole saatavilla.',
            version: '1.0.0',
            lastUpdated: new Date().toISOString()
          });
          return;
        }
      } else if (fetchError) {
        console.error('Supabase fetch error:', fetchError);
        throw fetchError;
      }

      console.log('Terms data received:', terms);

      if (terms) {
        const english = terms.find(t => t.language === 'english');
        const finnish = terms.find(t => t.language === 'finnish');

        console.log('Found terms:', { english: !!english, finnish: !!finnish });

        if (english) {
          setEnglishTerms({
            content: english.content,
            version: english.version,
            lastUpdated: english.last_updated
          });
        }

        if (finnish) {
          setFinnishTerms({
            content: finnish.content,
            version: finnish.version,
            lastUpdated: finnish.last_updated
          });
        }

        // If terms don't exist, create default ones
        if (!english || !finnish) {
          console.log('Terms not found, creating defaults...');
          await createDefaultTerms();
        }
      } else {
        // No terms found at all, create defaults
        console.log('No terms found, creating defaults...');
        await createDefaultTerms();
      }
    } catch (error: any) {
      console.error('Error fetching terms:', error);
      const errorMessage = error?.message || error?.error_description || 'Failed to load terms of service';
      setError(errorMessage);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
  };

  const createDefaultTerms = async () => {
    try {
      console.log('Creating default terms...');

      // First try with language column (new structure)
      const defaultEnglishTerms = {
        language: 'english',
        content: `Terms of Service\n\n1. Acceptance of Terms\nBy accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.\n\n2. User Account\nTo use certain features of the application, you must register for an account. You agree to provide accurate information and keep it updated.\n\n3. Privacy\nYour privacy is important to us. Please review our Privacy Policy to understand our practices.\n\n4. Service Usage\nYou agree to use the service only for lawful purposes and in accordance with these Terms.\n\n5. Modifications\nWe reserve the right to modify these terms at any time. Your continued use of the application constitutes agreement to such modifications.`,
        version: '1.0',
        last_updated: new Date().toISOString()
      };

      const defaultFinnishTerms = {
        language: 'finnish',
        content: `Käyttöehdot\n\n1. Ehtojen hyväksyminen\nKäyttämällä tätä sovellusta hyväksyt nämä käyttöehdot ja sitoudut noudattamaan niitä.\n\n2. Käyttäjätili\nJoidenkin ominaisuuksien käyttäminen edellyttää rekisteröitymistä. Sitoudut antamaan paikkansapitävät tiedot ja pitämään ne ajan tasalla.\n\n3. Yksityisyys\nYksityisyytesi on meille tärkeää. Tutustu tietosuojakäytäntöömme ymmärtääksesi toimintatapamme.\n\n4. Palvelun käyttö\nSitoudut käyttämään palvelua vain laillisiin tarkoituksiin ja näiden ehtojen mukaisesti.\n\n5. Muutokset\nPidätämme oikeuden muuttaa näitä ehtoja milloin tahansa. Palvelun jatkuva käyttö merkitsee muutosten hyväksymistä.`,
        version: '1.0',
        last_updated: new Date().toISOString()
      };

      console.log('Upserting default terms using service role client...');
      let { error: insertError } = await supabaseMigration
        .from('terms')
        .upsert([defaultEnglishTerms, defaultFinnishTerms]);

      // If that fails due to missing language column, try without it
      if (insertError && insertError.code === '42703' && insertError.message.includes('language')) {
        console.log('Language column not found, trying without language column...');
        const simpleTerms = {
          content: defaultEnglishTerms.content,
          version: defaultEnglishTerms.version,
          last_updated: defaultEnglishTerms.last_updated
        };

        const { error: simpleInsertError } = await supabaseMigration
          .from('terms')
          .upsert([simpleTerms]);

        if (simpleInsertError) {
          console.error('Error upserting simple terms:', simpleInsertError);
          throw simpleInsertError;
        }
      } else if (insertError) {
        console.error('Error upserting default terms:', insertError);
        throw insertError;
      }

      console.log('Default terms created successfully');

      // Update state with default terms
      setEnglishTerms({
        content: defaultEnglishTerms.content,
        version: defaultEnglishTerms.version,
        lastUpdated: defaultEnglishTerms.last_updated
      });

      setFinnishTerms({
        content: defaultFinnishTerms.content,
        version: defaultFinnishTerms.version,
        lastUpdated: defaultFinnishTerms.last_updated
      });
    } catch (error: any) {
      console.error('Error creating default terms:', error);
      const errorMessage = error?.message || error?.error_description || 'Failed to create default terms';
      setError(errorMessage);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
        position: 'bottom',
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6949FF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={fetchTerms} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  const terms = language === 'fi' ? finnishTerms : englishTerms;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.termsText}>{terms?.content || ''}</Text>
          {terms?.version && (
            <Text style={styles.versionText}>
              Version: {terms.version}
            </Text>
          )}
          {terms?.lastUpdated && (
            <Text style={styles.dateText}>
              Last Updated: {new Date(terms.lastUpdated).toLocaleDateString()}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  termsText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 20,
  },
  versionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#6949FF',
  },
}); 