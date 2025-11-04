// Example: Using the generated Petstore SDK in a React application

import React, { useEffect } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Import from generated SDK
import {
  petstoreReducer,
  listPets,
  createPet,
  getPetById,
  selectListPetsData,
  selectListPetsLoading,
  selectListPetsError,
  petstoreClient,
} from '../output/petstore-sdk';

// Configure Redux Store
const store = configureStore({
  reducer: {
    petstore: petstoreReducer,
  },
});

type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

// Configure API client (optional)
petstoreClient.setAuthToken('your-jwt-token-here');

// Example Component: Pet List
function PetList() {
  const dispatch = useDispatch<AppDispatch>();
  const pets = useSelector((state: RootState) => selectListPetsData(state));
  const loading = useSelector((state: RootState) => selectListPetsLoading(state));
  const error = useSelector((state: RootState) => selectListPetsError(state));

  useEffect(() => {
    // Fetch pets with optional parameters
    dispatch(listPets({ limit: 10, tag: 'cats' }));
  }, [dispatch]);

  if (loading) {
    return <div>Loading pets...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h2>Pet List</h2>
      <ul>
        {pets?.map((pet) => (
          <li key={pet.id}>
            {pet.name} - {pet.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Example Component: Create Pet Form
function CreatePetForm() {
  const dispatch = useDispatch<AppDispatch>();
  const [name, setName] = React.useState('');
  const [tag, setTag] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Dispatch create pet action
    const result = await dispatch(
      createPet({
        data: {
          name,
          tag,
          status: 'available',
        },
      })
    );

    if (createPet.fulfilled.match(result)) {
      console.log('Pet created successfully:', result.payload);
      // Refresh the pet list
      dispatch(listPets({}));
      // Reset form
      setName('');
      setTag('');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Add New Pet</h2>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Pet name"
        required
      />
      <input
        type="text"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="Tag (optional)"
      />
      <button type="submit">Create Pet</button>
    </form>
  );
}

// Example: Direct API Client Usage (without Redux)
async function directApiUsage() {
  try {
    // Fetch all pets
    const petsResponse = await petstoreClient.listPets({ limit: 10 });
    console.log('Pets:', petsResponse.data);

    // Get specific pet
    const petResponse = await petstoreClient.getPetById({ petId: 'pet-123' });
    console.log('Pet:', petResponse.data);

    // Create new pet
    const newPetResponse = await petstoreClient.createPet({
      name: 'Fluffy',
      tag: 'cats',
      status: 'available',
    });
    console.log('New pet created:', newPetResponse.data);

    // Update pet
    const updatedPetResponse = await petstoreClient.updatePet(
      { petId: 'pet-123' },
      {
        name: 'Updated Fluffy',
        tag: 'cats',
        status: 'sold',
      }
    );
    console.log('Pet updated:', updatedPetResponse.data);

    // Delete pet
    await petstoreClient.deletePet({ petId: 'pet-123' });
    console.log('Pet deleted');
  } catch (error) {
    console.error('API Error:', error);
  }
}

// Main App
function App() {
  return (
    <Provider store={store}>
      <div className="App">
        <h1>Petstore Demo</h1>
        <CreatePetForm />
        <PetList />
      </div>
    </Provider>
  );
}

export default App;
