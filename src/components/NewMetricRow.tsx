import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Metric, Person, ComparisonOperator, ValueUnit, ValueType } from '../models/types';

interface NewMetricRowProps {
  people: Person[];
  onSave: (metric: Metric) => Promise<void>;
  onCancel: () => void;
}

const Row = styled.div`
  display: flex;
  border-bottom: 1px solid #ddd;
  border-top: 1px solid #ddd;
  background-color: #f8f9fa;
  min-width: max-content;
  margin-top: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`;

const Cell = styled.div`
  padding: 8px 5px;
  width: 80px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
`;

const FormContainer = styled.div`
  position: sticky;
  left: 0;
  background-color: inherit;
  z-index: 1;
  width: 250px; /* Combined width of metric (180px) and goal (70px) cells */
  padding: 12px;
  display: flex;
  flex-direction: column;
`;

const EditableField = styled.div`
  width: 100%;
  margin-bottom: 8px;
`;

const FieldLabel = styled.label`
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 2px;
  color: #555;
`;

const Input = styled.input`
  width: 100%;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  transition: border-color 0.2s;
  
  &:focus {
    border-color: #0066cc;
    outline: none;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s;
  
  &:focus {
    border-color: #0066cc;
    outline: none;
  }
`;

const FlexRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const OperatorSelect = styled(Select)`
  width: 60px;
  flex-shrink: 0;
`;

const ValueInput = styled(Input)`
  width: 60px;
  flex-shrink: 0;
`;

const UnitSelect = styled(Select)`
  width: 50px;
  flex-shrink: 0;
`;

const Button = styled.button`
  padding: 6px 12px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
`;

const SaveButton = styled(Button)`
  background-color: #0066cc;
  color: white;
  
  &:hover {
    background-color: #0052a3;
  }
  
  &:disabled {
    background-color: #99c2ff;
    cursor: not-allowed;
  }
`;

const CancelButton = styled(Button)`
  background-color: #f5f5f5;
  color: #333;
  
  &:hover {
    background-color: #e5e5e5;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 12px;
`;

const StepCounter = styled.div`
  font-size: 0.75rem;
  color: #666;
  margin-top: 8px;
`;

const ValidationError = styled.div`
  color: #d9534f;
  font-size: 0.75rem;
  margin-top: 4px;
`;

