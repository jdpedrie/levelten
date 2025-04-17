import { Metric, Person, Week, WeeklyValue } from '../models/types';

// Local storage keys
const METRICS_KEY = 'scorecard_metrics';
const PEOPLE_KEY = 'scorecard_people';
const WEEKS_KEY = 'scorecard_weeks';
const VALUES_KEY = 'scorecard_values';

// Get data from local storage
export const getMetrics = (): Metric[] => {
  const data = localStorage.getItem(METRICS_KEY);
  return data ? JSON.parse(data) : [];
};

export const getPeople = (): Person[] => {
  const data = localStorage.getItem(PEOPLE_KEY);
  return data ? JSON.parse(data) : [];
};

export const getWeeks = (): Week[] => {
  const data = localStorage.getItem(WEEKS_KEY);
  return data ? JSON.parse(data) : [];
};

export const getWeeklyValues = (): WeeklyValue[] => {
  const data = localStorage.getItem(VALUES_KEY);
  return data ? JSON.parse(data) : [];
};

// Save data to local storage
export const saveMetric = (metric: Metric): void => {
  const metrics = getMetrics();
  const index = metrics.findIndex(m => m.id === metric.id);
  
  if (index >= 0) {
    metrics[index] = metric;
  } else {
    metrics.push(metric);
  }
  
  localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
};

export const savePerson = (person: Person): void => {
  const people = getPeople();
  const index = people.findIndex(p => p.id === person.id);
  
  if (index >= 0) {
    people[index] = person;
  } else {
    people.push(person);
  }
  
  localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
};

export const saveWeek = (week: Week): void => {
  const weeks = getWeeks();
  const index = weeks.findIndex(w => w.id === week.id);
  
  if (index >= 0) {
    weeks[index] = week;
  } else {
    weeks.push(week);
  }
  
  localStorage.setItem(WEEKS_KEY, JSON.stringify(weeks));
};

export const saveWeeklyValues = (values: WeeklyValue[]): void => {
  if (!values.length) return;
  
  const allValues = getWeeklyValues();
  
  // For each value in the array, update if exists or add if new
  values.forEach(newValue => {
    const index = allValues.findIndex(
      v => v.metricId === newValue.metricId && v.weekId === newValue.weekId
    );
    
    if (index >= 0) {
      allValues[index] = newValue;
    } else {
      allValues.push(newValue);
    }
  });
  
  localStorage.setItem(VALUES_KEY, JSON.stringify(allValues));
};

// Delete operations
export const deleteMetric = (id: string): void => {
  const metrics = getMetrics().filter(m => m.id !== id);
  localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
  
  // Also delete related weekly values
  const values = getWeeklyValues().filter(v => v.metricId !== id);
  localStorage.setItem(VALUES_KEY, JSON.stringify(values));
};

// Check if a person can be safely deleted (has no metrics assigned)
export const canDeletePerson = (id: string): boolean => {
  const metrics = getMetrics();
  // Return true if no metrics are owned by this person
  return !metrics.some(metric => metric.owner.id === id);
};

// Get metrics owned by a person
export const getMetricsOwnedByPerson = (id: string): Metric[] => {
  const metrics = getMetrics();
  return metrics.filter(metric => metric.owner.id === id);
};

// Count metrics owned by a person
export const countMetricsOwnedByPerson = (id: string): number => {
  return getMetricsOwnedByPerson(id).length;
};

export const deletePerson = (id: string): boolean => {
  console.log('deletePerson called with id:', id);
  
  // First check if the person can be deleted
  if (!canDeletePerson(id)) {
    console.log('Cannot delete person - they still own metrics');
    return false;
  }
  
  // Delete the person
  const people = getPeople();
  console.log('Current people before delete:', people);
  
  const filteredPeople = people.filter(p => p.id !== id);
  console.log('Filtered people after delete:', filteredPeople);
  
  localStorage.setItem(PEOPLE_KEY, JSON.stringify(filteredPeople));
  console.log('Saved people to localStorage');
  
  return true;
};

export const deleteWeek = (id: string): void => {
  const weeks = getWeeks().filter(w => w.id !== id);
  localStorage.setItem(WEEKS_KEY, JSON.stringify(weeks));
  
  // Also delete related weekly values
  const values = getWeeklyValues().filter(v => v.weekId !== id);
  localStorage.setItem(VALUES_KEY, JSON.stringify(values));
};

