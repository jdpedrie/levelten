import React, { useRef, useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { Metric, Week, WeeklyValue, Person, ComparisonOperator, ValueUnit, Target } from '../models/types';
import { formatDateRange } from '../models/utils';
import MetricRow from './MetricRow';
import NewMetricRow from './NewMetricRow';
import { reorderMetricsApi } from '../services/apiClient';

interface ScorecardProps {
  metrics: Metric[];
  weeks: Week[];
  weeklyValues: WeeklyValue[];
  people: Person[];
  onUpdateWeeklyValue?: (value: WeeklyValue) => Promise<void>;
  onSaveMetric?: (metric: Metric) => Promise<void>;
  onDeleteMetric?: (metric: Metric) => Promise<void>;
}

const ScorecardContainer = styled.div`
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin: 20px 0;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

// ScorecardHeader was removed

const ScorecardFooter = styled.div`
  display: flex;
  justify-content: flex-start;
  padding: 16px;
  border-top: 1px solid #eee;
`;

const GridContainer = styled.div`
  overflow-x: auto;
  display: flex;
  flex-direction: column;
`;

const HeaderRow = styled.div`
  display: flex;
  background-color: #f5f5f5;
  border-bottom: 2px solid #ddd;
  font-weight: 600;
  min-width: max-content;
  height: 38px; /* Make header more compact */
`;

const HeaderCell = styled.div`
  padding: 4px 5px;
  width: 80px;
  flex-shrink: 0;
  text-align: center;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MetricHeaderCell = styled(HeaderCell)`
  position: sticky;
  left: 0;
  z-index: 2;
  background-color: #f5f5f5;
  width: 180px;
  text-align: left;
  padding-left: 28px; /* Match the padding-left of MetricCell in MetricRow to account for drag handle */
  font-size: 0.85rem;
  justify-content: flex-start;
`;

const GoalHeaderCell = styled(HeaderCell)`
  position: sticky;
  left: 180px;
  z-index: 2;
  background-color: #f5f5f5;
  width: 80px; /* Match the width of GoalCell in MetricRow */
  padding-left: 0;
  padding-right: 0;
`;

const DateHeader = styled(HeaderCell)<{ $isLatestWeek?: boolean }>`
  font-weight: ${props => props.$isLatestWeek ? '700' : '600'};
  ${props => props.$isLatestWeek && `
    border-bottom: 3px solid #0066cc;
  `}
`;

const AddButton = styled.button`
  padding: 4px 8px;
  background-color: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-left: 10px;

  &:hover {
    background-color: #0052a3;
  }
`;

const Scorecard: React.FC<ScorecardProps> = ({
  metrics,
  weeks,
  weeklyValues,
  people,
  onUpdateWeeklyValue = async () => {},
  onSaveMetric = async () => {},
  onDeleteMetric = async () => {}
}) => {
  // Use a flag to detect if this component is still mounted
  const isMounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  const gridRef = useRef<HTMLDivElement>(null);

  // State for tracking metrics and their order
  const [orderedMetrics, setOrderedMetrics] = useState<Metric[]>([]);

  // Update ordered metrics when the metrics prop changes
  useEffect(() => {
    setOrderedMetrics([...metrics]);
  }, [metrics]);

  // Find the index of the latest week
  let latestWeekIndex = -1;
  if (weeks.length > 0) {
    const latestDate = new Date(Math.max(...weeks.map(week => new Date(week.startDate).getTime())));
    latestWeekIndex = weeks.findIndex(week => new Date(week.startDate).getTime() === latestDate.getTime());
  }

  // Scroll to the latest week on initial render
  useEffect(() => {
    if (gridRef.current && latestWeekIndex >= 0) {
      // Calculate scroll position:
      // - Fixed columns width (180px + 80px)
      // - Plus some previous weeks to provide context
      const previousWeeksToShow = Math.min(3, latestWeekIndex);
      const scrollPosition = 260 + (latestWeekIndex - previousWeeksToShow) * 80;

      gridRef.current.scrollLeft = scrollPosition;
    }
  }, [latestWeekIndex]);

  // Filter out incomplete weeks (current or future weeks)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Only include weeks that have fully completed (end date is in the past)
  const completedWeeks = weeks.filter(week => {
    const endDate = new Date(week.endDate);
    return endDate < today;
  });

  // Sort weeks chronologically
  const sortedWeeks = [...completedWeeks].sort((a, b) =>
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  // State for the add metric UI flow
  const [showNewMetricRow, setShowNewMetricRow] = useState(false);

  const handleAddNewMetric = () => {
    setShowNewMetricRow(true);
  };

  // Move a metric up in the order
  const handleMoveUp = useCallback(async (index: number) => {
    if (index <= 0 || index >= orderedMetrics.length) return;

    // Create a copy of the current metrics array
    const updatedMetrics = [...orderedMetrics];

    // Swap the metric with the one above it
    const temp = updatedMetrics[index];
    updatedMetrics[index] = updatedMetrics[index - 1];
    updatedMetrics[index - 1] = temp;

    // Update local state
    setOrderedMetrics(updatedMetrics);

    try {
      // Save the new order to the server
      await reorderMetricsApi(updatedMetrics);
    } catch (error) {
      console.error('Error saving metric order:', error);
      // Revert to original order if save fails
      if (isMounted.current) {
        setOrderedMetrics([...orderedMetrics]);
      }
    }
  }, [orderedMetrics, isMounted]);

  // Move a metric down in the order
  const handleMoveDown = useCallback(async (index: number) => {
    if (index < 0 || index >= orderedMetrics.length - 1) return;

    // Create a copy of the current metrics array
    const updatedMetrics = [...orderedMetrics];

    // Swap the metric with the one below it
    const temp = updatedMetrics[index];
    updatedMetrics[index] = updatedMetrics[index + 1];
    updatedMetrics[index + 1] = temp;

    // Update local state
    setOrderedMetrics(updatedMetrics);

    try {
      // Save the new order to the server
      await reorderMetricsApi(updatedMetrics);
    } catch (error) {
      console.error('Error saving metric order:', error);
      // Revert to original order if save fails
      if (isMounted.current) {
        setOrderedMetrics([...orderedMetrics]);
      }
    }
  }, [orderedMetrics, isMounted]);

  // Render a single metric row with move up/down handlers
  const renderMetricRow = (metric: Metric, index: number) => {
    return (
      <MetricRow
        key={metric.id || `temp-${index}`}
        metric={metric}
        weeks={sortedWeeks}
        weeklyValues={weeklyValues}
        onUpdateWeeklyValue={onUpdateWeeklyValue}
        people={people}
        onSaveMetric={onSaveMetric}
        onDeleteMetric={onDeleteMetric}
        index={index}
        onMoveUp={() => handleMoveUp(index)}
        onMoveDown={() => handleMoveDown(index)}
      />
    );
  };

  return (
    <ScorecardContainer>
      <GridContainer ref={gridRef}>
        <HeaderRow>
          <MetricHeaderCell>Metric</MetricHeaderCell>
          <GoalHeaderCell>Goal</GoalHeaderCell>
          {sortedWeeks.map((week, index) => (
            <DateHeader
              key={week.id}
              $isLatestWeek={index === latestWeekIndex}
            >
              {formatDateRange(week)}
            </DateHeader>
          ))}
        </HeaderRow>

        <div>
          {orderedMetrics.map((metric, index) =>
            renderMetricRow(metric, index)
          )}
        </div>

        {/* New metric row at the bottom */}
        {showNewMetricRow && (
          <NewMetricRow
            people={people}
            onSave={async (newMetric) => {
              try {
                await onSaveMetric(newMetric);
                setShowNewMetricRow(false);
              } catch (error) {
                console.error('Error saving new metric:', error);
                alert('Failed to save metric. Please try again.');
              }
            }}
            onCancel={() => setShowNewMetricRow(false)}
          />
        )}
      </GridContainer>

      {!showNewMetricRow && (
        <ScorecardFooter>
          <AddButton onClick={handleAddNewMetric}>+ Add Metric</AddButton>
        </ScorecardFooter>
      )}
    </ScorecardContainer>
  );
};

export default Scorecard;
