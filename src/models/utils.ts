import { Target, WeeklyValue, ComparisonOperator, ValueUnit, Week, ValueType, Metric } from './types';

// Helper function to format numbers with thousand separators and appropriate decimal places
export function formatNumber(num: number, forceDecimals = false): string {
  if (Number.isInteger(num) && !forceDecimals) {
    // For whole numbers, no decimal places
    return new Intl.NumberFormat().format(num);
  } else {
    // For decimals or when forcing decimal places
    return new Intl.NumberFormat(undefined, { 
      minimumFractionDigits: forceDecimals ? 2 : 0,
      maximumFractionDigits: 2
    }).format(num);
  }
}

export function formatValue(value: number, unit: ValueUnit, valueType?: ValueType): string {
  // Handle special formatting based on value type
  if (valueType) {
    switch (valueType) {
      case 'dollars':
        // Format as currency with dollar sign only at beginning and always 2 decimal places for non-whole numbers
        // Format: $X.XX or $X for whole numbers
        return `$${formatNumber(value, !Number.isInteger(value))}`;
      case 'percent':
        // Format as percentage
        return `${formatNumber(value)}%`;
      case 'time':
        // Format as time duration
        return formatTimeValue(value, unit);
      default:
        break;
    }
  }
  
  // Default formatting - use standard number format
  const formattedNumber = formatNumber(value);
  
  // Default formatting
  return `${formattedNumber}${unit}`;
}

// Format time values with appropriate units
function formatTimeValue(value: number, unit: ValueUnit): string {
  const formattedNumber = formatNumber(value);
  
  switch (unit) {
    case 'sec':
      return `${formattedNumber} sec`;
    case 'min':
      return `${formattedNumber} min`;
    case 'hour':
      return `${formattedNumber} hr${value !== 1 ? 's' : ''}`;
    case 'day':
      return `${formattedNumber} day${value !== 1 ? 's' : ''}`;
    default:
      return `${formattedNumber}`;
  }
}

// Convert a value with a unit to its raw number value
export function normalizeValue(value: number, unit: ValueUnit): number {
  switch (unit) {
    case 'k':
      return value * 1000;
    case 'm':
      return value * 1000000;
    case 'b':
      return value * 1000000000;
    case '%':
      return value / 100; // Convert percent to decimal
    case '$':
      return value; // Dollar amount as is
    case 'sec':
      return value; // Seconds as is
    case 'min':
      return value * 60; // Convert minutes to seconds
    case 'hour':
      return value * 3600; // Convert hours to seconds
    case 'day':
      return value * 86400; // Convert days to seconds
    default:
      return value;
  }
}

// Compare a weekly value against its target
export function isOnTarget(weeklyValue: WeeklyValue, target: Target): boolean {
  const normalizedActual = normalizeValue(weeklyValue.value, weeklyValue.unit);
  const normalizedTarget = normalizeValue(target.value, target.unit);
  
  switch (target.operator) {
    case 'gt':
      return normalizedActual > normalizedTarget;
    case 'lt':
      return normalizedActual < normalizedTarget;
    case 'gte':
      return normalizedActual >= normalizedTarget;
    case 'lte':
      return normalizedActual <= normalizedTarget;
    case 'eq':
      return normalizedActual === normalizedTarget;
    default:
      return false;
  }
}

// Format the comparison operator to human-readable text
export function formatOperator(operator: ComparisonOperator): string {
  switch (operator) {
    case 'gt':
      return 'greater than';
    case 'lt':
      return 'less than';
    case 'gte':
      return 'greater than or equal to';
    case 'lte':
      return 'less than or equal to';
    case 'eq':
      return 'equal to';
    default:
      return '';
  }
}

// Format date range for week headers
export function formatDateRange(week: Week): string {
  const startDate = new Date(week.startDate);
  const endDate = new Date(week.endDate);
  
  const formatDate = (date: Date) => {
    const month = date.getMonth() + 1; // 1-12
    const day = date.getDate();
    return `${month}/${day}`;
  };
  
  return `${formatDate(startDate)}-${formatDate(endDate)}`;
}

// Format target value with operator
export function formatGoal(target: Target, valueType?: ValueType): string {
  const value = formatValue(target.value, target.unit, valueType);
  
  switch (target.operator) {
    case 'gt':
      return `>${value}`;
    case 'lt':
      return `<${value}`;
    case 'gte':
      return `≥${value}`;
    case 'lte':
      return `≤${value}`;
    case 'eq':
      return `=${value}`;
    default:
      return value;
  }
}