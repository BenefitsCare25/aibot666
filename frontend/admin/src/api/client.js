import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 30000,
  withCredentials: true, // Enable cookies for authentication
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available (from localStorage as backup)
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add company domain header for multi-tenant support
    const selectedCompany = localStorage.getItem('selected_company_domain');
    if (selectedCompany) {
      config.headers['X-Widget-Domain'] = selectedCompany;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - redirect to login
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Clear auth data
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');

      // Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }

      return Promise.reject(error);
    }

    // Handle other errors
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

/**
 * Download a file from an API endpoint
 * Bypasses the response interceptor that unwraps response.data
 * @param {string} url - API endpoint path
 * @param {string} filename - Download filename
 * @param {string} mimeType - MIME type for the blob
 */
export async function downloadFile(url, filename, mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  const response = await axios.get(
    `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${url}`,
    {
      responseType: 'blob',
      headers: {
        'Authorization': localStorage.getItem('adminToken') ? `Bearer ${localStorage.getItem('adminToken')}` : '',
        'X-Widget-Domain': localStorage.getItem('selected_company_domain') || ''
      }
    }
  );

  const blob = new Blob([response.data], { type: mimeType });
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(blobUrl);
  document.body.removeChild(a);
}

export default apiClient;
