import { CheckCheck, Circle, FileText } from "lucide-react";

export function NodeStatusBadge({ status }: { status: string }) {
  const ready = ["Ready", "Learned", "Success", "Active", "ACTIVE"].includes(
    status,
  );
  const draft = status.toLowerCase() === "draft";
  const Icon = ready ? CheckCheck : draft ? FileText : Circle;
  return (
    <span
      className={`node-status inline-flex max-w-full items-center gap-1.5 text-xs leading-5 whitespace-nowrap ${ready ? "text-success" : draft ? "text-muted" : status.toLowerCase() === "failed" ? "text-danger" : "text-warning"}`}
    >
      <Icon size={13} aria-hidden="true" />
      {status}
    </span>
  );
}
