import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ExerciseHistoryScreen } from "../screens/ExerciseHistoryScreen";
import { WorkoutFormScreen } from "../screens/WorkoutFormScreen";
import { WorkoutsListScreen } from "../screens/WorkoutsListScreen";
import type { WorkoutsStackParamList } from "./types";

const Stack = createNativeStackNavigator<WorkoutsStackParamList>();

export function WorkoutsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="WorkoutsList"
        component={WorkoutsListScreen}
        options={{ title: "Treinos" }}
      />
      <Stack.Screen
        name="WorkoutForm"
        component={WorkoutFormScreen}
        options={{ title: "Novo treino" }}
      />
      <Stack.Screen
        name="ExerciseHistory"
        component={ExerciseHistoryScreen}
        options={({ route }) => ({ title: route.params.exerciseName })}
      />
    </Stack.Navigator>
  );
}
