import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export const usePresence = () => {
    const { user } = useAuth();
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
    const lastUpdateTime = useRef<number>(Date.now());
    const retryTimeout = useRef<NodeJS.Timeout | null>(null);
    const isUpdating = useRef<boolean>(false);
    const maxRetries = 3;



    return null;
};