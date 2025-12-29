// Table of Contents Generator
document.addEventListener('DOMContentLoaded', function() {
  const tocList = document.getElementById('toc-list');
  const content = document.querySelector('.post__content');
  
  if (!tocList || !content) return;
  
  // Find all h2 headings in the post content
  const headings = content.querySelectorAll('h2');
  
  if (headings.length === 0) {
    // Hide TOC if no headings
    const tocNav = document.querySelector('.post-toc');
    if (tocNav) tocNav.style.display = 'none';
    return;
  }
  
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
  
  // Smooth scroll
  document.querySelectorAll('.toc-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
