import { Timestamp } from 'firebase/firestore';

export interface User {
    id: string;
    email: string;
    role: 'admin' | 'driver';
    name: string;
    fullName?: string;
    phoneNumber?: string;
    address?: {
        street: string;
        city: string;
        state?: string;
        postalCode?: string;
        country?: string;
    };
    profileCompleted?: boolean;
    expoPushToken?: string;
    createdAt?: string;
    updatedAt?: string;
    profileImage?: string;
    skills?: string;
    experience?: string;
    companyInfo?: {
        companyName?: string;
        taxId?: string;
    };
    bankInfo?: {
        accountName?: string;
        accountNumber?: string;
        bankName?: string;
        swiftCode?: string;
    };
}

export type Job = {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    location: string;
    date: string;
    imageUrl?: string;
    status: 'new' | 'processing' | 'completed';
    rate: string;
    duration: string;
    createdAt: any;
    updatedAt: any;
    assignedTo?: string;
    driverName?: string;
};

export type RootStackParamList = {
    Welcome: undefined;
    Login: undefined;
    Register: undefined;
    ResetPassword: {
        email: string;
    };
    AdminHome: undefined;
    DriverHome: undefined;
    JobDetails: { jobId: string };
    Invoice: { invoiceId?: string };
    UploadTerms: undefined;
    TermsOfService: undefined;
    AddJob: undefined;
    DriversList: undefined;
    CompleteProfile: undefined;
    Chat: {
        adminId: string;
        adminName: string;
        chatId?: string;
        isOnline?: boolean;
    };
};

export type DriverTabParamList = {
    DriverHomeTab: undefined;
    InvoiceTab: undefined;
    ProfileTab: undefined;
    SettingsTab: undefined;
    LogoutTab: undefined;
    ChatTab: undefined;
}; 