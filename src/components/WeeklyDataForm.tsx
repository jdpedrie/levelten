import React, { useState } from 'react';
import styled from 'styled-components';
import { Metric, Week, WeeklyValue, ValueUnit } from '../models/types';

interface WeeklyDataFormProps {
  metrics: Metric[];
  week: Week;
  existingValues: WeeklyValue[];
  onSave: (values: WeeklyValue[]) => void;
}

const FormContainer = styled.div`
  max-width: 700px;
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

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
`;

const Th = styled.th`
  text-align: left;
  padding: 12px;
  border-bottom: 2px solid #ddd;
`;

const Td = styled.td`
  padding: 12px;
  border-bottom: 1px solid #eee;
`;

const InputGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ValueInput = styled.input`
  width: 100px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const UnitSelect = styled.select`
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
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

const WeeklyDataForm: React.FC<WeeklyDataFormProps> = ({ 
  metrics, 
  week, 
  existingValues, 
  onSave 
}) => {
  // Initialize form state with existing values or defaults
  // Filter out metrics without IDs, as they can't be saved yet
  const validMetrics = metrics.filter(metric => !!metric.id);
  
  const initialValues = validMetrics.map(metric => {
    // We know metric.id is defined here because of the filter above
    const existingValue = existingValues.find(
      v => v.metricId === metric.id && v.weekId === week.id
    );
    
    return existingValue || {
      metricId: metric.id!, // Non-null assertion is safe here due to filter
      weekId: week.id,
      value: 0,
      unit: '' as ValueUnit
    };
  });
  
  const [values, setValues] = useState<WeeklyValue[]>(initialValues);
  
  const handleValueChange = (metricId: string, field: 'value' | 'unit', newValue: string | number) => {
    setValues(prevValues => {
      return prevValues.map(val => {
        if (val.metricId === metricId) {
          return {
            ...val,
            [field]: field === 'value' ? Number(newValue) : newValue
          };
        }
        return val;
      });
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(values);
  };
  
  return (
    <FormContainer>
      <FormTitle>Enter Data for {week.name}</FormTitle>
      
      <form onSubmit={handleSubmit}>
        <Table>
          <thead>
            <tr>
              <Th>Metric</Th>
              <Th>Owner</Th>
              <Th>Target</Th>
              <Th>Value</Th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric, index) => {
              // Skip metrics without IDs in the table
              if (!metric.id) {
                return (
                  <tr key={`pending-${index}`}>
                    <Td>{metric.name}</Td>
                    <Td>{metric.owner.name}</Td>
                    <Td>
                      {metric.target.value}{metric.target.unit} 
                      ({metric.target.operator})
                    </Td>
                    <Td>
                      <div style={{ color: '#999', fontStyle: 'italic' }}>
                        Pending metric save...
                      </div>
                    </Td>
                  </tr>
                );
              }
              
              const currentValue = values.find(v => v.metricId === metric.id);
              
              return (
                <tr key={metric.id}>
                  <Td>{metric.name}</Td>
                  <Td>{metric.owner.name}</Td>
                  <Td>
                    {metric.target.value}{metric.target.unit} 
                    ({metric.target.operator})
                  </Td>
                  <Td>
                    <InputGroup>
                      <ValueInput 
                        type="number"
                        value={currentValue?.value || 0}
                        onChange={(e) => {
                          // We already checked metric.id exists
                          if (metric.id) {
                            handleValueChange(
                              metric.id, 
                              'value', 
                              e.target.value
                            );
                          }
                        }}
                        step="any"
                      />
                      <UnitSelect
                        value={currentValue?.unit || ''}
                        onChange={(e) => {
                          // We already checked metric.id exists
                          if (metric.id) {
                            handleValueChange(
                              metric.id, 
                              'unit', 
                              e.target.value as ValueUnit
                            );
                          }
                        }}
                      >
                        <option value="">-</option>
                        <option value="k">k</option>
                        <option value="m">m</option>
                        <option value="b">b</option>
                      </UnitSelect>
                    </InputGroup>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        
        <Button type="submit">Save Week Data</Button>
      </form>
    </FormContainer>
  );
};

export default WeeklyDataForm;
