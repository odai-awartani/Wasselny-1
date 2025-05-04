import { Ride } from "@/types/type";

export const sortRides = (rides: Ride[]): Ride[] => {
  const result = rides.sort((a, b) => {
    const dateA = new Date(`${a.created_at}T${a.ride_time}`);
    const dateB = new Date(`${b.created_at}T${b.ride_time}`);
    return dateB.getTime() - dateA.getTime();
  });

  return result.reverse();
};

export const formatTime = (dateString: string) => {
  console.log('formatTime input:', dateString);
  
  if (!dateString || typeof dateString !== 'string') {
    console.log('Invalid time input');
    return '--:--';
  }

  // Directly parse the time part
  const timeMatch = dateString.match(/(\d{2}):(\d{2})$/);
  if (!timeMatch) {
    console.log('No time match found');
    return '--:--';
  }

  const [, hours, minutes] = timeMatch;
  const hour = parseInt(hours, 10);
  const minute = parseInt(minutes, 10);

  if (isNaN(hour) || isNaN(minute)) {
    console.log('Invalid hour or minute:', { hour, minute });
    return '--:--';
  }

  // Convert to 12-hour format
  const period = hour >= 12 ? 'م' : 'ص';
  const hour12 = hour % 12 || 12;

  const result = `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
  console.log('formatTime result:', result);
  return result;
};

export function formatDate(dateString: string): string {
  console.log('formatDate input:', dateString);
  
  if (!dateString || typeof dateString !== 'string') {
    console.log('Invalid date input');
    return '--/--/----';
  }

  // Directly parse the date part
  const dateMatch = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!dateMatch) {
    console.log('No date match found');
    return '--/--/----';
  }

  const [, day, month, year] = dateMatch;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) {
    console.log('Invalid date numbers:', { dayNum, monthNum, yearNum });
    return '--/--/----';
  }

  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const result = `${dayNum} ${months[monthNum - 1]} ${yearNum}`;
  console.log('formatDate result:', result);
  return result;
}

export const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // in km
    return distance;
};