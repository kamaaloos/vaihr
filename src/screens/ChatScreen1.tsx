import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, FlatList, TouchableOpacity, Image, Animated, Keyboard, ActivityIndicator, Dimensions, Modal, PanResponder } from 'react-native';
import { Text, TextInput, IconButton, Avatar, Menu, Portal, Dialog, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import EmojiPicker from 'rn-emoji-keyboard';
import Copyright from '../components/Copyright';
import { useChat } from '../contexts/ChatContext';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

type ChatRouteProp = RouteProp<RootStackParamList, 'Chat'>;

type ChatMessage = {
  id: string;
  text: string;
  sender_id: string;
  sender_name?: string;
  created_at: string;
  updated_at: string;
  read: boolean;
  edited?: boolean;
  deleted?: boolean;
  delivered?: boolean;
  image_url?: string;
  local_id?: string;
  pending?: boolean;
  error?: boolean;
  read_at?: string;
  edited_at?: string;
  deleted_at?: string;
  delivered_at?: string;
}

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  lastMessageTime: string | null;
}

interface ChatScreenProps {
  route: {
    params: {
      driverId: string;
      driverName: string;
      chatId?: string;
      isOnline?: boolean;
    };
  };
}

interface DriverProfile {
  photo_url?: string;
  name: string;
  email: string;
}

interface ChatContextType {
  messages: ChatMessage[];
  sendMessage: (text: string, imageUrl?: string) => Promise<void>;
  setTypingStatus: (isTyping: boolean) => void;
  otherUserTyping: boolean;
  otherUserOnline: boolean;
  createOrGetChat: (userId: string) => Promise<{ data: Chat | null; error: string | null }>;
  deleteMessage: (messageId: string) => Promise<void>;
}

interface Chat {
  id: string;
  participants: string[];
  created_at: string;
  updated_at: string;
}

const formatMessageTime = (timestamp: string | null) => {
  if (!timestamp) return '';
  return format(new Date(timestamp), 'HH:mm');
};

