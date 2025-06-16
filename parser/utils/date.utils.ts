// Helper function to parse date string in multiple formats
export function parseDateTime(dateString: string): Date {
    // Handle space-separated format: "2024-01-15 10:30:00"
    if (dateString.includes(' ') && !dateString.includes('T')) {
      return new Date(dateString.replace(" ", "T"));
    }
    
    // Handle ISO format: "2025-01-14T16:17:19.000"
    return new Date(dateString);
  }