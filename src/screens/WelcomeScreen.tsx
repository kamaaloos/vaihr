import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
  LogBox,
  ActivityIndicator,
} from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import Copyright from '../components/Copyright';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

const { width } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }: Props) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    // Rotate animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 10000, // 10 seconds for one full rotation
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Fade in animation for video placeholder
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // Cleanup video when component unmounts
    return () => {
      if (videoRef.current) {
        videoRef.current.unloadAsync();
      }
    };
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleGetStarted = () => {
    navigation.navigate('Login');
  };

  const handlePlayVideo = async () => {
    setIsVideoVisible(true);
    setIsLoading(true);
    try {
      if (videoRef.current) {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error playing video:', error);
      handleCloseVideo();
    }
  };

  const handleCloseVideo = async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.stopAsync();
        await videoRef.current.unloadAsync();
      }
    } catch (error) {
      console.error('Error stopping video:', error);
    } finally {
      setIsVideoVisible(false);
      setIsLoading(false);
    }
  };

  const handleVideoStatus = (status: AVPlaybackStatus) => {
    if ('isLoaded' in status && status.isLoaded) {
      setIsLoading(false);
      if (status.didJustFinish) {
        handleCloseVideo();
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#DAF2FB', '#4083FF']}
        style={styles.container}
      >
        <View style={styles.content}>
          <Text variant="displaySmall" style={styles.title}>VAIHTORATTI</Text>

          <Animated.View
            style={[
              styles.steeringContainer,
              { transform: [{ rotate: spin }] }
            ]}
          >
            <Image
              source={require('../assets/steering-wheel.png')}
              style={styles.steeringWheel}
            />
          </Animated.View>

          <Text style={styles.subtitle}>Täyttää muutos, hanki muutos!</Text>
          <Text style={styles.description}>Easy to get driver job in here</Text>

          <Animated.View
            style={[
              styles.videoContainer,
              { opacity: fadeAnim }
            ]}
          >
            <TouchableOpacity
              style={styles.playButton}
              onPress={handlePlayVideo}
            >
              <Image
                source={require('../assets/play-botton.png')}
                style={styles.playIcon}
              />
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={handleGetStarted}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>

          <Copyright />

          <Modal
            visible={isVideoVisible}
            animationType="fade"
            transparent={true}
            onRequestClose={handleCloseVideo}
          >
            <View style={styles.modalContainer}>
              <View style={[styles.videoWrapper, styles.videoContainer]}>
                <IconButton
                  icon="close"
                  size={24}
                  onPress={handleCloseVideo}
                  style={styles.closeButton}
                  iconColor="white"
                />
                {isLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#6949FF" />
                    <Text style={styles.loadingText}>Loading video...</Text>
                  </View>
                )}
                <Video
                  ref={videoRef}
                  source={require('../assets/intro-video.mp4')}
                  style={[styles.video, isLoading && styles.hidden]}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={false}
                  isMuted={false}
                  onPlaybackStatusUpdate={handleVideoStatus}
                  onLoad={() => setIsLoading(false)}
                  onError={(error: string) => {
                    console.log('Video loading error:', error);
                    handleCloseVideo();
                  }}
                />
              </View>
            </View>
          </Modal>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 40,
  },
  steeringContainer: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  steeringWheel: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  subtitle: {
    fontSize: 18,
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  videoContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  playButton: {
    width: 64,
    height: 64,
    backgroundColor: '#FF0000',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  getStartedButton: {
    backgroundColor: '#6949FF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  getStartedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  videoWrapper: {
    width: '100%',
    height: 200,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  placeholderContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  placeholderTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    alignSelf: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 2,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  hidden: {
    opacity: 0,
  },
}); 