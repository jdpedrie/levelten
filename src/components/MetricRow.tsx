import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Metric, Week, WeeklyValue, ValueUnit, ComparisonOperator, ValueType } from '../models/types';
import { formatValue, formatGoal, isOnTarget } from '../models/utils';
import EditableValueCell from './EditableValueCell';

interface MetricRowProps {
  metric: Metric;
  weeks: Week[];
  weeklyValues: WeeklyValue[];
  onUpdateWeeklyValue?: (value: WeeklyValue) => Promise<void>;
  people?: any[];
  onSaveMetric?: (metric: Metric) => Promise<void>;
  onDeleteMetric?: (metric: Metric) => Promise<void>;
  isDragging?: boolean;
  index?: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const Row = styled.div<{ isDragging?: boolean }>`
  display: flex;
  border-bottom: 1px solid #eee;
  position: relative;
  background-color: white;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #f9f9f9;
  }
  
  min-width: max-content;
  ${props => props.isDragging && `
    background-color: #e6f7ff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border: 1px dashed #0066cc;
  `}
  
  /* Make rows more compact */
  height: 42px;
`;

const Cell = styled.div`
  padding: 4px 5px;
  width: 80px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  position: relative;
`;

const DragHandle = styled.div`
  width: 24px;
  height: 24px;
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  color: #0066cc;
  z-index: 10;
  cursor: ns-resize;
  border-radius: 4px;
  
  &:hover {
    background-color: #e6f7ff;
  }
  
  ${Row}:hover & {
    opacity: 1;
  }
  
  &::before {
    content: "☰";
    font-size: 16px;
    line-height: 1;
  }
`;

const MetricCell = styled(Cell)`
  position: sticky;
  left: 0;
  background-color: white;
  z-index: 1;
  width: 180px;
  padding-left: 28px; /* Increased to make room for drag handle */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  overflow: hidden;

  ${Row}:hover & {
    background-color: #f9f9f9;
  }
`;

const GoalCell = styled(Cell)`
  position: sticky;
  left: 180px;
  background-color: white;
  z-index: 1;
  width: 80px;
  box-sizing: border-box;
  overflow: hidden;

  ${Row}:hover & {
    background-color: #f9f9f9;
  }
`;

const MetricInfo = styled.div`
  flex: 1;
  cursor: pointer;

  &:hover {
    background-color: #f5f5f5;
  }
`;

const OwnerInfo = styled.div`
  font-size: 0.7rem;
  color: #666;
  margin-top: 2px;
  padding: 0;
  text-align: left;
`;

const DeleteLink = styled.span`
  color: #dc3545;
  font-size: 0.7rem;
  margin-top: 0;
  cursor: pointer;
  display: inline-block;
  padding: 0;
  text-align: left;
  position: absolute;
  right: 5px;
  bottom: 3px;
  opacity: 0;
  transition: opacity 0.2s;

  ${Row}:hover & {
    opacity: 1;
  }

  &:hover {
    text-decoration: underline;
  }
`;

const EmptyCell = styled(Cell)`
  justify-content: center;
  background-color: #f9f9f9;
  color: #999;
  font-style: italic;
  cursor: pointer;

  &:hover {
    background-color: #eaeaea;
  }
`;

const EditForm = styled.form`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex-direction: column;
  font-size: 0.8rem;
`;

const InputError = styled.div`
  color: #c5221f;
  font-size: 0.7rem;
  margin-top: 2px;
  text-align: center;
`;

const ValueInput = styled.input`
  padding: 4px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
  min-width: 0;
  width: 70px;
  font-size: 0.8rem;
`;

const UnitSelect = styled.select`
  padding: 3px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
  min-width: 0;
  width: 40px;
  font-size: 0.8rem;
`;

const EditOverlay = styled.div`
  position: absolute;
  left: 0; /* Start from the very left, covering the drag handle */
  top: 0;
  z-index: 20;
  width: 260px; /* Adjusted width to fit precisely */
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background-color: white;
  padding-right: 8px;
  padding-left: 8px;
  box-sizing: border-box;
  font-size: 0.8rem;
  
  ${Row}:hover & {
    background-color: #f9f9f9;
  }
`;

const GoalEditOverlay = styled(EditOverlay)`
  /* Any specific styles for goal editing */
`;

const EditContent = styled.div`
  padding: 4px;
  width: 92%;
  display: flex;
  flex-direction: column;
  background-color: white;
  
  ${Row}:hover & {
    background-color: #f9f9f9;
  }
`;

const GoalEditContent = styled(EditContent)`
  align-items: flex-end;
`;

const NameEditContent = styled(EditContent)`
  align-items: flex-start;
`;

const OwnerEditContent = styled(EditContent)`
  align-items: flex-start;
`;

const TargetInput = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  gap: 4px;
  
