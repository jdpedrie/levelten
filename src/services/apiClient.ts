import { Metric, Person, Week, WeeklyValue } from '../models/types';
import io from 'socket.io-client';

// API base URL
const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'  // In production, API is on same server
  : (process.env.REACT_APP_API_URL || 'http://localhost:3001/api'); // In dev

// Database status interface
export interface DatabaseStatus {
  initialized: boolean;
}

// Socket.io instance for real-time updates
let socket: any = null;

// Connect to socket.io server
export const connectSocket = (onUpdate: () => void) => {
  if (socket) return;

  socket = process.env.NODE_ENV === 'production'
  ? io()
  : io(process.env.REACT_APP_API_URL || 'http://localhost:3001');

  // Event listeners for real-time updates
  socket.on('connect', () => {
    console.log('Connected to server socket:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server socket');
  });

  // Person events
  socket.on('person_created', () => {
    console.log('Person created event received');
    onUpdate();
  });

  socket.on('person_updated', () => {
    console.log('Person updated event received');
    onUpdate();
  });

  socket.on('person_deleted', () => {
    console.log('Person deleted event received');
    onUpdate();
  });

  // Metric events
  socket.on('metric_created', () => {
    console.log('Metric created event received');
    onUpdate();
  });

  socket.on('metric_updated', () => {
    console.log('Metric updated event received');
    onUpdate();
  });

  socket.on('metric_deleted', () => {
    console.log('Metric deleted event received');
    onUpdate();
  });

  // Weekly value events
  socket.on('weekly_value_created', () => {
    console.log('Weekly value created event received');
    onUpdate();
  });

  socket.on('weekly_value_updated', () => {
    console.log('Weekly value updated event received');
    onUpdate();
  });

  // Week events
  socket.on('weeks_updated', () => {
    console.log('Weeks updated event received');
    onUpdate();
  });

  return () => {
    // Clean up socket connection
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  };
};

// Generic fetch helper with error handling
const fetchApi = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  try {
    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error for ${url}:`, error);
    throw error;
  }
};

// People API
export const getPeopleApi = async (): Promise<Person[]> => {
  return fetchApi<Person[]>('/people');
};

export const getPersonApi = async (id: string): Promise<Person> => {
  return fetchApi<Person>(`/people/${id}`);
};

export const savePersonApi = async (person: Person): Promise<Person> => {
  // Use PUT only if the person has a server-assigned ID
  // New persons created on client have temporary IDs
  const hasServerProvidedId = Boolean(person.id && !person.id.includes('person-'));

  if (hasServerProvidedId) {
    return fetchApi<Person>(`/people/${person.id}`, {
      method: 'PUT',
      body: JSON.stringify(person)
    });
  } else {
    // For new people, omit the id and let the server generate one
    const { id, ...personData } = person;
    return fetchApi<Person>('/people', {
      method: 'POST',
      body: JSON.stringify(personData)
    });
  }
};

export const deletePersonApi = async (id: string): Promise<boolean> => {
  try {
    await fetchApi<{id: string, deleted: boolean}>(`/people/${id}`, {
      method: 'DELETE'
    });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('own metrics')) {
      return false;
    }
    throw error;
  }
};

// Metrics API
export const getMetricsApi = async (): Promise<Metric[]> => {
  return fetchApi<Metric[]>('/metrics');
};

export const saveMetricApi = async (metric: Metric): Promise<Metric> => {
  const isUpdate = Boolean(metric.id);

  if (isUpdate) {
    return fetchApi<Metric>(`/metrics/${metric.id}`, {
      method: 'PUT',
      body: JSON.stringify(metric)
    });
  } else {
    // For new metrics, id should not be present at all
    return fetchApi<Metric>('/metrics', {
      method: 'POST',
      body: JSON.stringify(metric)
    });
  }
};

export const reorderMetricsApi = async (metrics: Metric[]): Promise<{message: string}> => {
  return fetchApi<{message: string}>('/metrics/reorder', {
    method: 'POST',
    body: JSON.stringify({ metrics })
  });
};

export const deleteMetricApi = async (id: string): Promise<boolean> => {
  if (!id) {
    throw new Error('Cannot delete metric without an ID');
  }

  await fetchApi<{id: string, deleted: boolean}>(`/metrics/${id}`, {
    method: 'DELETE'
  });
  return true;
};

// Weeks API
export const getWeeksApi = async (): Promise<Week[]> => {
  return fetchApi<Week[]>('/weeks');
};

export const updateWeeksApi = async (): Promise<{message: string, newWeeks: Week[]}> => {
  return fetchApi<{message: string, newWeeks: Week[]}>('/weeks/update', {
    method: 'POST'
  });
};

// Weekly Values API
export const getWeeklyValuesApi = async (): Promise<WeeklyValue[]> => {
  return fetchApi<WeeklyValue[]>('/weekly-values');
};

export const saveWeeklyValueApi = async (value: WeeklyValue): Promise<WeeklyValue> => {
  return fetchApi<WeeklyValue>('/weekly-values', {
    method: 'POST',
    body: JSON.stringify(value)
  });
};

// Database status and initialization APIs
export const getDatabaseStatusApi = async (): Promise<DatabaseStatus> => {
  return fetchApi<DatabaseStatus>('/status');
};

export const initializeSampleDataApi = async (): Promise<{success: boolean, message: string}> => {
  return fetchApi<{success: boolean, message: string}>('/initialize/sample', {
    method: 'POST'
  });
};

export const initializeEosDataApi = async (data: any): Promise<{success: boolean, message: string}> => {
  return fetchApi<{success: boolean, message: string}>('/initialize/eos', {
    method: 'POST',
    body: JSON.stringify({ data })
  });
};
