export type ComparisonOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

export type ValueUnit = '' | 'k' | 'm' | 'b' | '%' | '$' | 'sec' | 'min' | 'hour' | 'day';

export type ValueType = 'number' | 'percent' | 'dollars' | 'time';

export interface Person {
  id: string;
  name: string;
  email: string;
}

export interface Target {
  value: number;
  unit: ValueUnit;
  operator: ComparisonOperator;
}

export interface Metric {
  id?: string;  // Made optional for new metrics being created
  name: string;
  target: Target;
  owner: Person;
  displayOrder?: number;
  valueType?: ValueType; // Added to support different types of metrics
}

export interface WeeklyValue {
  metricId: string; // This must be a valid ID
  weekId: string;   // This must be a valid ID
  value: number;
  unit: ValueUnit;
}

export interface Week {
  id: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  name: string; // e.g., "Week 12"
}

export interface MetricStatus {
  metric: Metric;
  weeklyValue: WeeklyValue;
  isOnTarget: boolean;
}