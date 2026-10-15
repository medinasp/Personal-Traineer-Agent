import { Alert } from "react-native";

/** Dialogo de confirmacao para acoes destrutivas (deletar). */
export function confirmDelete(
  title: string,
  message: string,
  onConfirm: () => void,
): void {
  Alert.alert(title, message, [
    { text: "Cancelar", style: "cancel" },
    { text: "Excluir", style: "destructive", onPress: onConfirm },
  ]);
}