// Helper to create a new week
export const createWeek = (name: string, startDate: Date): Week => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6); // End date is start date + 6 days
  
  const week: Week = {
    id: `week-${Date.now()}`,
    name,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
  
  saveWeek(week);
  return week;
};

// Initialize with sample data if empty
export const initializeWithSampleData = (): void => {
  if (getPeople().length > 0) return; // Don't initialize if data exists
  
  // Sample people
  const people: Person[] = [
    { id: 'person-1', name: 'Alice Smith', email: 'alice@example.com' },
    { id: 'person-2', name: 'Bob Johnson', email: 'bob@example.com' },
    { id: 'person-3', name: 'Carol Williams', email: 'carol@example.com' }
  ];
  
  // Sample metrics
  const metrics: Metric[] = [
    {
      id: 'metric-1',
      name: 'New Customers',
      target: { value: 100, unit: '', operator: 'gte' },
      owner: people[0]
    },
    {
      id: 'metric-2',
      name: 'Revenue',
      target: { value: 1, unit: 'm', operator: 'gte' },
      owner: people[1]
    },
    {
      id: 'metric-3',
      name: 'Support Tickets',
      target: { value: 50, unit: '', operator: 'lte' },
      owner: people[2]
    }
  ];
  
  // Sample weeks - start on Mondays
  const now = new Date();
  const weeks: Week[] = [];
  
  // Find the most recent completed Monday (previous week's Monday)
  const mostRecentCompletedMonday = new Date(now);
  // Go back to previous week's Monday
  mostRecentCompletedMonday.setDate(now.getDate() - 7 - (now.getDay() === 0 ? 6 : now.getDay() - 1));
  mostRecentCompletedMonday.setHours(0, 0, 0, 0);
  
  // Generate 12 weeks of data (all previous completed weeks)
  for (let i = 0; i < 12; i++) {
    const startDate = new Date(mostRecentCompletedMonday);
    startDate.setDate(startDate.getDate() - (i * 7)); // Previous weeks
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6); // Sunday
    
    // Only add completed weeks
    if (endDate < now) {
      weeks.push({
        id: `week-${i + 1}`,
        name: `Week ${i + 1}`, // We'll display formatted date ranges instead
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
    }
  }
  
  // Sample weekly values
  const weeklyValues: WeeklyValue[] = [];
  
  // Generate values for all metrics and weeks
  metrics.forEach(metric => {
    weeks.forEach((week, index) => {
      // Calculate the relative index for consistent data patterns
      // We need to do this because the number of weeks may vary
      const relativeIndex = weeks.length - 1 - index; // Newest week has highest index
      
      // Generate realistic looking data with some trends and variations
      let value: number;
      
      if (metric.id === 'metric-1') {
        // New Customers - generally around 100-130, trending up
        const base = 100 + relativeIndex * 2;  // Trend up for newer weeks
        const variation = Math.floor(Math.random() * 30) - 15; // +/- 15
        value = base + variation;
      } 
      else if (metric.id === 'metric-2') {
        // Revenue - around 1m, seasonal variations
        const base = 1.0;
        const seasonal = Math.sin((relativeIndex / 12) * Math.PI * 2) * 0.3; // Seasonal cycle
        const random = (Math.random() * 0.2) - 0.1; // +/- 0.1m
        value = base + seasonal + random;
        value = Math.max(0.8, Math.min(1.5, value)); // Keep between 0.8m and 1.5m
        value = parseFloat(value.toFixed(2)); // Two decimal places
      } 
      else {
        // Support Tickets - target is below 50, fluctuates
        const base = 35 + (Math.sin((relativeIndex / 6) * Math.PI) * 20); // Cycle with peak around 55
        const variation = Math.floor(Math.random() * 16) - 8; // +/- 8
        value = Math.max(20, Math.round(base + variation));
      }
      
      // Skip metrics with undefined IDs
      if (metric.id) {
        weeklyValues.push({
          metricId: metric.id,
          weekId: week.id,
          value: value,
          unit: metric.name === 'Revenue' ? 'm' : '' // Only revenue has 'm' unit
        });
      }
    });
  });
  
  // Save sample data
  localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
  localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
  localStorage.setItem(WEEKS_KEY, JSON.stringify(weeks));
  localStorage.setItem(VALUES_KEY, JSON.stringify(weeklyValues));
};
