import { Text, TextInput } from 'react-native';

let applied = false;

export function applyGlobalFont() {
  if (applied) return;
  applied = true;

  const TextAny = Text as any;
  const TextInputAny = TextInput as any;

  TextAny.defaultProps = TextAny.defaultProps || {};
  TextInputAny.defaultProps = TextInputAny.defaultProps || {};

  TextAny.defaultProps.style = [{ fontFamily: 'Vazirmatn' }, TextAny.defaultProps.style];
  TextInputAny.defaultProps.style = [{ fontFamily: 'Vazirmatn' }, TextInputAny.defaultProps.style];
}
