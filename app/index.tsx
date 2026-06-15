import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDatabase } from '../store/database';
import OnboardingScreen from '../screens/OnboardingScreen';
import TodayScreen from '../screens/TodayScreen';
import GoodNightScreen from '../screens/GoodNightScreen';
import { colors } from '../constants/colors';
import type { RootStackParamList } from '../types';

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    async function init() {
      try {
        await initDatabase();
        const done = await AsyncStorage.getItem('onboarding_complete');
        setInitialRoute(done ? 'Today' : 'Onboarding');
      } catch {
        setInitialRoute('Onboarding');
      }
    }
    init();
  }, []);

  if (!initialRoute) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, animation: 'none' }}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Today"      component={TodayScreen} />
          <Stack.Screen name="GoodNight"  component={GoodNightScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
