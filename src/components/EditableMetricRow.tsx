import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Metric, Person, Target, ComparisonOperator, ValueUnit, ValueType } from '../models/types';
import { formatValue, formatGoal } from '../models/utils';

interface EditableMetricRowProps {
  metric?: Metric; // Optional for new metrics
  people: Person[];
  onSave: (metric: Metric) => void;
  onDelete?: (metric: Metric) => void;
  isNew?: boolean;
  inDataMode?: boolean; // If true, this row is in a data display row
}

const Row = styled.div<{ $isNew?: boolean }>`
  display: flex;
  border-bottom: 1px solid #eee;
  background-color: ${props => props.$isNew ? '#f9f9f9' : 'white'};
  min-width: max-content;
`;

const Cell = styled.div`
  padding: 16px;
  width: 180px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
`;

const MetricCell = styled(Cell)`
  position: sticky;
  left: 0;
  background-color: inherit;
  z-index: 1;
  width: 250px;
`;

const TargetCell = styled(Cell)`
  position: sticky;
  left: 250px;
  background-color: inherit;
  z-index: 1;
  width: 150px;
`;

const MetricInfo = styled.div`
  flex: 1;
  cursor: pointer;
  
  &:hover {
    background-color: #f9f9f9;
  }
`;

const DeleteLink = styled.span`
  color: #dc3545;
  font-size: 0.75rem;
  margin-top: 8px;
  cursor: pointer;
  display: inline-block;
  
  &:hover {
    text-decoration: underline;
  }
`;

const QuickEditContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 6px;
`;

const EditRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const EditField = styled.div`
  flex: 1;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  resize: vertical;
  min-height: 60px;
`;

const Select = styled.select`
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
`;

const TargetInput = styled.div`
  display: flex;
  gap: 8px;
  width: 100%;
  align-items: center;
`;

const ValueInput = styled(Input)`
  width: 70px;
  text-align: right;
`;

const UnitSelect = styled(Select)`
  width: 60px;
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`;

const Button = styled.button`
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
`;

const SaveButton = styled(Button)`
  background-color: #0066cc;
  color: white;
  
  &:hover {
    background-color: #0052a3;
  }
`;

const CancelButton = styled(Button)`
  background-color: #f5f5f5;
  color: #333;
  
  &:hover {
    background-color: #e5e5e5;
  }
`;

const DeleteButton = styled(Button)`
  background-color: #dc3545;
  color: white;
  
  &:hover {
    background-color: #c82333;
  }
`;

const ConfirmDeleteContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
`;

const ConfirmDeleteModal = styled.div`
  background-color: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 100%;
`;

const ModalTitle = styled.h3`
  margin-top: 0;
  color: #333;
`;

const ModalText = styled.p`
  margin-bottom: 24px;
  color: #666;
`;

const ModalButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const FieldLabel = styled.label`
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 2px;
  color: #555;
`;

