import { ProjectGrid } from "../../../components/dashboard/ProjectGrid";

export const metadata = { title: "Dashboard — ELove" };

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Thiep cua toi</h1>
      </div>
      <ProjectGrid />
    </div>
  );
}
