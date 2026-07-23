type SwipeSession = {
  dialog: HTMLElement;
  startX: number;
  startY: number;
  startScrollTop: number;
  direction: 'pending' | 'horizontal' | 'vertical';
};

let swipeSession: SwipeSession | null = null;

function getTouch(event: TouchEvent): Touch | null {
  return event.touches[0] ?? event.changedTouches[0] ?? null;
}

function handleTouchStart(event: TouchEvent) {
  if (!(event.target instanceof Element)) return;
  const dialog = event.target.closest<HTMLElement>('.card-detail-dialog');
  const touch = getTouch(event);
  if (!dialog || !touch) return;

  swipeSession = {
    dialog,
    startX: touch.clientX,
    startY: touch.clientY,
    startScrollTop: dialog.scrollTop,
    direction: 'pending',
  };
}

function handleTouchMove(event: TouchEvent) {
  const session = swipeSession;
  const touch = getTouch(event);
  if (!session || !touch) return;

  const deltaX = touch.clientX - session.startX;
  const deltaY = touch.clientY - session.startY;
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (session.direction === 'pending' && Math.max(horizontalDistance, verticalDistance) >= 8) {
    session.direction = horizontalDistance >= verticalDistance * 1.6 ? 'horizontal' : 'vertical';
  }

  if (session.direction !== 'horizontal') return;

  event.preventDefault();
  if (session.dialog.scrollTop !== session.startScrollTop) {
    session.dialog.scrollTop = session.startScrollTop;
  }
}

function clearSwipeSession() {
  swipeSession = null;
}

document.addEventListener('touchstart', handleTouchStart, { passive: true });
document.addEventListener('touchmove', handleTouchMove, { passive: false });
document.addEventListener('touchend', clearSwipeSession, { passive: true });
document.addEventListener('touchcancel', clearSwipeSession, { passive: true });
