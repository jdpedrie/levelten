import React, { useState } from 'react';
import styled from 'styled-components';
import { initializeSampleDataApi, initializeEosDataApi } from '../services/apiClient';

const SetupContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  font-size: 28px;
  margin-bottom: 32px;
  color: #333;
  text-align: center;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 40px;
`;

const Button = styled.button`
  padding: 12px 24px;
  background-color: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #0052a3;
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
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

const ImportContainer = styled.div`
  margin-top: 32px;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  margin-bottom: 16px;
`;

const InfoText = styled.p`
  color: #666;
  margin-bottom: 16px;
  line-height: 1.5;
`;

const ErrorMessage = styled.div`
  color: #e53935;
  padding: 12px;
  background-color: #ffebee;
  border-radius: 4px;
  margin-bottom: 16px;
`;

const SuccessMessage = styled.div`
  color: #43a047;
  padding: 12px;
  background-color: #e8f5e9;
  border-radius: 4px;
  margin-bottom: 16px;
`;

interface DatabaseSetupProps {
  onInitializationComplete: () => void;
}

const DatabaseSetup: React.FC<DatabaseSetupProps> = ({ onInitializationComplete }) => {
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSampleDataClick = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    
    try {
      const response = await initializeSampleDataApi();
      setSuccess(response.message);
      setTimeout(() => {
        onInitializationComplete();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEosImportClick = () => {
    setShowImport(true);
    setError(null);
    setSuccess(null);
  };

  const handleImportSubmit = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    
    try {
      // Validate JSON format
      let data;
      try {
        data = JSON.parse(importData);
      } catch (e) {
        throw new Error('Invalid JSON format');
      }
      
      // Validate EOS structure
      if (!data.measurables || !Array.isArray(data.measurables) || 
          !data.dates || !Array.isArray(data.dates)) {
        throw new Error('Invalid EOS format: missing measurables or dates arrays');
      }
      
      const response = await initializeEosDataApi(data);
      setSuccess(response.message);
      setTimeout(() => {
        onInitializationComplete();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setShowImport(false);
    setImportData('');
    setError(null);
  };

  return (
    <SetupContainer>
      <Title>Welcome to {process.env.REACT_APP_APP_NAME || 'LevelTen'}</Title>
      <InfoText>
        It looks like this is your first time running the application. Please choose how you'd like to initialize your database:
      </InfoText>
      
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}
      
      {!showImport ? (
        <ButtonContainer>
          <Button 
            onClick={handleSampleDataClick} 
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Use Sample Data'}
          </Button>
          <SecondaryButton 
            onClick={handleEosImportClick}
            disabled={isLoading}
          >
            Import from EOS One
          </SecondaryButton>
        </ButtonContainer>
      ) : (
        <ImportContainer>
          <InfoText>
            Paste your EOS JSON data below. You can find this data in the "eos.json" file.
          </InfoText>
          <TextArea 
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            placeholder="Paste EOS JSON data here..."
          />
          <ButtonContainer>
            <Button 
              onClick={handleImportSubmit}
              disabled={isLoading || !importData.trim()}
            >
              {isLoading ? 'Importing...' : 'Import Data'}
            </Button>
            <SecondaryButton 
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </SecondaryButton>
          </ButtonContainer>
        </ImportContainer>
      )}
    </SetupContainer>
  );
};

export default DatabaseSetup;