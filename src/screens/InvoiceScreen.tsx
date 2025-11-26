import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, Card, Button as PaperButton, Chip, ActivityIndicator, Portal, Modal, Searchbar } from 'react-native-paper';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import Toast from 'react-native-toast-message';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Copyright from '../components/Copyright';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { sendPushNotification } from '../utils/notifications';
import { useTheme } from '../contexts/ThemeContext';
import { getGradientColors, getSurfaceColors } from '../utils/gradientColors';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Invoice'>;
  route: {
    params: {
      invoiceId?: string; // Optional - if not provided, show list of invoices
    };
  };
};

interface Invoice {
  id: string;
  invoiceNumber: string;
  jobId: string;
  jobTitle: string;
  date: string;
  driverId: string;
  driverName: string;
  driverDetails: {
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    companyInfo?: {
      companyName?: string;
      taxId?: string;
    };
    bankInfo?: {
      accountName?: string;
      bankName?: string;
      accountNumber?: string;
      swiftCode?: string;
    };
    pushToken?: string;
  };
  jobDetails: {
    location: string;
    date: string;
    duration: string;
    rate: string;
  };
  amount: number;
  status: 'pending' | 'paid';
  createdAt: any;
  updatedAt: any;
}

export default function InvoiceScreen({ route, navigation }: Props) {
  const { user, userData } = useAuth();
  const { isDarkMode } = useTheme();
  const gradientColors = getGradientColors(isDarkMode);
  const surfaceColors = getSurfaceColors(isDarkMode);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchInvoices();
    const subscription = subscribeToInvoiceUpdates();
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const filtered = invoices.filter(invoice => {
      // Search filter
      const matchesSearch = 
        invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
    setFilteredInvoices(filtered);
  }, [searchQuery, statusFilter, invoices]);

  const subscribeToInvoiceUpdates = () => {
    const channelName = `invoices-${user?.id}-${userData?.role || 'unknown'}`;
    const filter = userData?.role === 'admin'
      ? undefined
      : `driver_id=eq.${user?.id}`;
    
    console.log('InvoiceScreen: Setting up real-time subscription:', {
      channelName,
      filter,
      userRole: userData?.role,
      userId: user?.id
    });
    
    return supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'invoices',
        filter: filter
      }, async (payload) => {
        console.log('InvoiceScreen: Real-time event received:', {
          eventType: payload.eventType,
          invoiceId: payload.new?.id || payload.old?.id,
          status: payload.new?.status || payload.old?.status,
          userRole: userData?.role
        });
        if (payload.eventType === 'INSERT') {
          const newInvoice = await fetchInvoiceWithDetails(payload.new.id);
          if (newInvoice) {
            setInvoices(current => {
              // Check if invoice already exists (prevent duplicates)
              const exists = current.some(inv => inv.id === newInvoice.id);
              if (exists) {
                console.warn('INSERT event for invoice that already exists, updating instead:', newInvoice.id);
                // Update existing invoice instead of adding duplicate
                return current.map(inv =>
                  inv.id === newInvoice.id ? newInvoice : inv
                );
              }
              // Add new invoice
              return [newInvoice, ...current];
            });
          }
        } else if (payload.eventType === 'UPDATE') {
          console.log('InvoiceScreen: UPDATE event received:', {
            invoiceId: payload.new.id,
            oldStatus: payload.old?.status,
            newStatus: payload.new.status,
            userRole: userData?.role,
            userId: user?.id
          });
          
          const updatedInvoice = await fetchInvoiceWithDetails(payload.new.id);
          if (updatedInvoice) {
            console.log('InvoiceScreen: Fetched updated invoice:', {
              id: updatedInvoice.id,
              status: updatedInvoice.status,
              invoiceNumber: updatedInvoice.invoiceNumber
            });
            
            setInvoices(current => {
              // Check if invoice already exists in the list
              const existingIndex = current.findIndex(inv => inv.id === updatedInvoice.id);
              if (existingIndex >= 0) {
                // Update existing invoice (replace it, don't add duplicate)
                const updated = current.map(inv =>
                  inv.id === updatedInvoice.id ? updatedInvoice : inv
                );
                console.log('InvoiceScreen: Updated invoice in list, new status:', updatedInvoice.status);
                return updated;
              } else {
                // Invoice doesn't exist yet, add it (shouldn't happen for UPDATE, but handle it)
                console.warn('UPDATE event for invoice not in list, adding it:', updatedInvoice.id);
                return [updatedInvoice, ...current];
              }
            });
            if (selectedInvoice?.id === updatedInvoice.id) {
              console.log('InvoiceScreen: Updating selected invoice status to:', updatedInvoice.status);
              setSelectedInvoice(updatedInvoice);
            }
          } else {
            console.warn('InvoiceScreen: Failed to fetch updated invoice details for:', payload.new.id);
          }
        } else if (payload.eventType === 'DELETE') {
          setInvoices(current =>
            current.filter(inv => inv.id !== payload.old.id)
          );
          if (selectedInvoice?.id === payload.old.id) {
            setShowModal(false);
          }
        }
      })
      .subscribe((status) => {
        console.log('InvoiceScreen: Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('InvoiceScreen: Successfully subscribed to invoice updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('InvoiceScreen: Channel subscription error');
        }
      });
  };

  const fetchInvoiceWithDetails = async (invoiceId: string) => {
    console.log('InvoiceScreen: Fetching invoice details for:', invoiceId, 'user:', user?.id, 'role:', userData?.role);
    
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        job:job_id(
          title,
          location,
          date,
          duration,
          rate,
          admin:admin_id(
            expo_push_token
          )
        ),
        driver:driver_id(
          name,
          email,
          phone_number,
          address,
          company_info,
          bank_info
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (error) {
      console.error('InvoiceScreen: Error fetching invoice details:', {
        error,
        invoiceId,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return null;
    }

    console.log('InvoiceScreen: Fetched invoice data:', {
      id: data.id,
      status: data.status,
      invoiceNumber: data.invoice_number,
      driverId: data.driver_id
    });

    return formatInvoiceData(data);
  };

  const formatInvoiceData = (data: any) => {
    // Helper function to map address
    const mapAddress = (addr: any) => {
      if (!addr) return null;
      
      // If address is a string, try to parse it
      if (typeof addr === 'string') {
        try {
          addr = JSON.parse(addr);
        } catch (e) {
          console.warn('Failed to parse address string:', e);
          return null;
        }
      }
      
      // Map address object (handle both snake_case and camelCase)
      return {
        street: addr.street || addr.street_address || null,
        city: addr.city || null,
        state: addr.state || null,
        postalCode: addr.postal_code || addr.postalCode || addr.zip || null,
        country: addr.country || null,
      };
    };

    // Helper function to map bank_info
    const mapBankInfo = (bankInfo: any) => {
      if (!bankInfo) return null;
      
      // If bank_info is a string, try to parse it
      if (typeof bankInfo === 'string') {
        try {
          bankInfo = JSON.parse(bankInfo);
        } catch (e) {
          console.warn('Failed to parse bank_info string:', e);
          return null;
        }
      }
      
      // Map bank_info object (handle both snake_case and camelCase)
      return {
        accountName: bankInfo.account_name || bankInfo.accountName || null,
        accountNumber: bankInfo.account_number || bankInfo.accountNumber || null,
        bankName: bankInfo.bank_name || bankInfo.bankName || null,
        swiftCode: bankInfo.swift_code || bankInfo.swiftCode || null,
      };
    };

    // Helper function to map company_info
    const mapCompanyInfo = (companyInfo: any) => {
      if (!companyInfo) return null;
      
      // If company_info is a string, try to parse it
      if (typeof companyInfo === 'string') {
        try {
          companyInfo = JSON.parse(companyInfo);
        } catch (e) {
          console.warn('Failed to parse company_info string:', e);
          return null;
        }
      }
      
      // Map company_info object (handle both snake_case and camelCase)
      return {
        companyName: companyInfo.company_name || companyInfo.companyName || null,
        taxId: companyInfo.tax_id || companyInfo.taxId || null,
        carPlateNumber: companyInfo.car_plate_number || companyInfo.carPlateNumber || null,
      };
    };

    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      jobId: data.job_id,
      jobTitle: data.job.title,
      date: data.date,
      driverId: data.driver_id,
      driverName: data.driver?.name,
      driverDetails: {
        email: data.driver?.email,
        phone: data.driver?.phone_number,
        address: mapAddress(data.driver?.address),
        companyInfo: mapCompanyInfo(data.driver?.company_info),
        bankInfo: mapBankInfo(data.driver?.bank_info),
        pushToken: data.driver?.expo_push_token
      },
      jobDetails: {
        location: data.job.location,
        date: data.job.date,
        duration: data.job.duration,
        rate: data.job.rate
      },
      amount: data.amount,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      adminPushToken: data.job.admin?.expo_push_token
    };
  };

  const fetchInvoices = async () => {
    try {
      if (!user) return;

      console.log('Fetching invoices for user:', user.id, 'role:', userData?.role);

      // First, let's check if we can access the invoices table with a simple count
      const { count, error: countError } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('Error getting invoice count:', countError);
      } else {
        console.log('Total number of invoices in database:', count);
      }

      // For admin, we want to see all invoices
      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          job_id,
          driver_id,
          amount,
          status,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      // Only filter by driver_id for non-admin users
      if (userData?.role !== 'admin') {
        console.log('Driver access - filtering by driver_id:', user.id);
        query = query.eq('driver_id', user.id);
      } else {
        console.log('Admin access - fetching all invoices');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching invoices:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('Raw invoice data:', data);

      if (!data || data.length === 0) {
        console.log('No invoices found');
        setInvoices([]);
        setLoading(false);
        return;
      }

      // Transform the data to match the Invoice interface
      const formattedInvoices = await Promise.all(data.map(async (invoice) => {
        console.log('Processing invoice:', invoice.id);

        // Fetch job details
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select('title, location, date, duration, rate')
          .eq('id', invoice.job_id)
          .single();

        if (jobError) {
          console.error('Error fetching job details for invoice:', invoice.id, jobError);
        }

        // Fetch driver details
        const { data: driverData, error: driverError } = await supabase
          .from('users')
          .select('name, email, phone_number, address, company_info, bank_info, expo_push_token')
          .eq('id', invoice.driver_id)
          .single();

        if (driverError) {
          console.error('Error fetching driver details for invoice:', invoice.id, driverError);
        }

        console.log('Job data for invoice', invoice.id, ':', jobData);
        console.log('Driver data for invoice', invoice.id, ':', driverData);

        // Helper function to map address
        const mapAddress = (addr: any) => {
          if (!addr) return null;
          
          // If address is a string, try to parse it
          if (typeof addr === 'string') {
            try {
              addr = JSON.parse(addr);
            } catch (e) {
              console.warn('Failed to parse address string:', e);
              return null;
            }
          }
          
          // Map address object (handle both snake_case and camelCase)
          return {
            street: addr.street || addr.street_address || null,
            city: addr.city || null,
            state: addr.state || null,
            postalCode: addr.postal_code || addr.postalCode || addr.zip || null,
            country: addr.country || null,
          };
        };

        // Helper function to map bank_info
        const mapBankInfo = (bankInfo: any) => {
          if (!bankInfo) return null;
          
          // If bank_info is a string, try to parse it
          if (typeof bankInfo === 'string') {
            try {
              bankInfo = JSON.parse(bankInfo);
            } catch (e) {
              console.warn('Failed to parse bank_info string:', e);
              return null;
            }
          }
          
          // Map bank_info object (handle both snake_case and camelCase)
          return {
            accountName: bankInfo.account_name || bankInfo.accountName || null,
            accountNumber: bankInfo.account_number || bankInfo.accountNumber || null,
            bankName: bankInfo.bank_name || bankInfo.bankName || null,
            swiftCode: bankInfo.swift_code || bankInfo.swiftCode || null,
          };
        };

        // Helper function to map company_info
        const mapCompanyInfo = (companyInfo: any) => {
          if (!companyInfo) return null;
          
          // If company_info is a string, try to parse it
          if (typeof companyInfo === 'string') {
            try {
              companyInfo = JSON.parse(companyInfo);
            } catch (e) {
              console.warn('Failed to parse company_info string:', e);
              return null;
            }
          }
          
          // Map company_info object (handle both snake_case and camelCase)
          return {
            companyName: companyInfo.company_name || companyInfo.companyName || null,
            taxId: companyInfo.tax_id || companyInfo.taxId || null,
            carPlateNumber: companyInfo.car_plate_number || companyInfo.carPlateNumber || null,
          };
        };

        return {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          jobId: invoice.job_id,
          jobTitle: jobData?.title || '',
          date: jobData?.date || '', // Use job date instead of invoice date
          driverId: invoice.driver_id,
          driverName: driverData?.name || '',
          driverDetails: {
            email: driverData?.email || '',
            phone: driverData?.phone_number || '',
            address: mapAddress(driverData?.address),
            companyInfo: mapCompanyInfo(driverData?.company_info),
            bankInfo: mapBankInfo(driverData?.bank_info),
            pushToken: driverData?.expo_push_token
          },
          jobDetails: {
            location: jobData?.location || '',
            date: jobData?.date || '',
            duration: jobData?.duration || '',
            rate: jobData?.rate || ''
          },
          amount: invoice.amount,
          status: invoice.status,
          createdAt: invoice.created_at,
          updatedAt: invoice.updated_at
        };
      }));

      console.log('Formatted invoices:', formattedInvoices);
      setInvoices(formattedInvoices);

      // If invoiceId is provided in route params, select that invoice
      if (route.params?.invoiceId) {
        const invoice = formattedInvoices.find(inv => inv.id === route.params.invoiceId);
        if (invoice) {
          setSelectedInvoice(invoice);
          setShowModal(true);
        }
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load invoices',
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async (invoice: Invoice) => {
    setPdfLoading(true);
    try {
      // Get the latest driver details from Supabase
      const { data: driverDataRaw, error: driverError } = await supabase
        .from('users')
        .select(`
          name,
          email,
          phone_number,
          address,
          company_info,
          bank_info,
          expo_push_token
        `)
        .eq('id', invoice.driverId)
        .single();

      if (driverError) throw driverError;

      // Map the data using the same helper functions
      const mapAddress = (addr: any) => {
        if (!addr) return null;
        if (typeof addr === 'string') {
          try {
            addr = JSON.parse(addr);
          } catch (e) {
            return null;
          }
        }
        return {
          street: addr.street || addr.street_address || null,
          city: addr.city || null,
          state: addr.state || null,
          postalCode: addr.postal_code || addr.postalCode || addr.zip || null,
          country: addr.country || null,
        };
      };

      const mapBankInfo = (bankInfo: any) => {
        if (!bankInfo) return null;
        if (typeof bankInfo === 'string') {
          try {
            bankInfo = JSON.parse(bankInfo);
          } catch (e) {
            return null;
          }
        }
        return {
          accountName: bankInfo.account_name || bankInfo.accountName || null,
          accountNumber: bankInfo.account_number || bankInfo.accountNumber || null,
          bankName: bankInfo.bank_name || bankInfo.bankName || null,
          swiftCode: bankInfo.swift_code || bankInfo.swiftCode || null,
        };
      };

      const mapCompanyInfo = (companyInfo: any) => {
        if (!companyInfo) return null;
        if (typeof companyInfo === 'string') {
          try {
            companyInfo = JSON.parse(companyInfo);
          } catch (e) {
            return null;
          }
        }
        return {
          companyName: companyInfo.company_name || companyInfo.companyName || null,
          taxId: companyInfo.tax_id || companyInfo.taxId || null,
          carPlateNumber: companyInfo.car_plate_number || companyInfo.carPlateNumber || null,
        };
      };

      const driverData = {
        ...driverDataRaw,
        address: mapAddress(driverDataRaw?.address),
        bank_info: mapBankInfo(driverDataRaw?.bank_info),
        company_info: mapCompanyInfo(driverDataRaw?.company_info),
      };

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .invoice-details { margin-bottom: 30px; }
              .section { margin-bottom: 20px; }
              .table { width: 100%; border-collapse: collapse; }
              .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              .total { font-weight: bold; margin-top: 20px; text-align: right; }
              .bank-details { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px; }
              .company-info { margin-top: 20px; }
              .status { text-align: center; padding: 10px; margin-top: 20px; border-radius: 5px; }
              .status.paid { background-color: #E8F5E9; color: #2E7D32; }
              .status.pending { background-color: #FFF3E0; color: #F57C00; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>INVOICE</h1>
              <h2>${invoice.invoiceNumber}</h2>
              <p>Date: ${new Date(invoice.date).toLocaleDateString()}</p>
            </div>
            
            <div class="section">
              <h3>From:</h3>
              <p>${driverData.name}</p>
              ${driverData.address ? `
                ${driverData.address.street ? `<p>${driverData.address.street}</p>` : ''}
                ${driverData.address.city || driverData.address.state || driverData.address.postalCode ? `
                  <p>${[driverData.address.city, driverData.address.state, driverData.address.postalCode].filter(Boolean).join(', ')}</p>
                ` : ''}
                ${driverData.address.country ? `<p>${driverData.address.country}</p>` : ''}
              ` : ''}
              ${driverData.company_info?.taxId ? `
                <div class="company-info">
                  <p>Tax ID: ${driverData.company_info.taxId}</p>
                </div>
              ` : ''}
            </div>

            <div class="section">
              <h3>Job Details:</h3>
              <table class="table">
                <tr>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
                <tr>
                  <td>${invoice.jobTitle || ''}</td>
                  <td>${invoice.jobDetails?.location || ''}</td>
                  <td>${invoice.jobDetails?.date ? new Date(invoice.jobDetails.date).toLocaleDateString() : ''}</td>
                  <td>${invoice.jobDetails?.duration || ''}</td>
                  <td>€${invoice.jobDetails?.rate || '0'}/h</td>
                  <td>€${invoice.amount?.toFixed(2) || '0.00'}</td>
                </tr>
              </table>
            </div>

            <div class="total">
              <h3>Total Amount: €${invoice.amount?.toFixed(2) || '0.00'}</h3>
            </div>

            <div class="bank-details">
              <h3>Payment Information:</h3>
              ${driverData.bank_info && (driverData.bank_info.accountName || driverData.bank_info.bankName) ? `
                ${driverData.bank_info.accountName ? `<p>Account Name: ${driverData.bank_info.accountName}</p>` : ''}
                ${driverData.bank_info.bankName ? `<p>Bank Name: ${driverData.bank_info.bankName}</p>` : ''}
                ${driverData.bank_info.accountNumber ? `<p>Account Number: ${driverData.bank_info.accountNumber}</p>` : ''}
                ${driverData.bank_info.swiftCode ? `<p>SWIFT/BIC: ${driverData.bank_info.swiftCode}</p>` : ''}
              ` : '<p>Bank information not provided</p>'}
            </div>

            <div class="status ${invoice.status || 'pending'}">
              <h3>Status: ${(invoice.status || 'pending').toUpperCase()}</h3>
            </div>

            <div style="margin-top: 40px; font-size: 12px; color: #666; text-align: center;">
              <p>Generated on: ${new Date().toLocaleString()}</p>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(uri);
      } else {
        const pdfName = `${invoice.invoiceNumber}.pdf`;
        const pdfDir = FileSystem.documentDirectory + 'invoices/';
        const pdfUri = pdfDir + pdfName;

        await FileSystem.makeDirectoryAsync(pdfDir, { intermediates: true });
        await FileSystem.copyAsync({
          from: uri,
          to: pdfUri
        });

        await Sharing.shareAsync(pdfUri);
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'PDF generated successfully',
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to generate PDF',
        position: 'bottom',
      });
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePaymentStatus = async (invoice: Invoice) => {
    try {
      console.log('Starting payment status update for invoice:', invoice.id);
      console.log('Current user:', user.id);
      console.log('User role:', userData?.role);

      // First, verify we can access the invoice
      const { data: verifyData, error: verifyError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoice.id)
        .single();

      if (verifyError) {
        console.error('Error verifying invoice access:', verifyError);
        throw verifyError;
      }

      console.log('Verified invoice access:', verifyData);

      // Now try to update the status
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      if (updateError) {
        console.error('Error updating payment status:', updateError);
        console.error('Error details:', {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        });
        throw updateError;
      }

      // Update local state
      setInvoices(current =>
        current.map(inv =>
          inv.id === invoice.id
            ? { ...inv, status: 'paid', updatedAt: new Date().toISOString() }
            : inv
        )
      );

      // Update selected invoice if it's the one being modified
      if (selectedInvoice?.id === invoice.id) {
        setSelectedInvoice(current =>
          current ? { ...current, status: 'paid', updatedAt: new Date().toISOString() } : null
        );
      }

      // Send notification to driver (don't let this fail the update)
      if (invoice.driverDetails?.pushToken) {
        try {
          await sendPushNotification(
            invoice.driverDetails.pushToken,
            'Payment Received',
            `Payment for invoice ${invoice.invoiceNumber} has been marked as received`
          );
        } catch (notificationError) {
          // Log but don't fail the update
          console.warn('Failed to send push notification, but invoice was updated:', notificationError);
        }
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Payment status updated',
        position: 'bottom',
      });

      // Don't refresh the invoice list - real-time subscription will handle the update
      // This prevents duplicate invoices from appearing
      // await fetchInvoices();
    } catch (error) {
      console.error('Error updating payment status:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update payment status',
        position: 'bottom',
      });
    }
  };

  const renderInvoiceCard = (invoice: Invoice) => (
    <Card style={[styles.card, { backgroundColor: surfaceColors.surface }]} onPress={() => {
      setSelectedInvoice(invoice);
      setShowModal(true);
    }}>
      <View style={styles.cardOverflowWrapper}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View>
              <Text variant="titleMedium" style={[styles.invoiceNumber, { color: surfaceColors.text }]}>
                {invoice.invoiceNumber}
              </Text>
              <Text variant="bodyMedium" style={[styles.jobTitle, { color: surfaceColors.textSecondary }]}>
                {invoice.jobTitle}
              </Text>
              <Text variant="bodySmall" style={[styles.jobId, { color: surfaceColors.textSecondary }]}>
                Job ID: {invoice.jobId}
              </Text>
            </View>
            <Chip
              mode="outlined"
              style={[
                styles.statusChip,
                { backgroundColor: invoice.status === 'paid' ? '#E8F5E9' : '#FFF3E0' }
              ]}
            >
              {invoice.status.toUpperCase()}
            </Chip>
          </View>

          <View style={styles.details}>
            <Text variant="bodyMedium" style={{ color: surfaceColors.text }}>Amount: €{invoice.amount.toFixed(2)}</Text>
            <Text variant="bodyMedium" style={{ color: surfaceColors.text }}>Date: {new Date(invoice.date).toLocaleDateString()}</Text>
          </View>
        </Card.Content>
      </View>
    </Card>
  );

  const renderInvoiceDetails = () => {
    if (!selectedInvoice) return null;

    return (
      <ScrollView
        style={styles.modalContent}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="headlineMedium" style={[styles.modalTitle, { color: surfaceColors.text }]}>
          Invoice Details
        </Text>

        <Card style={[styles.detailsCard, { backgroundColor: surfaceColors.surface }]}>
          <View style={styles.detailsCardOverflowWrapper}>
            <Card.Content>
              <View style={styles.headerSection}>
                <View>
                  <Text variant="titleLarge" style={[styles.invoiceNumber, { color: surfaceColors.text }]}>
                    {selectedInvoice.invoiceNumber}
                  </Text>
                  <Text variant="bodyMedium" style={[styles.subInfo, { color: surfaceColors.textSecondary }]}>
                    ID: {selectedInvoice.id}
                  </Text>
                </View>
                <Chip
                  mode="outlined"
                  style={[
                    styles.statusChip,
                    { backgroundColor: selectedInvoice.status === 'paid' ? '#E8F5E9' : '#FFF3E0' }
                  ]}
                >
                  {selectedInvoice.status.toUpperCase()}
                </Chip>
              </View>

              <View style={styles.section}>
                <Text variant="titleMedium" style={styles.sectionTitle}>Driver Information</Text>
                <Text style={styles.detail}>Name: {selectedInvoice.driverName}</Text>
                <Text style={styles.detail}>Email: {selectedInvoice.driverDetails.email}</Text>
                <Text style={styles.detail}>Phone: {selectedInvoice.driverDetails.phone}</Text>
                {selectedInvoice.driverDetails.address && (
                  <View style={styles.addressBox}>
                    <Text style={styles.detail}>Address:</Text>
                    {selectedInvoice.driverDetails.address.street && (
                      <Text style={styles.detailIndent}>{selectedInvoice.driverDetails.address.street}</Text>
                    )}
                    {(selectedInvoice.driverDetails.address.city || selectedInvoice.driverDetails.address.state || selectedInvoice.driverDetails.address.postalCode) && (
                      <Text style={styles.detailIndent}>
                        {[selectedInvoice.driverDetails.address.city, selectedInvoice.driverDetails.address.state, selectedInvoice.driverDetails.address.postalCode].filter(Boolean).join(', ')}
                      </Text>
                    )}
                    {selectedInvoice.driverDetails.address.country && (
                      <Text style={styles.detailIndent}>{selectedInvoice.driverDetails.address.country}</Text>
                    )}
                  </View>
                )}
                {selectedInvoice.driverDetails.companyInfo && (
                  <View style={styles.companyBox}>
                    <Text style={styles.detail}>Company: {selectedInvoice.driverDetails.companyInfo.companyName}</Text>
                    <Text style={styles.detail}>Tax ID: {selectedInvoice.driverDetails.companyInfo.taxId}</Text>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: surfaceColors.text }]}>Job Details</Text>
                <Text style={[styles.detail, { color: surfaceColors.text }]}>Job ID: {selectedInvoice.jobId}</Text>
                <Text style={[styles.detail, { color: surfaceColors.text }]}>Title: {selectedInvoice.jobTitle}</Text>
                <Text style={[styles.detail, { color: surfaceColors.text }]}>Location: {selectedInvoice.jobDetails.location}</Text>
                <Text style={[styles.detail, { color: surfaceColors.text }]}>Date: {selectedInvoice.jobDetails.date}</Text>
                <Text style={[styles.detail, { color: surfaceColors.text }]}>Duration: {selectedInvoice.jobDetails.duration}</Text>
                <Text style={[styles.detail, { color: surfaceColors.text }]}>Rate: {selectedInvoice.jobDetails.rate}/h</Text>
              </View>

              {selectedInvoice.driverDetails.bankInfo && (selectedInvoice.driverDetails.bankInfo.accountName || selectedInvoice.driverDetails.bankInfo.bankName) && (
                <View style={styles.section}>
                  <Text variant="titleMedium" style={[styles.sectionTitle, { color: surfaceColors.text }]}>Bank Information</Text>
                  <View style={styles.bankBox}>
                    {selectedInvoice.driverDetails.bankInfo.accountName && (
                      <Text style={[styles.detail, { color: surfaceColors.text }]}>Account Name: {selectedInvoice.driverDetails.bankInfo.accountName}</Text>
                    )}
                    {selectedInvoice.driverDetails.bankInfo.bankName && (
                      <Text style={[styles.detail, { color: surfaceColors.text }]}>Bank Name: {selectedInvoice.driverDetails.bankInfo.bankName}</Text>
                    )}
                    {selectedInvoice.driverDetails.bankInfo.accountNumber && (
                      <Text style={[styles.detail, { color: surfaceColors.text }]}>Account Number: {selectedInvoice.driverDetails.bankInfo.accountNumber}</Text>
                    )}
                    {selectedInvoice.driverDetails.bankInfo.swiftCode && (
                      <Text style={[styles.detail, { color: surfaceColors.text }]}>SWIFT/BIC: {selectedInvoice.driverDetails.bankInfo.swiftCode}</Text>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.section}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: surfaceColors.text }]}>Amount</Text>
                <Text style={[styles.detail, styles.amount, { color: surfaceColors.text }]}>€{selectedInvoice.amount.toFixed(2)}</Text>
              </View>

              <View style={styles.buttonContainer}>
                <PaperButton
                  mode="outlined"
                  onPress={() => generatePDF(selectedInvoice)}
                  style={styles.button}
                  loading={pdfLoading}
                  disabled={pdfLoading}
                  icon="file-pdf-box"
                >
                  Download PDF
                </PaperButton>
                {userData?.role === 'admin' && selectedInvoice.status === 'pending' && (
                  <PaperButton
                    mode="contained"
                    onPress={() => handlePaymentStatus(selectedInvoice)}
                    style={styles.button}
                    icon="check-circle"
                  >
                    Mark as Paid
                  </PaperButton>
                )}
              </View>

              <View style={styles.timestampsSection}>
                <Text style={styles.timestamp}>Created: {new Date(selectedInvoice.createdAt).toLocaleString()}</Text>
                {selectedInvoice.updatedAt && (
                  <Text style={styles.timestamp}>Last Updated: {new Date(selectedInvoice.updatedAt).toLocaleString()}</Text>
                )}
              </View>
            </Card.Content>
          </View>
        </Card>
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={['#DAF2FB', '#4083FF']}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
      >
        <View style={styles.container}>
          <View style={styles.screenHeader}>
            <Text variant="headlineMedium" style={[styles.screenTitle, { color: surfaceColors.text }]}>Invoices</Text>
          </View>
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search by Invoice ID"
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
              iconColor="#666"
              inputStyle={styles.searchInput}
            />
            <View style={styles.filterContainer}>
              <Chip
                selected={statusFilter === 'all'}
                onPress={() => setStatusFilter('all')}
                style={[
                  styles.filterChip,
                  statusFilter === 'all' && styles.filterChipSelected,
                  { backgroundColor: statusFilter === 'all' ? '#6949FF' : (isDarkMode ? surfaceColors.surface : '#f0f0f0') }
                ]}
                textStyle={[
                  styles.filterChipText,
                  { color: statusFilter === 'all' ? '#fff' : surfaceColors.text }
                ]}
              >
                All
              </Chip>
              <Chip
                selected={statusFilter === 'pending'}
                onPress={() => setStatusFilter('pending')}
                style={[
                  styles.filterChip,
                  statusFilter === 'pending' && styles.filterChipSelected,
                  { backgroundColor: statusFilter === 'pending' ? '#FFF3E0' : (isDarkMode ? surfaceColors.surface : '#f0f0f0') }
                ]}
                textStyle={[
                  styles.filterChipText,
                  { color: statusFilter === 'pending' ? '#F57C00' : surfaceColors.text }
                ]}
              >
                Pending
              </Chip>
              <Chip
                selected={statusFilter === 'paid'}
                onPress={() => setStatusFilter('paid')}
                style={[
                  styles.filterChip,
                  statusFilter === 'paid' && styles.filterChipSelected,
                  { backgroundColor: statusFilter === 'paid' ? '#E8F5E9' : (isDarkMode ? surfaceColors.surface : '#f0f0f0') }
                ]}
                textStyle={[
                  styles.filterChipText,
                  { color: statusFilter === 'paid' ? '#2E7D32' : surfaceColors.text }
                ]}
              >
                Paid
              </Chip>
            </View>
          </View>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.gridContainer}>
              {filteredInvoices.map(invoice => (
                <View key={invoice.id} style={styles.gridItem}>
                  {renderInvoiceCard(invoice)}
                </View>
              ))}
            </View>
            <Copyright />
          </ScrollView>
          <Portal>
            <Modal
              visible={showModal}
              onDismiss={() => setShowModal(false)}
              contentContainerStyle={styles.modalContainer}
            >
              {renderInvoiceDetails()}
            </Modal>
          </Portal>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardOverflowWrapper: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  invoiceNumber: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 18,
    flexShrink: 1,
  },
  jobTitle: {
    color: '#666',
    marginTop: 4,
    flexShrink: 1,
  },
  statusChip: {
    borderRadius: 20,
    minWidth: 80,
    textAlign: 'center',
  },
  details: {
    gap: 4,
    marginTop: 8,
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    maxHeight: '95%',
    width: Platform.OS === 'web' ? '80%' : 'auto',
    alignSelf: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
    fontWeight: 'bold',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  detailsCardOverflowWrapper: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexWrap: 'wrap',
    gap: 12,
  },
  subInfo: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    flexShrink: 1,
  },
  section: {
    marginTop: 20,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    color: '#333',
    marginBottom: 12,
    fontWeight: 'bold',
    fontSize: 18,
  },
  detail: {
    marginBottom: 8,
    color: '#495057',
    fontSize: 15,
    lineHeight: 22,
    flexWrap: 'wrap',
  },
  detailIndent: {
    marginBottom: 8,
    color: '#495057',
    fontSize: 15,
    marginLeft: 16,
    lineHeight: 22,
    flexWrap: 'wrap',
  },
  addressBox: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  companyBox: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  bankBox: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  amount: {
    fontSize: Platform.OS === 'web' ? 36 : 28,
    fontWeight: 'bold',
    color: '#6949FF',
    textAlign: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  button: {
    flex: Platform.OS === 'web' ? 1 : undefined,
    borderRadius: 8,
    paddingVertical: 8,
  },
  timestampsSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  timestamp: {
    color: '#6c757d',
    fontSize: 12,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  screenHeader: {
    padding: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  screenTitle: {
    color: '#333',
    fontWeight: 'bold',
    flexShrink: 1,
  },
  jobId: {
    color: '#666',
    marginTop: 2,
    fontSize: 12,
    flexShrink: 1,
  },
  contentContainer: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    flexWrap: 'wrap',
    gap: 16,
    padding: 16,
  },
  invoicesList: {
    flex: Platform.OS === 'web' ? 1 : undefined,
    minWidth: Platform.OS === 'web' ? 300 : '100%',
  },
  invoiceDetails: {
    flex: Platform.OS === 'web' ? 2 : undefined,
    minWidth: Platform.OS === 'web' ? 500 : '100%',
  },
  gridContainer: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  gridItem: {
    flex: Platform.OS === 'web' ? 1 : undefined,
    minWidth: Platform.OS === 'web' ? 300 : '100%',
    maxWidth: Platform.OS === 'web' ? '48%' : '100%',
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  infoLabel: {
    fontWeight: 'bold',
    minWidth: 120,
  },
  infoValue: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchBar: {
    borderRadius: 12,
    elevation: 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    marginBottom: 12,
  },
  searchInput: {
    fontSize: 16,
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 4,
  },
  filterChipSelected: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
}); 