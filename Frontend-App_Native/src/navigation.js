import React from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "./contexts/AuthContext";
import { useData } from "./contexts/DataContext";
import { colors } from "./theme/colors";


import ContactScreen from "./screens/ContactScreen";
import LoginScreen from "./screens/LoginScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import ChangePasswordScreen from "./screens/ChangePasswordScreen";
import HomeScreen from "./screens/HomeScreen";
import MetricsScreen from "./screens/MetricsScreen";
import MedicationScreen from "./screens/MedicationScreen";
import LifestyleScreen from "./screens/LifestyleScreen";
import RecheckScreen from "./screens/RecheckScreen";
import ProgressionScreen from "./screens/ProgressionScreen";
import SymptomsScreen from "./screens/SymptomsScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import BlogScreen from "./screens/BlogScreen";
import ProfileScreen from "./screens/ProfileScreen";
import VisitHistoryScreen from "./screens/VisitHistoryScreen";
import VisitFeedbackScreen from "./screens/VisitFeedbackScreen";
import VisitDetailScreen from "./screens/VisitDetailScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Kiểu tiêu đề dùng chung
const headerStyle = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { color: colors.ink, fontSize: 17, fontWeight: "600" },
  headerTintColor: colors.primary,
  headerShadowVisible: false,
};

/* ---------- Chưa đăng nhập ---------- */
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: "Quên mật khẩu" }} />
    </Stack.Navigator>
  );
}

/* ---------- Buộc đổi mật khẩu tạm ---------- */
function ForceChangePasswordStack() {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      {/*
        Tên route PHẢI khác "ChangePassword" của MainStack.
        Khi mustChangePassword lật sang false, NavigationContainer đổi con từ
        ForceChangePasswordStack sang MainStack nhưng vẫn GIỮ state điều hướng.
        Trùng tên route thì state cũ khớp được với navigator mới, nên app đứng
        nguyên ở màn đổi mật khẩu thay vì vào Trang chủ.
      */}
      <Stack.Screen
        name="ForceChangePassword"
        component={ChangePasswordScreen}
        // Route param is a fallback; ChangePasswordScreen also reads
        // mustChangePassword directly from AuthContext.
        initialParams={{ force: true }}
        options={{ title: "Đổi mật khẩu", headerLeft: () => null }}
      />
    </Stack.Navigator>
  );
}

/* ---------- 5 tab chính ---------- */
function MainTabs() {
  const { unreadCount } = useData();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...headerStyle,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.hairline, height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: "home-outline",
            Metrics: "pulse-outline",
            Medication: "medkit-outline",
            Progression: "trending-up-outline",
            Profile: "person-outline",
          };
          return <Ionicons name={icons[route.name] || "ellipse-outline"} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Trang chủ", headerShown: false }} />
      <Tab.Screen name="Metrics" component={MetricsScreen} options={{ title: "Chỉ số" }} />
      <Tab.Screen name="Medication" component={MedicationScreen} options={{ title: "Thuốc" }} />
      <Tab.Screen name="Progression" component={ProgressionScreen} options={{ title: "Diễn tiến" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Cá nhân" }} />
    </Tab.Navigator>
  );
}

/* ---------- Đã đăng nhập: tabs + các màn phụ ---------- */
function MainStack() {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Recheck" component={RecheckScreen} options={{ title: "Tái tầm soát" }} />
      <Stack.Screen name="Lifestyle" component={LifestyleScreen} options={{ title: "Nhật ký lối sống" }} />
      <Stack.Screen name="Symptoms" component={SymptomsScreen} options={{ title: "Triệu chứng" }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Thông báo" }} />
      <Stack.Screen name="Blog" component={BlogScreen} options={{ title: "Bài viết sức khỏe" }} />
      <Stack.Screen name="VisitHistory" component={VisitHistoryScreen} options={{ title: "Lịch sử khám" }} />
      <Stack.Screen name="VisitDetail" component={VisitDetailScreen} options={{ title: "Kết quả khám" }} />
      <Stack.Screen name="VisitFeedback" component={VisitFeedbackScreen} options={{ title: "Phản hồi lượt khám" }} />
      <Stack.Screen
  name="Contact"
  component={ContactScreen}
  options={{ title: "Liên hệ bệnh viện" }}
/>
      
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: "Đổi mật khẩu" }} />
    </Stack.Navigator>
  );
}

export default function RootNavigation() {
  const { isAuthenticated, mustChangePassword, booting } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? <AuthStack /> : mustChangePassword ? <ForceChangePasswordStack /> : <MainStack />}
    </NavigationContainer>
  );
}
