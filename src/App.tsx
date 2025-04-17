import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { Metric, Person, Week, WeeklyValue } from './models/types';
import Scorecard from './components/Scorecard';
import PeopleManager from './components/PeopleManager';
import Segue from './components/Segue';
import DatabaseSetup from './components/DatabaseSetup';
import {
  getPeopleApi,
  getMetricsApi,
  getWeeksApi,
  getWeeklyValuesApi,
  saveMetricApi,
  savePersonApi,
  deleteMetricApi,
  deletePersonApi,
  saveWeeklyValueApi,
  updateWeeksApi,
  connectSocket,
  getDatabaseStatusApi
} from './services/apiClient';

const AppContainer = styled.div`
  width: 90%;
  margin: 0 auto;
  padding: 20px;
`;

const Header = styled.header`
  margin-bottom: 20px;
`;

const Title = styled.h1`
  color: #333;
  font-size: 28px;
`;

const TabBar = styled.div`
  display: flex;
  border-bottom: 1px solid #ddd;
  margin-bottom: 20px;
`;

const Tab = styled.div<{ $active: boolean }>`
  padding: 12px 24px;
  cursor: pointer;
  font-weight: ${props => props.$active ? '600' : '400'};
  color: ${props => props.$active ? '#0066cc' : '#666'};
  border-bottom: ${props => props.$active ? '2px solid #0066cc' : 'none'};
  margin-bottom: -1px;
  transition: all 0.2s;

  &:hover {
    color: #0066cc;
  }
`;

const Button = styled.button`
  padding: 10px 16px;
  background-color: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-right: 10px;
  margin-bottom: 20px;

  &:hover {
    background-color: #0052a3;
  }
`;

const SecondaryButton = styled(Button)`
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;

  &:hover {
    background-color: #e5e5e5;
  }
`;

const ActionBar = styled.div`
  display: flex;
  justify-content: flex-start;
  margin-bottom: 20px;
`;

