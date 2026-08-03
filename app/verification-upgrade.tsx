import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiUrl, fetchJson } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { showError, showSuccess } from '@/lib/toast';

type Picked = { uri: string; name?: string; mimeType?: string; type?: string; size?: number };

export default function VerificationUpgradeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const type = params.type === 'gold' ? 'gold' : 'silver';
  const { userId, userToken } = useAuth();
  const [identity, setIdentity] = useState<Picked | null>(null);
  const [selfie, setSelfie] = useState<Picked | null>(null);
  const [video, setVideo] = useState<Picked | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!userId || !userToken) return;
    try {
      const body = new URLSearchParams({ user_id: userId, api_token: userToken, request_type: type, action: 'status' });
      const result = await fetchJson<any>('verification-request.php', { method: 'POST', body: body.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      setStatus(result?.data || null);
    } catch { /* The upload screen remains usable when there is no previous request. */ }
  }, [type, userId, userToken]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const pick = async (kind: 'image' | 'video', target?: 'identity' | 'selfie') => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === 'image' ? ['images'] : ['videos'], allowsEditing: kind === 'image', quality: 0.8, videoMaxDuration: 120 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const picked: Picked = { uri: asset.uri, name: asset.fileName || undefined, mimeType: asset.mimeType || undefined, type: kind, size: asset.fileSize || undefined };
    if (kind === 'video') setVideo(picked); else if (target === 'selfie') setSelfie(picked); else setIdentity(picked);
  };

  const submit = async () => {
    if (!userId || !userToken || loading) return;
    if (type === 'silver' && (!identity || !selfie)) { showError('خطا', 'تصویر مدرک هویتی و سلفی با مدرک را انتخاب کنید.'); return; }
    if (type === 'gold' && !video) { showError('خطا', 'ویدیوی احراز هویت را انتخاب کنید.'); return; }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('user_id', userId); form.append('api_token', userToken); form.append('request_type', type);
      const add = (field: string, file: Picked) => form.append(field, { uri: file.uri, name: file.name || `${field}.${type === 'gold' ? 'mp4' : 'jpg'}`, type: file.mimeType || (type === 'gold' ? 'video/mp4' : 'image/jpeg') } as any);
      if (type === 'silver') { add('identity_document', identity!); add('selfie', selfie!); } else add('video', video!);
      const response = await fetch(apiUrl('verification-request.php'), { method: 'POST', headers: { Accept: 'application/json' }, body: form });
      const result = await response.json();
      if (!response.ok || result?.success !== true) throw new Error(result?.message || 'ارسال درخواست انجام نشد.');
      showSuccess('ارسال شد', 'درخواست شما برای بررسی ارسال شد.');
      setStatus({ status: 'pending', request_type: type });
    } catch (error: any) { showError('خطا', error?.message || 'ارسال فایل‌ها انجام نشد.'); } finally { setLoading(false); }
  };

  const rejected = status?.status === 'rejected';
  const pending = status?.status === 'pending';
  return <SafeAreaView style={styles.safeArea}><Stack.Screen options={{ headerShown: false }} /><View style={styles.container}>
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-forward" size={22} color="#374151" /></TouchableOpacity><Text style={styles.title}>{type === 'silver' ? 'احراز هویت نقره‌ای' : 'احراز هویت طلایی'}</Text><View style={styles.space} /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {type === 'silver' ? <>
        <Text style={styles.instructions}>برای ارتقاء به سطح نقره‌ای، تصویر واضح مدرک هویتی و یک سلفی در حالی که مدرک را در دست دارید ارسال کنید.</Text>
        <PickerCard title="تصویر مدرک هویتی" value={identity} onPick={() => pick('image', 'identity')} onRemove={() => setIdentity(null)} />
        <PickerCard title="سلفی با مدرک هویتی" value={selfie} onPick={() => identity ? pick('image', 'selfie') : showError('راهنما', 'ابتدا تصویر مدرک هویتی را انتخاب کنید.')} onRemove={() => setSelfie(null)} />
      </> : <>
        <Text style={styles.instructions}>ویدیو باید شامل نمایش مدرک هویتی و گفتن نام و نام خانوادگی، نمایش کارت بانکی به نام خودتان با پوشاندن CVV و تاریخ انقضا، و نمایش واضح چهره باشد.</Text>
        <View style={styles.warning}><Text style={styles.warningText}>کارت بانکی باید به نام خودتان باشد. CVV و تاریخ انقضا را حتماً بپوشانید.</Text><Text style={styles.sentence}>این ویدیو بابت احراز هویت در اپلیکیشن افغان دیجیتال است.</Text></View>
        <PickerCard title="ویدیوی احراز هویت" value={video} onPick={() => pick('video')} onRemove={() => setVideo(null)} video />
      </>}
      {rejected && <View style={styles.rejected}><Text style={styles.rejectedTitle}>درخواست رد شده است</Text><Text style={styles.rejectedText}>{status?.rejection_reason || 'لطفاً فایل‌ها را اصلاح و دوباره ارسال کنید.'}</Text></View>}
      {pending && <View style={styles.pending}><Text style={styles.pendingText}>درخواست شما در حال بررسی است.</Text></View>}
      {!pending && <TouchableOpacity style={[styles.submit, loading && styles.disabled]} onPress={submit} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{rejected ? 'ارسال مجدد درخواست' : 'ارسال برای بررسی'}</Text>}</TouchableOpacity>}
    </ScrollView>
  </View></SafeAreaView>;
}