  ${Row}:hover & {
    background-color: #f9f9f9;
  }
`;

const Select = styled.select`
  padding: 3px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
  min-width: 0;
  width: 45px;
  font-size: 0.8rem;
`;

const Button = styled.button`
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
`;

const SaveButton = styled(Button)`
  background-color: #0066cc;
  color: white;
  min-width: 50px;
  
  &:hover {
    background-color: #0052a3;
  }
`;

const CancelButton = styled(Button)`
  background-color: #f5f5f5;
  color: #333;
  min-width: 50px;
  
  &:hover {
    background-color: #e5e5e5;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: white;
  padding: 24px;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
`;

const ModalTitle = styled.h3`
  margin-top: 0;
  margin-bottom: 16px;
  color: #dc3545;
`;

const ModalText = styled.p`
  margin-bottom: 20px;
  line-height: 1.5;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
`;

const ConfirmInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 20px;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
`;

const DeleteButton = styled(Button)`
  background-color: #dc3545;
  color: white;

  &:hover {
    background-color: #c82333;
  }

  &:disabled {
    background-color: #f5a5a5;
    cursor: not-allowed;
  }
`;

const Tooltip = styled.div`
  position: fixed;
  background-color: #333;
  color: white;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 9999;
  max-width: 300px;
  white-space: normal;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  pointer-events: none;
  transform: translate(-50%, -100%);
  margin-top: -10px;
  
  &::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #333 transparent transparent transparent;
  }
`;

const EditableField = styled.div`
  cursor: pointer;
  padding: 4px 0;
  border-radius: 4px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  position: relative;

  &:hover {
    background-color: #f0f0f0;
  }
`;

const EditableInput = styled.input`
  width: 100%;
  padding: 3px;
  border: 1px solid #0066cc;
  border-radius: 4px;
  font-size: 12px;
  box-sizing: border-box;
  
  /* Let parent control width limitation */
  &:not([style*="width"]) {
    max-width: 150px;
  }
`;

const OwnerSelect = styled.select`
  width: 100%;
  padding: 3px;
  border: 1px solid #0066cc;
  border-radius: 4px;
  font-size: 12px;
`;

const FieldLabel = styled.label`
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 4px;
  color: #555;
`;

const MetricRow: React.FC<MetricRowProps> = ({
  metric,
  weeks,
  weeklyValues,
  onUpdateWeeklyValue = async () => {},
  people = [],
  onSaveMetric = async () => {},
  onDeleteMetric = async () => {},
  isDragging = false,
  index,
  onMoveUp,
  onMoveDown
}) => {
  // Editing states for different fields
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [activeEditOverlay, setActiveEditOverlay] = useState<'name' | 'owner' | 'goal' | null>(null);

  // Edit values
  const [editName, setEditName] = useState(metric.name);
  const [editOwnerId, setEditOwnerId] = useState(metric.owner.id);
  const [editTarget, setEditTarget] = useState(metric.target);
  const [editValueType, setEditValueType] = useState(metric.valueType || 'number');

  // Delete confirmation
  const [confirmInput, setConfirmInput] = useState('');
  const confirmInputRef = useRef<HTMLInputElement>(null);

  // References for autofocus
  const nameInputRef = useRef<HTMLInputElement>(null);
  const ownerSelectRef = useRef<HTMLSelectElement>(null);
  
  // For empty cell value editing
  const [editingWeekId, setEditingWeekId] = useState<string | null>(null);
  const [newCellValue, setNewCellValue] = useState('');
  const [cellInputError, setCellInputError] = useState('');

  const handleUpdateValue = async (weekId: string, newValue: number, newUnit: ValueUnit) => {
    // Skip update if this metric doesn't have a server ID yet
    if (!metric.id) {
      console.error('Cannot update value for metric without an ID');
      return;
    }
    
    const updatedValue: WeeklyValue = {
      metricId: metric.id,
      weekId,
      value: newValue,
      unit: newUnit
    };

    try {
      await onUpdateWeeklyValue(updatedValue);
    } catch (error) {
      console.error('Error updating value:', error);
      alert('Failed to update value. Please try again.');
    }
  };

  // Handlers for individual field editing
  const handleNameEdit = () => {
    setIsEditingName(true);
    setActiveEditOverlay('name');
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleNameSave = async () => {
    // Don't save if empty or unchanged
    if (editName.trim() === '' || editName === metric.name) {
      setIsEditingName(false);
      setActiveEditOverlay(null);
      return;
    }
    
    try {
      await onSaveMetric({ ...metric, name: editName });
      setIsEditingName(false);
      setActiveEditOverlay(null);
    } catch (error) {
      console.error('Error saving metric name:', error);
      alert('Failed to save metric name. Please try again.');
    }
  };


  const handleOwnerEdit = () => {
    setIsEditingOwner(true);
    setActiveEditOverlay('owner');
    setTimeout(() => ownerSelectRef.current?.focus(), 50);
  };

  const handleOwnerSave = async () => {
    const selectedOwner = people.find(p => p.id === editOwnerId);
    
    // Don't save if owner is unchanged or not found
    if (!selectedOwner || (selectedOwner.id === metric.owner.id)) {
      setIsEditingOwner(false);
      setActiveEditOverlay(null);
      return;
    }
    
    try {
      await onSaveMetric({ ...metric, owner: selectedOwner });
      setIsEditingOwner(false);
      setActiveEditOverlay(null);
    } catch (error) {
      console.error('Error saving metric owner:', error);
      alert('Failed to save metric owner. Please try again.');
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
    // Focus on the input field when the modal opens (with a slight delay to ensure modal is rendered)
    setTimeout(() => {
      if (confirmInputRef.current) {
        confirmInputRef.current.focus();
      }
    }, 100);
  };

  const handleConfirmDelete = async () => {
    if (confirmInput === metric.name && metric.id) {
      try {
        await onDeleteMetric(metric);
        setShowDeleteConfirm(false);
      } catch (error) {
        console.error('Error deleting metric:', error);
        alert('Failed to delete metric. Please try again.');
      }
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setConfirmInput('');
  };
  
  // Helper function to check if target has changed
  const hasTargetChanged = () => {
    return (
      editTarget.operator !== metric.target.operator ||
      editTarget.value !== metric.target.value ||
      editTarget.unit !== metric.target.unit
    );
  };
  
  // Effect to handle updating units when value type changes
  useEffect(() => {
    if (isEditingGoal) {
      // Define default units based on value type
      let unitValue: ValueUnit = editTarget.unit;
      
      // Only change the unit if it's not appropriate for the new value type
      const isUnitCompatible = (
        (editValueType === 'number' && ['', 'k', 'm', 'b'].includes(unitValue)) ||
        (editValueType === 'percent' && unitValue === '%') ||
        (editValueType === 'dollars' && ['$', 'k', 'm', 'b'].includes(unitValue)) ||
        (editValueType === 'time' && ['sec', 'min', 'hour', 'day'].includes(unitValue))
      );
      
      if (!isUnitCompatible) {
        switch (editValueType) {
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
        
        setEditTarget(prev => ({
          ...prev,
          unit: unitValue
        }));
      }
    }
  }, [editValueType, isEditingGoal]);

  // Handle saving the goal target
  const handleTargetSave = async () => {
    if (!hasTargetChanged() && editValueType === (metric.valueType || 'number')) {
      setIsEditingGoal(false);
      setActiveEditOverlay(null);
      return;
    }
    
    try {
      await onSaveMetric({
        ...metric, 
        target: editTarget,
        valueType: editValueType
      });
      setIsEditingGoal(false);
      setActiveEditOverlay(null);
    } catch (error) {
      console.error('Error saving metric target:', error);
      alert('Failed to save metric target. Please try again.');
    }
  };
  
  const handleGoalEdit = () => {
    setIsEditingGoal(true);
    setActiveEditOverlay('goal');
  };

  return (
    <>
      {/* Tooltip rendered at top level to avoid z-index issues */}
      {showTooltip && metric.name.length > 20 && (
        <Tooltip style={{ 
          left: `${tooltipPosition.x}px`, 
          top: `${tooltipPosition.y}px` 
        }}>
          {metric.name}
        </Tooltip>
      )}
      <Row isDragging={isDragging}>
        {activeEditOverlay === 'name' && (
          <EditOverlay>
            <NameEditContent>
              <EditableInput
                ref={nameInputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleNameSave}
                onKeyPress={(e) => e.key === 'Enter' && handleNameSave()}
                style={{ fontWeight: 500, width: '180px', fontSize: '0.8rem', padding: '3px' }}
              />
              <div style={{ display: 'flex', gap: '3px', marginTop: '5px' }}>
                <SaveButton 
                  onClick={handleNameSave}
                  style={{ padding: '2px 5px', fontSize: '10px', minWidth: '35px' }}
                >
                  Save
                </SaveButton>
                <CancelButton
                  onClick={() => {
                    setEditName(metric.name);
                    setIsEditingName(false);
                    setActiveEditOverlay(null);
                  }}
                  style={{ padding: '2px 5px', fontSize: '10px', minWidth: '35px' }}
                >
                  Cancel
                </CancelButton>
              </div>
            </NameEditContent>
          </EditOverlay>
        )}
        
        {activeEditOverlay === 'owner' && (
          <EditOverlay>
            <OwnerEditContent>
              <OwnerSelect
                ref={ownerSelectRef}
                value={editOwnerId}
                onChange={(e) => setEditOwnerId(e.target.value)}
                onBlur={handleOwnerSave}
                style={{ width: '180px', fontSize: '0.75rem', padding: '2px' }}
              >
                {people.map(person => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </OwnerSelect>
              <div style={{ display: 'flex', gap: '3px', marginTop: '5px' }}>
                <SaveButton 
                  onClick={handleOwnerSave}
                  style={{ padding: '2px 5px', fontSize: '10px', minWidth: '35px' }}
                >
                  Save
                </SaveButton>
                <CancelButton
                  onClick={() => {
                    setEditOwnerId(metric.owner.id);
                    setIsEditingOwner(false);
                    setActiveEditOverlay(null);
                  }}
                  style={{ padding: '2px 5px', fontSize: '10px', minWidth: '35px' }}
                >
                  Cancel
                </CancelButton>
              </div>
            </OwnerEditContent>
          </EditOverlay>
        )}
        
        {activeEditOverlay === 'goal' && (
          <GoalEditOverlay>
            <GoalEditContent>
              <TargetInput>
                <Select
                  id="valueType" 
                  value={editValueType || 'number'}
                  onChange={(e) => setEditValueType(e.target.value as ValueType)}
                  style={{ width: '45px', fontSize: '11px', padding: '2px' }}
                >
                  <option value="number">#</option>
                  <option value="percent">%</option>
                  <option value="dollars">$</option>
                  <option value="time">00:00</option>
                </Select>
                <Select
                  id="operator"
                  value={editTarget.operator}
                  onChange={(e) => setEditTarget({...editTarget, operator: e.target.value as ComparisonOperator})}
                  style={{ width: '30px', fontSize: '11px', padding: '2px' }}
                >
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                  <option value="gte">≥</option>
                  <option value="lte">≤</option>
                  <option value="eq">=</option>
                </Select>
                <ValueInput
                  id="targetValue"
                  type="number"
                  value={editTarget.value}
                  onChange={(e) => setEditTarget({...editTarget, value: parseFloat(e.target.value)})}
                  style={{ width: '45px', fontSize: '11px', padding: '2px' }}
                />
                <UnitSelect
                  id="targetUnit"
                  value={editTarget.unit}
                  onChange={(e) => setEditTarget({...editTarget, unit: e.target.value as ValueUnit})}
                  style={{ width: '35px', fontSize: '11px', padding: '2px' }}
                >
                  {editValueType === 'number' && (
                    <>
                      <option value="">-</option>
                      <option value="k">k</option>
                      <option value="m">m</option>
                      <option value="b">b</option>
                    </>
                  )}
                  {editValueType === 'percent' && (
                    <option value="%">%</option>
                  )}
                  {editValueType === 'dollars' && (
                    <>
                      <option value="$">$</option>
                      <option value="k">$k</option>
                      <option value="m">$m</option>
                      <option value="b">$b</option>
                    </>
                  )}
                  {editValueType === 'time' && (
                    <>
                      <option value="sec">sec</option>
                      <option value="min">min</option>
                      <option value="hour">hour</option>
                      <option value="day">day</option>
                    </>
                  )}
                </UnitSelect>
              </TargetInput>

              <ButtonGroup style={{ marginTop: '3px', justifyContent: 'flex-end', gap: '3px' }}>
                <CancelButton
                  onClick={() => {
                    setEditTarget(metric.target);
                    setEditValueType(metric.valueType || 'number');
                    setIsEditingGoal(false);
                    setActiveEditOverlay(null);
                  }}
                  style={{ padding: '2px 4px', fontSize: '10px', minWidth: '35px' }}
                >
                  Cancel
                </CancelButton>
                <SaveButton
                  onClick={handleTargetSave}
                  style={{ padding: '2px 4px', fontSize: '10px', minWidth: '35px' }}
                >
                  Save
                </SaveButton>
              </ButtonGroup>
            </GoalEditContent>
          </GoalEditOverlay>
        )}

        {metric.id && onMoveUp && onMoveDown && (
          <DragHandle 
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onMouseDown={(e) => {
              const startY = e.clientY;
              let hasMoved = false;
              let direction = null;
              
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const currentY = moveEvent.clientY;
                const diff = currentY - startY;
                
                // Require a minimum movement to trigger direction change
                if (Math.abs(diff) > 20 && !hasMoved) {
                  hasMoved = true;
                  direction = diff > 0 ? 'down' : 'up';
                  
                  if (direction === 'up' && onMoveUp) {
                    onMoveUp();
                  } else if (direction === 'down' && onMoveDown) {
                    onMoveDown();
                  }
                }
              };
              
              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
        )}
        <MetricCell>
          <div style={{ width: '100%', textAlign: 'left' }}>
            {/* Metric Name - Editable */}
            <EditableField 
              onClick={handleNameEdit} 
              onMouseEnter={(e) => {
                if (metric.name.length > 20) {
                  setTooltipPosition({ 
                    x: e.clientX, 
                    y: e.clientY 
                  });
                  setShowTooltip(true);
                }
              }}
              onMouseMove={(e) => {
                if (showTooltip) {
                  setTooltipPosition({ 
                    x: e.clientX, 
                    y: e.clientY 
                  });
                }
              }}
              onMouseLeave={() => setShowTooltip(false)}
              style={{ fontWeight: 500, width: '100%', textAlign: 'left' }}
            >
              {metric.name}
            </EditableField>

            {/* Owner - Editable */}
            <OwnerInfo onClick={handleOwnerEdit} style={{ cursor: 'pointer' }}>
              {metric.owner.name}
            </OwnerInfo>

            <DeleteLink onClick={handleDelete}>×</DeleteLink>
          </div>
        </MetricCell>
        <GoalCell>
          <EditableField onClick={handleGoalEdit}>
            {formatGoal(metric.target, metric.valueType)}
          </EditableField>
        </GoalCell>
        {weeks.map(week => {
          // Skip showing clickable cells for metrics without IDs
          if (!metric.id) {
            return <EmptyCell key={week.id}>-</EmptyCell>;
          }
            
          const weeklyValue = weeklyValues.find(
            v => v.metricId === metric.id && v.weekId === week.id
          );

          if (!weeklyValue) {
            const isEditing = editingWeekId === week.id;
            
            const handleCreateValue = async () => {
              // Skip if empty or not a valid number
              if (newCellValue.trim() === '' || isNaN(parseFloat(newCellValue))) {
                setCellInputError('Please enter a valid number');
                return;
              }
              
              try {
                await handleUpdateValue(week.id, parseFloat(newCellValue), metric.target.unit);
                setEditingWeekId(null);
                setNewCellValue('');
                setCellInputError('');
              } catch (error) {
                console.error('Error adding value:', error);
              }
            };
            
            return (
              <EmptyCell key={week.id}>
                {isEditing ? (
                  <EditForm onSubmit={(e) => { e.preventDefault(); handleCreateValue(); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ValueInput
                        type="text"
                        value={newCellValue}
                        onChange={(e) => {
                          setNewCellValue(e.target.value);
                          if (cellInputError) setCellInputError('');
                        }}
                        placeholder={`In ${metric.target.unit || 'units'}`}
                        autoFocus
                        onBlur={() => {
                          if (newCellValue.trim() === '') {
                            setEditingWeekId(null);
                          } else {
                            handleCreateValue();
                          }
                        }}
                      />
                      <span>{metric.target.unit}</span>
                    </div>
                    {cellInputError && <InputError>{cellInputError}</InputError>}
                  </EditForm>
                ) : (
                  <div onClick={() => {
                    setEditingWeekId(week.id);
                    setNewCellValue('');
                    setCellInputError('');
                  }} style={{ fontSize: '0.75rem' }}>
                    Add {metric.target.unit ? `(${metric.target.unit})` : ''}
                  </div>
                )}
              </EmptyCell>
            );
          }

          const onTarget = isOnTarget(weeklyValue, metric.target);

          return (
            <EditableValueCell
              key={week.id}
              value={weeklyValue.value}
              unit={weeklyValue.unit}
              isOnTarget={onTarget}
              goalTarget={metric.target}
              valueType={metric.valueType}
              onSave={(value, unit) => handleUpdateValue(week.id, value, unit)}
            />
          );
        })}
      </Row>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <ModalOverlay onClick={handleCancelDelete}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalTitle>Delete Metric</ModalTitle>
            <ModalText>
              Are you sure you want to delete <strong>{metric.name}</strong>? This action cannot be undone.
              <br /><br />
              To confirm, please type the exact metric name:
            </ModalText>
            <ConfirmInput
              ref={confirmInputRef}
              type="text"
              value={confirmInput}
              onChange={e => setConfirmInput(e.target.value)}
              placeholder={metric.name.length > 25 ? "Type exact metric name to confirm" : `Type "${metric.name}" to confirm`}
            />
            <ButtonGroup>
              <CancelButton onClick={handleCancelDelete}>
                Cancel
              </CancelButton>
              <DeleteButton
                onClick={handleConfirmDelete}
                disabled={confirmInput !== metric.name}
              >
                Delete
              </DeleteButton>
            </ButtonGroup>
          </ModalContent>
        </ModalOverlay>
      )}
    </>
  );
};

export default MetricRow;