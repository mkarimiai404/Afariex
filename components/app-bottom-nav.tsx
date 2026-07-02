import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type NavKey = 'remittance' | 'wallet' | 'support';

const items: Array<{
  key: NavKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}> = [
  { key: 'remittance', label: 'حواله', icon: 'swap-horizontal', route: '/add-remittance' },
  { key: 'wallet', label: 'کیف پول', icon: 'wallet', route: '/add-balance' },
  { key: 'support', label: 'پشتیبانی', icon: 'headset', route: '/profile' },
];

export function AppBottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const activeKey: NavKey | null = pathname?.includes('add-remittance')
    ? 'remittance'
    : pathname?.includes('add-balance')
      ? 'wallet'
      : pathname?.includes('profile')
        ? 'support'
        : null;

  return (
    <View style={styles.bar}>
      {items.map((item) => {
        const active = activeKey === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.8}
          >
            <Ionicons name={item.icon} size={22} color={active ? '#0ed874' : '#718096'} />
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: 65,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 9999,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: '100%',
  },
  itemActive: {
    backgroundColor: '#eefbf5',
  },
  label: {
    fontSize: 10,
    fontFamily: 'Vazirmatn',
    color: '#718096',
  },
  labelActive: {
    color: '#0ed874',
    fontWeight: 'bold',
  },
});
