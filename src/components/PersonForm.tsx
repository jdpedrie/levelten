import React, { useState } from 'react';
import styled from 'styled-components';
import { Person } from '../models/types';

interface PersonFormProps {
  onSave: (person: Person) => void;
  initialPerson?: Person;
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

const PersonForm: React.FC<PersonFormProps> = ({ onSave, initialPerson }) => {
  const [person, setPerson] = useState<Person>(initialPerson || {
    id: '',
    name: '',
    email: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPerson(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate an ID if it's a new person
    const personToSave = person.id ? person : {
      ...person,
      id: `person-${Date.now()}`
    };
    
    onSave(personToSave);
  };

  return (
    <FormContainer>
      <FormTitle>{initialPerson ? 'Edit Person' : 'Add New Person'}</FormTitle>
      
      <form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="name">Name</Label>
          <Input 
            type="text" 
            id="name" 
            name="name" 
            value={person.name}
            onChange={handleChange}
            required
          />
        </FormGroup>
        
        <FormGroup>
          <Label htmlFor="email">Email</Label>
          <Input 
            type="email" 
            id="email" 
            name="email" 
            value={person.email}
            onChange={handleChange}
            required
          />
        </FormGroup>
        
        <Button type="submit">
          {initialPerson ? 'Update Person' : 'Add Person'}
        </Button>
      </form>
    </FormContainer>
  );
};

export default PersonForm;
