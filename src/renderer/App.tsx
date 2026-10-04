import { useEffect } from 'react';
import { PetAvatar } from './components/PetAvatar/PetAvatar';
import { useCursorTracking } from './hooks';
import { usePetMoodStore } from './stores/petMoodStore';
import { useSettingsStore } from './stores/settingsStore';

export function App() {
  const setMood = usePetMoodStore((s) => s.setMood);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  /**
   * El seguimiento del cursor se monta aqui y no dentro de PetAvatar: es un
   * listener de ventana, no de la mascota. Asi sigue funcionando aunque el
   * avatar se oculte o se reescriba, y cualquier otro componente puede
   * consumir el mismo tracker.
   */
  useCursorTracking();

  // Los ajustes se piden a su cuenta: hydrate() ya contempla que Main no
  // este disponible y nunca debe bloquear el arranque.
  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  // Sincroniza el animo inicial con el proceso Main (fuente de verdad).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.aurapetAPI) return;
    void window.aurapetAPI.pet.getState().then((state) => setMood(state.mood));
  }, [setMood]);

  return (
    <main className="flex h-full w-full flex-col">
      <PetAvatar />
    </main>
  );
}