import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';

export default function AddRemittanceScreen() {
  const router = useRouter();
  
  // State ها دقیقا مطابق ستون های دیتابیس
  const [agency, setAgency] = useState('');
  const [exchanger, setExchanger] = useState('');
  const [sender, setSender] = useState('');
  const [receiver, setReceiver] = useState('');
  const [amountToman, setAmountToman] = useState('');
  const [amountAfghani, setAmountAfghani] = useState('');
  const [description, setDescription] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRegister = async () => {
    // طبق دیتابیس شما این فیلدها Not Null هستند پس باید حتما پر شوند
    if (!agency || !exchanger || !sender || !receiver || !amountToman || !amountAfghani) {
      setModalMessage('لطفاً تمام فیلدهای ضروری را پر کنید (توضیحات اختیاری است).');
      setIsSuccess(false);
      setModalVisible(true);
      return;
    }

    setIsLoading(true);

    try {
      // کلیدها دقیقاً هم‌نام با ستون‌های دیتابیس شما
      const requestData = {
        agency: agency,
        exchanger: exchanger,
        sender: sender,
        receiver: receiver,
        amount_toman: amountToman,
        amount_afghani: amountAfghani,
        description: description,
      };

      console.log("Sending data:", requestData);

      // --- تغییر آدرس API به دامنه جدید ---
      const response = await fetch('http://mazhikeabi.com/API/add_remittance.php', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const responseText = await response.text();
      console.log("Server Raw Response:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        setModalMessage('خطا در خواندن اطلاعات از سرور.');
        setIsSuccess(false);
        setModalVisible(true);
        setIsLoading(false);
        return;
      }

      if (data.success || data.status === 'success') {
        setModalMessage('حواله با موفقیت ثبت شد!');
        setIsSuccess(true);
        setModalVisible(true);
        
        // پاک کردن فرم
        setAgency('');
        setExchanger('');
        setSender('');
        setReceiver('');
        setAmountToman('');
        setAmountAfghani('');
        setDescription('');
      } else {
        setModalMessage(data.message || 'خطا در ثبت حواله.');
        setIsSuccess(false);
        setModalVisible(true);
      }
    } catch (error) {
      console.error("Network Fetch Error: ", error);
      setModalMessage('مشکلی در ارتباط با سرور پیش آمد.');
      setIsSuccess(false);
      setModalVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    if (isSuccess) {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* حذف هدر انگلیسی پیش‌فرض و اضافی بالای صفحه */}
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.card}>
          
          {/* هدر داخلی فرم (مطابق عکس طراحی شما) */}
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <Text style={styles.headerTitle}>ثبت حواله جدید</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-forward" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />

          <View style={styles.formContainer}>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>نمایندگی</Text>
              <TextInput
                style={styles.input}
                placeholder="نام نمایندگی را وارد کنید"
                placeholderTextColor="#9CA3AF"
                value={agency}
                onChangeText={setAgency}
                textAlign="right"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>صراف</Text>
              <TextInput
                style={styles.input}
                placeholder="محمد کریمی"
                placeholderTextColor="#9CA3AF"
                value={exchanger}
                onChangeText={setExchanger}
                textAlign="right"
              />
            </View>

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>فرستنده</Text>
                <TextInput
                  style={styles.input}
                  placeholder="نام فرستنده"
                  placeholderTextColor="#9CA3AF"
                  value={sender}
                  onChangeText={setSender}
                  textAlign="center"
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>گیرنده</Text>
                <TextInput
                  style={styles.input}
                  placeholder="نام گیرنده"
                  placeholderTextColor="#9CA3AF"
                  value={receiver}
                  onChangeText={setReceiver}
                  textAlign="center"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>مقدار وجه (تومان)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="مثلا 10,000,000"
                  placeholderTextColor="#9CA3AF"
                  value={amountToman}
                  onChangeText={setAmountToman}
                  keyboardType="numeric"
                  textAlign="center"
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>مقدار (افغانی)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="مثلا 15,000"
                  placeholderTextColor="#9CA3AF"
                  value={amountAfghani}
                  onChangeText={setAmountAfghani}
                  keyboardType="numeric"
                  textAlign="center"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>توضیحات</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="توضیحات حواله..."
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
                textAlign="right"
                multiline={true}
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>ثبت حواله</Text>
              )}
            </TouchableOpacity>

          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.iconContainer, isSuccess ? styles.iconSuccess : styles.iconError]}>
              <Ionicons 
                name={isSuccess ? "checkmark" : "close"} 
                size={40} 
                color="#fff" 
              />
            </View>
            <Text style={styles.modalTitle}>{isSuccess ? 'موفق' : 'خطا'}</Text>
            <Text style={styles.modalMessageText}>{modalMessage}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={closeModal}>
              <Text style={styles.modalButtonText}>باشه</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 20,
  },
  formContainer: {
    gap: 15,
  },
  inputGroup: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  halfWidth: {
    width: '48%',
  },
  label: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
    textAlign: 'right',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1F2937',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -40,
    elevation: 5,
  },
  iconSuccess: {
    backgroundColor: '#10B981', 
  },
  iconError: {
    backgroundColor: '#EF4444', 
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 15,
    marginBottom: 10,
  },
  modalMessageText: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  modalButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
