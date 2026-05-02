import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { colors } from "../../lib/theme";

type TabIconName = "home" | "home-outline" | "cube" | "cube-outline" | "person" | "person-outline";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          height: 78,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen name="home" options={tabOptions("Home", "home", "home-outline")} />
      <Tabs.Screen name="orders" options={tabOptions("Orders", "cube", "cube-outline")} />
      <Tabs.Screen name="profile" options={tabOptions("Profile", "person", "person-outline")} />
    </Tabs>
  );
}

function tabOptions(label: string, activeIcon: TabIconName, inactiveIcon: TabIconName) {
  return {
    title: label,
    tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
      <Ionicons name={focused ? activeIcon : inactiveIcon} size={24} color={color} />
    ),
  };
}
