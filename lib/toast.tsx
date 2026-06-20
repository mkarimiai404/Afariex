import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';

export const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#21b08c', borderLeftWidth: 6, borderRadius: 12 }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontSize: 14, fontWeight: '700' }}
      text2Style={{ fontSize: 13 }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#e74c3c', borderLeftWidth: 6, borderRadius: 12 }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontSize: 14, fontWeight: '700' }}
      text2Style={{ fontSize: 13 }}
    />
  ),
};

export const showSuccess = (title: string, message?: string) => {
  Toast.show({
    type: 'success',
    text1: title,
    text2: message,
    position: 'top',
    visibilityTime: 2500,
  });
};

export const showError = (title: string, message?: string) => {
  Toast.show({
    type: 'error',
    text1: title,
    text2: message,
    position: 'top',
    visibilityTime: 3000,
  });
};