const EditableMetricRow: React.FC<EditableMetricRowProps> = ({ 
  metric,
  people,
  onSave,
  onDelete,
  isNew = false,
  inDataMode = false
}) => {
  const emptyMetric: Metric = {
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
  };

  const [editedMetric, setEditedMetric] = useState<Metric>(metric || emptyMetric);
  const [isEditing, setIsEditing] = useState(isNew);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('target.')) {
      const targetField = name.split('.')[1];
      setEditedMetric(prev => ({
        ...prev,
        target: {
          ...prev.target,
          [targetField]: targetField === 'value' ? parseFloat(value) : value
        }
      }));
    } else {
      setEditedMetric(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  const handleOwnerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPersonId = e.target.value;
    const selectedPerson = people.find(p => p.id === selectedPersonId);
    
    if (selectedPerson) {
      setEditedMetric(prev => ({
        ...prev,
        owner: selectedPerson
      }));
    }
  };
  
  const handleValueTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValueType = e.target.value as ValueType;
    
    // Update value type and set appropriate default unit
    setEditedMetric(prev => {
      // Define default units based on value type
      let unitValue: ValueUnit = prev.target.unit;
      
      // Only change the unit if it's not appropriate for the new value type
      const isUnitCompatible = (
        (newValueType === 'number' && ['', 'k', 'm', 'b'].includes(unitValue)) ||
        (newValueType === 'percent' && unitValue === '%') ||
        (newValueType === 'dollars' && ['$', 'k', 'm', 'b'].includes(unitValue)) ||
        (newValueType === 'time' && ['sec', 'min', 'hour', 'day'].includes(unitValue))
      );
      
      if (!isUnitCompatible) {
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
      }
      
      return {
        ...prev,
        valueType: newValueType,
        target: {
          ...prev.target,
          unit: unitValue
        }
      };
    });
  };
  
  const handleSave = () => {
    // Simple validation
    if (!editedMetric.name || !editedMetric.owner.id) {
      alert('Please fill in the required fields: Metric name and Owner');
      return;
    }
    
    // Generate an ID if it's a new metric
    const metricToSave = editedMetric.id ? editedMetric : {
      ...editedMetric,
      id: `metric-${Date.now()}`
    };
    
    onSave(metricToSave);
    setIsEditing(false);
    setIsEditingName(false);
    setIsEditingTarget(false);
  };
  
  const handleTargetSave = () => {
    if (editedMetric.id) { // Only save if this is an existing metric
      onSave(editedMetric);
    }
    setIsEditingTarget(false);
  };
  
  const handleNameSave = () => {
    if (editedMetric.id) { // Only save if this is an existing metric
      onSave(editedMetric);
    }
    setIsEditingName(false);
  };
  
  const handleCancel = () => {
    if (isNew) {
      // Reset to empty state for new metrics
      setEditedMetric(emptyMetric);
    } else {
      // Reset to original metric data
      setEditedMetric(metric!);
      setIsEditing(false);
      setIsEditingName(false);
      setIsEditingTarget(false);
    }
  };
  
  const handleDelete = () => {
    if (metric && onDelete) {
      setShowDeleteConfirm(true);
    }
  };
  
  const confirmDelete = () => {
    if (deleteConfirmText === metric!.name && onDelete) {
      onDelete(metric!);
      setShowDeleteConfirm(false);
    }
  };

  // If this is a new metric row or in full edit mode
  if (isEditing) {
    return (
      <Row $isNew={isNew}>
        <MetricCell>
          <div style={{ width: '100%' }}>
            <Input
              type="text"
              name="name"
              value={editedMetric.name}
              onChange={handleInputChange}
              placeholder="Metric name"
              required
            />
            <div style={{ marginTop: '8px' }}>
              <FieldLabel htmlFor="valueType">Value Type</FieldLabel>
              <Select 
                id="valueType" 
                name="valueType"
                value={editedMetric.valueType || 'number'} 
                onChange={handleValueTypeChange}
                required
              >
                <option value="number">Number</option>
                <option value="percent">Percent</option>
                <option value="dollars">Dollars</option>
                <option value="time">Time</option>
              </Select>
            </div>
            <div style={{ marginTop: '8px' }}>
              <FieldLabel htmlFor="owner">Owner</FieldLabel>
              <Select
                id="owner"
                name="ownerId"
                value={editedMetric.owner.id}
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
            </div>
            <ButtonsContainer>
              <SaveButton onClick={handleSave}>Save</SaveButton>
              <CancelButton onClick={handleCancel}>Cancel</CancelButton>
              {!isNew && onDelete && (
                <DeleteButton onClick={handleDelete}>Delete</DeleteButton>
              )}
            </ButtonsContainer>
          </div>
        </MetricCell>
        <TargetCell>
          <div style={{ width: '100%' }}>
            <FieldLabel htmlFor="targetValue">Target Goal</FieldLabel>
            <TargetInput>
              <ValueInput
                id="targetValue"
                type="number"
                name="target.value"
                value={editedMetric.target.value}
                onChange={handleInputChange}
                step="any"
              />
              <UnitSelect
                name="target.unit"
                value={editedMetric.target.unit}
                onChange={handleInputChange}
              >
                {editedMetric.valueType === 'number' && (
                  <>
                    <option value="">-</option>
                    <option value="k">k</option>
                    <option value="m">m</option>
                    <option value="b">b</option>
                  </>
                )}
                {editedMetric.valueType === 'percent' && (
                  <option value="%">%</option>
                )}
                {editedMetric.valueType === 'dollars' && (
                  <>
                    <option value="$">$</option>
                    <option value="k">$k</option>
                    <option value="m">$m</option>
                    <option value="b">$b</option>
                  </>
                )}
                {editedMetric.valueType === 'time' && (
                  <>
                    <option value="sec">sec</option>
                    <option value="min">min</option>
                    <option value="hour">hour</option>
                    <option value="day">day</option>
                  </>
                )}
              </UnitSelect>
            </TargetInput>
            <div style={{ marginTop: '8px' }}>
              <FieldLabel htmlFor="targetOperator">Operator</FieldLabel>
              <Select
                id="targetOperator"
                name="target.operator"
                value={editedMetric.target.operator}
                onChange={handleInputChange}
              >
                <option value="gt">Greater than (&gt;)</option>
                <option value="lt">Less than (&lt;)</option>
                <option value="gte">Greater than or equal (&gt;=)</option>
                <option value="lte">Less than or equal (&lt;=)</option>
                <option value="eq">Equal to (=)</option>
              </Select>
            </div>
          </div>
        </TargetCell>
      </Row>
    );
  }

  // Inline editing mode - for existing metrics
  return (
    <>
      <Row $isNew={isNew}>
        <MetricCell>
          {isEditingName ? (
            <QuickEditContainer>
              <Input
                type="text"
                name="name"
                value={editedMetric.name}
                onChange={handleInputChange}
                placeholder="Metric name"
                autoFocus
                required
              />
              
              <div style={{ marginTop: '8px' }}>
                <FieldLabel htmlFor="valueType">Value Type</FieldLabel>
                <Select 
                  id="valueType" 
                  name="valueType"
                  value={editedMetric.valueType || 'number'} 
                  onChange={handleValueTypeChange}
                  required
                >
                  <option value="number">Number</option>
                  <option value="percent">Percent</option>
                  <option value="dollars">Dollars</option>
                  <option value="time">Time</option>
                </Select>
              </div>
              
              <div style={{ marginTop: '8px' }}>
                <FieldLabel htmlFor="owner">Owner</FieldLabel>
                <Select
                  id="owner"
                  name="ownerId"
                  value={editedMetric.owner.id}
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
              </div>
              
              <ButtonsContainer>
                <SaveButton onClick={handleNameSave}>Save</SaveButton>
                <CancelButton onClick={handleCancel}>Cancel</CancelButton>
              </ButtonsContainer>
            </QuickEditContainer>
          ) : (
            <MetricInfo onClick={() => setIsEditingName(true)}>
              <div style={{ fontWeight: 500 }}>{metric?.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>
                Owner: {metric?.owner.name}
              </div>
              {onDelete && <DeleteLink onClick={(e) => { e.stopPropagation(); handleDelete(); }}>delete</DeleteLink>}
            </MetricInfo>
          )}
        </MetricCell>
        <TargetCell>
          {isEditingTarget ? (
            <QuickEditContainer>
              <div style={{ marginBottom: '8px' }}>
                <FieldLabel htmlFor="valueType">Value Type</FieldLabel>
                <Select 
                  id="valueType" 
                  name="valueType"
                  value={editedMetric.valueType || 'number'} 
                  onChange={handleValueTypeChange}
                  required
                >
                  <option value="number">Number</option>
                  <option value="percent">Percent</option>
                  <option value="dollars">Dollars</option>
                  <option value="time">Time</option>
                </Select>
              </div>
              
              <FieldLabel htmlFor="targetValue">Target Goal</FieldLabel>
              <EditRow>
                <EditField>
                  <ValueInput
                    id="targetValue"
                    type="number"
                    name="target.value"
                    value={editedMetric.target.value}
                    onChange={handleInputChange}
                    step="any"
                  />
                </EditField>
                <EditField>
                  <UnitSelect
                    name="target.unit"
                    value={editedMetric.target.unit}
                    onChange={handleInputChange}
                  >
                    {editedMetric.valueType === 'number' && (
                      <>
                        <option value="">-</option>
                        <option value="k">k</option>
                        <option value="m">m</option>
                        <option value="b">b</option>
                      </>
                    )}
                    {editedMetric.valueType === 'percent' && (
                      <option value="%">%</option>
                    )}
                    {editedMetric.valueType === 'dollars' && (
                      <>
                        <option value="$">$</option>
                        <option value="k">$k</option>
                        <option value="m">$m</option>
                        <option value="b">$b</option>
                      </>
                    )}
                    {editedMetric.valueType === 'time' && (
                      <>
                        <option value="sec">sec</option>
                        <option value="min">min</option>
                        <option value="hour">hour</option>
                        <option value="day">day</option>
                      </>
                    )}
                  </UnitSelect>
                </EditField>
              </EditRow>
              
              <div style={{ marginTop: '8px' }}>
                <FieldLabel htmlFor="targetOperator">Operator</FieldLabel>
                <Select
                  id="targetOperator"
                  name="target.operator"
                  value={editedMetric.target.operator}
                  onChange={handleInputChange}
                >
                  <option value="gt">Greater than (&gt;)</option>
                  <option value="lt">Less than (&lt;)</option>
                  <option value="gte">Greater than or equal (&gt;=)</option>
                  <option value="lte">Less than or equal (&lt;=)</option>
                  <option value="eq">Equal to (=)</option>
                </Select>
              </div>
              
              <ButtonsContainer>
                <SaveButton onClick={handleTargetSave}>Save</SaveButton>
                <CancelButton onClick={handleCancel}>Cancel</CancelButton>
              </ButtonsContainer>
            </QuickEditContainer>
          ) : (
            <MetricInfo onClick={() => setIsEditingTarget(true)}>
              <div>{formatGoal(metric?.target || { value: 0, unit: '', operator: 'gte' })}</div>
            </MetricInfo>
          )}
        </TargetCell>
      </Row>
      
      {showDeleteConfirm && (
        <ConfirmDeleteContainer>
          <ConfirmDeleteModal>
            <ModalTitle>Delete Metric</ModalTitle>
            <ModalText>
              Are you sure you want to delete the metric "{metric!.name}"? 
              This action cannot be undone.
            </ModalText>
            <ModalText>
              Type the metric name to confirm:
            </ModalText>
            <Input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={`Type "${metric!.name}" to confirm`}
            />
            <ModalButtons>
              <CancelButton onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmText('');
              }}>
                Cancel
              </CancelButton>
              <DeleteButton 
                onClick={confirmDelete}
                disabled={deleteConfirmText !== metric!.name}
              >
                Delete
              </DeleteButton>
            </ModalButtons>
          </ConfirmDeleteModal>
        </ConfirmDeleteContainer>
      )}
    </>
  );
};

export default EditableMetricRow;