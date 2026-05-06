import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons'; // برای آیکون پشتیبانی
import { useRouter, Stack } from 'expo-router'; // Stack اضافه شد
import AsyncStorage from '@react-native-async-storage/async-storage'; // اضافه شدن AsyncStorage

export default function WelcomeScreen() {
  const router = useRouter();

  // اضافه شدن منطق بررسی وضعیت ورود (لاگین)
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        // فرض می‌کنیم در زمان لاگین، user_id را ذخیره کرده‌اید
        const userId = await AsyncStorage.getItem('user_id');
        
        if (userId) {
          // اگر کاربر قبلاً لاگین کرده بود، مستقیما به داشبورد منتقل شود
          router.replace('/dashboard' as any);
        }
      } catch (error) {
        console.error("Error checking login status:", error);
      }
    };

    checkLoginStatus();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* این خط هدر پیش‌فرض را حذف می‌کند */}
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.card}>
        {/* بخش لوگو */}
        <View style={styles.logoContainer}>
          {/* آدرس عکس رو میتونی بعدا با عکس خودت توی پوشه assets جایگزین کنی */}
          <Image 
            source={{ uri: 'https://via.placeholder.com/90' }} 
            style={styles.logo} 
            resizeMode="contain"
          />
        </View>

        {/* عناوین */}
        <Text style={styles.title}>به آفاریکس خوش آمدید</Text>
        <Text style={styles.subtitle}>سامانه جامع خدمات مالی و حواله</Text>

        {/* دکمه‌های اصلی */}
        <TouchableOpacity 
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => router.push('/login')} // آدرس صفحه لاگین که بعدا میسازیم
        >
          <Text style={styles.btnPrimaryText}>ورود به حساب کاربری</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btn, styles.btnOutline]}
          onPress={() => router.push('/register')} // آدرس صفحه ثبت نام
        >
          <Text style={styles.btnOutlineText}>ثبت‌نام با شماره موبایل</Text>
        </TouchableOpacity>

        {/* خط جداکننده */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>یا</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* دکمه گوگل */}
        <View style={styles.googleBtn}>
          <View style={styles.badgeSoon}>
            <Text style={styles.badgeSoonText}>به زودی</Text>
          </View>
          <Text style={styles.googleBtnText}>ورود با گوگل</Text>
        </View>

        {/* فاصله پرکن برای هل دادن پشتیبانی به پایین */}
        <View style={{ flex: 1 }} />

        {/* لینک پشتیبانی */}
        <TouchableOpacity style={styles.supportLink}>
          <Text style={styles.supportLinkText}>تماس با پشتیبانی</Text>
          <Feather name="headphones" size={18} color="#666" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    width: '90%',
    maxWidth: 420,
    minHeight: 550,
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 30,
    alignItems: 'center',
    // تنظیمات سایه برای iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    // تنظیمات سایه برای اندروید
    elevation: 3,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logo: {
    width: 90,
    height: 90,
  },
  title: {
    fontSize: 22,
    color: '#333',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: '#777',
    fontSize: 14,
    marginBottom: 40,
    textAlign: 'center',
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    marginBottom: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#2eb886',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2eb886',
  },
  btnOutlineText: {
    color: '#2eb886',
    fontSize: 15,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#eee',
  },
  dividerText: {
    color: '#bbb',
    fontSize: 13,
    marginHorizontal: 10,
  },
  googleBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#fcfcfc',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 35,
    position: 'relative',
  },
  googleBtnText: {
    color: '#666',
    fontSize: 14,
  },
  badgeSoon: {
    position: 'absolute',
    left: 15, // چون صفحه راست‌چین است، سمت چپ قرار می‌دهیم
    backgroundColor: '#ff9800',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeSoonText: {
    color: 'white',
    fontSize: 11,
  },
  supportLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  supportLinkText: {
    color: '#666',
    fontSize: 14,
    marginRight: 8,
  },
});
