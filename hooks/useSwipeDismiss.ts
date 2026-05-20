import { CSSProperties, TouchEvent, useMemo, useRef, useState } from 'react';

type SwipeDirection = 'right' | 'down' | 'both';

interface UseSwipeDismissOptions {
  direction?: SwipeDirection;
  threshold?: number;
  onDismiss: () => void;
}

interface TouchPoint {
  x: number;
  y: number;
}

const NO_OFFSET = { x: 0, y: 0 };
const GESTURE_LOCK_THRESHOLD = 12;

type GestureState = 'idle' | 'pending' | 'dragging' | 'ignored';

export const useSwipeDismiss = ({
  direction = 'both',
  threshold = 80,
  onDismiss,
}: UseSwipeDismissOptions) => {
  const startPointRef = useRef<TouchPoint | null>(null);
  const gestureStateRef = useRef<GestureState>('idle');
  const [offset, setOffset] = useState(NO_OFFSET);
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    startPointRef.current = null;
    gestureStateRef.current = 'idle';
    setOffset(NO_OFFSET);
    setIsDragging(false);
  };

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    startPointRef.current = { x: touch.clientX, y: touch.clientY };
    gestureStateRef.current = 'pending';
  };

  const onTouchMove = (event: TouchEvent<HTMLElement>) => {
    if (!startPointRef.current) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - startPointRef.current.x;
    const deltaY = touch.clientY - startPointRef.current.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (gestureStateRef.current === 'ignored') {
      return;
    }

    if (gestureStateRef.current === 'pending') {
      if (absDeltaX < GESTURE_LOCK_THRESHOLD && absDeltaY < GESTURE_LOCK_THRESHOLD) {
        return;
      }

      if (direction === 'right') {
        if (deltaX > 0 && absDeltaX > absDeltaY) {
          gestureStateRef.current = 'dragging';
          setIsDragging(true);
        } else {
          gestureStateRef.current = 'ignored';
        }
        return;
      }

      if (direction === 'down') {
        if (deltaY > 0 && absDeltaY > absDeltaX) {
          gestureStateRef.current = 'dragging';
          setIsDragging(true);
        } else {
          gestureStateRef.current = 'ignored';
        }
        return;
      }

      if ((deltaX > 0 && absDeltaX >= absDeltaY) || (deltaY > 0 && absDeltaY > absDeltaX)) {
        gestureStateRef.current = 'dragging';
        setIsDragging(true);
      } else {
        gestureStateRef.current = 'ignored';
      }
    }

    if (gestureStateRef.current !== 'dragging') {
      return;
    }

    if (direction === 'right') {
      setOffset({ x: Math.max(0, deltaX), y: 0 });
      return;
    }

    if (direction === 'down') {
      setOffset({ x: 0, y: Math.max(0, deltaY) });
      return;
    }

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      setOffset({ x: Math.max(0, deltaX), y: 0 });
      return;
    }

    setOffset({ x: 0, y: Math.max(0, deltaY) });
  };

  const onTouchEnd = () => {
    const shouldDismiss =
      gestureStateRef.current === 'dragging' && (
      offset.x >= threshold ||
      offset.y >= threshold
      );

    reset();

    if (shouldDismiss) {
      onDismiss();
    }
  };

  const style = useMemo<CSSProperties>(
    () => ({
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      transition: isDragging ? 'none' : 'transform 180ms ease-out',
    }),
    [isDragging, offset.x, offset.y],
  );

  return {
    bind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: reset,
    },
    style,
  };
};
