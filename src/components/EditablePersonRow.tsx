import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Person } from '../models/types';

interface EditablePersonRowProps {
  person?: Person; // Optional for new people
  onSave: (person: Person) => Promise<void>;
  onDelete?: (person: Person) => Promise<boolean>; // Returns a Promise that resolves to true if deletion succeeded
  isNew?: boolean;
  metricCount?: number; // Number of metrics assigned to this person
  canDelete?: boolean; // Whether this person can be deleted
}

const Row = styled.div<{ $isNew?: boolean }>`
  display: flex;
  border-bottom: 1px solid #eee;
  background-color: ${props => props.$isNew ? '#f9f9f9' : 'white'};
  padding: 10px 12px;
  cursor: pointer;
  font-size: 0.9rem;
  
  &:hover {
    background-color: ${props => props.$isNew ? '#f9f9f9' : '#f5f5f5'};
  }
`;

const PersonContainer = styled.div`
  flex: 1;
`;

const PersonName = styled.div`
  font-weight: 500;
  margin-bottom: 4px;
`;

const PersonEmail = styled.div`
  color: #666;
  font-size: 0.9em;
`;

const DeleteLink = styled.span`
  color: #dc3545;
  font-size: 0.75rem;
  cursor: pointer;
  display: inline-block;
  
  &:hover {
    text-decoration: underline;
  }
`;

const MetricInfo = styled.span`
  color: #6c757d;
  font-size: 0.75rem;
  font-style: italic;
  display: inline-block;
`;

const EditForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
`;

const FormRow = styled.div`
  display: flex;
  gap: 12px;
`;

const Input = styled.input`
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 13px;
  flex: 1;
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 6px;
`;

const Button = styled.button`
  padding: 5px 10px;
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
`;

const CancelButton = styled(Button)`
  background-color: #f5f5f5;
  color: #333;
  
  &:hover {
    background-color: #e5e5e5;
  }
`;

const DeleteButton = styled(Button)<{ disabled?: boolean }>`
  background-color: ${props => props.disabled ? '#f5a5a5' : '#dc3545'};
  color: white;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.7 : 1};
  
  &:hover {
    background-color: ${props => props.disabled ? '#f5a5a5' : '#c82333'};
  }
`;

const ConfirmDeleteContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
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

const ErrorMessage = styled.div`
  color: #dc3545;
  padding: 10px;
  margin-bottom: 15px;
  background-color: #f8d7da;
  border-radius: 4px;
  font-size: 14px;
