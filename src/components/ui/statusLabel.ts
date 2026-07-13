export function statusLabel(status: string): string {
  if (status === "ready_to_connect") return "Ready";
  if (status === "ready_to_configure") return "Configure";
  if (status === "missing_dependency") return "Missing";
  return status;
}
