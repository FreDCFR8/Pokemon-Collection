type StoredPageStyles = {
  scrollY: number;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  documentOverflow: string;
};

let storedStyles: StoredPageStyles | null = null;

function hasOpenSetsOverlay(): boolean {
  return document.querySelector('.sets-page-set-overlay') !== null;
}

function lockPageScroll() {
  if (storedStyles) return;

  const bodyStyle = document.body.style;
  storedStyles = {
    scrollY: window.scrollY,
    bodyOverflow: bodyStyle.overflow,
    bodyPosition: bodyStyle.position,
    bodyTop: bodyStyle.top,
    bodyWidth: bodyStyle.width,
    documentOverflow: document.documentElement.style.overflow,
  };

  bodyStyle.overflow = 'hidden';
  bodyStyle.position = 'fixed';
  bodyStyle.top = `-${storedStyles.scrollY}px`;
  bodyStyle.width = '100%';
  document.documentElement.style.overflow = 'hidden';
}

function unlockPageScroll() {
  if (!storedStyles) return;

  const previous = storedStyles;
  storedStyles = null;
  const bodyStyle = document.body.style;

  bodyStyle.overflow = previous.bodyOverflow;
  bodyStyle.position = previous.bodyPosition;
  bodyStyle.top = previous.bodyTop;
  bodyStyle.width = previous.bodyWidth;
  document.documentElement.style.overflow = previous.documentOverflow;
  window.scrollTo(0, previous.scrollY);
}

function synchronizeSetsOverlayScrollLock() {
  if (hasOpenSetsOverlay()) lockPageScroll();
  else unlockPageScroll();
}

const observer = new MutationObserver(synchronizeSetsOverlayScrollLock);
observer.observe(document.documentElement, { childList: true, subtree: true });
synchronizeSetsOverlayScrollLock();

window.addEventListener('pagehide', unlockPageScroll);