// Status message components
const StatusMessage = styled.div<{ isError?: boolean }>`
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 4px;
  background-color: ${props => props.isError ? '#fce8e6' : '#e6f4ea'};
  color: ${props => props.isError ? '#c5221f' : '#137333'};
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-width: 350px;
  animation: fadeInOut 5s forwards;

  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(20px); }
    10% { opacity: 1; transform: translateY(0); }
    90% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(20px); }
  }
`;

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [weeklyValues, setWeeklyValues] = useState<WeeklyValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{text: string, isError: boolean} | null>(null);
  const [databaseInitialized, setDatabaseInitialized] = useState<boolean | null>(null);

  // Function to show a status message that automatically disappears
  const showStatusMessage = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    
    // Clear message after 5 seconds
    setTimeout(() => {
      setStatusMessage(null);
    }, 5000);
  };

  // Check database initialization status
  const checkDatabaseStatus = useCallback(async () => {
    try {
      const status = await getDatabaseStatusApi();
      setDatabaseInitialized(status.initialized);
      return status.initialized;
    } catch (err) {
      console.error('Error checking database status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check database status');
      showStatusMessage('Failed to connect to server. Check that the server is running.', true);
      return false;
    }
  }, [showStatusMessage]);

  // Fetch all data from the API
  const fetchAllData = useCallback(async (checkStatus = true) => {
    try {
      setLoading(true);
      
      // Check if database is initialized first (if requested)
      if (checkStatus) {
        const isInitialized = await checkDatabaseStatus();
        if (!isInitialized) {
          setLoading(false);
          return;
        }
      }
      
      // Update weeks first to ensure we have the latest completed weeks
      await updateWeeksApi();
      
      const [peopleData, metricsData, weeksData, valuesData] = await Promise.all([
        getPeopleApi(),
        getMetricsApi(),
        getWeeksApi(),
        getWeeklyValuesApi()
      ]);
      
      setPeople(peopleData);
      setMetrics(metricsData);
      setWeeks(weeksData);
      setWeeklyValues(valuesData);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      showStatusMessage('Failed to connect to server. Check that the server is running.', true);
    } finally {
      setLoading(false);
    }
  }, [checkDatabaseStatus, showStatusMessage]);

  // Check database status once on initial load
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const status = await getDatabaseStatusApi();
        setDatabaseInitialized(status.initialized);
        if (status.initialized) {
          fetchAllData(false); // Skip checking status again
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error checking database status:', err);
        setError(err instanceof Error ? err.message : 'Failed to check database status');
        showStatusMessage('Failed to connect to server. Check that the server is running.', true);
        setLoading(false);
      }
    };
    
    checkInitialStatus();
  }, []); // Empty dependencies - only run once
  
  // Set up socket connection for real-time updates
  useEffect(() => {
    if (databaseInitialized) {
      const cleanup = connectSocket(() => {
        fetchAllData(false); // Skip checking status on socket updates
      });
      
      return cleanup;
    }
  }, [databaseInitialized, fetchAllData]);

  const handleSaveMetric = async (metric: Metric) => {
    try {
      await saveMetricApi(metric);
      await fetchAllData(false); // Skip status check
      showStatusMessage('Metric saved successfully');
    } catch (err) {
      console.error('Error saving metric:', err);
      showStatusMessage('Failed to save metric', true);
    }
  };

  const handleDeleteMetric = async (metric: Metric) => {
    if (!metric.id) {
      console.error('Cannot delete metric without an ID');
      showStatusMessage('Failed to delete metric: no ID', true);
      return;
    }
    
    try {
      await deleteMetricApi(metric.id);
      await fetchAllData(false); // Skip status check
      showStatusMessage('Metric deleted successfully');
    } catch (err) {
      console.error('Error deleting metric:', err);
      showStatusMessage('Failed to delete metric', true);
    }
  };

  const handleSavePerson = async (person: Person) => {
    try {
      await savePersonApi(person);
      await fetchAllData(false); // Skip status check
      showStatusMessage('Person saved successfully');
    } catch (err) {
      console.error('Error saving person:', err);
      showStatusMessage('Failed to save person', true);
    }
  };

  const handleDeletePerson = async (person: Person) => {
    try {
      const success = await deletePersonApi(person.id);
      
      if (success) {
        await fetchAllData(false); // Skip status check
        showStatusMessage('Person deleted successfully');
        return true;
      } else {
        showStatusMessage('Cannot delete person - they still own metrics', true);
        return false;
      }
    } catch (err) {
      console.error('Error deleting person:', err);
      showStatusMessage('Failed to delete person', true);
      return false;
    }
  };

  const handleUpdateWeeklyValue = async (value: WeeklyValue) => {
    try {
      await saveWeeklyValueApi(value);
      await fetchAllData(false); // Skip status check
    } catch (err) {
      console.error('Error updating weekly value:', err);
      showStatusMessage('Failed to update value', true);
    }
  };

  // Handle database initialization completion
  const handleInitializationComplete = useCallback(() => {
    setDatabaseInitialized(true);
    fetchAllData(false); // Skip status check since we just set it
  }, [fetchAllData]);

  // App name from environment variable
  const APP_NAME = process.env.REACT_APP_APP_NAME || 'LevelTen';

  // If we're still checking database status or loading initial data
  if (loading && databaseInitialized === null) {
    return (
      <AppContainer>
        <Header>
          <Title>{APP_NAME}</Title>
        </Header>
        <div>Checking database status...</div>
      </AppContainer>
    );
  }

  // If database is not initialized, show setup screen
  if (databaseInitialized === false) {
    return (
      <AppContainer>
        <DatabaseSetup onInitializationComplete={handleInitializationComplete} />
      </AppContainer>
    );
  }

  // If data is still loading but we know database is initialized
  if (loading && people.length === 0) {
    return (
      <AppContainer>
        <Header>
          <Title>{APP_NAME}</Title>
        </Header>
        <div>Loading data from server...</div>
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <Header>
        <Title>{APP_NAME}</Title>
      </Header>

      <TabBar>
        <Tab
          $active={location.pathname === '/segue'}
          onClick={() => navigate('/segue')}
        >
          Segue
        </Tab>
        <Tab
          $active={location.pathname === '/' || location.pathname === '/scorecard'}
          onClick={() => navigate('/scorecard')}
        >
          Scorecard
        </Tab>
        <Tab
          $active={location.pathname === '/people'}
          onClick={() => navigate('/people')}
        >
          Manage People
        </Tab>
      </TabBar>

      <Routes>
        <Route path="/" element={<Navigate to="/scorecard" replace />} />
        <Route path="/scorecard" element={
          <Scorecard
            metrics={metrics}
            weeks={weeks}
            weeklyValues={weeklyValues}
            people={people}
            onUpdateWeeklyValue={handleUpdateWeeklyValue}
            onSaveMetric={handleSaveMetric}
            onDeleteMetric={handleDeleteMetric}
          />
        } />
        <Route path="/people" element={
          <PeopleManager
            people={people}
            metrics={metrics}
            onSavePerson={handleSavePerson}
            onDeletePerson={handleDeletePerson}
          />
        } />
        <Route path="/segue" element={
          <Segue people={people} />
        } />
      </Routes>

      {statusMessage && (
        <StatusMessage isError={statusMessage.isError}>
          {statusMessage.text}
        </StatusMessage>
      )}
    </AppContainer>
  );
};

export default App;
