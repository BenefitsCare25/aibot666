/**
 * Authentication Context
 * Manages global authentication state and session timeout
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { login as loginAPI, logout as logoutAPI, getCurrentUser } from '../api/auth';

const AuthContext = createContext(null);

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before timeout
const ACTIVITY_THROTTLE = 1000; // Throttle activity tracking to once per second

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const timeoutWarningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const activityThrottleRef = useRef(null);

  /**
   * Update last activity timestamp and reset timers
   */
  const updateActivity = useCallback(() => {
    const now = Date.now();

    // Throttle activity updates
    if (activityThrottleRef.current && now - activityThrottleRef.current < ACTIVITY_THROTTLE) {
      return;
    }

    activityThrottleRef.current = now;
    lastActivityRef.current = now;
    setShowTimeoutWarning(false);

    // Clear existing timers
    if (timeoutWarningTimerRef.current) {
      clearTimeout(timeoutWarningTimerRef.current);
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }

    // Set warning timer (show warning 2 min before logout)
    timeoutWarningTimerRef.current = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, SESSION_TIMEOUT - WARNING_TIME);

    // Set logout timer
    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
    }, SESSION_TIMEOUT);
  }, []);

  /**
   * Track user activity events
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    // Initial activity update
    updateActivity();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });

      if (timeoutWarningTimerRef.current) {
        clearTimeout(timeoutWarningTimerRef.current);
      }
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
    };
  }, [isAuthenticated, updateActivity]);

  /**
   * Login user
   */
  const handleLogin = async (username, password) => {
    try {
      const response = await loginAPI(username, password);

      if (response.success && response.user) {
        setUser(response.user);
        setIsAuthenticated(true);

        // Store token and user info
        if (response.token) {
          localStorage.setItem('adminToken', response.token);
        }
        localStorage.setItem('adminUser', JSON.stringify(response.user));

        // Start activity tracking
        updateActivity();

        return { success: true };
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  };

  /**
   * Logout user
   */
  const handleLogout = async () => {
    try {
      await logoutAPI();
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear state and storage
      setUser(null);
      setIsAuthenticated(false);
      setShowTimeoutWarning(false);
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');

      // Clear timers
      if (timeoutWarningTimerRef.current) {
        clearTimeout(timeoutWarningTimerRef.current);
      }
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }

      // Redirect to login
      window.location.href = '/login';
    }
  };

  /**
   * Extend session (user dismissed timeout warning)
   */
  const extendSession = useCallback(() => {
    updateActivity();
  }, [updateActivity]);

  /**
   * Check authentication status on mount
   */
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('adminToken');
      const savedUser = localStorage.getItem('adminUser');

      if (!token || !savedUser) {
        setIsLoading(false);
        return;
      }

      try {
        // Verify token is still valid
        const response = await getCurrentUser();

        if (response.success && response.user) {
          setUser(response.user);
          setIsAuthenticated(true);
          updateActivity();
        } else {
          // Invalid session
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [updateActivity]);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    showTimeoutWarning,
    login: handleLogin,
    logout: handleLogout,
    extendSession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use authentication context
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export default AuthContext;
