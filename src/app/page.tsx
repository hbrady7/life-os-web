import { Screen } from "@/components/screen";
import { TodayHeader } from "@/components/today/header";
import { SleepCard } from "@/components/today/sleep-card";
import { MorningBriefing } from "@/components/today/morning-briefing";
import { MorningRoutine } from "@/components/today/morning-routine";
import { EveningRoutine } from "@/components/today/evening-routine";
import { Goals } from "@/components/today/goals";
import { Workouts } from "@/components/today/workouts";
import { ReflectionCard } from "@/components/today/reflection";

export default function Page() {
  return (
    <Screen>
      <MorningBriefing />
      <TodayHeader />
      <SleepCard />
      <MorningRoutine />
      <Goals />
      <Workouts />
      <EveningRoutine />
      <ReflectionCard />
    </Screen>
  );
}
