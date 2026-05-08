import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { colors } from "../../lib/theme";

type TabIconName =
  | "home"
  | "home-outline"
  | "reader"
  | "reader-outline"
  | "locate"
  | "locate-outline"
  | "person"
  | "person-outline";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: {
          backgroundColor: "#F2E7CC",
          borderTopColor: colors.line,
          height: 80,
          paddingBottom: 14,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen name="home" options={tabOptions("Home", "home", "home-outline")} />
      <Tabs.Screen name="orders" options={tabOptions("Orders", "reader", "reader-outline")} />
      <Tabs.Screen name="track" options={tabOptions("Track", "locate", "locate-outline")} />
      <Tabs.Screen name="profile" options={tabOptions("Profile", "person", "person-outline")} />
    </Tabs>
  );
}

function tabOptions(label: string, activeIcon: TabIconName, inactiveIcon: TabIconName) {
  return {
    title: label,
    tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
      <Ionicons name={focused ? activeIcon : inactiveIcon} size={22} color={color} />
    ),
  };
}
