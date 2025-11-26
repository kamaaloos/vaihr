import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import debounce from 'lodash/debounce';
import { getPresenceManager } from '../services/PresenceManager';
import { useUnifiedPresence } from '../hooks/useUnifiedPresence';

// Constants for optimization
const MESSAGES_PER_PAGE = 20;
const TYPING_DEBOUNCE_MS = 1000;
const MESSAGE_CACHE_KEY = 'chat_messages_';
const CHAT_CACHE_KEY = 'chat_data_';
const PRESENCE_TIMEOUT = 30000; // 30 seconds

interface Chat {
  id: string;
  driver_id: string;
  admin_id: string;
  last_message: string | null;
  last_message_time: string | null;
  created_at: string;
  updated_at: string;
  // Virtual field - not stored in database
  participants?: string[];
}

export interface Message {
  id: string;
  text: string;
  image_url?: string;
  sender_id: string;
  created_at: string;
  updated_at: string;
  read: boolean;
  delivered: boolean;
  deleted?: boolean;
  deleted_at?: string;
}

interface PresenceData {
  user_id: string;
  isTyping: boolean;
  last_seen: string;
  online: boolean;
  role?: string;
  presence_ref?: string;
  online_at?: string;
}

type PresenceState = {
  [key: string]: PresenceData[];
};

// Helper function to get presence data for a user
const getPresenceByUserId = (presenceState: PresenceState, userId: string): PresenceData | undefined => {
  // Flatten all presence entries into a single array
  const allPresenceEntries = Object.values(presenceState).flat();

  // Find the first matching presence entry
  const presence = allPresenceEntries.find(p => p.user_id === userId);

  // Only log if we're debugging or if there's an issue
  if (process.env.NODE_ENV === 'development' && !presence) {
    console.log('getPresenceByUserId: User not found in presence', {
      userId,
      availableUsers: allPresenceEntries.map(p => p.user_id),
      presenceStateKeys: Object.keys(presenceState)
    });
  }

  return presence;
};

interface ChatContextType {
  currentChat: Chat | null;
  messages: Message[];
  loading: boolean;
  error: string | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  sendMessage: (text: string, imageUrl?: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  setTypingStatus: (isTyping: boolean) => void;
  otherUserTyping: boolean;
  otherUserOnline: boolean;
  createOrGetChat: (adminId: string) => Promise<{ data: Chat | null; error: string | null }>;
  loadMoreMessages: () => Promise<void>;
  hasMoreMessages: boolean;
  markMessagesAsRead: (chatId: string) => Promise<void>;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  setCurrentChat: React.Dispatch<React.SetStateAction<Chat | null>>;
}

export const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  const lastMessageRef = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageCache = useRef<Record<string, Message[]>>({});
  const chatSubscription = useRef<any>(null);

  // Use unified presence system
  const {
    isOnline,
    isTyping: checkTyping,
    updateTypingStatus,
    joinChatPresence,
    leaveChatPresence
  } = useUnifiedPresence(currentChat?.id);

  // Update other user's online and typing status - memoized to prevent unnecessary re-renders
  const otherUserStatus = useMemo(() => {
    if (!currentChat?.id || !user) {
      return { online: false, typing: false };
    }

    const otherUserId = currentChat.driver_id === user.id ? currentChat.admin_id : currentChat.driver_id;

    const presenceOnline = isOnline(otherUserId);
    const typing = checkTyping(otherUserId, currentChat.id);

    // Use presence status if available, otherwise don't override existing status
    // The ChatScreen should handle database status fallback
    const online = presenceOnline !== null ? presenceOnline : false;

    return { online, typing };
  }, [currentChat?.id, user, isOnline, checkTyping]);

  // Update state only when status actually changes
  useEffect(() => {
    setOtherUserOnline(otherUserStatus.online);
    setOtherUserTyping(otherUserStatus.typing);
  }, [otherUserStatus.online, otherUserStatus.typing]);

  // Join/leave chat presence when chat changes
  useEffect(() => {
    if (!currentChat?.id || !user) return;

    console.log('ChatContext: Joining chat presence:', currentChat.id);
    joinChatPresence(currentChat.id);

    return () => {
      console.log('ChatContext: Leaving chat presence:', currentChat.id);
      leaveChatPresence(currentChat.id);
    };
  }, [currentChat?.id, user, joinChatPresence, leaveChatPresence]);

