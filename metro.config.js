const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver for additional file extensions
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];
config.resolver.assetExts = [...config.resolver.assetExts, 'db'];

// Add resolver for Node.js core modules
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'ws' || moduleName.startsWith('ws/')) {
        return {
            filePath: require.resolve('react-native-websocket'),
            type: 'sourceFile',
        };
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config; 