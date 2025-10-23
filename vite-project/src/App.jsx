import React, { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// --- 1. Constants and Initial Data ---
const LOGIN_CREDENTIALS = {
  email: 'admin@example.com',
  password: 'password123',
};

const INITIAL_DEVICES = [
  { id: 'dev-001', name: 'Server Rack 1', status: true, location: 'Data Center A' },
  { id: 'dev-002', name: 'HVAC Unit 3', status: true, location: 'Warehouse 2' },
  { id: 'dev-003', name: 'Cold Storage A', status: false, location: 'Processing Plant' },
];

const DEFAULT_THRESHOLDS = {
  temp: { min: 18, max: 25 },
  humidity: { min: 40, max: 60 },
};

// --- 2. Contexts ---

// Authentication and Navigation Context
const AuthContext = createContext(null);

// Dashboard State Context
const DashboardContext = createContext(null);

// --- 3. Utility Functions ---

/**
 * Creates a mock historical data array.
 * @param {string} range - Time range (e.g., '24h', '7d', '3m').
 * @returns {Array} Array of historical data points.
 */
const createHistoricalData = (range) => {
  let count;
  switch (range) {
    case '7d': count = 168; break; // 1 week (hourly)
    case '3m': count = 30 * 3; break; // 3 months (daily average)
    case '24h': default: count = 24; break; // 24 hours
  }

  const data = [];
  let currentTimestamp = Date.now();
  const step = range === '3m' ? 86400000 : range === '7d' ? 3600000 : 3600000;

  for (let i = 0; i < count; i++) {
    const timestamp = currentTimestamp - (count - i) * step;
    data.push({
      timestamp: timestamp,
      time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temp: parseFloat((15 + Math.random() * 15).toFixed(1)), // 15.0 to 30.0
      humidity: parseFloat((30 + Math.random() * 45).toFixed(1)), // 30.0 to 75.0
    });
  }
  return data;
};

/**
 * Converts data array to CSV format string.
 * @param {Array} data - The data array.
 * @returns {string} CSV content.
 */
const convertToCsv = (data) => {
  if (data.length === 0) return '';
  const headers = ['Timestamp', 'Temperature', 'Humidity'];
  const rows = data.map(d => [
    new Date(d.timestamp).toISOString(),
    d.temp,
    d.humidity
  ]);

  let csvContent = headers.join(',') + '\n';
  rows.forEach(row => {
    csvContent += row.join(',') + '\n';
  });
  return csvContent;
};

/**
 * Downloads a string as a CSV file.
 * @param {string} csvContent - The CSV content string.
 */
const downloadCsv = (csvContent) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `iot_data_${new Date().toISOString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// --- 4. Custom Hooks ---

/**
 * Handles user authentication state.
 */
const useAuth = (setView) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check local storage for a mock token
    return localStorage.getItem('authToken') === 'valid';
  });
  const [error, setError] = useState(null);

  const login = (email, password) => {
    setError(null);
    if (email === LOGIN_CREDENTIALS.email && password === LOGIN_CREDENTIALS.password) {
      localStorage.setItem('authToken', 'valid');
      setIsAuthenticated(true);
      // Navigate to dashboard on successful login
      if (setView) setView('dashboard');
      return true;
    } else {
      setError('Invalid email or password.');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
    // Navigate back to landing page on logout
    if (setView) setView('landing');
  };

  return { isAuthenticated, error, login, logout };
};

/**
 * Simulates real-time IoT device data and historical data.
 */
const useIoTData = (initialDevices, thresholds) => {
  const [deviceData, setDeviceData] = useState(() => {
    // Initialize data with a random starting point
    const initialData = {};
    initialDevices.forEach(device => {
      initialData[device.id] = {
        temp: 22.5 + (Math.random() * 5 - 2.5),
        humidity: 50 + (Math.random() * 10 - 5),
        status: device.status,
      };
    });
    return initialData;
  });

  const [historicalData, setHistoricalData] = useState(createHistoricalData('24h'));

  useEffect(() => {
    // Real-time data simulation (updates every 5 seconds)
    const intervalId = setInterval(() => {
      setDeviceData(prevData => {
        const newData = { ...prevData };
        initialDevices.forEach(device => {
          if (newData[device.id].status) {
            // Slight random walk simulation for temp and humidity
            newData[device.id].temp = Math.max(
              thresholds.temp.min - 5, // Lower bound to prevent extreme negative
              Math.min(
                thresholds.temp.max + 5, // Upper bound
                newData[device.id].temp + (Math.random() * 1 - 0.5)
              )
            );
            newData[device.id].humidity = Math.max(
              thresholds.humidity.min - 10,
              Math.min(
                thresholds.humidity.max + 10,
                newData[device.id].humidity + (Math.random() * 2 - 1)
              )
            );
          }
          // Format to one decimal place
          newData[device.id].temp = parseFloat(newData[device.id].temp.toFixed(1));
          newData[device.id].humidity = parseFloat(newData[device.id].humidity.toFixed(1));
        });
        return newData;
      });
    }, 5000); // Update interval

    return () => clearInterval(intervalId);
  }, [initialDevices, thresholds]);

  const toggleStatus = useCallback((deviceId) => {
    setDeviceData(prevData => {
      const newStatus = !prevData[deviceId].status;
      return {
        ...prevData,
        [deviceId]: {
          ...prevData[deviceId],
          status: newStatus
        }
      };
    });
  }, []);

  const getDeviceCurrentData = useCallback((deviceId) => {
    const data = deviceData[deviceId];
    if (!data) return { temp: 0, humidity: 0, status: false };
    return {
      temp: data.temp,
      humidity: data.humidity,
      status: data.status,
      tempAlert: data.temp > thresholds.temp.max || data.temp < thresholds.temp.min,
      humidityAlert: data.humidity > thresholds.humidity.max || data.humidity < thresholds.humidity.min,
    };
  }, [deviceData, thresholds]);


  return {
    devices: initialDevices,
    getDeviceCurrentData,
    toggleStatus,
    historicalData,
    setHistoricalData,
  };
};

// --- 5. Icons (Inline SVG for Single File) ---
const Icon = ({ name, className = 'w-5 h-5' }) => {
  // Wrapping multiple SVG elements in React Fragments (<>...</>) to fix JSX parsing errors.
  const svg = {
    LogOut: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></>),
    Thermometer: (<><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><line x1="12" x2="12" y1="16" y2="20"/></>),
    Droplet: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.32 0z"/>,
    Settings: (<><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18c-2.61.14-5.11 1.25-7.14 3.19l-.36.36a2 2 0 0 0 2.83 2.83l.36-.36c1.84-1.84 4.14-2.88 6.58-3.19V12a2 2 0 0 0 2 2h.18c.14 2.61 1.25 5.11 3.19 7.14l.36.36a2 2 0 0 0 2.83-2.83l-.36-.36c-1.84-1.84-2.88-4.14-3.19-6.58H20a2 2 0 0 0 2-2v-.44a2 2 0 0 0-2-2h-.18c-2.61-.14-5.11-1.25-7.14-3.19l-.36-.36a2 2 0 0 0-2.83-2.83l.36.36C18.2 4.8 20.35 6.09 21.82 8.52h.18Z"/><circle cx="12" cy="12" r="3"/></>),
    Activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
    History: (<><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M12 3v9h5"/></>),
    Download: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></>),
    CheckCircle: (<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>),
    AlertTriangle: (<><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14a2 2 0 0 0 1.73 3H19.9a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></>),
    BarChart: (<><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></>),
    LogIn: (<><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></>),
    Home: (<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>),
  };

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {svg[name]}
    </svg>
  );
};

// --- 6. Components ---

/**
 * Landing Page Component
 */
const LandingPage = ({ setView }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center max-w-7xl mx-auto">
                <h1 className="text-3xl font-extrabold text-indigo-400 tracking-wide">
                    IoT Monitor
                </h1>
                <button
                    onClick={() => setView('login')}
                    className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-lg transition duration-300 transform hover:scale-105"
                >
                    <Icon name="LogIn" className="w-5 h-5 mr-2" />
                    Login
                </button>
            </header>

            <main className="text-center py-20 max-w-4xl">
                <div className="text-indigo-400 mb-4">
                    <Icon name="BarChart" className="w-16 h-16 mx-auto stroke-1" />
                </div>
                <h2 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
                    Real-time Data Insights.
                    <span className="block text-indigo-400">Simplified Monitoring.</span>
                </h2>
                <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
                    Centralized control and visualization for all your connected devices. Track temperature, humidity, and device status instantly with smart alerting.
                </p>
                <button
                    onClick={() => setView('login')}
                    className="flex items-center justify-center mx-auto px-10 py-4 text-lg font-bold bg-green-500 hover:bg-green-600 text-gray-900 rounded-xl shadow-2xl transition duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-50"
                >
                    Start Monitoring Now
                    <Icon name="Activity" className="w-5 h-5 ml-2" />
                </button>
            </main>

            <footer className="absolute bottom-0 p-4 text-sm text-gray-500">
                &copy; {new Date().getFullYear()} IoT Dashboard. All rights reserved.
            </footer>
        </div>
    );
};

/**
 * User Authentication Form
 */
const LoginForm = ({ setView }) => {
  const { login, error } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(null);

    // Simple validation
    if (!email || !password) {
      setFormError('Both fields are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Invalid email format.');
      return;
    }

    if (login(email, password)) {
      // Login success handled by AuthContext redirect
    } else {
      // Login error handled by AuthContext state
      setFormError(error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl transition duration-500 hover:shadow-3xl">
        <h2 className="text-3xl font-bold text-center text-indigo-700 mb-6">
          Dashboard Login
        </h2>
        <p className="text-center text-sm text-gray-500 mb-8">
          Use: `admin@example.com` / `password123`
        </p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out"
              placeholder="password123"
              required
            />
          </div>

          {(formError || error) && (
            <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
              {formError || error}
            </div>
          )}

          <button
            type="submit"
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
          >
            Sign In
          </button>
        </form>
        <div className="mt-6 border-t pt-4">
            <button
                onClick={() => setView('landing')}
                className="w-full flex justify-center items-center py-2 px-4 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
            >
                <Icon name="Home" className="w-4 h-4 mr-2" />
                Back to Home
            </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Live Monitor Tab Component
 */
const LiveMonitorTab = () => {
  const { devices, getDeviceCurrentData, toggleStatus } = useContext(DashboardContext);

  // Derive live chart data from the first active device for simplicity
  const activeDeviceId = devices.find(d => getDeviceCurrentData(d.id).status)?.id || devices[0].id;
  const currentData = getDeviceCurrentData(activeDeviceId);
  // Keep an array of historical live data points (last 10 updates) for a trending chart
  const [liveDataHistory, setLiveDataHistory] = useState([]);

  useEffect(() => {
    // Add the current data point (with time) to the history every 5 seconds
    const interval = setInterval(() => {
        setLiveDataHistory(prev => {
            const time = new Date().toLocaleTimeString([], { second: '2-digit', minute: '2-digit' });
            const newDataPoint = {
                time: time,
                temp: getDeviceCurrentData(activeDeviceId).temp,
                humidity: getDeviceCurrentData(activeDeviceId).humidity
            };
            // Keep only the last 10 points for the live chart
            const newHistory = [...prev.slice(-9), newDataPoint];
            return newHistory;
        });
    }, 5000); 

    return () => clearInterval(interval);
  }, [activeDeviceId, getDeviceCurrentData]);

  const cardClasses = "bg-white p-6 rounded-xl shadow-lg transition duration-300 hover:shadow-xl border border-gray-100";
  const alertClasses = "absolute top-3 right-3 w-3 h-3 rounded-full animate-pulse";

  return (
    <div className="space-y-8 p-4 md:p-6">
      <h3 className="text-2xl font-semibold text-gray-800 border-b pb-3 mb-5">Live Device Status</h3>

      {/* Device Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => {
          const data = getDeviceCurrentData(device.id);
          const isAlert = data.tempAlert || data.humidityAlert;
          const statusColor = data.status ? 'bg-green-500' : 'bg-gray-400';

          return (
            <div key={device.id} className={`${cardClasses} relative`}>
              {/* Pulsing Alert Indicator */}
              <span className={`${alertClasses} ${isAlert ? 'bg-red-500' : 'bg-green-500'} ${data.status ? '' : 'opacity-50'}`}></span>
              <div className="flex items-start justify-between">
                <h4 className="text-xl font-bold text-gray-700">{device.name}</h4>
                <div className={`px-3 py-1 text-xs font-semibold rounded-full text-white ${statusColor}`}>
                  {data.status ? 'ONLINE' : 'OFFLINE'}
                </div>
              </div>

              <p className="text-sm text-gray-500 mt-1 mb-4">{device.location}</p>

              <div className="flex justify-between items-center space-x-4 mt-3">
                {/* Temperature Card */}
                <div className={`flex flex-col items-center justify-center p-3 rounded-xl w-1/2 transition ${data.tempAlert ? 'bg-red-100' : 'bg-blue-50'}`}>
                  <Icon name="Thermometer" className={`w-6 h-6 ${data.tempAlert ? 'text-red-600' : 'text-blue-500'}`} />
                  <span className="text-3xl font-extrabold mt-1 text-gray-800">{data.temp.toFixed(1)}°C</span>
                  <span className="text-xs text-gray-500">Temperature</span>
                  {data.tempAlert && <Icon name="AlertTriangle" className="w-4 h-4 text-red-500 mt-1"/>}
                </div>

                {/* Humidity Card */}
                <div className={`flex flex-col items-center justify-center p-3 rounded-xl w-1/2 transition ${data.humidityAlert ? 'bg-red-100' : 'bg-green-50'}`}>
                  <Icon name="Droplet" className={`w-6 h-6 ${data.humidityAlert ? 'text-red-600' : 'text-green-500'}`} />
                  <span className="text-3xl font-extrabold mt-1 text-gray-800">{data.humidity.toFixed(1)}%</span>
                  <span className="text-xs text-gray-500">Humidity</span>
                  {data.humidityAlert && <Icon name="AlertTriangle" className="w-4 h-4 text-red-500 mt-1"/>}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Device Power</span>
                <label htmlFor={`toggle-${device.id}`} className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      id={`toggle-${device.id}`}
                      className="sr-only"
                      checked={data.status}
                      onChange={() => toggleStatus(device.id)}
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${data.status ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform ${data.status ? 'transform translate-x-full' : ''}`}></div>
                  </div>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Charts Section */}
      <h3 className="text-2xl font-semibold text-gray-800 border-b pb-3 mb-5 pt-4">Live Readings Trend (Device: {devices.find(d => d.id === activeDeviceId)?.name})</h3>

      <div className="bg-white p-6 rounded-xl shadow-lg h-[320px] border border-gray-100 flex flex-col">
        {/* Chart container now takes remaining space */}
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={liveDataHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="time" />
              <YAxis yAxisId="temp" orientation="left" stroke="#8884d8" domain={[15, 30]} />
              <YAxis yAxisId="humidity" orientation="right" stroke="#82ca9d" domain={[30, 75]} />
              <Tooltip
                  formatter={(value, name) => [`${value.toFixed(1)} ${name === 'temp' ? '°C' : '%'}`, name === 'temp' ? 'Temperature' : 'Humidity']}
                  labelFormatter={(label) => `Time: ${label}`}
              />
              <Legend />
              <Line yAxisId="temp" type="monotone" dataKey="temp" name="Temperature" stroke="#8884d8" strokeWidth={2} dot={false} />
              <Line yAxisId="humidity" type="monotone" dataKey="humidity" name="Humidity" stroke="#82ca9d" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Caption remains at the bottom */}
        <p className="text-center text-sm text-gray-500 mt-2">Chart shows the last 10 data points, updating every 5 seconds.</p>
      </div>
    </div>
  );
};

