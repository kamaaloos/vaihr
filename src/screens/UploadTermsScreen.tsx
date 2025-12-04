import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Button, Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../config/supabase';
import { supabaseMigration } from '../config/supabaseMigration';
import Toast from 'react-native-toast-message';
import { useAuth } from '../contexts/AuthContext';
import Copyright from '../components/Copyright';

export default function UploadTermsScreen() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'fi'>('en');
    const [terms, setTerms] = useState({
        en: '',
        fi: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadTerms();
    }, []);

    const loadTerms = async () => {
        try {
            setLoading(true);
            const { data: termsData, error } = await supabase
                .from('terms')
                .select('*')
                .in('language', ['english', 'finnish']);

            if (error) throw error;

            if (termsData) {
                const englishTerms = termsData.find(t => t.language === 'english');
                const finnishTerms = termsData.find(t => t.language === 'finnish');

                setTerms({
                    en: englishTerms?.content || '',
                    fi: finnishTerms?.content || ''
                });
            }
        } catch (error) {
            console.error('Error loading terms:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load terms of service',
                position: 'bottom',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!isAdmin) return;
        
        try {
            setSaving(true);
            Keyboard.dismiss(); // Dismiss keyboard when saving
            
            const updates = [
                {
                    language: 'english',
                    content: terms.en.trim(),
                    version: '1.0',
                    last_updated: new Date().toISOString()
                },
                {
                    language: 'finnish',
                    content: terms.fi.trim(),
                    version: '1.0',
                    last_updated: new Date().toISOString()
                }
            ];

            console.log('Saving terms using service role client...');
            const { error } = await supabaseMigration
                .from('terms')
                .upsert(updates);

            if (error) {
                console.error('Error saving terms:', error);
                throw error;
            }

            console.log('Terms saved successfully');
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Terms of service saved successfully',
                position: 'bottom',
            });

            // Refresh the terms after saving
            await loadTerms();
        } catch (error: any) {
            console.error('Error saving terms:', error);
            const errorMessage = error?.message || error?.error_description || 'Failed to save terms of service';
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: errorMessage,
                position: 'bottom',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <LinearGradient
                    colors={['#DAF2FB', '#4083FF']}
                    style={[styles.gradient, styles.loadingContainer]}
                >
                    <ActivityIndicator size="large" />
                    <Text style={styles.loadingText}>Loading terms...</Text>
                </LinearGradient>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <LinearGradient
                        colors={['#DAF2FB', '#4083FF']}
                        style={styles.gradient}
                    >
                        <View style={styles.content}>
                            <View style={styles.header}>
                                <Text variant="headlineSmall" style={styles.title}>
                                    Terms of Service
                                </Text>
                                <View style={styles.languageButtons}>
                                    <Button
                                        mode={selectedLanguage === 'en' ? 'contained' : 'outlined'}
                                        onPress={() => setSelectedLanguage('en')}
                                        style={styles.languageButton}
                                    >
                                        English
                                    </Button>
                                    <Button
                                        mode={selectedLanguage === 'fi' ? 'contained' : 'outlined'}
                                        onPress={() => setSelectedLanguage('fi')}
                                        style={styles.languageButton}
                                    >
                                        Finnish
                                    </Button>
                                </View>
                            </View>

                            <ScrollView 
                                style={styles.termsContainer}
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode="on-drag"
                                showsVerticalScrollIndicator={false}
                            >
                                {isAdmin ? (
                                    <TextInput
                                        mode="outlined"
                                        multiline
                                        value={terms[selectedLanguage]}
                                        onChangeText={(text) => setTerms(prev => ({
                                            ...prev,
                                            [selectedLanguage]: text
                                        }))}
                                        placeholder={`Enter Terms of Service in ${selectedLanguage === 'en' ? 'English' : 'Finnish'}`}
                                        style={styles.textInput}
                                        numberOfLines={20}
                                        textAlignVertical="top"
                                        blurOnSubmit={true}
                                    />
                                ) : (
                                    <Text style={styles.termsText}>
                                        {terms[selectedLanguage] || 'No terms available in this language.'}
                                    </Text>
                                )}
                            </ScrollView>

                            {isAdmin && (
                                <Button
                                    mode="contained"
                                    onPress={handleSave}
                                    style={styles.saveButton}
                                    icon="content-save"
                                    loading={saving}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save Terms'}
                                </Button>
                            )}
                            <Copyright />
                        </View>
                    </LinearGradient>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    header: {
        marginBottom: 16,
    },
    title: {
        color: '#333',
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    languageButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 16,
    },
    languageButton: {
        minWidth: 100,
    },
    termsContainer: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 16,
        padding: 16,
    },
    textInput: {
        backgroundColor: '#fff',
        minHeight: 400,
    },
    termsText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#333',
    },
    saveButton: {
        marginTop: 16,
        marginBottom: 16,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        color: '#333',
    },
}); 