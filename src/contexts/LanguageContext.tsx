import React, { createContext, useState, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'en' | 'fi';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // General
    'settings': 'Settings',
    'language': 'Language',
    'english': 'English',
    'finnish': 'Finnish',
    'save': 'Save',
    'cancel': 'Cancel',
    'success': 'Success',
    'error': 'Error',
    'appearance': 'Appearance',
    'dark_mode': 'Dark Mode',
    'dark_mode_description': 'Switch between light and dark themes',
    
    // Tab Names
    'home': 'Home',
    'chat': 'Chat',
    'chats': 'Chats',
    'invoices': 'Invoices',
    'profile': 'Profile',
    'logout': 'Logout',
    'logout_confirmation': 'Are you sure you want to logout?',
    
    // Invoice related
    'invoice_details': 'Invoice Details',
    'job_information': 'Job Information',
    'driver_information': 'Driver Information',
    'payment_information': 'Payment Information',
    'bank_details': 'Bank Details',
    'download_pdf': 'Download PDF',
    'mark_as_paid': 'Mark as Paid',
    'job_id': 'Job ID',
    'title': 'Title',
    'location': 'Location',
    'date': 'Date',
    'duration': 'Duration',
    'rate': 'Rate',
    'name': 'Name',
    'email': 'Email',
    'phone': 'Phone',
    'address': 'Address',
    'company': 'Company',
    'tax_id': 'Tax ID',
    'amount': 'Amount',
    'status': 'Status',
    'account_name': 'Account Name',
    'bank_name': 'Bank Name',
    'account_number': 'Account Number',
    'swift_bic': 'SWIFT/BIC',
    'pending': 'PENDING',
    'paid': 'PAID',
  },
  fi: {
    // General
    'settings': 'Asetukset',
    'language': 'Kieli',
    'english': 'Englanti',
    'finnish': 'Suomi',
    'save': 'Tallenna',
    'cancel': 'Peruuta',
    'success': 'Onnistui',
    'error': 'Virhe',
    'appearance': 'Ulkoasu',
    'dark_mode': 'Tumma Tila',
    'dark_mode_description': 'Vaihda vaalean ja tumman teeman välillä',
    
    // Tab Names
    'home': 'Koti',
    'chat': 'Keskustelu',
    'chats': 'Keskustelut',
    'invoices': 'Laskut',
    'profile': 'Profiili',
    'logout': 'Kirjaudu ulos',
    'logout_confirmation': 'Haluatko varmasti kirjautua ulos?',
    
    // Invoice related
    'invoice_details': 'Laskun Tiedot',
    'job_information': 'Työn Tiedot',
    'driver_information': 'Kuljettajan Tiedot',
    'payment_information': 'Maksutiedot',
    'bank_details': 'Pankkitiedot',
    'download_pdf': 'Lataa PDF',
    'mark_as_paid': 'Merkitse Maksetuksi',
    'job_id': 'Työn ID',
    'title': 'Otsikko',
    'location': 'Sijainti',
    'date': 'Päivämäärä',
    'duration': 'Kesto',
    'rate': 'Hinta',
    'name': 'Nimi',
    'email': 'Sähköposti',
    'phone': 'Puhelin',
    'address': 'Osoite',
    'company': 'Yritys',
    'tax_id': 'Y-tunnus',
    'amount': 'Summa',
    'status': 'Tila',
    'account_name': 'Tilin Omistaja',
    'bank_name': 'Pankin Nimi',
    'account_number': 'Tilinumero',
    'swift_bic': 'SWIFT/BIC',
    'pending': 'ODOTTAA',
    'paid': 'MAKSETTU',
  }
};

export const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: () => '',
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem('language', lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  // Load saved language preference on mount
  React.useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('language');
        if (savedLanguage === 'en' || savedLanguage === 'fi') {
          setLanguageState(savedLanguage);
        }
      } catch (error) {
        console.error('Error loading language preference:', error);
      }
    };
    loadLanguage();
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}; 