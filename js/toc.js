// Table of Contents Generator
document.addEventListener('DOMContentLoaded', function() {
  const tocList = document.getElementById('toc-list');
  const tocCompact = document.getElementById('toc-compact');
  const tocToggle = document.getElementById('toc-toggle');
  const tocDropdown = document.getElementById('toc-dropdown');
  const tocIcon = document.getElementById('toc-icon');
  const content = document.querySelector('.post__content');
  
  if (!tocList || !content) return;
  
  // Find all h2 headings in the post content
  const headings = content.querySelectorAll('h2');
  
  if (headings.length === 0) {
    // Hide TOC if no headings
    if (tocCompact) tocCompact.style.display = 'none';
    return;
  }
  
  // Set horizontal bars based on number of headings
  const bars = '▬'.repeat(headings.length);
  tocIcon.textContent = bars;
  
  // Generate TOC items
  headings.forEach((heading, index) => {
    // Add an ID to the heading for anchor links
    const id = `heading-${index}`;
    heading.id = id;
    
    // Create TOC list item
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${id}`;
    a.textContent = heading.textContent;
    a.classList.add('toc-link');
    
    li.appendChild(a);
    tocList.appendChild(li);
  });
  
  // Toggle dropdown
  let isOpen = false;
  tocToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    isOpen = !isOpen;
    tocDropdown.classList.toggle('is-open', isOpen);
    tocToggle.classList.toggle('is-active', isOpen);
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!tocCompact.contains(e.target) && isOpen) {
      isOpen = false;
      tocDropdown.classList.remove('is-open');
      tocToggle.classList.remove('is-active');
    }
  });
  
  // Smooth scroll and close dropdown on link click
  document.querySelectorAll('.toc-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Close dropdown
        isOpen = false;
        tocDropdown.classList.remove('is-open');
        tocToggle.classList.remove('is-active');
      }
    });
  });
  
  // Highlight active section on scroll
  let observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        document.querySelectorAll('.toc-link').forEach(link => {
          link.classList.remove('active');
        });
        const activeLink = document.querySelector(`.toc-link[href="#${id}"]`);
        if (activeLink) activeLink.classList.add('active');
      }
    });
  }, {
    rootMargin: '-20% 0px -70% 0px'
  });
  
  headings.forEach(heading => {
    observer.observe(heading);
  });
});
