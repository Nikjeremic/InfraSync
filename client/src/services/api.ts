import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  
  register: (userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => api.post('/auth/register', userData),
  
  getCurrentUser: () => api.get('/auth/me'),
  
  updateProfile: (userData: any) => api.put('/auth/profile', userData),
  
  changePassword: (passwords: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/change-password', passwords),
};

// Companies API
export const companiesAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
    isActive?: boolean;
  }) => api.get('/companies', { params }),
  
  getById: (id: string) => api.get(`/companies/${id}`),
  
  create: (companyData: {
    name: string;
    description?: string;
    industry?: string;
    website?: string;
    email?: string;
    phone?: string;
    address?: any;
    primaryColor?: string;
    secondaryColor?: string;
    subscription?: any;
  }) => api.post('/companies', companyData),
  
  update: (id: string, companyData: any) => api.put(`/companies/${id}`, companyData),
  
  delete: (id: string) => api.delete(`/companies/${id}`),
  
  activate: (id: string) => api.post(`/companies/${id}/activate`),
  
  deactivate: (id: string) => api.post(`/companies/${id}/deactivate`),
  
  upgradeSubscription: (id: string, data: {
    plan: string;
    duration: number;
    features?: string[];
  }) => api.post(`/companies/${id}/upgrade-subscription`, data),
  
  getStats: (id: string) => api.get(`/companies/${id}/stats`),
  
  getForTickets: () => api.get('/companies/for-tickets'),
};

// Users API
export const usersAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    isActive?: boolean;
  }) => api.get('/users', { params }),
  
  getAgents: () => api.get('/users/agents'),
  
  getById: (id: string) => api.get(`/users/${id}`),
  
  create: (userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
    company?: string;
    subscription?: string;
    permissions?: string[];
  }) => api.post('/users', userData),
  
  update: (id: string, userData: any) => api.put(`/users/${id}`, userData),
  
  delete: (id: string) => api.delete(`/users/${id}`),
  
  activate: (id: string) => api.post(`/users/${id}/activate`),
  
  deactivate: (id: string) => api.post(`/users/${id}/deactivate`),
  
  upgradeSubscription: (id: string, data: {
    plan: string;
    duration: number;
  }) => api.post(`/users/${id}/upgrade-subscription`, data),
  
  getStats: () => api.get('/users/stats'),
  
  getForTickets: () => api.get('/users/for-tickets'),
};

// Tickets API
export const ticketsAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    category?: string;
    assignee?: string;
    search?: string;
    company?: string;
  }) => {
    // Filter out empty string values
    const filteredParams = params ? Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== '' && value !== undefined && value !== null)
    ) : {};
    return api.get('/tickets', { params: filteredParams });
  },
  
  getById: (id: string) => api.get(`/tickets/${id}`),
  
  create: (ticketData: {
    title: string;
    description: string;
    priority: string;
    category: string;
    assignee?: string;
    company: string;
    estimatedTime?: number;
    dueDate?: string;
    tags?: string[];
    customFields?: any[];
  }) => api.post('/tickets', ticketData),
  
  update: (id: string, ticketData: any) => api.put(`/tickets/${id}`, ticketData),
  
  delete: (id: string) => api.delete(`/tickets/${id}`),
  
  // Time tracking
  addTimeEntry: (id: string, timeEntry: {
    description: string;
    startTime: string;
    endTime?: string;
    duration?: number;
  }) => api.post(`/tickets/${id}/time-entries`, timeEntry),
  
  startTracking: (id: string, description: string) =>
    api.post(`/tickets/${id}/start-tracking`, { description }),
  
  stopTracking: (id: string) => api.post(`/tickets/${id}/stop-tracking`),
  
  // Escalation
  escalate: (id: string, data: {
    reason: string;
    escalatedTo: string;
  }) => api.post(`/tickets/${id}/escalate`, data),
  
  // Watching
  watch: (id: string) => api.post(`/tickets/${id}/watch`),
  
  unwatch: (id: string) => api.delete(`/tickets/${id}/watch`),
  
  // Internal notes
  addInternalNote: (id: string, content: string) =>
    api.post(`/tickets/${id}/internal-notes`, { content }),
  
  // Comments
  getComments: (id: string) => api.get(`/tickets/${id}/comments`),
  
  addComment: (id: string, content: string, isInternal?: boolean) =>
    api.post(`/tickets/${id}/comments`, { content, isInternal }),
  
  // Reopen requests
  getReopenRequests: (id: string) => api.get(`/tickets/${id}/reopen-requests`),
  
  getAllReopenRequests: () => api.get('/tickets/reopen-requests/all'),
  
  requestReopen: (id: string, reason: string) =>
    api.post(`/tickets/${id}/reopen-request`, { reason }),
  
  approveReopen: (id: string, requestId: string, reviewNote?: string) =>
    api.put(`/tickets/${id}/reopen-request/${requestId}/approve`, { reviewNote }),
  
  rejectReopen: (id: string, requestId: string, reviewNote?: string) =>
    api.put(`/tickets/${id}/reopen-request/${requestId}/reject`, { reviewNote }),
  
  approveReopenRequest: (requestId: string, reviewNote?: string) =>
    api.put(`/tickets/reopen-request/${requestId}/approve`, { reviewNote }),
  
  rejectReopenRequest: (requestId: string, reviewNote?: string) =>
    api.put(`/tickets/reopen-request/${requestId}/reject`, { reviewNote }),
  
  // Statistics
  getStats: (params?: { company?: string }) => api.get('/tickets/stats/overview', { params }),
};

// Analytics API
export const analyticsAPI = {
  getOverview: () => api.get('/analytics/overview'),
  
  getTrends: (params: {
    period: string;
    metric: string;
  }) => api.get('/analytics/trends', { params }),
  
  getPerformance: (params: {
    period: string;
    agentId?: string;
  }) => api.get('/analytics/performance', { params }),
  
  getCategoryAnalysis: (params: {
    period: string;
  }) => api.get('/analytics/category-analysis', { params }),
  
  exportData: (params: {
    type: string;
    period: string;
    format: string;
  }) => api.get('/analytics/export', { params }),
};

// Notifications API
export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
  
  delete: (id: string) => api.delete(`/notifications/${id}`),
  
  clearAll: () => api.delete('/notifications'),
};

// Comments API
export const commentsAPI = {
  getForTicket: (ticketId: string) => api.get(`/comments/ticket/${ticketId}`),
  
  create: (commentData: {
    ticketId: string;
    content: string;
    isInternal?: boolean;
    file?: File;
  }) => {
    // If file exists, send as multipart to tickets route for unified handling
    if (commentData.file) {
      const form = new FormData();
      form.append('content', commentData.content);
      form.append('isInternal', String(!!commentData.isInternal));
      form.append('file', commentData.file);
      return api.post(`/tickets/${commentData.ticketId}/comments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/comments', {
      ticketId: commentData.ticketId,
      content: commentData.content,
      isInternal: commentData.isInternal,
    });
  },
  
  update: (id: string, content: string) => api.put(`/comments/${id}`, { content }),
  
  delete: (id: string) => api.delete(`/comments/${id}`),
};

// Invoices API
export const invoicesAPI = {
  createForTicket: (data: { ticketId: string; rate: number; currency: string; taxPercent?: number; recipientEmail?: string; }) =>
    api.post('/invoices', data)
};

// Attachments API
export const attachmentsAPI = {
  upload: (ticketId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/tickets/${ticketId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
};

export default api; 