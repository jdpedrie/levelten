import React from 'react';
import styled from 'styled-components';
import { Metric, Person } from '../models/types';
import EditablePersonRow from './EditablePersonRow';

interface PeopleManagerProps {
  people: Person[];
  onSavePerson: (person: Person) => Promise<void>;
  onDeletePerson: (person: Person) => Promise<boolean>;
  metrics?: Metric[];
}

const Container = styled.div`
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin: 20px 0;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 16px;
  background-color: #f5f5f5;
  border-bottom: 2px solid #ddd;
  font-weight: 600;
  display: flex;
`;

const HeaderColumn = styled.div`
  flex: 1;
`;

const PeopleContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const NoDataMessage = styled.div`
  padding: 24px;
  text-align: center;
  color: #666;
  font-style: italic;
`;

const PeopleManager: React.FC<PeopleManagerProps> = ({ 
  people, 
  onSavePerson, 
  onDeletePerson,
  metrics = []
}) => {
  return (
    <Container>
      <Header>
        <HeaderColumn>People</HeaderColumn>
      </Header>
      
      <PeopleContainer>
        {people.length === 0 ? (
          <NoDataMessage>No people added yet. Use the form below to add someone.</NoDataMessage>
        ) : (
          people.map(person => {
            // Calculate number of metrics owned by this person
            const metricCount = metrics.filter(metric => 
              metric.owner && metric.owner.id === person.id
            ).length;
            
            return (
              <EditablePersonRow
                key={person.id}
                person={person}
                metricCount={metricCount}
                onSave={onSavePerson}
                onDelete={onDeletePerson}
                canDelete={metricCount === 0}
              />
            );
          })
        )}
        
        {/* Empty row to add a new person */}
        <EditablePersonRow
          onSave={onSavePerson}
          isNew={true}
        />
      </PeopleContainer>
    </Container>
  );
};

export default PeopleManager;