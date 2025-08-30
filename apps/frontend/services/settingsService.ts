import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://aistory-backend.onrender.com/api';

const settingsApi = axios.create({
  baseURL: API_URL,
});

// Get system announcements
export const getAnnouncements = async (): Promise<string[]> => {
  try {
    const response = await settingsApi.get('/settings');
    if (response.data.success) {
      const settings = response.data.settings;
      const announcements = [
        settings.announcement1?.value || '',
        settings.announcement2?.value || '',
        settings.announcement3?.value || '',
        settings.announcement4?.value || '',
        settings.announcement5?.value || ''
      ].filter(text => text.trim() !== ''); // Filter out empty announcements
      
      return announcements;
    }
    return [];
  } catch (error) {
    console.error('Error getting announcements:', error);
    return [];
  }
};

// Legacy function for backward compatibility
export const getAnnouncement = async (): Promise<string> => {
  const announcements = await getAnnouncements();
  return announcements[0] || '';
};

// Get all system settings (for admin use)
export const getSystemSettings = async () => {
  try {
    const response = await settingsApi.get('/settings');
    return response.data;
  } catch (error) {
    console.error('Error getting system settings:', error);
    throw error;
  }
};

export default {
  getAnnouncements,
  getAnnouncement,
  getSystemSettings,
};