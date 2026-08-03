import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showError, showSuccess } from '@/lib/toast';

const RUBIKA_ID = '@Afariex';
const RUBIKA_URL = 'https://rubika.ir/Afariex2026';

const quickHelp = [
  { icon: 'receipt-outline' as const, text: 'وضعیت سفارش‌ها را در بخش سفارش‌ها بررسی کنید.' },
  { icon: 'shield-checkmark-outline' as const, text: 'وضعیت احراز هویت را در سطح دسترسی مشاهده کنید.' },
  { icon: 'refresh-outline' as const, text: 'از آخرین نسخه اپلیکیشن استفاده کنید.' },
];

const faqs = ['چگونه موجودی خود را افزایش دهم؟', 'چگونه سطح کاربری خود را ارتقا دهم؟', 'چگونه با پشتیبانی تماس بگیرم؟'];

export default function SupportScreen() {
  const router = useRouter();

  const handleRubika = async () => {
    try {
      if (await Linking.canOpenURL(RUBIKA_URL)) {
        await Linking.openURL(RUBIKA_URL);
        return;
      }
    } catch {
      // A failed deep link falls back to copying the public support ID.
    }

    try {
      await Clipboard.setStringAsync(RUBIKA_ID);
      showSuccess('آیدی کپی شد', 'آیدی روبیکا در کلیپ‌بورد ذخیره شد.');
    } catch {
      showError('خطا', 'امکان باز کردن یا کپی آیدی روبیکا وجود ندارد.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="بازگشت">
              <Ionicons name="arrow-forward" size={21} color="#233b49" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>پشتیبانی</Text>
            <View style={styles.headerSpace} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <LinearGradient colors={['#123e4e', '#147d70']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
              <View style={styles.heroCircle} />
              <View style={styles.heroIcon}><Ionicons name="headset-outline" size={31} color="#b9f4df" /></View>
              <Text style={styles.heroTitle}>پشتیبانی آفاریکس</Text>
              <Text style={styles.heroSubtitle}>در صورت داشتن سوال یا مشکل، تیم پشتیبانی آماده پاسخگویی به شماست.</Text>
              <View style={styles.heroAccent} />
            </LinearGradient>

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>راه‌های ارتباطی</Text>
              <Text style={styles.sectionCaption}>از مسیر رسمی زیر با تیم آفاریکس در ارتباط باشید</Text>
            </View>
            <View style={styles.contactCard}>
              <View style={styles.contactTop}>
                <View style={styles.rubikaIcon}><Ionicons name="chatbubble-ellipses-outline" size={23} color="#0d9273" /></View>
                <View style={styles.contactCopy}>
                  <Text style={styles.cardTitle}>پشتیبانی در روبیکا</Text>
                  <Text style={styles.cardText}>برای ارتباط مستقیم با تیم پشتیبانی از طریق روبیکا پیام ارسال کنید.</Text>
                </View>
              </View>
              <View style={styles.idRow}>
                <Text style={styles.contactId}>{RUBIKA_ID}</Text>
                <Text style={styles.idLabel}>آیدی روبیکا</Text>
              </View>
              <TouchableOpacity style={styles.contactButton} onPress={handleRubika} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="ارتباط با پشتیبانی در روبیکا">
                <Ionicons name="open-outline" size={18} color="#fff" />
                <Text style={styles.contactButtonText}>ارتباط با پشتیبانی</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>کمک سریع</Text></View>
            <View style={styles.helpCard}>
              <Text style={styles.helpTitle}>قبل از تماس بررسی کنید</Text>
              {quickHelp.map((item) => (
                <View key={item.text} style={styles.helpItem}>
                  <View style={styles.helpIcon}><Ionicons name={item.icon} size={17} color="#0d9273" /></View>
                  <Text style={styles.helpText}>{item.text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>سوالات متداول</Text></View>
            <View style={styles.faqCard}>
              {faqs.map((question, index) => (
                <View key={question} style={[styles.faqItem, index === faqs.length - 1 && styles.lastFaqItem]}>
                  <Text style={styles.faqText}>{question}</Text>
                  <Ionicons name="chevron-back" size={18} color="#8a9a9f" />
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f7f8' },
  screen: { flex: 1, backgroundColor: '#f4f7f8' },
  container: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 14 },
  header: { height: 52, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2ebeb' },
  headerTitle: { fontFamily: 'VazirmatnBold', fontSize: 18, color: '#193440' },
  headerSpace: { width: 44, height: 44 },
  content: { paddingBottom: 34 },
  heroCard: { minHeight: 190, borderRadius: 24, padding: 22, justifyContent: 'center', overflow: 'hidden', shadowColor: '#0d5960', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  heroCircle: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -85, top: -85, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroIcon: { width: 59, height: 59, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(183,244,222,0.16)', marginBottom: 15 },
  heroTitle: { fontFamily: 'VazirmatnBold', fontSize: 24, color: '#fff', textAlign: 'right' },
  heroSubtitle: { fontFamily: 'Vazirmatn', fontSize: 12, lineHeight: 22, color: '#d9f7ec', textAlign: 'right', marginTop: 5 },
  heroAccent: { position: 'absolute', left: 22, bottom: 22, width: 34, height: 4, borderRadius: 2, backgroundColor: '#7de2ba' },
  sectionHeading: { alignItems: 'flex-end', marginTop: 23, marginBottom: 11 },
  sectionTitle: { fontFamily: 'VazirmatnBold', fontSize: 17, color: '#253e4a' },
  sectionCaption: { fontFamily: 'Vazirmatn', fontSize: 10, color: '#8a9a9f', marginTop: 3 },
  contactCard: { backgroundColor: '#fff', borderRadius: 21, padding: 18, borderWidth: 1, borderColor: '#e3ecec', shadowColor: '#193b49', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  contactTop: { flexDirection: 'row-reverse', alignItems: 'flex-start' },
  rubikaIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f7f2', marginLeft: 13 },
  contactCopy: { flex: 1, alignItems: 'flex-end' },
  cardTitle: { width: '100%', fontFamily: 'VazirmatnBold', fontSize: 15, color: '#27404c', textAlign: 'right' },
  cardText: { width: '100%', fontFamily: 'Vazirmatn', fontSize: 11, lineHeight: 21, color: '#71858a', textAlign: 'right', marginTop: 5 },
  idRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 17, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 13, backgroundColor: '#f5faf8' },
  contactId: { fontFamily: 'VazirmatnBold', fontSize: 15, color: '#147e69' },
  idLabel: { fontFamily: 'Vazirmatn', fontSize: 10, color: '#829598' },
  contactButton: { minHeight: 50, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: '#0e9672', marginTop: 13, shadowColor: '#0e9672', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  contactButtonText: { fontFamily: 'VazirmatnBold', fontSize: 13, color: '#fff' },
  helpCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#e4ecec' },
  helpTitle: { fontFamily: 'VazirmatnBold', fontSize: 14, color: '#2a4350', textAlign: 'right', marginBottom: 6 },
  helpItem: { minHeight: 47, flexDirection: 'row-reverse', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eef3f2' },
  helpIcon: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf7f2', marginLeft: 10 },
  helpText: { flex: 1, fontFamily: 'Vazirmatn', fontSize: 11, lineHeight: 19, color: '#71858a', textAlign: 'right' },
  faqCard: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 17, borderWidth: 1, borderColor: '#e4ecec' },
  faqItem: { minHeight: 55, flexDirection: 'row-reverse', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eef3f2' },
  lastFaqItem: { borderBottomWidth: 0 },
  faqText: { flex: 1, fontFamily: 'Vazirmatn', fontSize: 12, color: '#4f6871', textAlign: 'right' },
});
