import { StyleSheet } from 'react-native';

export const colors = {
    primary: '#6949FF',
    background: '#F8F9FD',
    surface: '#FFFFFF',
    text: '#333333',
    textSecondary: '#757575',
    border: '#E0E0E0',
    success: '#4CAF50',
    error: '#F44336',
};

export const commonStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        padding: 16,
    },
    surface: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    sectionTitle: {
        padding: 16,
        paddingBottom: 8,
        color: colors.text,
        fontWeight: '500',
        fontSize: 16,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
    },
}); 