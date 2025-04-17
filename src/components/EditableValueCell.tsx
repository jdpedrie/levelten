import React, { useState } from 'react';
import styled from 'styled-components';
import { ValueUnit, Target, ValueType } from '../models/types';
import { formatValue } from '../models/utils';

interface EditableValueCellProps {
  value: number;
  unit: ValueUnit;
  isOnTarget: boolean;
  onSave: (value: number, unit: ValueUnit) => Promise<void>;
  goalTarget?: Target;
  valueType?: ValueType;
}

const CellContainer = styled.div<{ $isOnTarget: boolean }>`
  padding: 4px 5px;
  width: 80px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${props => props.$isOnTarget ? '#e6f4ea' : '#fce8e6'};
  color: ${props => props.$isOnTarget ? '#137333' : '#c5221f'};
  font-weight: 500;
  cursor: pointer;
  position: relative;
  font-size: 0.85rem;
  transition: background-color 0.2s;
  
  /* Deeper hue on row hover */
  div:hover & {
    background-color: ${props => props.$isOnTarget ? '#d4ebdc' : '#f7dbd8'};
  }
`;

const ValueDisplay = styled.div`
  width: 100%;
  text-align: center;
`;

const EditForm = styled.form`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-direction: column;
`;

const ValueInput = styled.input`
  width: 55px;
  padding: 2px 3px;
  border: 1px solid #ccc;
  border-radius: 3px;
  text-align: right;
  font-size: 0.75rem;
`;

const InputError = styled.div`
  color: #c5221f;
  font-size: 0.75rem;
  margin-top: 4px;
  text-align: center;
`;

const EditableValueCell: React.FC<EditableValueCellProps> = ({ 
  value, 
  unit, 
  isOnTarget, 
  onSave,
  goalTarget,
  valueType
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [inputError, setInputError] = useState("");
  
  // Use the goal's unit if provided, otherwise use the current value's unit
  const effectiveUnit = goalTarget ? goalTarget.unit : unit;

  const handleClick = () => {
    setIsEditing(true);
    setEditValue(value.toString());
    setInputError("");
    console.log(`Editing value: ${value} with goal unit: ${effectiveUnit}`);
  };

  const validateAndSave = async () => {
    // Validate input is a number
    const parsedValue = parseFloat(editValue);
    
    if (isNaN(parsedValue)) {
      setInputError("Please enter a valid number");
      return false;
    }
    
    // Clear error and save
    setInputError("");
    try {
      await onSave(parsedValue, effectiveUnit);
      setIsEditing(false);
      return true;
    } catch (error) {
      console.error('Error saving value:', error);
      setInputError("Failed to save. Try again.");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await validateAndSave();
  };

  const handleBlur = async () => {
    await validateAndSave();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
    
    // Clear error when user starts typing again
    if (inputError) {
      setInputError("");
    }
  };

  return (
    <CellContainer $isOnTarget={isOnTarget} onClick={!isEditing ? handleClick : undefined}>
      {isEditing ? (
        <EditForm onSubmit={handleSubmit}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ValueInput
              type="text"
              value={editValue}
              onChange={handleChange}
              placeholder={`In ${effectiveUnit || 'units'}`}
              autoFocus
              onBlur={handleBlur}
            />
            <span>{effectiveUnit}</span>
          </div>
          {inputError && <InputError>{inputError}</InputError>}
        </EditForm>
      ) : (
        <ValueDisplay>
          {formatValue(value, unit, valueType)}
        </ValueDisplay>
      )}
    </CellContainer>
  );
};

export default EditableValueCell;