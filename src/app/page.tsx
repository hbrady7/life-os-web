import { Screen } from "@/components/screen";
import { TodayHeader } from "@/components/today/header";
import { PulseStrip } from "@/components/today/pulse-strip";
import { MorningBriefing } from "@/components/today/morning-briefing";
import { Goals } from "@/components/today/goals";
import { HabitsGrid } from "@/components/today/habits-grid";
import { Workouts } from "@/components/today/workouts";
import { PlanTomorrowSection } from "@/components/today/plan-tomorrow";
import { WinsSection } from "@/components/today/wins";
import { StrugglesSection } from "@/components/today/struggles";
import { ReflectionCard } from "@/components/today/reflection";

export default function Page() {
  return (
    <Screen>
      <MorningBriefing />
      <TodayHeader />
      <PulseStrip />
      <Goals />
      <HabitsGrid />
      <Workouts />
      <PlanTomorrowSection />
      <WinsSection />
      <StrugglesSection />
      <ReflectionCard />
    </Screen>
  );
}
