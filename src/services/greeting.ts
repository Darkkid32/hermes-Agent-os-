export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Good Night";
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}
