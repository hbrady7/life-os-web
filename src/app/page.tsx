import { Screen } from "@/components/screen";
import { TodayHeader } from "@/components/today/header";
import { PulseStrip } from "@/components/today/pulse-strip";
import { MorningBriefing } from "@/components/today/morning-briefing";
import { MorningRoutine } from "@/components/today/morning-routine";
import { EveningRoutine } from "@/components/today/evening-routine";
import { Nutrition } from "@/components/today/nutrition";
import { Goals } from "@/components/today/goals";
import { Schedule } from "@/components/today/schedule";
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
      <Nutrition />
      <MorningRoutine />
      <Goals />
      <Schedule />
      <HabitsGrid />
      <Workouts />
      <PlanTomorrowSection />
      <WinsSection />
      <StrugglesSection />
      <EveningRoutine />
      <ReflectionCard />
    </Screen>
  );
}
