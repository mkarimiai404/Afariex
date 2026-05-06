import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// تابع تبدیل اعداد به فارسی
const toPersianNum = (num: string | number) => {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

// تبدیل قیمت با کاما و اعداد فارسی
const formatPrice = (price: number) => {
  const formatted = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return toPersianNum(formatted);
};

export default function DashboardScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('کاربر آفاریکس');
  const [walletBalance, setWalletBalance] = useState(0);
  const [unreadCount, setUnreadCount] = useState(1);

  useEffect(() => {
    // دریافت نام کاربر
    AsyncStorage.getItem('name').then((name) => {
      if (name) setUserName(name);
    });

    // تابع دریافت اطلاعات کاربر و موجودی از سرور
    const fetchUserData = async () => {
      try {
        // فرض می‌کنیم شناسه یا شماره کاربر در AsyncStorage ذخیره شده است
        const userId = await AsyncStorage.getItem('user_id'); // اگر کلید شما چیز دیگری است (مثل phone) اینجا تغییر دهید
        
        if (!userId) {
          // اگر کاربری لاگین نبود
          return;
        }

        const response = await fetch('http://mazhikeabi.com/API/get-user.php', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          // ارسال آیدی به بک‌اند برای دریافت موجودی همین شخص
          body: JSON.stringify({ user_id: userId }), 
        });

        const data = await response.json();
        
        // تنظیم موجودی بر اساس پاسخ دریافتی از سرور
        if (data && data.balance !== undefined) {
          setWalletBalance(Number(data.balance));
        } else if (data && data.status === 'success' && data.data && data.data.balance !== undefined) {
           setWalletBalance(Number(data.data.balance));
        }
      } catch (error) {
        console.error("Error fetching balance:", error);
        // در صورت بروز خطا در ارتباط با سرور می‌توانید مقدار پیش‌فرض یا آخرین موجودی ذخیره شده را نشان دهید
      }
    };

    fetchUserData();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* حذف هدر پیش‌فرض اکسپو روتر */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* پس‌زمینه اصلی که باعث میشه پنل به صورت باکس دیده بشه */}
      <View style={styles.outerBackground}>
        
        {/* باکس اصلی داشبورد با گوشه‌های گرد */}
        <View style={styles.boxedContainer}>
          
          <ScrollView style={styles.mainContent} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            
            {/* هدر داخلی */}
            <View style={styles.topHeader}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={22} color="#10a37f" />
                </View>
                <View style={styles.welcomeText}>
                  <Text style={styles.welcomeSub}>سلام، خوش آمدید</Text>
                  <Text style={styles.welcomeName}>{userName}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.notificationBtn} 
                onPress={() => router.push('/notifications' as any)}
              >
                <Ionicons name="notifications-outline" size={20} color="#4b5563" />
                {unreadCount > 0 && (
                  <View style={styles.notifBadgeIndicator} />
                )}
              </TouchableOpacity>
            </View>

            {/* کارت کیف پول با گرادیانت */}
            <LinearGradient
              colors={['#10a37f', '#0d8a6a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.walletCard}
            >
              <View style={styles.walletDecoration} />
              <Text style={styles.walletTitle}>موجودی کیف پول</Text>
              <View style={styles.walletBalanceContainer}>
                <Text style={styles.walletAmount}>{formatPrice(walletBalance)}</Text>
                <Text style={styles.walletCurrency}>تومان</Text>
              </View>

              {/* دکمه‌های کیف پول - اصلاح شده */}
              <View style={styles.walletActions}>
                <TouchableOpacity style={styles.btnDeposit} onPress={() => router.push('/add-balance' as any)}>
                  <Text style={styles.btnDepositText}>افزایش موجودی</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnHistory} onPress={() => router.push('/transactions-history' as any)}>
                  <Text style={styles.btnHistoryText}>تاریخچه</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* بخش خدمات */}
            <View style={styles.servicesSection}>
              <Text style={styles.sectionTitle}>خدمات آفاریکس</Text>
              
              <View style={styles.servicesGrid}>
                
              {/* آیتم 1: فعال */}
<TouchableOpacity style={styles.serviceItem} onPress={() => router.push('/add-remittance' as any)}>
  <View style={[styles.iconWrapper, { backgroundColor: '#e3f2fd' }]}>
    <MaterialCommunityIcons name="send" size={24} color="#1976d2" style={{ transform: [{ rotate: '-45deg' }] }} />
  </View>
  <Text style={styles.serviceText}>ارسال حواله</Text>
