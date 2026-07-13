export default function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <b title={value}>{value}</b>
    </div>
  );
}
