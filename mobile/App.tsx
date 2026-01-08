import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChronousApp } from './src/ChronousApp';
import { CapsuleProvider } from './src/store/CapsuleContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <CapsuleProvider>
        <ChronousApp />
      </CapsuleProvider>
    </SafeAreaProvider>
  );
}

