import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, FlatList, TouchableOpacity, Image, Animated, Keyboard, ActivityIndicator, Dimensions, Alert, PanResponder } from 'react-native';
import { Text, TextInput, Avatar, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { useChatFunctions } from '../hooks/useChatFunctions';
import { useChat } from '../contexts/ChatContext';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import EmojiPicker from 'rn-emoji-keyboard';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../types';
import type { Message } from '../contexts/ChatContext';
import { supabase } from '../config/supabase';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = -100;

type Props = StackScreenProps<RootStackParamList, 'Chat'>;

interface AdminProfile {
  photo_url?: string;
  name: string;
  email: string;
}

const MessageItem = memo(({ item, onDelete, userId, showDate }: {
  item: Message;
  onDelete: (id: string) => void;
  userId: string | undefined;
  showDate: boolean;
}) => {
  const isOwnMessage = item.sender_id === userId;
  const messageTime = format(new Date(item.created_at), 'HH:mm');
  const messageDate = format(new Date(item.created_at), 'MMM d, yyyy');
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
          onDelete(item.id);
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

  return (
    <Animated.View
      ref={rowRef}
      style={[
        styles.messageWrapper,
        {
          transform: [{ translateX }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {showDate && (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateText}>{messageDate}</Text>
        </View>
      )}
      <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
        <View style={styles.messageContent}>
          {item.deleted ? (
            <Text style={[styles.deletedText, isOwnMessage && styles.ownDeletedText]}>
              This message was deleted
            </Text>
          ) : (
            <>
              <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
                {item.text}
              </Text>
              {item.image_url && (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.messageFooter}>
                <Text style={[styles.timestamp, isOwnMessage && styles.ownTimestamp]}>
                  {messageTime}
                </Text>
                {isOwnMessage && (
                  <View style={styles.receiptContainer}>
                    {item.read && <Text style={styles.readReceipt}>✓✓</Text>}
                    {item.delivered && !item.read && <Text style={styles.deliveredReceipt}>✓</Text>}
                  </View>
                )}
              </View>
            </>
          )}
        </View>
        {isOwnMessage && !item.deleted && (
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
            <TouchableOpacity onPress={() => onDelete(item.id)}>
              <Ionicons name="trash-outline" size={24} color="#FF4444" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
});

const ChatScreen: React.FC<Props> = ({ route }) => {
  const navigation = useNavigation();
  const { driverId: adminId, driverName: adminName, chatId, isOnline: initialIsOnline } = route.params;
  const { user } = useAuth();
  const chatContext = useChat();

  // Add a ref to track if we've already handled invalid parameters to prevent infinite loops
  const invalidParamsHandledRef = useRef(false);
  const contextLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show loading state while contexts are initializing
  if (!user || !chatContext) {
    // Clear any existing timeout
    if (contextLoadingTimeoutRef.current) {
      clearTimeout(contextLoadingTimeoutRef.current);
    }

    // Set a timeout to prevent infinite loading
    contextLoadingTimeoutRef.current = setTimeout(() => {
      console.log('⚠️ ChatScreen: Context loading timeout, navigating back');
      navigation.goBack();
    }, 5000); // 5 second timeout

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4083FF" />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Clear timeout if contexts are ready
  if (contextLoadingTimeoutRef.current) {
    clearTimeout(contextLoadingTimeoutRef.current);
    contextLoadingTimeoutRef.current = null;
  }

  // Re-enable validation with guards to prevent infinite loops
  // Prevent rendering if adminId is the same as current user ID (invalid parameters)
  if (adminId === user?.id) {
    // Only handle invalid params once to prevent infinite loops
    if (!invalidParamsHandledRef.current) {
      invalidParamsHandledRef.current = true;
      // Navigate back to prevent infinite loop
      setTimeout(() => {
        navigation.goBack();
      }, 100);
    }

    return null;
  }

  // Check if all three parameters are the same (invalid - can't chat with yourself)
  if (route.params.driverId === route.params.chatId && route.params.driverId === adminId) {
    // Only handle invalid params once to prevent infinite loops
    if (!invalidParamsHandledRef.current) {
      invalidParamsHandledRef.current = true;
      // Navigate back to prevent infinite loop
      setTimeout(() => {
        navigation.goBack();
      }, 100);
    }

    return null;
  }

  // Additional validation - prevent rendering if parameters are missing or invalid
  if (!adminId || !adminName || !user || !chatContext) {
    // Only handle invalid params once to prevent infinite loops
    if (!invalidParamsHandledRef.current) {
      invalidParamsHandledRef.current = true;
      // Navigate back to prevent infinite loop
      setTimeout(() => {
        navigation.goBack();
      }, 100);
    }

    return null;
  }

  // Reset the invalid params flag when we have valid parameters
  if (invalidParamsHandledRef.current) {
    invalidParamsHandledRef.current = false;
  }

  const {
    text,
    setText,
    messages,
    setMessages,
    handleDelete,
    isInitializing,
    initError,
    isLoading,
    retryInitialization,
    chatId: chatIdFromFunctions
  } = useChatFunctions(adminId, chatId);

  const sendMessage = chatContext?.sendMessage;

  const loadMoreMessages = chatContext?.loadMoreMessages ?? (() => Promise.resolve());
  const otherUserOnline = chatContext?.otherUserOnline ?? false;
  const [isOnline, setIsOnline] = useState(initialIsOnline || false);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const isMounted = useRef(true);
  const chatSubscription = useRef<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const initializedRef = useRef(false);
  const lastMountKey = useRef('');

  // Initialize chat when component mounts
  useEffect(() => {
    console.log('🎬 ChatScreen: Initialization effect triggered', {
      user: !!user,
      adminId,
      chatId,
      chatContext: !!chatContext,
      initializedRef: initializedRef.current,
      mountKey: lastMountKey.current
    });

    const initializeChat = async () => {
      if (!user || !adminId || !chatContext || initializedRef.current) {
        console.log('ChatScreen: Skipping initialization', {
          user: !!user,
          adminId: !!adminId,
          chatContext: !!chatContext,
          alreadyInitialized: initializedRef.current
        });
        return;
      }

      // Prevent initialization if adminId is the same as current user ID
      if (adminId === user.id) {
        console.log('ChatScreen: Skipping initialization - adminId is same as current user ID');
        return;
      }

      // Additional guard: only initialize if we have a valid mount key
      const currentMountKey = `${adminId}-${chatId}`;
      if (lastMountKey.current !== currentMountKey) {
        console.log('ChatScreen: Skipping initialization - mount key mismatch');
        return;
      }

      try {
        initializedRef.current = true;
        console.log('ChatScreen: Starting chat initialization', { adminId, chatId });

        // If we have a chatId, fetch the chat directly
        if (chatId && chatId !== adminId) { // Make sure chatId is not the same as adminId
          console.log('ChatScreen: Using existing chatId:', chatId);
          let chatToLoad;

          // Find the chat using admin_id and driver_id
          const { data: existingChat, error } = await supabase
            .from('chats')
            .select('*')
            .eq('admin_id', adminId)
            .eq('driver_id', user.id)
            .single();

          if (error) {
            console.error('ChatScreen: Error fetching existing chat:', error);
            throw error;
          }
          if (!existingChat) {
            console.error('ChatScreen: Chat not found for chatId:', chatId);
            throw new Error('Chat not found');
          }
          chatToLoad = existingChat;
          console.log('ChatScreen: Found existing chat:', chatToLoad.id);

          // Set the current chat in the context
          chatContext.setCurrentChat(chatToLoad);

          // Load messages for the chat
          const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatToLoad.id)
            .order('created_at', { ascending: false })
            .limit(20);

          if (messagesError) {
            console.error('ChatScreen: Error loading messages:', messagesError);
            throw messagesError;
          }

          console.log('ChatScreen: Loaded', messages?.length || 0, 'messages');
          // Update messages in the context
          setMessages(messages || []);
        } else {
          // If no chatId or chatId is the same as adminId, create a new chat
          console.log('ChatScreen: Creating new chat with adminId:', adminId);
          const { data: newChat, error } = await chatContext.createOrGetChat(adminId);
          if (error) {
            console.error('ChatScreen: Error creating chat:', error);
            throw error;
          }
          if (!newChat) {
            console.error('ChatScreen: Failed to create chat - no data returned');
            throw new Error('Failed to create chat');
          }
          console.log('ChatScreen: Successfully created/found chat:', newChat.id);
        }
      } catch (error) {
        console.error('ChatScreen: Error initializing chat:', error);
        initializedRef.current = false; // Reset on error
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to initialize chat. Please try again.',
          position: 'bottom',
        });
      }
    };

    initializeChat();
  }, [user?.id, adminId]); // Keep only essential dependencies to prevent infinite loops

  // Set up real-time message subscription
  useEffect(() => {
    if (!user || !chatId) return;

    console.log('ChatScreen: Setting up real-time subscription for chat:', chatId);

    // Clean up previous subscription
    if (chatSubscription.current) {
      console.log('ChatScreen: Cleaning up previous subscription');
      chatSubscription.current.unsubscribe();
    }

    chatSubscription.current = supabase
      .channel(`chat:${chatId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, async (payload) => {
        console.log('ChatScreen: Received message change:', payload.eventType, payload.new?.id);

        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new as Message;
          setMessages((prev: Message[]) => {
            const updatedMessages = [newMessage, ...prev];
            return updatedMessages.sort((a: Message, b: Message) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });

          if (newMessage.sender_id !== user.id) {
            await supabase
              .from('messages')
              .update({
                read: true,
                read_at: new Date().toISOString(),
                delivered: true,
                delivered_at: new Date().toISOString()
              })
              .eq('id', newMessage.id);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedMessage = payload.new as Message;
          setMessages((prev: Message[]) => {
            const updatedMessages = prev.map((msg: Message) =>
              msg.id === updatedMessage.id ? updatedMessage : msg
            );
            return updatedMessages.sort((a: Message, b: Message) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });
        } else if (payload.eventType === 'DELETE') {
          const deletedMessageId = payload.old.id;
          setMessages((prev: Message[]) =>
            prev.map((msg: Message) =>
              msg.id === deletedMessageId
                ? { ...msg, deleted: true, deleted_at: new Date().toISOString() }
                : msg
            )
          );
        }
      })
      .subscribe((status) => {
        console.log('ChatScreen: Subscription status:', status);
      });

    return () => {
      if (chatSubscription.current) {
        console.log('ChatScreen: Cleaning up subscription on unmount');
        chatSubscription.current.unsubscribe();
      }
    };
  }, [chatId, user?.id]); // Only depend on chatId and user.id

  useEffect(() => {
    // Only mount once per unique chat session
    const mountKey = `${adminId}-${chatId}`;

    if (lastMountKey.current === mountKey) {
      console.log('ChatScreen: Same mount key detected, preventing re-initialization');
      return;
    }

    console.log('ChatScreen: New mount key detected, initializing:', mountKey);
    lastMountKey.current = mountKey;

    isMounted.current = true;
    initializedRef.current = false; // Reset initialization state on mount

    return () => {
      console.log('ChatScreen: Component unmounting');
      isMounted.current = false;
      initializedRef.current = false; // Reset initialization state on unmount
    };
  }, [adminId, chatId]); // Only depend on adminId and chatId for mount/unmount

  // Fetch other user's profile (admin or driver depending on current user's role)
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Determine current user's role and the other user's ID
        const { data: currentUserData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user?.id)
          .maybeSingle();

        const currentUserIsAdmin = currentUserData?.role === 'admin';
        const otherUserId = adminId; // This is the other user's ID (driver if admin is viewing, admin if driver is viewing)

        // Set default profile with provided adminName
        if (isMounted) {
          setAdminProfile({
            name: adminName,
            email: '',
            photo_url: undefined
          });
        }

        // Try to get additional info from users table, including profile image
        const { data: userData, error } = await supabase
          .from('users')
          .select('id, email, avatar_url, profile_image')
          .eq('id', otherUserId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching user data:', error);
          return;
        }

        if (userData && isMounted) {
          // Get profile image from avatar_url or profile_image
          const profileImage = userData.avatar_url || userData.profile_image || undefined;
          
          setAdminProfile(prev => ({
            ...prev,
            email: userData.email || '',
            name: prev?.name || adminName,
            photo_url: profileImage,
          }));

          console.log('✅ ChatScreen: Fetched profile for', currentUserIsAdmin ? 'driver' : 'admin', {
            userId: otherUserId,
            name: adminName,
            hasPhoto: !!profileImage,
            photoUrl: profileImage
          });

          // Get online status from user_status table (primary) or users table (fallback)
          const { data: statusData } = await supabase
            .from('user_status')
            .select('is_online, last_seen')
            .eq('user_id', otherUserId)
            .maybeSingle();

          const isOnline = statusData?.is_online ?? false;
          console.log('🔍 ChatScreen: Online status for', otherUserId, {
            statusData,
            userDataOnline: undefined,
            finalIsOnline: isOnline
          });

          setIsOnline(isOnline);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Don't show error toast since we have fallback data
      }
    };

    fetchData();

    // Subscribe to user status changes
    const statusSubscription = supabase
      .channel('user_status_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_status',
        filter: `user_id=eq.${adminId}`
      }, payload => {
        console.log('🔄 ChatScreen: User status changed:', payload);
        if (payload.eventType === 'UPDATE' && isMounted.current) {
          const updatedStatus = payload.new;
          setIsOnline(updatedStatus.is_online);
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      statusSubscription.unsubscribe();
    };
  }, [adminId, adminName]); // Only depend on adminId and adminName

  // Use the unified presence system from ChatContext instead of local presence tracking
  // The ChatContext already handles presence tracking and provides otherUserOnline

  const handleEmojiSelect = ({ emoji }: { emoji: string }) => {
    setText(prev => prev + emoji);
  };

  const handleImagePick = async () => {
    if (!sendMessage) return;
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

        await sendMessage('', publicUrl);
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

    // Set typing status
    if (chatContext?.setTypingStatus) {
      console.log('Setting typing status to true');
      chatContext.setTypingStatus(true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to clear typing status
    typingTimeoutRef.current = setTimeout(() => {
      if (chatContext?.setTypingStatus) {
        console.log('Setting typing status to false');
        chatContext.setTypingStatus(false);
      }
    }, 1000);
  };

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        console.log('Cleaning up typing timeout');
        clearTimeout(typingTimeoutRef.current);
      }
      if (contextLoadingTimeoutRef.current) {
        console.log('Cleaning up context loading timeout');
        clearTimeout(contextLoadingTimeoutRef.current);
      }
    };
  }, []);

  // Add debug logging for typing status changes
  useEffect(() => {
    console.log('Other user typing status changed:', chatContext?.otherUserTyping);
  }, [chatContext?.otherUserTyping]);

  // Add debug logging for online status changes
  useEffect(() => {
    console.log('Other user online status changed:', chatContext?.otherUserOnline);
  }, [chatContext?.otherUserOnline]);

  const handleSend = async () => {
    if (!text.trim() || !sendMessage) return;
    try {
      await sendMessage(text.trim());
      setText('');
    } catch (error) {
      console.error('Error sending message:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send message',
      });
    }
  };

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const showDate = index === 0 ||
      format(new Date(item.created_at), 'MMM d, yyyy') !==
      format(new Date(messages[index - 1].created_at), 'MMM d, yyyy');

    return (
      <MessageItem
        item={item}
        onDelete={handleDelete}
        userId={user?.id}
        showDate={showDate}
      />
    );
  }, [handleDelete, user?.id, messages]);

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: 80,
    offset: 80 * index,
    index,
  }), []);

  const ListEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubble-outline" size={48} color="#4083FF" />
      <Text style={styles.emptyText}>No messages yet</Text>
      <Text style={styles.emptySubText}>Start the conversation by sending a message</Text>
    </View>
  ), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <LinearGradient
          colors={['#4083FF', '#4083FF']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{adminProfile?.name || adminName}</Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, (otherUserOnline !== false ? otherUserOnline : isOnline) && styles.onlineDot]} />
                <Text style={styles.statusText}>
                  {(otherUserOnline !== false ? otherUserOnline : isOnline) ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
            {adminProfile?.photo_url ? (
              <Avatar.Image
                size={40}
                source={{ uri: adminProfile.photo_url }}
                style={styles.avatar}
              />
            ) : (
              <Avatar.Text
                size={40}
                label={(adminProfile?.name || adminName || 'U').charAt(0)}
                style={styles.avatar}
              />
            )}
          </View>
        </LinearGradient>

        {isInitializing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4083FF" />
          </View>
        ) : initError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{initError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={retryInitialization}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            contentContainerStyle={styles.messageList}
            inverted={false}
            ListEmptyComponent={ListEmptyComponent}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
          />
        )}

        {chatContext?.otherUserTyping && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>
              {adminProfile?.name || adminName} is typing...
            </Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <IconButton
            icon="emoticon-outline"
            size={24}
            onPress={() => setShowEmojiPicker(true)}
          />
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            multiline
            maxLength={1000}
          />
          <IconButton
            icon="image-outline"
            size={24}
            onPress={handleImagePick}
            disabled={isUploading}
          />
          <IconButton
            icon="send"
            size={24}
            onPress={handleSend}
            disabled={!text.trim() || isUploading}
          />
        </View>
      </KeyboardAvoidingView>

      <EmojiPicker
        onEmojiSelected={handleEmojiSelect}
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
      />
    </SafeAreaView>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginRight: 6,
  },
  onlineDot: {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
  },
  avatar: {
    marginLeft: 12,
  },
  messageList: {
    flexGrow: 1,
    padding: 16,
  },
  messageWrapper: {
    marginVertical: 4,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  messageContent: {
    flex: 1,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4083FF',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 20,
    marginRight: 24,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  receiptContainer: {
    flexDirection: 'row',
    marginLeft: 4,
  },
  readReceipt: {
    fontSize: 12,
    color: '#fff',
  },
  deliveredReceipt: {
    fontSize: 12,
    color: '#fff',
  },
  deletedText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  ownDeletedText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    marginHorizontal: 8,
    maxHeight: 100,
    fontSize: 16,
    color: '#333',
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#4083FF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptySubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  typingContainer: {
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  typingText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  loadingText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
});