const SuccessMessage = styled.div`
  color: #5cb85c;
  font-size: 0.85rem;
  margin-top: 8px;
  padding: 4px 8px;
  background-color: #f0fff0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const NewMetricRow: React.FC<NewMetricRowProps> = ({ people, onSave, onCancel }) => {
  // References for focusing
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Metric fields state
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [targetValue, setTargetValue] = useState(100);
  const [targetUnit, setTargetUnit] = useState<ValueUnit>('');
  const [targetOperator, setTargetOperator] = useState<ComparisonOperator>('gt');
  const [valueType, setValueType] = useState<ValueType>('number');
  
  // UI state
  const [currentStep, setCurrentStep] = useState(1);
  const [showNameError, setShowNameError] = useState(false);
  const [showOwnerError, setShowOwnerError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Set focus on name input when component mounts
  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);
  
  // Handle value type change
  const handleValueTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValueType = e.target.value as ValueType;
    setValueType(newValueType);
    
    // Define default units based on value type
    let unitValue: ValueUnit = '';
    
    switch (newValueType) {
      case 'percent':
        unitValue = '%';
        break;
      case 'dollars':
        unitValue = '$';
        break;
      case 'time':
        unitValue = 'hour';
        break;
      default:
        unitValue = '';
    }
    
    setTargetUnit(unitValue);
  };
  
  const validateAndProceed = () => {
    if (currentStep === 1) {
      if (name.trim() === '') {
        setShowNameError(true);
        return;
      }
      setShowNameError(false);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (ownerId === '') {
        setShowOwnerError(true);
        return;
      }
      setShowOwnerError(false);
      setCurrentStep(3);
    }
  };
  
  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      validateAndProceed();
    }
  };
  
  const handleSave = async () => {
    // Final validation
    if (name.trim() === '') {
      setShowNameError(true);
      setCurrentStep(1);
      return;
    }
    
    if (ownerId === '') {
      setShowOwnerError(true);
      setCurrentStep(2);
      return;
    }
    
    // Find the selected owner
    const owner = people.find(p => p.id === ownerId) || { id: '', name: '', email: '' };
    
    // Create the new metric
    const newMetric: Metric = {
      // Don't include ID for new metrics, let the server generate it
      name: name.trim(),
      target: {
        value: targetValue,
        unit: targetUnit,
        operator: targetOperator
      },
      owner: owner,
      valueType: valueType
    };
    
    // Show success message briefly before saving
    setShowSuccess(true);
    try {
      // Wait a brief moment to show the success message
      await new Promise(resolve => setTimeout(resolve, 600));
      await onSave(newMetric);
    } catch (error) {
      console.error('Error saving new metric:', error);
      setShowSuccess(false);
      alert('Failed to save metric. Please try again.');
    }
  };
  
  return (
    <Row>
      <FormContainer>
        <h3 style={{ margin: '0 0 10px 0', color: '#0066cc', fontSize: '15px' }}>Add New Metric</h3>
        
        <EditableField style={{ display: currentStep === 1 ? 'block' : 'none' }}>
          <FieldLabel htmlFor="metric-name">Metric Name</FieldLabel>
          <Input
            id="metric-name"
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyPress={handleNameKeyPress}
            placeholder="Enter metric name"
          />
          {showNameError && (
            <ValidationError>Please enter a metric name</ValidationError>
          )}
        </EditableField>
        
        <EditableField style={{ display: currentStep === 2 ? 'block' : 'none' }}>
          <FieldLabel htmlFor="metric-owner">Owner</FieldLabel>
          <Select
            id="metric-owner"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            autoFocus={currentStep === 2}
          >
            <option value="">Select an owner</option>
            {people.map(person => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
          {showOwnerError && (
            <ValidationError>Please select an owner</ValidationError>
          )}
        </EditableField>
        
        <EditableField style={{ display: currentStep === 3 ? 'block' : 'none' }}>
          <FieldLabel htmlFor="metric-target">Target Goal</FieldLabel>
          <FlexRow>
            <Select 
              id="metric-value-type" 
              value={valueType}
              onChange={handleValueTypeChange}
              autoFocus={currentStep === 3}
              style={{ width: '80px' }}
            >
              <option value="number">#</option>
              <option value="percent">%</option>
              <option value="dollars">$</option>
              <option value="time">00:00</option>
            </Select>
            
            <OperatorSelect
              id="metric-operator"
              value={targetOperator}
              onChange={(e) => setTargetOperator(e.target.value as ComparisonOperator)}
            >
              <option value="gt">&gt;</option>
              <option value="lt">&lt;</option>
              <option value="gte">≥</option>
              <option value="lte">≤</option>
              <option value="eq">=</option>
            </OperatorSelect>
            
            <ValueInput
              type="number"
              id="metric-value"
              value={targetValue}
              onChange={(e) => setTargetValue(Number(e.target.value))}
            />
            
            <UnitSelect
              id="metric-unit"
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value as ValueUnit)}
            >
              {valueType === 'number' && (
                <>
                  <option value="">-</option>
                  <option value="k">k</option>
                  <option value="m">m</option>
                  <option value="b">b</option>
                </>
              )}
              {valueType === 'percent' && (
                <option value="%">%</option>
              )}
              {valueType === 'dollars' && (
                <>
                  <option value="$">$</option>
                  <option value="k">$k</option>
                  <option value="m">$m</option>
                  <option value="b">$b</option>
                </>
              )}
              {valueType === 'time' && (
                <>
                  <option value="sec">sec</option>
                  <option value="min">min</option>
                  <option value="hour">hour</option>
                  <option value="day">day</option>
                </>
              )}
            </UnitSelect>
          </FlexRow>
        </EditableField>
        
        {showSuccess ? (
          <SuccessMessage>
            <span role="img" aria-label="check">✅</span> Metric saved successfully!
          </SuccessMessage>
        ) : (
          <>
            <ButtonGroup>
              {currentStep > 1 && (
                <CancelButton 
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  type="button"
                >
                  Back
                </CancelButton>
              )}
              
              {currentStep < 3 ? (
                <SaveButton 
                  onClick={validateAndProceed}
                  type="button"
                >
                  Next
                </SaveButton>
              ) : (
                <SaveButton 
                  onClick={handleSave}
                  type="button"
                >
                  Save Metric
                </SaveButton>
              )}
              
              <CancelButton 
                onClick={onCancel}
                type="button"
              >
                Cancel
              </CancelButton>
            </ButtonGroup>
            
            <StepCounter>
              Step {currentStep} of 3
            </StepCounter>
          </>
        )}
      </FormContainer>
    </Row>
  );
};

export default NewMetricRow;