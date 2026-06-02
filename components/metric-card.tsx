import { ArrowUpRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <CardTitle className="text-4xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between pt-0">
        <p className="max-w-[18rem] text-sm text-muted-foreground">{detail}</p>
        <div className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
