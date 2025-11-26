export interface Message {
    id: string;
    text: string;
    senderId: string;
    senderName?: string;
    timestamp: string;
    read: boolean;
    edited?: boolean;
    deleted?: boolean;
    delivered?: boolean;
    imageUrl?: string;
    localId?: string;
    pending?: boolean;
    error?: boolean;
    readAt?: string;
    editedAt?: string;
    deletedAt?: string;
    deliveredAt?: string;
}

export interface Job {
    id: string;
    title: string;
    description: string;
    location: string;
    date: string;
    rate: string;
    duration: string;
    image_url: string;
    status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
    driver_id?: string;
    admin_id: string;
    driver_name?: string;
    created_at?: string;
    updated_at?: string;
    completed_at?: string;
    invoice_id?: string;
}

export interface UserData {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'driver';
    profileImage?: string;
    phoneNumber?: string;
    address?: string;
    companyInfo?: string;
    bankInfo?: string;
    expoPushToken?: string;
    online?: boolean;
    driverType?: 'individual' | 'company';
}

export type RootStackParamList = {
    Welcome: undefined;
    Login: undefined;
    Register: undefined;
    DriverHome: { filter?: string } | undefined;
    AdminHome: undefined;
    JobDetails: { jobId: string };
    CompleteProfile: undefined;
    Invoice: {
        invoiceId?: string;
        jobId?: string;
    };
    TermsOfService: undefined;
    UploadTerms: undefined;
    DriversList: undefined;
    Chat: {
        driverId: string;
        driverName: string;
        chatId?: string;
        isOnline?: boolean;
    };
    AddJob: undefined;
    Profile: {
        userId: string;
        userName: string;
        isDriver: boolean;
        isOnline: boolean;
        canChat: boolean;
    };
    UserProfile: {
        userId: string;
        userName: string;
        isDriver: boolean;
        isOnline: boolean;
        canChat: boolean;
    };
    Notifications: undefined;
};

export type DriverTabParamList = {
    Jobs: undefined;
    Chat: undefined;
    Profile: undefined;
};

export interface User {
    id: string;
    email: string;
    name?: string;  // ✅ Ensure 'name' exists (optional or required)
}
