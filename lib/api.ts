/**
 * API Client for Client Success Tracker
 * Handles all HTTP requests to the backend with JWT authentication
 */

const API_BASE_URL = '/api';

// Token management
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (token) {
    localStorage.setItem('cst_token', token);
  } else {
    localStorage.removeItem('cst_token');
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem('cst_token');
  }
  return authToken;
}

export function clearAuthToken(): void {
  authToken = null;
  localStorage.removeItem('cst_token');
}

// API Error class
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Generic fetch wrapper
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 - clear token and redirect to login
  if (response.status === 401) {
    clearAuthToken();
    window.location.href = '/';
    throw new ApiError(401, 'Session expired');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error || 'Request failed',
      data.details
    );
  }

  return data;
}

// ============================================
// AUTH API
// ============================================

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'COACH';
    avatar: string | null;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'COACH';
  avatar: string | null;
  createdAt?: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(response.token);
    return response;
  },

  logout: async (): Promise<void> => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      clearAuthToken();
    }
  },

  me: async (): Promise<{ user: User }> => {
    return request('/auth/me');
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};

// ============================================
// CLIENTS API
// ============================================

export interface Client {
  id: string;
  name: string;
  email: string;
  timezone: string;
  status: 'ONBOARDING' | 'ACTIVE' | 'AT_RISK' | 'COMPLETED' | 'PAUSED';
  riskReason: string | null;
  onboardingStatus: 'NOT_BOOKED' | 'BOOKED' | 'COMPLETED' | 'NO_SHOW';
  onboardingDateTime: string | null;
  lastContactDate: string | null;
  nextActionDate: string | null;
  createdAt: string;
  coach: { id: string; name: string; avatar?: string };
  tags: string[];
  noteCount?: number;
  outcomes: {
    hasReview: boolean;
    hasReferral: boolean;
    isInnerCircle: boolean;
  };
  currentStepIndex: number;
  totalSteps: number;
}

export interface ClientDetail extends Client {
  notes: Note[];
  outcome: Outcome | null;
  curriculum: CurriculumProgress[];
  customFields: CustomField[];
  appointments: Appointment[];
}

export interface Note {
  id: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  nextActionAt: string | null;
  createdAt: string;
  author: { id: string; name: string; avatar?: string };
}

export interface Outcome {
  reviewStatus: string;
  reviewDone: boolean;
  endorsementStatus: string;
  endorsementCount: number;
  endorsementDone: boolean;
  innerCircleStatus: string;
  innerCircleDone: boolean;
}

