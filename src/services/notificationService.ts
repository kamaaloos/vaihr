import { supabase } from '../config/supabase';
import { sendPushNotification } from '../utils/notifications';

export interface JobStatusNotification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'job_status';
    data: {
        jobId: string;
        oldStatus: string;
        newStatus: string;
        driverId?: string;
        driverName?: string;
        driverEmail?: string;
    };
    push_token?: string;
    read: boolean;
    created_at: string;
}

export interface JobCreationNotification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'job_creation';
    data: {
        jobId: string;
        jobTitle: string;
        jobLocation: string;
        jobRate: string;
        adminName: string;
        adminEmail: string;
    };
    push_token?: string;
    read: boolean;
    created_at: string;
}

export interface InvoiceCreationNotification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'invoice_creation';
    data: {
        invoiceId: string;
        invoiceNumber: string;
        jobId: string;
        jobTitle: string;
        driverId: string;
        driverName?: string;
        driverEmail?: string;
        amount: number;
    };
    push_token?: string;
    read: boolean;
    created_at: string;
}

export interface InvoicePaymentNotification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'invoice_payment';
    data: {
        invoiceId: string;
        invoiceNumber: string;
        jobId: string;
        jobTitle: string;
        driverId?: string;
        driverName?: string;
        amount: number;
        oldStatus: string;
        newStatus: string;
    };
    push_token?: string;
    read: boolean;
    created_at: string;
}

export type Notification = JobStatusNotification | JobCreationNotification | InvoiceCreationNotification | InvoicePaymentNotification;

export class NotificationService {
    /**
     * Send push notification for any notification type
     */
    static async sendNotification(notification: Notification): Promise<void> {
        try {
            // Get push token from users table if not in notification
            let pushToken = notification.push_token;
            
            if (!pushToken) {
                console.log('No push token in notification, fetching from users table...');
                const { data: userData, error } = await supabase
                    .from('users')
                    .select('expo_push_token')
                    .eq('id', notification.user_id)
                    .single();

                if (error || !userData?.expo_push_token) {
                    console.log('No push token available for user:', notification.user_id, '- will use local notification only');
                    // Still send local notification even without push token
                    pushToken = '';
                } else {
                    pushToken = userData.expo_push_token;
                }
            }

            console.log('Sending notification:', {
                title: notification.title,
                message: notification.message,
                type: notification.type,
                hasToken: !!pushToken,
                tokenPreview: pushToken ? pushToken.substring(0, 20) + '...' : 'none'
            });

            // sendPushNotification will handle Expo Go detection and fallback to local notifications
            await sendPushNotification(
                pushToken || 'dummy-token', // Pass dummy token if none, function will handle it
                notification.title,
                notification.message,
                { sound: 'default' }
            );

            console.log('Notification sent successfully for notification:', notification.id);
        } catch (error) {
            console.error('Error sending notification:', error);
            // Don't throw error to avoid breaking the process
        }
    }

    /**
     * Process all unread notifications and send push notifications
     */
    static async processUnreadNotifications(): Promise<void> {
        try {
            const { data: notifications, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('read', false)
                .not('push_token', 'is', null)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching unread notifications:', error);
                return;
            }

            if (!notifications || notifications.length === 0) {
                console.log('No unread notifications to process');
                return;
            }

            console.log(`Processing ${notifications.length} unread notifications`);

            // Process notifications in parallel
            const notificationPromises = notifications.map(async (notification) => {
                await this.sendNotification(notification as Notification);

                // Mark notification as read after sending
                await supabase
                    .from('notifications')
                    .update({ read: true })
                    .eq('id', notification.id);
            });

            await Promise.all(notificationPromises);
            console.log('All notifications processed successfully');
        } catch (error) {
            console.error('Error processing notifications:', error);
        }
    }

