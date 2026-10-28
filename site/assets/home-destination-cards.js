// Make the Budapest and Marvão home cards navigate when their photo or
// non-interactive text is clicked. Existing links remain keyboard accessible.
(() => {
  const cards = document.querySelectorAll(
    '#destinations .destination-card:not(.destination-card--coming-soon)'
  );
  for (const card of cards) {
    const destinationLink = card.querySelector('h3 .tour-detail-link[href]');
    if (!destinationLink) continue;
    card.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 ||
          event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      // Preserve independent behavior of actual links and controls.
      if (event.target?.closest?.('a, button, input, select, textarea, [role="button"], [role="link"]')) return;
      // Dragging across a card's description may end with a click event.
      // Respect text selection instead of unexpectedly navigating away.
      if (document.getSelection?.()?.toString().trim()) return;
      destinationLink.click();
    });
  }
})();
