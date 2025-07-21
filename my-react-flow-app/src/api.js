// src/api.js
import axios from 'axios';

const API_BASE = process.env.NODE_ENV === 'development' 
  ? ''
  : 'http://127.0.0.1:5000'; 

export const getDevices = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/get_devices`);
    console.log("helllo");
    return response.data;
  } catch (error) {
    console.error('Error fetching devices:', error);
    return null;
  }
};

export const sendCommand = async (deviceId, command) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/${command}/${deviceId}`);
    return response.data;
  } catch (error) {
    console.error(`Error sending ${command} command:`, error);
    return null;
  }
};

export const sendHint = async (deviceId, hintId) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/hint/${deviceId}/${hintId}`);
    return response.data;
  } catch (error) {
    console.error('Error sending hint:', error);
    return null;
  }
};

export const startAllDevices = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}/start_all`);
    return response.data;
  } catch (error) {
    console.error('Error starting all devices:', error);
    return null;
  }
};

export const resetAllDevices = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}/reset_all`);
    return response.data;
  } catch (error) {
    console.error('Error resetting all devices:', error);
    return null;
  }
};