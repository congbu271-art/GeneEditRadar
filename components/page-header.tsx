import { Radar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] glass-panel border-none shadow-soft p-8 md:p-10 mb-8">
      <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
        <Radar className="h-48 w-48 text-cyan-600" />
      </div>
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-700/70">
            {eyebrow}
          </p>
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-slate-900 leading-[1.1]">
            <span className="text-gradient">{title}</span>
          </h1>
          <p className="max-w-2xl text-base text-slate-500 leading-relaxed">{description}</p>
        </div>
        {actions ? <div className="relative flex flex-wrap gap-4">{actions}</div> : null}
      </div>
    </section>
  );
}
