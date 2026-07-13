export default function SectionHeading({ title, suffix }: { title: string; suffix?: string }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {suffix ? <span>{suffix}</span> : null}
    </div>
  );
}
