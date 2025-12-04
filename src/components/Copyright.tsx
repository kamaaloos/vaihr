import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function Copyright() {
  return (
    <View style={styles.container}>
      <Text variant="bodySmall" style={styles.text}>
        © Copyright - 2024 Vaihtoratti, designed by Engineer Hasan Kamaal
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#666',
    textAlign: 'center',
    fontSize: 12,
  },
}); 