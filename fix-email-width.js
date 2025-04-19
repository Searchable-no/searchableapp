// Fix Email Width Script
// How to use:
// 1. Add this file to your public folder
// 2. Include it in your HTML with a script tag:
//    <script src="/fix-email-width.js"></script>
// 3. Or paste this code directly into your browser console when viewing emails

(function() {
  // Run immediately and also set up to run whenever DOM changes
  function fixEmailWidth() {
    console.log("Running email width fix...");
    
    // Override max-width constraints in parent containers
    const maxWidthContainers = document.querySelectorAll('.max-w-3xl');
    maxWidthContainers.forEach(container => {
      container.style.maxWidth = '100%';
      container.style.width = '100%';
    });
    
    // Target all space-y-* classes which might be constraining width
    const spaceYContainers = document.querySelectorAll('[class*="space-y"]');
    spaceYContainers.forEach(container => {
      container.style.width = '100%';
      container.style.maxWidth = '100%';
    });
    
    // Find Microsoft or Azure content specifically
    const azureContainers = Array.from(document.querySelectorAll('img'))
      .filter(img => img.src.includes('Microsoft') || img.src.includes('Azure') || 
                    (img.alt && (img.alt.includes('Microsoft') || img.alt.includes('Azure'))))
      .map(img => img.closest('div'));
    
    azureContainers.forEach(container => {
      if (container) {
        // Apply to the container and all its parent divs
        let current = container;
        while (current && current.tagName === 'DIV') {
          current.style.width = '100%';
          current.style.maxWidth = '100%';
          current.style.minWidth = '100%';
          current = current.parentElement;
        }
      }
    });
    
    // Force all tables to be full width
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      if (table.hasAttribute('width') || table.style.width) {
        table.setAttribute('width', '100%');
        table.style.width = '100%';
        table.style.maxWidth = '100%';
      }
    });
    
    // Fix all fixed-width divs and containers
    const fixedWidthDivs = document.querySelectorAll('div[style*="width"]');
    fixedWidthDivs.forEach(div => {
      if (div.style.width && div.style.width.includes('px')) {
        div.style.width = '100%';
        div.style.maxWidth = '100%';
      }
    });
    
    // Find center tags and remove their width restriction
    const centers = document.querySelectorAll('center');
    centers.forEach(center => {
      // Instead of removing, set width to 100%
      center.style.width = '100%';
      center.style.maxWidth = '100%';
    });
  }
  
  // Run immediately
  fixEmailWidth();
  
  // Set up a mutation observer to watch for DOM changes
  const observer = new MutationObserver(() => {
    fixEmailWidth();
  });
  
  // Start observing the document
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also run when images load as they can affect layout
  window.addEventListener('load', fixEmailWidth);
  
  // Run periodically to catch any missed changes
  setInterval(fixEmailWidth, 1000);
  
  console.log("Email width fix script installed");
})(); 