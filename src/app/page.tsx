import { Screen } from "@/components/screen";
import { TodayHeader } from "@/components/today/header";
import { PulseStrip } from "@/components/today/pulse-strip";
import { MorningBriefing } from "@/components/today/morning-briefing";
import { MorningRoutine } from "@/components/today/morning-routine";
import { EveningRoutine } from "@/components/today/evening-routine";
import { Goals } from "@/components/today/goals";
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
      <MorningRoutine />
      <Goals />
      <Workouts />
      <WinsSection />
      <StrugglesSection />
      <PlanTomorrowSection />
      <EveningRoutine />
      <ReflectionCard />
    </Screen>
  );
}
