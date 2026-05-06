import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RegisterScreen() {
  const router = useRouter(); 

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

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
    if (!fullName || !mobile || !password) {
      Alert.alert('خطا', 'لطفاً تمام فیلدها را پر کنید.');
      return;
    }

    try {
      const response = await fetch('http://mazhikeabi.com/API/register.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fullName,
          mobile: mobile,
          password: password,
          pin: pin
        }),
      });

      const data = await response.json();

      if (data.status === 'true' || data.success) {
        // ذخیره توکن و آیدی کاربر برای استفاده در سایر صفحات
        if (data.data?.api_token) {
          await AsyncStorage.setItem('userToken', data.data.api_token);
        }
        if (data.data?.id || data.data?.user_id) {
          await AsyncStorage.setItem('userId', String(data.data.id || data.data.user_id));
        }
        
        // هدایت به داشبورد
        router.replace('/dashboard' as any);
      } else {
        Alert.alert('خطا در ثبت نام', data.message || 'مشکلی پیش آمده است. لطفاً مجدداً تلاش کنید.');
      }
    } catch (error) {
      Alert.alert('خطای ارتباط', 'خطا در برقراری ارتباط با سرور.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
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

            <TouchableOpacity style={styles.submitBtn} onPress={handleRegister}>
              <Text style={styles.submitBtnText}>ثبت نام</Text>
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
    backgroundColor: '#f6f7f9',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    width: '90%',
    maxWidth: 420,
    padding: 30,
    borderRadius: 16,
    elevation: 3,
  },
  header: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  inputWrapper: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#333', marginBottom: 6, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff', color: '#333' },
  readOnlyInput: { backgroundColor: '#f9f9f9', color: '#555', fontWeight: 'bold', letterSpacing: 2 },
  warningBox: { backgroundColor: 'rgba(231, 76, 60, 0.08)', padding: 10, borderRadius: 8, marginTop: 8 },
  warningText: { color: '#e74c3c', fontSize: 12, textAlign: 'right' },
  passwordContainer: { flexDirection: 'row-reverse', alignItems: 'center' },
  toggleBtn: { borderWidth: 1, borderColor: '#e0e0e0', borderRightWidth: 0, borderTopLeftRadius: 8, borderBottomLeftRadius: 8, padding: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  toggleText: { color: '#21b08c', fontSize: 13, fontWeight: 'bold' },
  strengthMeter: { height: 4, backgroundColor: '#dce0e5', borderRadius: 4, marginTop: 8, flexDirection: 'row-reverse', overflow: 'hidden' },
  strengthBar: { height: '100%' },
  submitBtn: { backgroundColor: '#21b08c', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  backLink: { marginTop: 20, alignItems: 'center' },
  backLinkText: { color: '#333', fontSize: 14 },
});
