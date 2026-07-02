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

import { fetchJson } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { showError } from '@/lib/toast';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

   const handleLogin = async () => {
    if (!mobile || !password) {
      showError('خطا', 'لطفاً شماره موبایل و رمز عبور را وارد کنید.');
      return;
    }

    setLoading(true);

    try {
      // استفاده از FormData برای سازگاری کامل با سرورهای PHP
      const formData = new FormData();
      formData.append('mobile', mobile);
      formData.append('password', password);

      const data = await fetchJson<any>('login.php', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        // نیازی به تعریف Content-Type نیست، fetch خودش برای FormData آن را تنظیم می‌کند
        body: formData,
      });

      if (data.status === 'success') {
        const fullName = data.data.full_name || data.data.name;
        const userId = data.data.id || data.data.user_id; 
        signIn({
          userToken: data.data.api_token ? String(data.data.api_token) : null,
          userMobile: data.data.mobile ? String(data.data.mobile) : null,
          userName: fullName ? String(fullName) : null,
          userId: userId ? String(userId) : null,
        });

        router.replace('/dashboard');
      } else {
        showError('خطا در ورود', data.message || 'شماره موبایل یا رمز عبور اشتباه است.');
      }
    } catch (error) {
      console.error('Login Error:', error);
      if (error instanceof Error) {
        console.log('[Login] error message:', error.message);
        console.log('[Login] error cause:', error.cause);
      }
      showError('خطای ارتباط', 'خطا در ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
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

      <ScrollView contentContainerStyle={styles.pageWrapper} keyboardShouldPersistTaps="handled">
        
        <View style={styles.loginCard}>
          <Text style={styles.title}>ورود به حساب</Text>
          <Text style={styles.subtitle}>خوش برگشتید! لطفاً اطلاعات خود را وارد کنید.</Text>

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
    backgroundColor: '#ffffff',
  },
  pageWrapper: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: 20,
    paddingBottom: 70,
  },
  loginCard: {
    backgroundColor: 'transparent',
    width: '100%',
    maxWidth: 420,
    minHeight: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    shadowColor: '#000',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    justifyContent: 'center',
  },
  title: {
    color: '#333333',
    fontSize: 24,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    fontFamily: 'Vazirmatn',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    color: '#333333',
    fontSize: 13,
    fontFamily: 'Vazirmatn',
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
    fontFamily: 'Vazirmatn',
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
    fontFamily: 'Vazirmatn',
    color: '#888',
  },
  loginBtn: {
    backgroundColor: '#0ed874',
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
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
  },
  backLink: {
    color: 'rgb(31, 31, 31)',
    fontSize: 14,
    fontFamily: 'Vazirmatn',
    textAlign: 'center',
    marginTop: 10,
  }
});
