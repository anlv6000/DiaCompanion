import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import SmsSender from './modules/sms-sender/src/SmsSenderModule';

type PendingSms = {
  id: string;
  phoneNumber: string;
  message: string;
};

type LogItem = {
  at: string;
  text: string;
};

const DEFAULT_URL = process.env.EXPO_PUBLIC_SMS_BACKEND_URL ?? 'http://192.168.1.10:8091';
const DEFAULT_KEY = process.env.EXPO_PUBLIC_SMS_GATEWAY_KEY ?? 'change-this-gateway-key';
const POLL_MS = 3000;

export default function App() {
  const [backendUrl, setBackendUrl] = useState(DEFAULT_URL);
  const [gatewayKey, setGatewayKey] = useState(DEFAULT_KEY);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('DiaCompanion: Ma OTP test cua ban la 123456.');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = (text: string) => {
    setLogs((old) => [{ at: new Date().toLocaleTimeString(), text }, ...old].slice(0, 30));
  };

  const requestSmsPermission = async () => {
    if (Platform.OS !== 'android') return false;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: 'Quyen gui SMS',
        message: 'DiaCompanion SMS Gateway can quyen gui SMS bang SIM tren dien thoai nay.',
        buttonPositive: 'Cho phep',
        buttonNegative: 'Tu choi',
      }
    );
    const ok = result === PermissionsAndroid.RESULTS.GRANTED;
    addLog(ok ? 'SEND_SMS permission granted' : `SEND_SMS permission: ${result}`);
    return ok;
  };

  useEffect(() => {
    requestSmsPermission().catch((e) => addLog(`Permission error: ${String(e)}`));
  }, []);

  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    pollOnce();
    timerRef.current = setInterval(pollOnce, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [running, backendUrl, gatewayKey]);

  const normalizedBaseUrl = () => backendUrl.replace(/\/+$/, '');

  const reportResult = async (job: PendingSms, success: boolean, errorMessage?: string) => {
    const response = await fetch(`${normalizedBaseUrl()}/api/gateway/${job.id}/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SMS-GATEWAY-KEY': gatewayKey,
      },
      body: JSON.stringify({ success, errorMessage: errorMessage ?? null }),
    });
    if (!response.ok) throw new Error(`Report result HTTP ${response.status}`);
  };

  const sendNativeSms = async (targetPhone: string, body: string) => {
    const permission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS);
    if (!permission) {
      const granted = await requestSmsPermission();
      if (!granted) throw new Error('SEND_SMS permission denied');
    }
    return SmsSender.sendSms(targetPhone, body);
  };

  const pollOnce = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`${normalizedBaseUrl()}/api/gateway/pending`, {
        headers: { 'X-SMS-GATEWAY-KEY': gatewayKey },
      });

      if (response.status === 204) return;
      if (!response.ok) throw new Error(`Poll HTTP ${response.status}`);

      const job = (await response.json()) as PendingSms;
      addLog(`Picked ${job.id.slice(0, 8)} -> ${job.phoneNumber}`);

      try {
        const result = await sendNativeSms(job.phoneNumber, job.message);
        await reportResult(job, result.success, result.success ? undefined : result.detail);
        addLog(`${result.success ? 'SENT' : 'FAILED'} ${job.phoneNumber}: ${result.detail}`);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        try {
          await reportResult(job, false, detail);
        } catch (reportError) {
          addLog(`Could not report failure: ${String(reportError)}`);
        }
        addLog(`FAILED ${job.phoneNumber}: ${detail}`);
      }
    } catch (error) {
      addLog(`Poll error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const testBackend = async () => {
    try {
      const response = await fetch(`${normalizedBaseUrl()}/health`);
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
      addLog(`Backend OK: ${text}`);
      Alert.alert('OK', 'Ket noi backend thanh cong.');
    } catch (error) {
      Alert.alert('Loi ket noi', error instanceof Error ? error.message : String(error));
    }
  };

  const sendManual = async () => {
    if (!phone.trim() || !message.trim()) {
      Alert.alert('Thieu du lieu', 'Nhap so dien thoai va noi dung.');
      return;
    }
    try {
      const result = await sendNativeSms(phone.trim(), message.trim());
      addLog(`${result.success ? 'SENT' : 'FAILED'} manual: ${result.detail}`);
      Alert.alert(result.success ? 'Da gui' : 'Gui that bai', result.detail);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      addLog(`Manual send failed: ${detail}`);
      Alert.alert('Gui that bai', detail);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>DiaCompanion SMS Gateway</Text>
        <Text style={styles.subtitle}>Android + SIM local gateway</Text>

        <Text style={styles.label}>Backend URL</Text>
        <TextInput value={backendUrl} onChangeText={setBackendUrl} style={styles.input} autoCapitalize="none" />

        <Text style={styles.label}>Gateway Key</Text>
        <TextInput value={gatewayKey} onChangeText={setGatewayKey} style={styles.input} autoCapitalize="none" secureTextEntry />

        <View style={styles.row}>
          <ActionButton text="Test backend" onPress={testBackend} />
          <ActionButton text={running ? 'Stop polling' : 'Start polling'} onPress={() => setRunning((v) => !v)} />
        </View>

        <View style={styles.statusBox}>
          <Text>Status: {running ? 'RUNNING' : 'STOPPED'} {busy ? ' / BUSY' : ''}</Text>
          <Text>Polling: {POLL_MS / 1000}s</Text>
        </View>

        <Text style={styles.sectionTitle}>Manual SMS test</Text>
        <TextInput placeholder="0335571221 or +84335571221" value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" />
        <TextInput value={message} onChangeText={setMessage} style={[styles.input, styles.messageInput]} multiline />
        <ActionButton text="SEND SMS BY SIM" onPress={sendManual} />

        <Text style={styles.sectionTitle}>Logs</Text>
        <View style={styles.logBox}>
          {logs.length === 0 ? <Text>Chua co log.</Text> : logs.map((item, index) => (
            <Text key={`${item.at}-${index}`} style={styles.logText}>[{item.at}] {item.text}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
      <Text style={styles.buttonText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20, gap: 10 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, opacity: 0.7, marginBottom: 10 },
  label: { fontWeight: '600', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  messageInput: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  button: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, alignSelf: 'flex-start' },
  buttonPressed: { opacity: 0.6 },
  buttonText: { fontWeight: '700' },
  statusBox: { borderWidth: 1, borderRadius: 8, padding: 12, marginVertical: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 14 },
  logBox: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 120 },
  logText: { fontSize: 12, marginBottom: 4 },
});