/**
 * Threshold Settings Tab Component
 */
const ThresholdSettingsTab = () => {
  const { thresholds, setThresholds } = useContext(DashboardContext);
  const [localThresholds, setLocalThresholds] = useState(thresholds);
  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState(null); // Added state for validation error

  useEffect(() => {
    setLocalThresholds(thresholds);
  }, [thresholds]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const [type, limit] = name.split('-');
    setLocalThresholds(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [limit]: parseFloat(value) || 0,
      }
    }));
    setSuccess(false);
    setValidationError(null); // Clear error on input change
  };

  const handleSave = (e) => {
    e.preventDefault();
    setValidationError(null);

    // Simple validation (Max > Min)
    if (localThresholds.temp.max <= localThresholds.temp.min) {
        setValidationError("Temperature max limit must be greater than min limit.");
        return;
    }
    if (localThresholds.humidity.max <= localThresholds.humidity.min) {
        setValidationError("Humidity max limit must be greater than min limit.");
        return;
    }

    setThresholds(localThresholds);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const inputClass = "w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition";

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-2xl mx-auto">
      <h3 className="text-2xl font-semibold text-gray-800 border-b pb-3 mb-5 flex items-center">
        <Icon name="Settings" className="mr-2 text-indigo-600" />
        Global Alert Thresholds
      </h3>

      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <p className="text-sm text-gray-500 mb-6">
          Set the acceptable minimum and maximum limits for temperature and humidity. Alerts will trigger in the Live Monitor if values fall outside these ranges.
        </p>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Temperature Settings */}
          <fieldset className="border p-4 rounded-lg">
            <legend className="px-2 text-lg font-medium text-gray-700 flex items-center">
              <Icon name="Thermometer" className="w-5 h-5 mr-2 text-blue-500" /> Temperature (°C)
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="temp-min">Minimum Temp</label>
                <input
                  id="temp-min"
                  name="temp-min"
                  type="number"
                  step="0.1"
                  value={localThresholds.temp.min}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="temp-max">Maximum Temp</label>
                <input
                  id="temp-max"
                  name="temp-max"
                  type="number"
                  step="0.1"
                  value={localThresholds.temp.max}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>
            </div>
          </fieldset>

          {/* Humidity Settings */}
          <fieldset className="border p-4 rounded-lg">
            <legend className="px-2 text-lg font-medium text-gray-700 flex items-center">
              <Icon name="Droplet" className="w-5 h-5 mr-2 text-green-500" /> Humidity (%)
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="humidity-min">Minimum Humidity</label>
                <input
                  id="humidity-min"
                  name="humidity-min"
                  type="number"
                  step="0.1"
                  value={localThresholds.humidity.min}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="humidity-max">Maximum Humidity</label>
                <input
                  id="humidity-max"
                  name="humidity-max"
                  type="number"
                  step="0.1"
                  value={localThresholds.humidity.max}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>
            </div>
          </fieldset>

          {/* Validation Error Message */}
          {validationError && (
            <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg font-medium" role="alert">
              <Icon name="AlertTriangle" className="w-4 h-4 mr-2 inline-block align-text-bottom" />
              {validationError}
            </div>
          )}

          <button
            type="submit"
            className="w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
          >
            {success ? (
              <>
                <Icon name="CheckCircle" className="w-5 h-5 mr-2" />
                Settings Saved!
              </>
            ) : (
              'Save Global Thresholds'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * Historical Data Tab Component
 */
const HistoricalDataTab = () => {
  const { devices, historicalData, setHistoricalData } = useContext(DashboardContext);
  const [selectedDevice, setSelectedDevice] = useState(devices[0]?.id || '');
  const [timeRange, setTimeRange] = useState('24h');

  // Recalculate dummy historical data whenever timeRange changes
  useEffect(() => {
    setHistoricalData(createHistoricalData(timeRange));
  }, [timeRange, setHistoricalData]);

  const handleExport = () => {
    const dataToExport = historicalData.map(d => ({
      timestamp: d.timestamp,
      temp: d.temp,
      humidity: d.humidity
    }));
    const csvContent = convertToCsv(dataToExport);
    downloadCsv(csvContent);
  };

  const chartTitle = selectedDevice ? devices.find(d => d.id === selectedDevice)?.name : 'All Devices';
  const rangeMap = {
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '3m': 'Last 3 Months',
  };

  return (
    <div className="space-y-8 p-4 md:p-6">
      <h3 className="text-2xl font-semibold text-gray-800 border-b pb-3 mb-5 flex items-center">
        <Icon name="History" className="mr-2 text-indigo-600" />
        Historical Data Analysis
      </h3>

      {/* Filters and Export */}
      <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        {/* Device Selector */}
        <div className="w-full sm:w-auto flex-grow">
          <label className="block text-sm font-medium text-gray-700 mb-1">Device Filter</label>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
          >
            {devices.map(device => (
              <option key={device.id} value={device.id}>{device.name}</option>
            ))}
          </select>
        </div>

        {/* Time Range Filter */}
        <div className="w-full sm:w-auto flex-grow">
          <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
          >
            {Object.entries(rangeMap).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
            ))}
          </select>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={handleExport}
          className="w-full sm:w-auto mt-6 sm:mt-0 flex justify-center items-center py-3 px-4 rounded-lg shadow-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition"
        >
          <Icon name="Download" className="w-5 h-5 mr-2" />
          Export CSV ({historicalData.length} records)
        </button>
      </div>

      {/* Historical Chart */}
      <div className="bg-white p-6 rounded-xl shadow-lg h-[500px] border border-gray-100">
        <h4 className="text-lg font-bold mb-4 text-gray-700">
          {rangeMap[timeRange]} Trend: {chartTitle}
        </h4>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={historicalData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" />
            <YAxis yAxisId="temp" orientation="left" stroke="#8884d8" label={{ value: 'Temp (°C)', angle: -90, position: 'left', fill: '#8884d8' }} domain={[15, 30]}/>
            <YAxis yAxisId="humidity" orientation="right" stroke="#82ca9d" label={{ value: 'Humidity (%)', angle: 90, position: 'right', fill: '#82ca9d' }} domain={[30, 75]}/>
            <Tooltip
                labelFormatter={(label) => `Time: ${label}`}
                formatter={(value, name) => [`${value.toFixed(1)} ${name === 'temp' ? '°C' : '%'}`, name === 'temp' ? 'Temperature' : 'Humidity']}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line yAxisId="temp" type="monotone" dataKey="temp" name="Temperature" stroke="#8884d8" dot={false} strokeWidth={2} />
            <Line yAxisId="humidity" type="monotone" dataKey="humidity" name="Humidity" stroke="#82ca9d" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};


/**
 * Main Dashboard Layout with Tabs
 */
const DashboardLayout = () => {
  const { logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('live'); // 'live', 'threshold', 'historical'

  const TabButton = ({ tabKey, label, icon }) => (
    <button
      onClick={() => setActiveTab(tabKey)}
      className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
        activeTab === tabKey
          ? 'bg-white text-indigo-600 shadow-md'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon name={icon} className="mr-2 w-5 h-5" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.split(' ')[0]}</span>
    </button>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'threshold':
        return <ThresholdSettingsTab />;
      case 'historical':
        return <HistoricalDataTab />;
      case 'live':
      default:
        return <LiveMonitorTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header/Navigation */}
      <header className="bg-indigo-600 shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white tracking-wider">
            IoT Dashboard
          </h1>
          <button
            onClick={logout}
            className="flex items-center text-white bg-indigo-700 hover:bg-indigo-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-md"
          >
            <Icon name="LogOut" className="w-4 h-4 mr-2" />
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1">
        {/* Sidebar/Tab Navigation */}
        <nav className="bg-gray-200 p-4 shadow-xl md:w-56 md:min-h-screen">
          <div className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
            <TabButton tabKey="live" label="Live Monitor" icon="Activity" />
            <TabButton tabKey="threshold" label="Threshold Settings" icon="Settings" />
            <TabButton tabKey="historical" label="Historical Data" icon="History" />
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 max-w-full lg:max-w-7xl mx-auto w-full py-6">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
};

// --- 7. Main Application Component ---

/**
 * Provides Auth and Dashboard context and handles top-level routing.
 */
const App = () => {
  // State to manage the current view: 'landing', 'login', or 'dashboard'
  const [view, setView] = useState('landing');
  
  // Pass setView to useAuth so it can trigger navigation after login/logout
  const auth = useAuth(setView); 

  // Load thresholds from local storage on initial load
  const [thresholds, setThresholdsState] = useState(() => {
    const saved = localStorage.getItem('iotThresholds');
    return saved ? JSON.parse(saved) : DEFAULT_THRESHOLDS;
  });

  // Function to update thresholds and local storage
  const setThresholds = useCallback((newThresholds) => {
    setThresholdsState(newThresholds);
    localStorage.setItem('iotThresholds', JSON.stringify(newThresholds));
  }, []);

  // Simulate IoT data and logic
  const iotData = useIoTData(INITIAL_DEVICES, thresholds);

  // Combine all dashboard state into a single value provider
  const dashboardContextValue = useMemo(() => ({
    ...iotData,
    thresholds,
    setThresholds,
  }), [iotData, thresholds, setThresholds]);

  // Global Tailwind styling assumption
  useEffect(() => {
    document.body.style.fontFamily = 'Inter, sans-serif';
    document.body.className = 'antialiased';
  }, []);


  // Determine which component to render based on view state and authentication
  let content;
  if (auth.isAuthenticated && view !== 'landing' && view !== 'login') {
    // If authenticated, always show the dashboard (unless explicitly logged out to landing)
    content = (
      <DashboardContext.Provider value={dashboardContextValue}>
        <DashboardLayout />
      </DashboardContext.Provider>
    );
  } else if (view === 'login') {
    content = <LoginForm setView={setView} />;
  } else {
    // Default to landing page
    content = <LandingPage setView={setView} />;
  }


  return (
    <AuthContext.Provider value={auth}>
      {content}
    </AuthContext.Provider>
  );
};

export default App;
