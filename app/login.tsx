import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  ActivityIndicator
} from 'react-native';
import { useRouter, Stack } from 'expo-router'; // Stack اضافه شد
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

   const handleLogin = async () => {
    setErrorMessage(''); 

    if (!mobile || !password) {
      setErrorMessage('لطفاً شماره موبایل و رمز عبور را وارد کنید.');
      return;
    }

    setLoading(true);

    try {
      // استفاده از FormData برای سازگاری کامل با سرورهای PHP
      const formData = new FormData();
      formData.append('mobile', mobile);
      formData.append('password', password);

      // حتماً از https استفاده شود
      const response = await fetch('http://mazhikeabi.com/API/login.php', {
        method: 'POST',
        // نیازی به تعریف Content-Type نیست، fetch خودش برای FormData آن را تنظیم می‌کند
        body: formData,
      });

      const data = await response.json();

      if (data.status === 'success') {
        // ذخیره توکن و اطلاعات
        await AsyncStorage.setItem('userToken', data.data.api_token);
        await AsyncStorage.setItem('userMobile', data.data.mobile);
        
        if(data.data.name) {
           await AsyncStorage.setItem('userName', data.data.name);
        }
        
        const userId = data.data.id || data.data.user_id; 
        if(userId) {
           await AsyncStorage.setItem('user_id', String(userId));
        }

        router.replace('/dashboard');
      } else {
        setErrorMessage(data.message || 'شماره موبایل یا رمز عبور اشتباه است.');
      }
    } catch (error) {
      console.error('Login Error:', error);
      setErrorMessage('خطا در ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* این خط هدر پیش‌فرض را حذف می‌کند */}
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        <View style={styles.loginCard}>
          <Text style={styles.title}>ورود به حساب</Text>
          <Text style={styles.subtitle}>خوش برگشتید! لطفاً اطلاعات خود را وارد کنید.</Text>

          {errorMessage ? (
            <View style={styles.alertError}>
              <Text style={styles.alertErrorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>شماره موبایل</Text>
            <TextInput
              style={styles.input}
              placeholder="09123456789"
              placeholderTextColor="#b0b0b0"
              keyboardType="phone-pad"
              value={mobile}
              onChangeText={setMobile}
              maxLength={11}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>رمز عبور</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { paddingLeft: 45 }]} 
                placeholder="رمز عبور خود را وارد کنید"
                placeholderTextColor="#b0b0b0"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity 
                style={styles.eyeIconContainer} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeIconText}>👁</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.loginBtn} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginBtnText}>ورود</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/')}>
            <Text style={styles.backLink}>بازگشت به صفحه اصلی</Text>
          </TouchableOpacity>

        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7f9',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loginCard: {
    backgroundColor: '#ffffff',
    width: '90%',
    maxWidth: 420,
    minHeight: 550,
    paddingHorizontal: 30,
    paddingVertical: 40,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 3,
    justifyContent: 'center',
  },
  title: {
    color: '#333333',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    marginBottom: 30,
    textAlign: 'center',
  },
  alertError: {
    backgroundColor: '#fdedec',
    borderColor: '#f5b7b1',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  alertErrorText: {
    color: '#c0392b',
    fontSize: 14,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    color: '#333333',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    fontSize: 14,
    color: '#333',
    textAlign: 'left', 
    backgroundColor: '#fff',
  },
  passwordContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeIconContainer: {
    position: 'absolute',
    left: 15,
    zIndex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingRight: 10,
  },
  eyeIconText: {
    fontSize: 18,
    color: '#888',
  },
  loginBtn: {
    backgroundColor: '#20b28a',
    width: '100%',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 25,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backLink: {
    color: 'rgb(31, 31, 31)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  }
});