function PickerCard({ title, value, onPick, onRemove, video }: { title: string; value: Picked | null; onPick: () => void; onRemove: () => void; video?: boolean }) {
  return <View style={styles.picker}><Text style={styles.pickerTitle}>{title}</Text>{value && !video && <Image source={{ uri: value.uri }} style={styles.preview} />}{value && video && <View style={styles.videoPreview}><Ionicons name="videocam" size={28} color="#2563eb" /><Text style={styles.fileName}>ویدیو انتخاب شد</Text></View>}<View style={styles.pickerActions}><TouchableOpacity style={styles.choose} onPress={onPick}><Text style={styles.chooseText}>{value ? 'جایگزینی' : 'انتخاب فایل'}</Text></TouchableOpacity>{value && <TouchableOpacity onPress={onRemove}><Text style={styles.remove}>حذف</Text></TouchableOpacity>}</View></View>;
}

const styles = StyleSheet.create({ safeArea: { flex: 1, backgroundColor: '#f8fafc' }, container: { flex: 1, padding: 18 }, header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, back: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, title: { fontFamily: 'VazirmatnBold', fontSize: 18, color: '#1f2937' }, space: { width: 40 }, content: { paddingBottom: 32 }, instructions: { fontFamily: 'Vazirmatn', color: '#475569', textAlign: 'right', lineHeight: 25, marginBottom: 14 }, picker: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14 }, pickerTitle: { fontFamily: 'VazirmatnBold', color: '#1f2937', textAlign: 'right', marginBottom: 12 }, preview: { width: '100%', height: 150, borderRadius: 12, resizeMode: 'cover' }, videoPreview: { height: 90, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }, fileName: { fontFamily: 'Vazirmatn', color: '#2563eb', marginTop: 6 }, pickerActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 16, marginTop: 12 }, choose: { backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }, chooseText: { fontFamily: 'VazirmatnBold', color: '#2563eb' }, remove: { fontFamily: 'Vazirmatn', color: '#dc2626' }, warning: { backgroundColor: '#fffbeb', borderRadius: 14, padding: 16, marginBottom: 14 }, warningText: { fontFamily: 'VazirmatnBold', color: '#92400e', textAlign: 'right', lineHeight: 24 }, sentence: { fontFamily: 'Vazirmatn', color: '#78350f', textAlign: 'right', marginTop: 10, lineHeight: 24 }, pending: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, marginTop: 4 }, pendingText: { fontFamily: 'Vazirmatn', color: '#1d4ed8', textAlign: 'right' }, rejected: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, marginTop: 4 }, rejectedTitle: { fontFamily: 'VazirmatnBold', color: '#b91c1c', textAlign: 'right' }, rejectedText: { fontFamily: 'Vazirmatn', color: '#991b1b', textAlign: 'right', marginTop: 5 }, submit: { minHeight: 52, borderRadius: 12, backgroundColor: '#0ed874', alignItems: 'center', justifyContent: 'center', marginTop: 18 }, disabled: { opacity: 0.65 }, submitText: { fontFamily: 'VazirmatnBold', color: '#fff' } });
