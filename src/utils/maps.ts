import { Platform, Linking, Alert, Clipboard } from 'react-native';

export const openMaps = async (location: string) => {
    try {
        const encodedLocation = encodeURIComponent(location);
        const mapsUrl = Platform.select({
            ios: `maps://app?address=${encodedLocation}`,
            android: `google.navigation:q=${encodedLocation}`,
            default: `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`
        });

        const canOpen = await Linking.canOpenURL(mapsUrl);

        if (canOpen) {
            await Linking.openURL(mapsUrl);
        } else {
            // Fallback to browser if maps app isn't available
            const browserUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;
            await Linking.openURL(browserUrl);
        }
    } catch (error) {
        console.error('Error opening maps:', error);
        Alert.alert(
            "Error",
            "Could not open maps. Please try again or copy the address manually.",
            [
                {
                    text: "Copy Address",
                    onPress: () => {
                        Clipboard.setString(location);
                        Alert.alert("Success", "Address copied to clipboard!");
                    }
                },
                { text: "OK" }
            ]
        );
    }
}; 