`;

const ModalButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const EditablePersonRow: React.FC<EditablePersonRowProps> = ({ 
  person,
  onSave,
  onDelete,
  isNew = false,
  metricCount = 0,
  canDelete = true
}) => {
  const emptyPerson: Person = {
    id: '',
    name: '',
    email: ''
  };

  const [editedPerson, setEditedPerson] = useState<Person>(person || emptyPerson);
  const [isEditing, setIsEditing] = useState(isNew);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  
  // useEffect no longer needed as we're getting canDelete and metricCount as props

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedPerson(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSave = async () => {
    // Simple validation
    if (!editedPerson.name || !editedPerson.email) {
      alert('Please fill in the required fields: Name and Email');
      return;
    }
    
    // Generate an ID if it's a new person (though the server will do this now)
    const personToSave = editedPerson.id ? editedPerson : {
      ...editedPerson,
      id: `person-${Date.now()}`
    };
    
    try {
      await onSave(personToSave);
      
      if (isNew) {
        // Reset form for adding another person
        setEditedPerson(emptyPerson);
      } else {
        // Close edit mode for existing person
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error saving person:', error);
      alert('Failed to save person. Please try again.');
    }
  };
  
  const handleCancel = () => {
    if (isNew) {
      // Reset to empty state for new people
      setEditedPerson(emptyPerson);
    } else {
      // Reset to original person data
      setEditedPerson(person!);
      setIsEditing(false);
    }
  };
  
  const handleDelete = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('Delete button clicked for person:', person);
    console.log('onDelete handler available:', !!onDelete);
    
    if (person && onDelete) {
      console.log('Opening delete confirmation for:', person);
      setShowDeleteConfirm(true);
    } else {
      console.error('Cannot delete: person or onDelete handler missing', { 
        hasPerson: !!person, 
        hasDeleteHandler: !!onDelete 
      });
    }
  };
  
  const confirmDelete = async () => {
    console.log('Confirming delete for:', person, 'Entered text:', deleteConfirmText);
    
    try {
      if (deleteConfirmText === person!.name && onDelete) {
        console.log('Delete confirmed, executing onDelete');
        
        // Clear any previous errors
        setDeleteError('');
        
        // Try to delete the person
        const success = await onDelete(person!);
        console.log('Delete result:', success);
        
        if (success) {
          console.log('Delete succeeded');
          setShowDeleteConfirm(false);
        } else {
          console.log('Delete failed - person still has metrics assigned');
          setDeleteError('Cannot delete this person because they are still assigned as the owner of one or more metrics. Please reassign those metrics to another person first.');
        }
      } else {
        console.log('Text mismatch or missing onDelete handler', {
          textMatch: deleteConfirmText === person!.name,
          hasOnDelete: !!onDelete
        });
      }
    } catch (error) {
      console.error('Error during delete operation:', error);
      setDeleteError('An error occurred while trying to delete this person. Please try again.');
    }
  };

  if (isEditing) {
    return (
      <Row $isNew={isNew}>
        <div style={{ width: '100%' }}>
          <FormRow>
            <Input
              type="text"
              name="name"
              value={editedPerson.name}
              onChange={handleInputChange}
              placeholder="Name"
              required
            />
            <Input
              type="email"
              name="email"
              value={editedPerson.email}
              onChange={handleInputChange}
              placeholder="Email"
              required
            />
          </FormRow>
          <ButtonsContainer>
            <SaveButton type="button" onClick={handleSave}>Save</SaveButton>
            <CancelButton type="button" onClick={handleCancel}>Cancel</CancelButton>
          </ButtonsContainer>
        </div>
      </Row>
    );
  }

  return (
    <>
      <Row $isNew={isNew}>
        <PersonContainer onClick={() => setIsEditing(true)}>
          <PersonName>{person?.name}</PersonName>
          <PersonEmail>{person?.email}</PersonEmail>
          
          {!isNew && (
            <div style={{ marginTop: '8px' }}>
              {canDelete && onDelete ? (
                <DeleteLink 
                  onClick={(e) => { 
                    console.log('Delete link clicked');
                    e.stopPropagation(); 
                    handleDelete(e); 
                  }}
                >
                  delete
                </DeleteLink>
              ) : (
                <MetricInfo>
                  {metricCount} associated metric{metricCount !== 1 ? 's' : ''}
                </MetricInfo>
              )}
            </div>
          )}
        </PersonContainer>
      </Row>
      
      {showDeleteConfirm && (
        <ConfirmDeleteContainer 
          onClick={(e) => {
            e.preventDefault();
            console.log('Overlay clicked');
            setShowDeleteConfirm(false);
            setDeleteConfirmText('');
            setDeleteError('');
          }}
        >
          <ConfirmDeleteModal 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Modal clicked');
            }}
          >
            <ModalTitle>Delete Person</ModalTitle>
            
            {deleteError ? (
              <ErrorMessage>{deleteError}</ErrorMessage>
            ) : (
              <>
                <ModalText>
                  Are you sure you want to delete "{person!.name}"? 
                  This action cannot be undone.
                </ModalText>
                <ModalText>
                  Type the person's name to confirm:
                </ModalText>
                <Input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={`Type "${person!.name}" to confirm`}
                  onKeyPress={e => {
                    if (e.key === 'Enter' && deleteConfirmText === person!.name) {
                      confirmDelete();
                    }
                  }}
                  autoFocus
                  style={{
                    borderColor: deleteConfirmText && deleteConfirmText !== person!.name ? '#dc3545' : '#ddd'
                  }}
                />
                <div style={{ 
                  fontSize: '12px', 
                  marginTop: '4px', 
                  color: deleteConfirmText === person!.name ? '#28a745' : '#6c757d',
                  fontStyle: 'italic'
                }}>
                  {deleteConfirmText ? (
                    deleteConfirmText === person!.name ? 
                      '✓ Name matches - you can now delete' : 
                      '✗ Name does not match exactly'
                  ) : 'Enter the full name to enable deletion'}
                </div>
              </>
            )}
            <ModalButtons>
              <CancelButton 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Modal cancel button clicked');
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                  setDeleteError('');
                }}
              >
                {deleteError ? 'Close' : 'Cancel'}
              </CancelButton>
              
              {!deleteError && (
                <DeleteButton 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Modal delete button clicked');
                    confirmDelete();
                  }}
                  disabled={deleteConfirmText !== person!.name}
                  title={deleteConfirmText !== person!.name ? 
                    "Type the full name exactly to enable deletion" : 
                    "Click to delete this person"}
                >
                  Delete
                </DeleteButton>
              )}
            </ModalButtons>
          </ConfirmDeleteModal>
        </ConfirmDeleteContainer>
      )}
    </>
  );
};

export default EditablePersonRow;