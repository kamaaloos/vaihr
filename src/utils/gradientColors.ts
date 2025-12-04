/**
 * Utility function to get gradient colors based on theme mode
 * Provides professional, readable gradients for both light and dark modes
 */

export const getGradientColors = (isDarkMode: boolean): readonly [string, string] => {
  if (isDarkMode) {
    // Professional dark mode gradient: Deep blue to darker blue
    // These colors provide good contrast and readability
    return ['#1a1f3a', '#2d3561'] as const; // Deep navy to medium blue
  } else {
    // Light mode gradient: Light blue to primary blue
    return ['#DAF2FB', '#4083FF'] as const;
  }
};

export const getSurfaceColors = (isDarkMode: boolean) => {
  return {
    background: isDarkMode ? '#121212' : '#F8F9FD',
    surface: isDarkMode ? '#1e1e1e' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#333333',
    textSecondary: isDarkMode ? '#B0B0B0' : '#757575',
    border: isDarkMode ? '#333333' : '#E0E0E0',
  };
};