  // Debounced typing status update
  const debouncedSetTypingStatus = useCallback(
    debounce(async (isTyping: boolean) => {
      if (!user || !currentChat?.id) return;

      try {
        console.log('ChatContext: Updating typing status:', {
          chatId: currentChat.id,
          isTyping,
          userId: user.id,
          userRole: user.user_metadata?.role
        });
        await updateTypingStatus(currentChat.id, isTyping);
        console.log('ChatContext: Typing status updated successfully');
      } catch (error) {
        console.error('ChatContext: Error updating typing status:', error);
      }
    }, TYPING_DEBOUNCE_MS),
    [user, currentChat?.id, updateTypingStatus]
  );

  // Set up real-time subscription for messages
  useEffect(() => {
    if (!currentChat?.id || !user) {
      console.log('ChatContext: No chat or user, skipping subscription', {
        hasChat: !!currentChat?.id,
        hasUser: !!user,
        chatId: currentChat?.id,
        userId: user?.id
      });
      return;
    }

    console.log('ChatContext: Setting up real-time subscription for chat:', {
      chatId: currentChat.id,
      userId: user.id,
      userRole: user.user_metadata?.role
    });

    // Unsubscribe from previous subscription
    if (chatSubscription.current) {
      console.log('ChatContext: Unsubscribing from previous subscription');
      chatSubscription.current.unsubscribe();
    }

    // Set up new subscription
    const channelName = `chat:${currentChat.id}`;
    console.log('ChatContext: Creating channel:', channelName);

    chatSubscription.current = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${currentChat.id}`
      }, async (payload) => {
        console.log('ChatContext: Received message change:', {
          eventType: payload.eventType,
          messageId: payload.new?.id,
          senderId: payload.new?.sender_id,
          currentUserId: user.id,
          chatId: currentChat.id,
          messageText: payload.new?.text,
          channelName: channelName
        });

        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new as Message;

          // Don't add our own messages (they're already added optimistically)
          if (newMessage.sender_id === user.id) {
            console.log('ChatContext: Ignoring own message from user:', user.id);
            return;
          }

          console.log('ChatContext: Adding new message from other user:', {
            messageId: newMessage.id,
            senderId: newMessage.sender_id,
            text: newMessage.text,
            currentUserId: user.id
          });

          setMessages(prev => {
            // Check if message already exists
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) {
              console.log('ChatContext: Message already exists, skipping');
              return prev;
            }

            const updatedMessages = [newMessage, ...prev];
            // Sort messages by created_at in descending order
            return updatedMessages.sort((a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });

          // Mark message as read if it's from the other user
          try {
            await supabase
              .from('messages')
              .update({ read: true, read_at: new Date().toISOString() })
              .eq('id', newMessage.id);
            console.log('ChatContext: Marked message as read');
          } catch (error) {
            console.error('ChatContext: Error marking message as read:', error);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedMessage = payload.new as Message;
          console.log('ChatContext: Updating message in state');
          setMessages(prev =>
            prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
          );
        } else if (payload.eventType === 'DELETE') {
          const deletedMessage = payload.old as Message;
          console.log('ChatContext: Removing deleted message from state');
          setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id));
        }
      })
      .subscribe((status) => {
        console.log('ChatContext: Subscription status:', {
          status,
          chatId: currentChat.id,
          userId: user.id,
          channelName: channelName
        });
        if (status === 'SUBSCRIBED') {
          console.log('ChatContext: Successfully subscribed to chat messages for chat:', currentChat.id);

          // Test the subscription by sending a test message
          console.log('ChatContext: Testing subscription with a simple database query...');
          supabase
            .from('messages')
            .select('id, text, sender_id, created_at')
            .eq('chat_id', currentChat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .then(({ data, error }) => {
              if (error) {
                console.error('ChatContext: Test query failed:', error);
              } else {
                console.log('ChatContext: Test query successful, found messages:', data?.length || 0);
              }
            });
        } else if (status === 'CHANNEL_ERROR') {
          console.error('ChatContext: Channel error in subscription');
        }
      });

    return () => {
      if (chatSubscription.current) {
        console.log('ChatContext: Cleaning up subscription for chat:', currentChat.id);
        chatSubscription.current.unsubscribe();
      }
    };
  }, [currentChat?.id, user]);

  // Load messages for a chat
  const loadMessages = async (chatId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          text,
          sender_id,
          created_at,
          updated_at,
          deleted_at,
          read,
          delivered,
          image_url,
          chat_id
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_PAGE);

      if (error) throw error;

      // Mark messages as read
      const unreadMessages = data.filter(msg => !msg.read && msg.sender_id !== user?.id);
      if (unreadMessages.length > 0) {
        await markMessagesAsRead(chatId);
      }

      // Sort messages by created_at in descending order (newest first)
      const sortedMessages = data.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setMessages(sortedMessages);
      setHasMoreMessages(data.length === MESSAGES_PER_PAGE);
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async (text: string, imageUrl?: string) => {
    if (!user || !currentChat?.id) {
      console.error('sendMessage: Missing user or currentChat', { user: !!user, chatId: currentChat?.id });
      return;
    }

    try {
      console.log('sendMessage: Sending message', { text, chatId: currentChat.id, userId: user.id });

      const message = {
        chat_id: currentChat.id,
        text,
        image_url: imageUrl,
        sender_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        read: false,
        delivered: false
      };

      console.log('sendMessage: Inserting message into database');
      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert(message)
        .select()
        .single();

      if (error) {
        console.error('sendMessage: Error inserting message:', error);
        throw error;
      }

      console.log('sendMessage: Message inserted successfully:', newMessage.id);

      // Update last message in chat
      console.log('sendMessage: Updating chat last message');

      // Try to update with last_message_time first, fallback to just last_message if column doesn't exist
      let updateData: any = {
        last_message: text,
        updated_at: new Date().toISOString()
      };

      // Try to include last_message_time, but don't fail if column doesn't exist
      try {
        const { error: updateError } = await supabase
          .from('chats')
          .update({
            ...updateData,
            last_message_time: new Date().toISOString()
          })
          .eq('id', currentChat.id);

        if (updateError) {
          // If last_message_time column doesn't exist, try without it
          if (updateError.code === 'PGRST204' && updateError.message?.includes('last_message_time')) {
            console.log('sendMessage: last_message_time column not found, updating without it');
            const { error: fallbackError } = await supabase
              .from('chats')
              .update(updateData)
              .eq('id', currentChat.id);

            if (fallbackError) {
              console.error('sendMessage: Error updating chat (fallback):', fallbackError);
            }
          } else {
            console.error('sendMessage: Error updating chat:', updateError);
          }
        }
      } catch (error) {
        console.error('sendMessage: Error updating chat:', error);
        // Don't throw here, message was sent successfully
      }

      // Optimistically update local state
      if (newMessage) {
        console.log('sendMessage: Updating local messages state');
        setMessages(prev => {
          const updatedMessages = [newMessage, ...prev];
          // Sort messages by created_at in descending order
          return updatedMessages.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      }

      console.log('sendMessage: Message sent successfully');
    } catch (error) {
      console.error('sendMessage: Error sending message:', error);
      throw error;
    }
  };

  // Delete message
  const deleteMessage = async (messageId: string) => {
    if (!user || !currentChat) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({
          deleted: true,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  };

  // Mark messages as read
  const markMessagesAsRead = async (chatId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({
          read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('chat_id', chatId)
        .eq('sender_id', user.id)
        .eq('read', false);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Load more messages
  const loadMoreMessages = async () => {
    if (!currentChat || !user || loading || !hasMoreMessages) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', currentChat.id)
        .order('created_at', { ascending: false })
        .range(messages.length, messages.length + MESSAGES_PER_PAGE - 1);

      if (error) throw error;

      if (data) {
        const newMessages = data.reverse();
        setMessages(prev => {
          const updatedMessages = [...prev, ...newMessages];
          // Sort messages by created_at in descending order
          return updatedMessages.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
        setHasMoreMessages(data.length === MESSAGES_PER_PAGE);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
      setError('Failed to load more messages');
    } finally {
      setLoading(false);
    }
  };

  // Set typing status
  const setTypingStatus = useCallback((isTyping: boolean) => {
    debouncedSetTypingStatus(isTyping);
  }, [debouncedSetTypingStatus]);

  // Create or get chat
  const createOrGetChat = async (adminId: string) => {
    if (!user) {
      console.error('createOrGetChat: No user found');
      return { data: null, error: 'Not authenticated' };
    }

    try {
      setLoading(true);
      setError(null);

      console.log('createOrGetChat: Starting with adminId:', adminId, 'userId:', user.id, 'userRole:', user.user_metadata?.role);

      // Determine the correct driver_id and admin_id based on user roles
      let driverId: string;
      let actualAdminId: string;

      if (user.user_metadata?.role === 'admin') {
        // If current user is admin, they're initiating chat with a driver
        driverId = adminId; // The adminId parameter is actually the driver's ID
        actualAdminId = user.id;
        console.log('createOrGetChat: Admin initiating chat with driver:', { driverId, actualAdminId });
      } else {
        // If current user is driver, they're initiating chat with an admin
        driverId = user.id;
        actualAdminId = adminId;
        console.log('createOrGetChat: Driver initiating chat with admin:', { driverId, actualAdminId });
      }

      // First check if chat exists
      const { data: existingChat, error: selectError } = await supabase
        .from('chats')
        .select('*')
        .eq('driver_id', driverId)
        .eq('admin_id', actualAdminId)
        .maybeSingle();

      if (selectError) {
        console.error('createOrGetChat: Error checking existing chat:', selectError);
        throw selectError;
      }

      if (existingChat) {
        console.log('createOrGetChat: Found existing chat:', {
          chatId: existingChat.id,
          driverId: existingChat.driver_id,
          adminId: existingChat.admin_id,
          currentUserId: user.id,
          userRole: user.user_metadata?.role
        });
        const chat = {
          ...existingChat,
          participants: [existingChat.admin_id, existingChat.driver_id]
        };
        setCurrentChat(chat);
        await loadMessages(existingChat.id);
        return { data: existingChat, error: null };
      }

      // If no existing chat, create new one
      console.log('createOrGetChat: Creating new chat with:', {
        driverId,
        actualAdminId,
        currentUserId: user.id,
        userRole: user.user_metadata?.role
      });
      const { data: newChat, error: insertError } = await supabase
        .from('chats')
        .insert({
          driver_id: driverId,
          admin_id: actualAdminId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('createOrGetChat: Error creating chat:', insertError);

        // If we get a unique violation, try to fetch the chat again
        if (insertError.code === '23505') {
          console.log('createOrGetChat: Unique violation, fetching existing chat');
          const { data: fetchedChat, error: fetchError } = await supabase
            .from('chats')
            .select('*')
            .eq('driver_id', driverId)
            .eq('admin_id', actualAdminId)
            .single();

          if (fetchError) {
            console.error('createOrGetChat: Error fetching after unique violation:', fetchError);
            throw fetchError;
          }

          if (fetchedChat) {
            console.log('createOrGetChat: Found chat after unique violation:', {
              chatId: fetchedChat.id,
              driverId: fetchedChat.driver_id,
              adminId: fetchedChat.admin_id,
              currentUserId: user.id,
              userRole: user.user_metadata?.role
            });
            const chat = {
              ...fetchedChat,
              participants: [fetchedChat.admin_id, fetchedChat.driver_id]
            };
            setCurrentChat(chat);
            await loadMessages(fetchedChat.id);
            return { data: fetchedChat, error: null };
          }
        }

        // If it's not a unique violation, check if it's a constraint error
        if (insertError.message?.includes('constraint')) {
          console.error('createOrGetChat: Constraint error - may need to fix database schema');
          throw new Error('Database constraint error. Please contact support.');
        }

        throw insertError;
      }

      if (!newChat) {
        throw new Error('Failed to create chat - no data returned');
      }

      console.log('createOrGetChat: Successfully created new chat:', {
        chatId: newChat.id,
        driverId: newChat.driver_id,
        adminId: newChat.admin_id,
        currentUserId: user.id,
        userRole: user.user_metadata?.role
      });
      const chat = {
        ...newChat,
        participants: [newChat.admin_id, newChat.driver_id]
      };
      setCurrentChat(chat);
      return { data: newChat, error: null };
    } catch (error) {
      console.error('createOrGetChat: Error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({
    currentChat,
    messages,
    loading,
    error,
    setMessages,
    sendMessage,
    deleteMessage,
    setTypingStatus,
    otherUserTyping: otherUserTyping,
    otherUserOnline: otherUserOnline,
    createOrGetChat,
    loadMoreMessages,
    hasMoreMessages,
    markMessagesAsRead,
    isTyping,
    setIsTyping,
    setCurrentChat
  }), [
    currentChat,
    messages,
    loading,
    error,
    setMessages,
    sendMessage,
    deleteMessage,
    setTypingStatus,
    otherUserTyping,
    otherUserOnline,
    createOrGetChat,
    loadMoreMessages,
    hasMoreMessages,
    markMessagesAsRead,
    isTyping,
    setIsTyping,
    setCurrentChat
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}; 