export interface CurriculumProgress {
  id: string;
  order: number;
  title: string;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface CustomField {
  id: string;
  name: string;
  type: string;
  value: string;
}

export interface Appointment {
  id: string;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
}

export interface ClientsListResponse {
  clients: Client[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ClientFilters {
  page?: number;
  limit?: number;
  status?: string;
  onboardingStatus?: string;
  coachId?: string;
  search?: string;
  atRiskOnly?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const clientsApi = {
  list: async (filters: ClientFilters = {}): Promise<ClientsListResponse> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    return request(`/clients?${params.toString()}`);
  },

  get: async (id: string): Promise<{ client: ClientDetail }> => {
    return request(`/clients/${id}`);
  },

  create: async (data: Partial<Client>): Promise<{ client: Client }> => {
    return request('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: Partial<Client>): Promise<{ client: Client }> => {
    return request(`/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    await request(`/clients/${id}`, { method: 'DELETE' });
  },
};

// ============================================
// NOTES API
// ============================================

export interface CreateNoteData {
  content: string;
  tags?: string[];
  isPinned?: boolean;
  nextActionAt?: string;
}

export const notesApi = {
  list: async (clientId: string): Promise<{ notes: Note[] }> => {
    return request(`/clients/${clientId}/notes`);
  },

  create: async (clientId: string, data: CreateNoteData): Promise<{ note: Note }> => {
    return request(`/clients/${clientId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (
    clientId: string,
    noteId: string,
    data: Partial<CreateNoteData>
  ): Promise<{ note: Note }> => {
    return request(`/clients/${clientId}/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (clientId: string, noteId: string): Promise<void> => {
    await request(`/clients/${clientId}/notes/${noteId}`, { method: 'DELETE' });
  },
};

// ============================================
// CURRICULUM API
// ============================================

export interface CurriculumStep {
  id: string;
  order: number;
  title: string;
}

export const curriculumApi = {
  list: async (): Promise<{ steps: CurriculumStep[] }> => {
    return request('/curriculum');
  },

  getProgress: async (clientId: string): Promise<{ progress: CurriculumProgress[] }> => {
    return request(`/curriculum/clients/${clientId}/progress`);
  },

  updateProgress: async (
    clientId: string,
    stepId: string,
    isCompleted: boolean
  ): Promise<{ progress: CurriculumProgress }> => {
    return request(`/curriculum/clients/${clientId}/progress/${stepId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isCompleted }),
    });
  },
};

// ============================================
// OUTCOMES API
// ============================================

export const outcomesApi = {
  get: async (clientId: string): Promise<{ outcome: Outcome }> => {
    return request(`/curriculum/clients/${clientId}/outcomes`);
  },

  update: async (clientId: string, data: Partial<Outcome>): Promise<{ outcome: Outcome }> => {
    return request(`/curriculum/clients/${clientId}/outcomes`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ============================================
// USERS API (Admin only)
// ============================================

export interface UserWithStats extends User {
  isActive: boolean;
  clientCount: number;
}

export const usersApi = {
  list: async (): Promise<{ users: UserWithStats[] }> => {
    return request('/users');
  },

  get: async (id: string): Promise<{ user: UserWithStats }> => {
    return request(`/users/${id}`);
  },

  create: async (data: {
    email: string;
    password: string;
    name: string;
    role: 'ADMIN' | 'COACH';
  }): Promise<{ user: User }> => {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: Partial<User & { isActive: boolean }>): Promise<{ user: User }> => {
    return request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    await request(`/users/${id}`, { method: 'DELETE' });
  },

  resetPassword: async (id: string, newPassword: string): Promise<void> => {
    await request(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },
};

// ============================================
// ADMIN API
// ============================================

export interface DashboardStats {
  summary: {
    totalClients: number;
    atRiskClients: number;
    onboardingClients: number;
    activeClients: number;
    completedClients: number;
    notBookedOnboarding: number;
    noShowOnboarding: number;
    recentContacts: number;
  };
  coaches: Array<{
    id: string;
    name: string;
    totalClients: number;
    atRiskCount: number;
    staleCount: number;
  }>;
  generatedAt: string;
}

export const adminApi = {
  getStats: async (): Promise<DashboardStats> => {
    return request('/admin/stats');
  },

  getAtRiskClients: async (): Promise<{ clients: Client[] }> => {
    return request('/admin/at-risk');
  },

  sendHeartbeat: async (): Promise<{ message: string }> => {
    return request('/admin/heartbeat/send', { method: 'POST' });
  },

  syncGHL: async (): Promise<{ message: string; contactsFound: number; clientsUpdated: number }> => {
    return request('/admin/ghl/sync', { method: 'POST' });
  },

  getAuditLogs: async (params?: { action?: string; userId?: string; limit?: number }): Promise<{ logs: any[]; total: number }> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    return request(`/admin/audit-logs?${searchParams.toString()}`);
  },
};

// ============================================
// EXPORT API
// ============================================

export const exportApi = {
  exportClients: async (format: 'csv' | 'json' = 'csv'): Promise<Blob | Client[]> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/export/clients?format=${format}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(response.status, error.error);
    }

    if (format === 'csv') {
      return response.blob();
    }
    const data = await response.json();
    return data.clients;
  },

  exportNotes: async (format: 'csv' | 'json' = 'csv'): Promise<Blob | Note[]> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/export/notes?format=${format}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(response.status, error.error);
    }

    if (format === 'csv') {
      return response.blob();
    }
    const data = await response.json();
    return data.notes;
  },

  downloadFile: (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