    /**
     * Subscribe to new notifications and send push notifications automatically
     */
    static subscribeToNotifications(): () => void {
        const subscription = supabase
            .channel('all_notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications'
            }, async (payload) => {
                console.log('New notification received:', payload);

                const notification = payload.new as any;
                if (notification && !notification.read) {
                    // Fetch user's push token and send notification
                    const { data: userData, error } = await supabase
                        .from('users')
                        .select('expo_push_token')
                        .eq('id', notification.user_id)
                        .single();

                    if (error || !userData?.expo_push_token) {
                        console.log('No push token available for user:', notification.user_id);
                        return;
                    }

                    // Create notification object with push token
                    const notificationWithToken: Notification = {
                        ...notification,
                        push_token: userData.expo_push_token
                    } as Notification;

                    // Send notification with explicit sound
                    console.log('Sending notification with sound enabled:', {
                        title: notification.title,
                        message: notification.message,
                        type: notification.type,
                        userId: notification.user_id
                    });
                    
                    await this.sendNotification(notificationWithToken);

                    // Mark as read after sending
                    await supabase
                        .from('notifications')
                        .update({ read: true })
                        .eq('id', notification.id);
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }

    /**
     * Subscribe to job-related notifications only
     */
    static subscribeToJobNotifications(): () => void {
        const subscription = supabase
            .channel('job_notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: 'type=in.(job_status,job_creation)'
            }, async (payload) => {
                console.log('New job notification received:', payload);

                const notification = payload.new as any;
                if (notification && !notification.read) {
                    // Fetch user's push token and send notification
                    const { data: userData, error } = await supabase
                        .from('users')
                        .select('expo_push_token')
                        .eq('id', notification.user_id)
                        .single();

                    if (error || !userData?.expo_push_token) {
                        console.log('No push token available for user:', notification.user_id);
                        return;
                    }

                    // Create notification object with push token
                    const notificationWithToken: Notification = {
                        ...notification,
                        push_token: userData.expo_push_token
                    } as Notification;

                    // Send notification with explicit sound
                    console.log('Sending job notification with sound enabled:', {
                        title: notification.title,
                        message: notification.message,
                        type: notification.type,
                        userId: notification.user_id
                    });
                    
                    await this.sendNotification(notificationWithToken);

                    // Mark as read after sending
                    await supabase
                        .from('notifications')
                        .update({ read: true })
                        .eq('id', notification.id);
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }

    /**
     * Subscribe to invoice-related notifications only
     */
    static subscribeToInvoiceNotifications(): () => void {
        const subscription = supabase
            .channel('invoice_notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: 'type=in.(invoice_creation,invoice_payment)'
            }, async (payload) => {
                console.log('New invoice notification received:', payload);

                const notification = payload.new as any;
                if (notification && !notification.read) {
                    // Fetch user's push token and send notification
                    const { data: userData, error } = await supabase
                        .from('users')
                        .select('expo_push_token')
                        .eq('id', notification.user_id)
                        .single();

                    if (error || !userData?.expo_push_token) {
                        console.log('No push token available for user:', notification.user_id);
                        return;
                    }

                    // Create notification object with push token
                    const notificationWithToken: Notification = {
                        ...notification,
                        push_token: userData.expo_push_token
                    } as Notification;

                    await this.sendNotification(notificationWithToken);

                    // Mark as read after sending
                    await supabase
                        .from('notifications')
                        .update({ read: true })
                        .eq('id', notification.id);
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }

    /**
     * Get unread notification count for a user
     */
    static async getUnreadNotificationCount(userId: string): Promise<number> {
        try {
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('read', false);

            if (error) {
                console.error('Error fetching unread notification count:', error);
                return 0;
            }

            return count || 0;
        } catch (error) {
            console.error('Error getting unread notification count:', error);
            return 0;
        }
    }

    /**
     * Get unread notification count by type for a user
     */
    static async getUnreadNotificationCountByType(userId: string, type: string): Promise<number> {
        try {
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('type', type)
                .eq('read', false);

            if (error) {
                console.error('Error fetching unread notification count by type:', error);
                return 0;
            }

            return count || 0;
        } catch (error) {
            console.error('Error getting unread notification count by type:', error);
            return 0;
        }
    }

    /**
     * Mark all notifications as read for a user
     */
    static async markAllNotificationsAsRead(userId: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', userId)
                .eq('read', false);

            if (error) {
                console.error('Error marking notifications as read:', error);
            }
        } catch (error) {
            console.error('Error marking notifications as read:', error);
        }
    }

    /**
     * Delete read notifications for a user
     */
    static async deleteReadNotifications(userId: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', userId)
                .eq('read', true);

            if (error) {
                console.error('Error deleting read notifications:', error);
                throw error;
            }
            
            console.log('Deleted read notifications for user:', userId);
        } catch (error) {
            console.error('Error deleting read notifications:', error);
            throw error;
        }
    }

    /**
     * Mark all notifications as read and delete them
     */
    static async markAllAsReadAndDelete(userId: string): Promise<void> {
        try {
            // First mark all as read
            await this.markAllNotificationsAsRead(userId);
            // Then delete them
            await this.deleteReadNotifications(userId);
        } catch (error) {
            console.error('Error marking as read and deleting:', error);
            throw error;
        }
    }

    /**
     * Mark notifications of a specific type as read for a user
     */
    static async markNotificationsAsReadByType(userId: string, type: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', userId)
                .eq('type', type)
                .eq('read', false);

            if (error) {
                console.error('Error marking notifications as read by type:', error);
            }
        } catch (error) {
            console.error('Error marking notifications as read by type:', error);
        }
    }

    /**
     * Get notifications for a user with optional filtering
     */
    static async getNotifications(
        userId: string,
        options: {
            type?: string;
            limit?: number;
            offset?: number;
            read?: boolean;
        } = {}
    ): Promise<Notification[]> {
        try {
            let query = supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (options.type) {
                query = query.eq('type', options.type);
            }

            if (options.read !== undefined) {
                query = query.eq('read', options.read);
            }

            if (options.limit) {
                query = query.limit(options.limit);
            }

            if (options.offset) {
                query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching notifications:', error);
                return [];
            }

            return (data as Notification[]) || [];
        } catch (error) {
            console.error('Error getting notifications:', error);
            return [];
        }
    }

    /**
     * Delete old notifications (cleanup utility)
     */
    static async deleteOldNotifications(daysOld: number = 30): Promise<void> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const { error } = await supabase
                .from('notifications')
                .delete()
                .lt('created_at', cutoffDate.toISOString())
                .eq('read', true);

            if (error) {
                console.error('Error deleting old notifications:', error);
            } else {
                console.log(`Deleted notifications older than ${daysOld} days`);
            }
        } catch (error) {
            console.error('Error deleting old notifications:', error);
        }
    }
} 