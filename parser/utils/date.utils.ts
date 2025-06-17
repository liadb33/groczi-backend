// Helper function to parse date string in multiple formats
export function parseDateTime(dateString: string): Date {
    // Handle Victory format with forward slashes: "2021/12/13 10:15"
    if (dateString.includes('/') && dateString.includes(' ')) {
      // Convert "2021/12/13 10:15" to "2021-12-13T10:15"
      const [datePart, timePart] = dateString.split(' ');
      const convertedDate = datePart.replace(/\//g, '-') + 'T' + timePart;
      return new Date(convertedDate);
    }
    
    // Handle space-separated format: "2024-01-15 10:30:00"
    if (dateString.includes(' ') && !dateString.includes('T')) {
      return new Date(dateString.replace(" ", "T"));
    }
    
    // Handle ISO format: "2025-01-14T16:17:19.000"
    return new Date(dateString);
  }