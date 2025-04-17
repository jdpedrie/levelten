import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { Person } from '../models/types';

interface SegueProps {
  people: Person[];
}

const SegueContainer = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const CardsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  margin-bottom: 30px;
  max-width: 1000px;
`;

const PersonCard = styled.div<{ $selected: boolean; $visited: boolean }>`
  width: 200px;
  height: 100px;
  padding: 16px;
  border-radius: 8px;
  background-color: ${props => 
    props.$selected 
      ? '#0066cc' 
      : props.$visited 
        ? '#f5f5f5' 
        : 'white'
  };
  color: ${props => 
    props.$selected 
      ? 'white' 
      : props.$visited 
        ? '#999' 
        : '#333'
  };
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  transition: all 0.3s ease;
  border: 1px solid ${props => 
    props.$selected 
      ? '#0052a3' 
      : props.$visited 
        ? '#ddd' 
        : '#ccc'
  };
  opacity: ${props => 
    props.$visited && !props.$selected 
      ? 0.7 
      : 1
  };
`;

const PersonName = styled.div`
  font-weight: 600;
  font-size: 18px;
  margin-bottom: 8px;
  text-align: center;
`;

const PersonEmail = styled.div`
  font-size: 14px;
  color: inherit;
  opacity: 0.8;
`;

const NextButton = styled.button`
  padding: 10px 24px;
  background-color: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: #0052a3;
  }
  
  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const CompletionMessage = styled.div`
  font-size: 18px;
  color: #137333;
  margin-top: 20px;
  padding: 12px 24px;
  background-color: #e6f4ea;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Segue: React.FC<SegueProps> = ({ people }) => {
  const navigate = useNavigate();
  
  // Shuffle people array and maintain state
  const [shuffledPeople, setShuffledPeople] = useState<Person[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState(false);
  
  // Shuffle the people array on component mount
  useEffect(() => {
    if (people.length > 0) {
      const shuffled = [...people].sort(() => Math.random() - 0.5);
      setShuffledPeople(shuffled);
      
      // Mark the first person as visited
      if (shuffled.length > 0) {
        setVisited(new Set([shuffled[0].id]));
      }
    }
  }, [people]);
  
  const handleNext = () => {
    if (currentIndex < shuffledPeople.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      
      // Add the next person to visited set
      setVisited(prev => {
        const newSet = new Set(prev);
        newSet.add(shuffledPeople[nextIndex].id);
        return newSet;
      });
    } else {
      // All people have been visited
      setCompleted(true);
    }
  };
  
  const goToScorecard = () => {
    navigate('/scorecard');
  };
  
  // No people to display
  if (shuffledPeople.length === 0) {
    return (
      <SegueContainer>
        <h2>No people available</h2>
      </SegueContainer>
    );
  }
  
  return (
    <SegueContainer>
      <h2 style={{ marginBottom: '30px' }}>Segue Randomizer</h2>
      
      <CardsContainer>
        {shuffledPeople.map((person, index) => (
          <PersonCard 
            key={person.id}
            $selected={index === currentIndex}
            $visited={visited.has(person.id) && index !== currentIndex}
          >
            <PersonName>{person.name}</PersonName>
            <PersonEmail>{person.email}</PersonEmail>
          </PersonCard>
        ))}
      </CardsContainer>
      
      {completed ? (
        <CompletionMessage>
          <span role="img" aria-label="check">✅</span>
          All people have been selected!
        </CompletionMessage>
      ) : (
        <NextButton 
          onClick={currentIndex === shuffledPeople.length - 1 ? goToScorecard : handleNext} 
          disabled={shuffledPeople.length <= 1}
        >
          {currentIndex === shuffledPeople.length - 1 ? "Scorecard" : "Next Person"}
        </NextButton>
      )}
    </SegueContainer>
  );
};

export default Segue;