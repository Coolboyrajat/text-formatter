// Theme management functionality
(function() {
  "use strict";
  
  // Setup for both server and browser environments
  const isNode = typeof window === 'undefined';
  
  // Theme toggle functionality - updated to use icon font
  window.updateThemeIcon = function(isDarkMode, iconElement) {
      if (isDarkMode) {
          // Switch to dark mode icon
          iconElement.classList.remove('icon-light');
          iconElement.classList.add('icon-dark');
      } else {
          // Switch to light mode icon
          iconElement.classList.remove('icon-dark');
          iconElement.classList.add('icon-light');
      }
  };

  function updateThemeButtonIcon(isDarkMode) {
      const themeIcon = document.querySelector('#theme-toggle .icon');
      if (themeIcon && window.updateThemeIcon) {
          window.updateThemeIcon(isDarkMode, themeIcon);
      }
  }

  // Event listener for when the DOM content is loaded
  document.addEventListener('DOMContentLoaded', function() {
      // Apply theme based on saved preference or system preference
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

      if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
          document.body.classList.add('dark-mode');
          updateThemeButtonIcon(true);
      }

      // Add click event for theme toggle
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
          themeToggle.addEventListener('click', function() {
              const isDarkMode = document.body.classList.toggle('dark-mode');
              localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
              updateThemeButtonIcon(isDarkMode);
          });
      }
  });

})();