const SWIPE_THRESHOLD = -100;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const Message = React.memo(({ message, isOwnMessage, onDelete }: { message: ChatMessage; isOwnMessage: boolean; onDelete: () => void }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const rowRef = useRef<View>(null);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) => {
      return isOwnMessage && Math.abs(dx) > Math.abs(dy * 2);
    },
    onPanResponderMove: (_, { dx }) => {
      if (isOwnMessage && dx < 0) {
        translateX.setValue(dx);
      }
    },
    onPanResponderRelease: (_, { dx }) => {
      if (dx < SWIPE_THRESHOLD && isOwnMessage) {
        Animated.spring(translateX, {
          toValue: -SCREEN_WIDTH,
          useNativeDriver: true,
          bounciness: 0,
        }).start(() => {
          onDelete();
        });
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      }
    },
  });

  const messageContainerStyle = [
    styles.messageContainer,
    isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
    message.deleted && styles.deletedMessageContainer,
  ];

  const messageTextStyle = [
    styles.messageText,
    isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
    message.deleted && styles.deletedMessageText,
  ];

  const timeTextStyle = [
    styles.timeText,
    isOwnMessage ? styles.ownTimeText : styles.otherTimeText,
  ];

  return (
    <Animated.View
      ref={rowRef}
      style={[
        styles.messageRow,
        {
          transform: [{ translateX }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={messageContainerStyle}>
        {message.deleted ? (
          <Text style={styles.deletedMessageText}>This message was deleted</Text>
        ) : (
          <>
            <Text style={messageTextStyle}>{message.text}</Text>
            {message.image_url && (
              <Image source={{ uri: message.image_url }} style={styles.messageImage} />
            )}
            <Text style={timeTextStyle}>
              {formatMessageTime(message.created_at)}
            </Text>
          </>
        )}
      </View>
      {isOwnMessage && (
        <Animated.View
          style={[
            styles.deleteButton,
            {
              opacity: translateX.interpolate({
                inputRange: [-100, 0],
                outputRange: [1, 0],
              }),
            },
          ]}
        >
          <TouchableOpacity onPress={onDelete}>
            <Ionicons name="trash-outline" size={24} color="#FF4444" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
});

export default function ChatScreen({ route }: ChatScreenProps) {
  const { driverId, driverName, chatId: initialChatId, isOnline: initialIsOnline } = route.params;
  const { user } = useAuth();
  const chatContext = useChat();
  const {
    messages: rawMessages = [],
    sendMessage: sendChatMessage,
    setTypingStatus,
    otherUserTyping,
    otherUserOnline,
    createOrGetChat,
    deleteMessage,
  } = (chatContext as unknown as ChatContextType) || {};

  const messages = rawMessages as unknown as ChatMessage[];
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const [isOnline, setIsOnline] = useState(initialIsOnline || false);
  const [chatId, setChatId] = useState<string | null>(initialChatId || null);

  // Set up real-time chat subscription
  useEffect(() => {
    if (!user || !chatId) return;

    const channel = supabase.channel(`chat:${chatId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          // New message received
          const newMessage = payload.new as ChatMessage;
          if (newMessage.sender_id !== user.id) {
            // Mark message as read if it's from the other user
            await supabase
              .from('messages')
              .update({ read: true, read_at: new Date().toISOString() })
              .eq('id', newMessage.id);
          }
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, chatId]);

  // Track user presence (driver tracks themselves when in chat)
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const userPresence = state[driverId];
        setIsOnline(!!userPresence);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Driver tracks their own presence
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user, driverId]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Create or get chat first
        const { data: chat, error } = await createOrGetChat(driverId);
        if (error) throw error;
        if (chat && isMounted) {
          setChatId(chat.id);
        }

        // Get user data from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, name, avatar_url')
          .eq('id', driverId)
          .single();

        if (userError) throw userError;
        if (!isMounted) return;

        if (userData) {
          setDriverProfile({
            photo_url: userData.avatar_url,
            name: userData.name || userData.email || driverName || 'User',
            email: userData.email
          });

          // Check online status from user_status table
          const { data: statusData } = await supabase
            .from('user_status')
            .select('is_online, last_seen')
            .eq('user_id', driverId)
            .single();

          if (statusData) {
            setIsOnline(statusData.is_online);
          }
        }
      } catch (error) {
        console.error('Error in fetchData:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load chat data',
        });
      }
    };

    fetchData();

    // Subscribe to user status changes
    const subscription = supabase
      .channel('user_status_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_status',
        filter: `user_id=eq.${driverId}`
      }, payload => {
        if (payload.eventType === 'UPDATE' && isMounted) {
          const updatedStatus = payload.new;
          setIsOnline(updatedStatus.is_online);
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [driverId, driverName, createOrGetChat]);

  const handleSend = async () => {
    if (!text.trim() || !chatId) return;

    const trimmedText = text.trim();
    setText('');
    try {
      await sendChatMessage(trimmedText);
      // Update last activity
      await supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user?.id);
    } catch (error) {
      console.error('Error sending message:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send message',
      });
      setText(trimmedText); // Restore text if send fails
    }
  };

  const handleEmojiSelect = ({ emoji }: { emoji: string }) => {
    setText(prev => prev + emoji);
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploading(true);
        const uri = result.assets[0].uri;
        const fileExt = uri.substring(uri.lastIndexOf('.') + 1);
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `chat-images/${fileName}`;

        // Upload to Supabase Storage
        const formData = new FormData();
        formData.append('file', {
          uri,
          name: fileName,
          type: `image/${fileExt}`
        } as any);

        const { data, error } = await supabase
          .storage
          .from('chat-images')
          .upload(filePath, formData);

        if (error) throw error;

        const { data: { publicUrl } } = supabase
          .storage
          .from('chat-images')
          .getPublicUrl(filePath);

        await sendChatMessage('', publicUrl);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to upload image',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextChange = (value: string) => {
    setText(value);
    setTypingStatus(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(false);
    }, 1000);
  };

  const handleDelete = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete message',
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Avatar.Image
              size={40}
              source={
                driverProfile && driverProfile.photo_url
                  ? { uri: driverProfile.photo_url }
                  : require('../assets/default-avatar.png')
              }
            />
            <View style={styles.nameContainer}>
              <Text style={styles.userName}>{driverProfile?.name || driverName || 'User'}</Text>
              <View style={styles.onlineStatus}>
                <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#4CAF50' : '#757575' }]} />
                <Text style={styles.onlineText}>{isOnline ? 'Online' : 'Offline'}</Text>
              </View>
            </View>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <Message
              message={item}
              isOwnMessage={item.sender_id === user?.id}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          contentContainerStyle={styles.messagesContainer}
          inverted
        />

        {otherUserTyping && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>
              {driverName || 'User'} is typing...
            </Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <IconButton
            icon="emoticon"
            size={24}
            onPress={() => setShowEmojiPicker(!showEmojiPicker)}
          />
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            style={styles.input}
            multiline
          />
          <IconButton
            icon="image"
            size={24}
            onPress={handleImagePick}
            disabled={isUploading}
          />
          <IconButton
            icon="send"
            size={24}
            onPress={handleSend}
            disabled={!text.trim() && !isUploading}
          />
        </View>
      </KeyboardAvoidingView>

      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelected={handleEmojiSelect}
          open={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messagesContainer: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 15,
    marginVertical: 2,
  },
  ownMessageContainer: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    marginLeft: 'auto',
  },
  otherMessageContainer: {
    backgroundColor: '#E5E5EA',
    alignSelf: 'flex-start',
    marginRight: 'auto',
  },
  deletedMessageContainer: {
    backgroundColor: '#F0F0F0',
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#000',
  },
  deletedMessageText: {
    color: '#999',
    fontStyle: 'italic',
  },
  timeText: {
    fontSize: 12,
    marginTop: 2,
  },
  ownTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimeText: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    marginHorizontal: 10,
    maxHeight: 100,
  },
  typingContainer: {
    padding: 5,
    backgroundColor: '#F0F0F0',
  },
  typingText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 10,
    marginVertical: 5,
  },
  deleteButton: {
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginLeft: 10,
    borderRadius: 8,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#fff',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameContainer: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  onlineText: {
    fontSize: 12,
    color: '#666',
  },
  avatar: {
    marginRight: 12,
  },
}); 