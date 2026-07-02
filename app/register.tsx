import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchJson } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { showError, showSuccess } from '@/lib/toast';

export default function RegisterScreen() {
  const router = useRouter(); 
  const { signIn } = useAuth();

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const generatedPin = Math.floor(10000 + Math.random() * 90000).toString();
    setPin(generatedPin);
  }, []);

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    let strength = 0;
    if (val.length >= 8) strength++;
    if (val.match(/[a-z]/) && val.match(/[A-Z]/)) strength++;
    if (val.match(/[0-9]/)) strength++;
    setPasswordStrength(strength);
  };

  const getStrengthColor = () => {
    if (passwordStrength === 1) return '#e74c3c';
    if (passwordStrength === 2) return '#f39c12';
    if (passwordStrength === 3) return '#2ecc71';
    return 'transparent';
  };

  // اتصال به API ثبت‌نام با دامنه جدید
  const handleRegister = async () => {
    if (loading) return;

    if (!fullName || !mobile || !pin || !password) {
      showError('خطا', 'لطفاً تمام فیلدها را پر کنید.');
      return;
    }

    setLoading(true);

    try {
      const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ');

      const data = await fetchJson<any>('register.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
          pin_code: pin,
          mobile,
          pin,
          password,
        }),
      });

      const normalizedStatus = String(data?.status ?? '').toLowerCase();
      const isSuccess = data?.success === true || normalizedStatus === 'true' || normalizedStatus === 'success' || normalizedStatus === '1';

      if (isSuccess) {
        const userId = data.data?.id || data.data?.user_id;
        signIn({
          userToken: data.data?.api_token ? String(data.data.api_token) : null,
          userId: userId ? String(userId) : null,
          userName: fullName ? String(fullName) : null,
          userMobile: mobile ? String(mobile) : null,
        });
        showSuccess('ثبت نام موفق', 'اکنون وارد حساب خود شوید.');
        router.replace('/login');
      } else {
        showError('خطا در ثبت نام', data.message || 'مشکلی پیش آمده است. لطفاً مجدداً تلاش کنید.');
      }
    } catch (error) {
      console.log('[Register] full error object', error);
      console.log('[Register] error details', {
        message: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error ? error.cause : undefined,
      });
      if (error instanceof Error) {
        console.log('[Register] error message:', error.message);
        console.log('[Register] error cause:', error.cause);
      }
      showError('خطای ارتباط', 'خطا در برقراری ارتباط با سرور.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.pageWrapper}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>ثبت نام</Text>
              <Text style={styles.subtitle}>برای ساخت حساب کاربری، اطلاعات زیر را وارد کنید.</Text>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>نام و نام خانوادگی</Text>
              <TextInput
                style={styles.input}
                placeholder="مثلاً: علی محمدی"
                value={fullName}
                onChangeText={setFullName}
                textAlign="right"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>شماره موبایل</Text>
              <TextInput
                style={styles.input}
                placeholder="09123456789"
                keyboardType="phone-pad"
                value={mobile}
                onChangeText={setMobile}
                textAlign="left"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>کد اختصاصی شما</Text>
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={pin}
                editable={false}
                textAlign="center"
              />
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>این کد برای ورودهای بعدی لازم است. لطفاً آن را یادداشت کنید.</Text>
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>رمز عبور</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                  placeholder="رمز عبور خود را وارد کنید"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={handlePasswordChange}
                  textAlign="left"
                />
                <TouchableOpacity 
                  style={styles.toggleBtn} 
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.toggleText}>{showPassword ? 'مخفی' : 'نمایش'}</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.strengthMeter}>
                <View 
                  style={[
                    styles.strengthBar, 
                    { 
                      width: `${(passwordStrength / 3) * 100}%`,
                      backgroundColor: getStrengthColor()
                    }
                  ]} 
                />
              </View>
            </View>

            <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>ثبت نام</Text>}
            </TouchableOpacity>

            <Link href="/" asChild>
              <TouchableOpacity style={styles.backLink}>
                <Text style={styles.backLinkText}>بازگشت به صفحه اصلی</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  card: {
    backgroundColor: 'transparent',
    width: '100%',
    maxWidth: 420,
    padding: 0,
    borderRadius: 0,
    shadowColor: '#000',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  header: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 8, fontFamily: 'Vazirmatn' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', fontFamily: 'Vazirmatn' },
  inputWrapper: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#333', marginBottom: 6, textAlign: 'right', fontFamily: 'Vazirmatn' },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff', color: '#333', fontFamily: 'Vazirmatn' },
  readOnlyInput: { backgroundColor: '#f9f9f9', color: '#555', fontWeight: 'bold', letterSpacing: 2, fontFamily: 'Vazirmatn' },
  warningBox: { backgroundColor: 'rgba(231, 76, 60, 0.08)', padding: 10, borderRadius: 8, marginTop: 8 },
  warningText: { color: '#e74c3c', fontSize: 12, textAlign: 'right', fontFamily: 'Vazirmatn' },
  passwordContainer: { flexDirection: 'row-reverse', alignItems: 'center' },
  toggleBtn: { borderWidth: 1, borderColor: '#e0e0e0', borderRightWidth: 0, borderTopLeftRadius: 8, borderBottomLeftRadius: 8, padding: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  toggleText: { color: '#0ed874', fontSize: 13, fontWeight: 'bold', fontFamily: 'Vazirmatn' },
  strengthMeter: { height: 4, backgroundColor: '#dce0e5', borderRadius: 4, marginTop: 8, flexDirection: 'row-reverse', overflow: 'hidden' },
  strengthBar: { height: '100%' },
  submitBtn: { backgroundColor: '#0ed874', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  submitBtnDisabled: { opacity: 0.75 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: 'Vazirmatn' },
  backLink: { marginTop: 20, alignItems: 'center' },
  backLinkText: { color: '#333', fontSize: 14, fontFamily: 'Vazirmatn' },
});
