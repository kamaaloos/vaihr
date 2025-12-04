import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OnlineStatusIndicator: React.FC = () => {
    const { isOnline, loading, setOnline, setOffline } = useOnlineStatus();

    if (isOnline === null) {
        return null; // Don't show if user is not logged in
    }

    return (
        <View style={styles.container}>
            <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: isOnline ? '#4CAF50' : '#F44336' }]} />
                <Text style={styles.statusText}>
                    {isOnline ? 'Online' : 'Offline'}
                </Text>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.button, styles.onlineButton]}
                    onPress={setOnline}
                    disabled={loading || isOnline}
                >
                    <Text style={styles.buttonText}>Go Online</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.offlineButton]}
                    onPress={setOffline}
                    disabled={loading || !isOnline}
                >
                    <Text style={styles.buttonText}>Go Offline</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        margin: 16,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    button: {
        flex: 1,
        padding: 12,
        borderRadius: 6,
        alignItems: 'center',
    },
    onlineButton: {
        backgroundColor: '#4CAF50',
    },
    offlineButton: {
        backgroundColor: '#F44336',
    },
    buttonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
}); 