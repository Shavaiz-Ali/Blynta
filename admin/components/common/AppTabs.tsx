"use client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
export function AppTabs({ tabs, value, onValueChange }: { tabs: { value: string; label: string }[]; value: string; onValueChange: (value: string) => void }) {
  return <Tabs value={value} onValueChange={onValueChange}><TabsList>{tabs.map(tab => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}</TabsList></Tabs>;
}
