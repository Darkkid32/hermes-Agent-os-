import { ExecutionBus, type ExecutionBusEvent, type ExecutionEventType } from "./ExecutionEventBus";

export type { ExecutionBusEvent, ExecutionEventType };

export function subscribeExecutionEvents(
  callback: (event: ExecutionBusEvent) => void,
  filterType?: ExecutionEventType
): () => void {
  const listener = (event: ExecutionBusEvent) => {
    if (filterType && event.type !== filterType) return;
    callback(event);
  };
  return ExecutionBus.subscribe(listener);
}

export { ExecutionBus };
