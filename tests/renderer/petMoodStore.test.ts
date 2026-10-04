import { beforeEach, describe, expect, it } from 'vitest';
import {
  createInitialPetMoodState,
  selectCanBlink,
  selectIsAlert,
  selectIsSleepy,
  usePetMoodStore,
} from '../../src/renderer/stores/petMoodStore';

describe('usePetMoodStore', () => {
  beforeEach(() => {
    usePetMoodStore.getState().reset();
  });

  it('arranca en idle, con el cursor centrado y sin parpadear', () => {
    expect(usePetMoodStore.getState()).toMatchObject({
      mood: 'idle',
      cursor: { x: 0, y: 0 },
      isBlinking: false,
    });
  });

  it('createInitialPetMoodState devuelve un objeto nuevo cada vez', () => {
    const first = createInitialPetMoodState();
    const second = createInitialPetMoodState();

    // Si se compartiera la referencia, un consumidor podria mutar el estado.
    expect(first).not.toBe(second);
    expect(first.cursor).not.toBe(second.cursor);
    expect(first).toEqual(second);
  });

  it('setMood cambia el animo', () => {
    usePetMoodStore.getState().setMood('happy');

    expect(usePetMoodStore.getState().mood).toBe('happy');
  });

  // Importante a 60 fps: sin esta guarda, mover el cursor re-renderiza de mas.
  it('setMood no notifica si el animo no cambia', () => {
    let notifications = 0;
    const unsubscribe = usePetMoodStore.subscribe(() => {
      notifications += 1;
    });

    usePetMoodStore.getState().setMood('idle');
    expect(notifications).toBe(0);

    usePetMoodStore.getState().setMood('alert');
    expect(notifications).toBe(1);

    unsubscribe();
  });

  it('setCursor guarda la posicion normalizada', () => {
    usePetMoodStore.getState().setCursor(-0.5, 0.25);

    expect(usePetMoodStore.getState().cursor).toEqual({ x: -0.5, y: 0.25 });
  });

  it('setCursor reemplaza el objeto en vez de mutarlo', () => {
    const before = usePetMoodStore.getState().cursor;
    usePetMoodStore.getState().setCursor(1, -1);

    expect(usePetMoodStore.getState().cursor).not.toBe(before);
    expect(before).toEqual({ x: 0, y: 0 });
  });

  it('setBlinking cambia el estado de parpadeo', () => {
    usePetMoodStore.getState().setBlinking(true);

    expect(usePetMoodStore.getState().isBlinking).toBe(true);
  });

  it('setBlinking no notifica si el valor no cambia', () => {
    let notifications = 0;
    const unsubscribe = usePetMoodStore.subscribe(() => {
      notifications += 1;
    });

    usePetMoodStore.getState().setBlinking(false);
    expect(notifications).toBe(0);

    usePetMoodStore.getState().setBlinking(true);
    expect(notifications).toBe(1);

    unsubscribe();
  });

  it('el parpadeo es independiente del animo', () => {
    usePetMoodStore.getState().setMood('alert');
    usePetMoodStore.getState().setBlinking(true);

    expect(usePetMoodStore.getState().mood).toBe('alert');
    expect(usePetMoodStore.getState().isBlinking).toBe(true);
  });

  it('reset vuelve al estado inicial', () => {
    const { setMood, setCursor, setBlinking, reset } = usePetMoodStore.getState();

    setMood('alert');
    setCursor(1, -1);
    setBlinking(true);
    reset();

    expect(usePetMoodStore.getState()).toMatchObject(createInitialPetMoodState());
  });
});

describe('selectores de petMoodStore', () => {
  beforeEach(() => {
    usePetMoodStore.getState().reset();
  });

  it('selectIsSleepy solo es true con el animo sleepy', () => {
    expect(selectIsSleepy(usePetMoodStore.getState())).toBe(false);

    usePetMoodStore.getState().setMood('sleepy');

    expect(selectIsSleepy(usePetMoodStore.getState())).toBe(true);
  });

  it('selectIsAlert solo es true con el animo alert', () => {
    expect(selectIsAlert(usePetMoodStore.getState())).toBe(false);

    usePetMoodStore.getState().setMood('alert');

    expect(selectIsAlert(usePetMoodStore.getState())).toBe(true);
  });

  it('selectCanBlink es false solo con el animo sleepy', () => {
    expect(selectCanBlink(usePetMoodStore.getState())).toBe(true);

    usePetMoodStore.getState().setMood('sleepy');
    expect(selectCanBlink(usePetMoodStore.getState())).toBe(false);

    usePetMoodStore.getState().setMood('alert');
    expect(selectCanBlink(usePetMoodStore.getState())).toBe(true);
  });
});