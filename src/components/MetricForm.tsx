import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Metric, Person, ComparisonOperator, ValueUnit, ValueType } from '../models/types';

interface MetricFormProps {
  people: Person[];
  onSave: (metric: Metric) => void;
  initialMetric?: Metric;
}

const FormContainer = styled.div`
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const FormTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  min-height: 80px;
`;

const Select = styled.select`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
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
  
  &:hover {
    background-color: #0052a3;
  }
`;

const TargetGroup = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-end;
`;

const ValueInput = styled.div`
  flex: 2;
`;

const UnitSelect = styled.div`
  flex: 1;
`;

const OperatorSelect = styled.div`
  flex: 2;
`;

const MetricForm: React.FC<MetricFormProps> = ({ people, onSave, initialMetric }) => {
  const [metric, setMetric] = useState<Metric>(initialMetric || {
    id: '',
    name: '',
    target: {
      value: 0,
      unit: '',
      operator: 'gte'
    },
    owner: {
      id: '',
      name: '',
      email: ''
    },
    valueType: 'number'
  });
  
  // Set default unit when initialMetric is loaded
  useEffect(() => {
    if (initialMetric && initialMetric.valueType) {
      // Only update if unit is not already set appropriately
      if (!initialMetric.target.unit) {
        let unitValue: ValueUnit = '';
        
        switch (initialMetric.valueType) {
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
        
        if (unitValue) {
          setMetric(prev => ({
            ...prev,
            target: {
              ...prev.target,
              unit: unitValue
            }
          }));
        }
      }
    }
  }, [initialMetric]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('target.')) {
      const targetField = name.split('.')[1];
      setMetric(prev => ({
        ...prev,
        target: {
          ...prev.target,
          [targetField]: targetField === 'value' ? parseFloat(value) : value
        }
      }));
    } else {
      setMetric(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  const handleOwnerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPerson = people.find(p => p.id === e.target.value);
    if (selectedPerson) {
      setMetric(prev => ({
        ...prev,
        owner: selectedPerson
      }));
    }
  };
  
  const handleValueTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const valueType = e.target.value as ValueType;
    
    // Update value type
    setMetric(prev => {
      // Define default units based on value type
      let unitValue: ValueUnit = '';
      
      switch (valueType) {
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
      
      return {
        ...prev,
        valueType,
        target: {
          ...prev.target,
          unit: unitValue
        }
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate an ID if it's a new metric
    const metricToSave = metric.id ? metric : {
      ...metric,
      id: `metric-${Date.now()}`
    };
    
    onSave(metricToSave);
  };

  return (
    <FormContainer>
      <FormTitle>{initialMetric ? 'Edit Metric' : 'Add New Metric'}</FormTitle>
      
      <form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="name">Metric Name</Label>
          <Input 
            type="text" 
            id="name" 
            name="name" 
            value={metric.name}
            onChange={handleChange}
            required
          />
        </FormGroup>
        
        <FormGroup>
          <Label>Target</Label>
          <TargetGroup>
            <ValueInput style={{ flex: 1 }}>
              <Select 
                id="valueType" 
                name="valueType"
                value={metric.valueType} 
                onChange={handleValueTypeChange}
                required
                style={{ width: '100%' }}
              >
                <option value="number">#</option>
                <option value="percent">%</option>
                <option value="dollars">$</option>
                <option value="time">00:00</option>
              </Select>
            </ValueInput>
            
            <ValueInput>
              <Input 
                type="number" 
                name="target.value" 
                value={metric.target.value}
                onChange={handleChange}
                required
                step="any"
              />
            </ValueInput>
            
            <UnitSelect>
              <Select 
                name="target.unit" 
                value={metric.target.unit}
                onChange={handleChange}
              >
                {metric.valueType === 'number' && (
                  <>
                    <option value="">-</option>
                    <option value="k">k</option>
                    <option value="m">m</option>
                    <option value="b">b</option>
                  </>
                )}
                {metric.valueType === 'percent' && (
                  <option value="%">%</option>
                )}
                {metric.valueType === 'dollars' && (
                  <>
                    <option value="$">$</option>
                    <option value="k">$k</option>
                    <option value="m">$m</option>
                    <option value="b">$b</option>
                  </>
                )}
                {metric.valueType === 'time' && (
                  <>
                    <option value="sec">sec</option>
                    <option value="min">min</option>
                    <option value="hour">hour</option>
                    <option value="day">day</option>
                  </>
                )}
              </Select>
            </UnitSelect>
            
            <OperatorSelect>
              <Select 
                name="target.operator" 
                value={metric.target.operator}
                onChange={handleChange}
              >
                <option value="gt">Greater than (&gt;)</option>
                <option value="lt">Less than (&lt;)</option>
                <option value="gte">Greater than or equal (&gt;=)</option>
                <option value="lte">Less than or equal (&lt;=)</option>
                <option value="eq">Equal to (=)</option>
              </Select>
            </OperatorSelect>
          </TargetGroup>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="owner">Owner</Label>
          <Select 
            id="owner" 
            name="owner"
            value={metric.owner.id} 
            onChange={handleOwnerChange}
            required
          >
            <option value="">Select an owner</option>
            {people.map(person => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </FormGroup>
        
        <Button type="submit">
          {initialMetric ? 'Update Metric' : 'Add Metric'}
        </Button>
      </form>
    </FormContainer>
  );
};

export default MetricForm;