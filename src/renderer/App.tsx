import { useEffect } from 'react';
import { PetAvatar } from './components/PetAvatar/PetAvatar';
import { usePetMoodStore } from './stores/petMoodStore';

export function App() {
  const setMood = usePetMoodStore((s) => s.setMood);

  // Sincroniza el estado inicial con el proceso Main (fuente de verdad).
  useEffect(() => {
    if (!window.aurapetAPI) return;
    void window.aurapetAPI.pet.getState().then((state) => setMood(state.mood));
  }, [setMood]);

  return (
    <main className="flex h-full w-full flex-col">
      <PetAvatar />
    </main>
  );
}