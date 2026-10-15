import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootTabParamList = {
  Inicio: undefined;
  Treinos: NavigatorScreenParams<WorkoutsStackParamList> | undefined;
  HojeTab: NavigatorScreenParams<TodayStackParamList> | undefined;
  Coach: undefined;
  Ajustes: undefined;
};

export type RootTabProps<T extends keyof RootTabParamList> = BottomTabScreenProps<
  RootTabParamList,
  T
>;

export type WorkoutsStackParamList = {
  WorkoutsList: undefined;
  WorkoutForm: { workoutId?: number } | undefined;
  ExerciseHistory: { exerciseId: number; exerciseName: string };
};

export type WorkoutsScreenProps<T extends keyof WorkoutsStackParamList> =
  NativeStackScreenProps<WorkoutsStackParamList, T>;

export type TodayStackParamList = {
  ChooseWorkout: undefined;
  Session: { sessionId: number; workoutId: number; title: string; resumed?: boolean };
  ExerciseLog: {
    sessionId: number;
    exerciseId: number;
    exerciseName: string;
    targetSets: number;
    workoutId: number;
    title: string;
    resumed?: boolean;
  };
};

export type TodayScreenProps<T extends keyof TodayStackParamList> =
  NativeStackScreenProps<TodayStackParamList, T>;
