import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ChooseWorkoutScreen } from "../screens/ChooseWorkoutScreen";
import { ExerciseLogScreen } from "../screens/ExerciseLogScreen";
import { SessionScreen } from "../screens/SessionScreen";
import type { TodayStackParamList } from "./types";

const Stack = createNativeStackNavigator<TodayStackParamList>();

export function TodayStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ChooseWorkout"
        component={ChooseWorkoutScreen}
        options={{ title: "Diário" }}
      />
      <Stack.Screen
        name="Session"
        component={SessionScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
      <Stack.Screen
        name="ExerciseLog"
        component={ExerciseLogScreen}
        options={({ route }) => ({ title: route.params.exerciseName })}
      />
    </Stack.Navigator>
  );
}
