import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://aistory-backend.onrender.com/api';

const settingsApi = axios.create({
  baseURL: API_URL,
});

// Get system announcement
export const getAnnouncement = async (): Promise<string> => {
  try {
    const response = await settingsApi.get('/settings/announcement');
    return response.data.setting?.value || '';
  } catch (error) {
    console.error('Error getting announcement:', error);
    return '';
  }
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
  getAnnouncement,
  getSystemSettings,
};