</TouchableOpacity>


                {/* آیتم 2: غیرفعال */}
                <View style={[styles.serviceItem, styles.disabledService]}>
                  <View style={styles.badgeSoon}><Text style={styles.badgeSoonText}>به زودی</Text></View>
                  <View style={[styles.iconWrapper, { backgroundColor: '#fff3e0' }]}>
                    <Ionicons name="flash" size={24} color="#f57c00" />
                  </View>
                  <Text style={styles.serviceText}>خرید شارژ</Text>
                </View>

                {/* آیتم 3: غیرفعال */}
                <View style={[styles.serviceItem, styles.disabledService]}>
                  <View style={styles.badgeSoon}><Text style={styles.badgeSoonText}>به زودی</Text></View>
                  <View style={[styles.iconWrapper, { backgroundColor: '#e8f5e9' }]}>
                    <Ionicons name="wallet" size={24} color="#388e3c" />
                  </View>
                  <Text style={styles.serviceText}>کیف پول</Text>
                </View>

                {/* آیتم 4: غیرفعال */}
                <View style={[styles.serviceItem, styles.disabledService]}>
                  <View style={styles.badgeSoon}><Text style={styles.badgeSoonText}>به زودی</Text></View>
                  <View style={[styles.iconWrapper, { backgroundColor: '#fce4ec' }]}>
                    <Ionicons name="car-sport" size={24} color="#c2185b" />
                  </View>
                  <Text style={styles.serviceText}>کرایه اسنپ</Text>
                </View>

                {/* آیتم 5: غیرفعال */}
                <View style={[styles.serviceItem, styles.disabledService]}>
                  <View style={styles.badgeSoon}><Text style={styles.badgeSoonText}>به زودی</Text></View>
                  <View style={[styles.iconWrapper, { backgroundColor: '#f3e5f5' }]}>
                    <Ionicons name="location" size={24} color="#7b1fa2" />
                  </View>
                  <Text style={styles.serviceText}>آدرس‌ها</Text>
                </View>

                {/* آیتم 6: غیرفعال */}
                <View style={[styles.serviceItem, styles.disabledService]}>
                  <View style={styles.badgeSoon}><Text style={styles.badgeSoonText}>به زودی</Text></View>
                  <View style={[styles.iconWrapper, { backgroundColor: '#efebe9' }]}>
                    <Ionicons name="headset" size={24} color="#5d4037" />
                  </View>
                  <Text style={styles.serviceText}>پشتیبانی</Text>
                </View>

              </View>
            </View>
          </ScrollView>

          {/* منوی پایین ثابت داخل باکس */}
          <View style={styles.bottomNav}>
            <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
              <Ionicons name="home" size={22} color="#10a37f" />
              <Text style={[styles.navText, styles.navTextActive]}>خانه</Text>
            </TouchableOpacity>
            
            {/* دکمه آپدیت شده */}
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/transactions-history' as any)}>
              <Ionicons name="swap-horizontal" size={22} color="#718096" />
              <Text style={styles.navText}>تراکنش‌ها</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile' as any)}>
              <Ionicons name="person-outline" size={22} color="#718096" />
              <Text style={styles.navText}>پروفایل</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7f9', 
  },
  outerBackground: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  boxedContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 30, 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  mainContent: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 15,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    backgroundColor: '#e6f6f2',
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  welcomeText: {
    justifyContent: 'center',
  },
  welcomeSub: {
    fontSize: 11,
    color: '#718096',
    textAlign: 'right',
    fontFamily: 'sans-serif',
  },
  welcomeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'right',
    marginTop: 2,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadgeIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    backgroundColor: '#ef4444',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  walletCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  walletDecoration: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 50,
  },
  walletTitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 8,
    textAlign: 'right',
  },
  walletBalanceContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  walletAmount: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  walletCurrency: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginRight: 5,
  },
  walletActions: {
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'space-between',
  },
  btnDeposit: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDepositText: {
    color: '#10a37f',
    fontSize: 13,
    fontWeight: 'bold',
  },
  btnHistory: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnHistoryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  servicesSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 15,
    textAlign: 'right',
  },
  servicesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
  },
  serviceItem: {
    width: (width - 90) / 3, 
    alignItems: 'center',
    marginBottom: 15,
  },
  disabledService: {
    opacity: 0.6,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceText: {
    fontSize: 11,
    color: '#2d3748',
    fontWeight: '500',
  },
  badgeSoon: {
    position: 'absolute',
    top: -5,
    right: 0,
    backgroundColor: '#e9d5ff',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    zIndex: 2,
  },
  badgeSoonText: {
    color: '#7e22ce',
    fontSize: 8,
    fontWeight: 'bold',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 64,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 4,
  },
  navItemActive: {
    backgroundColor: '#e6f6f2',
  },
  navText: {
    fontSize: 10,
    color: '#718096',
  },
  navTextActive: {
    color: '#10a37f',
    fontWeight: 'bold',
  },
});
