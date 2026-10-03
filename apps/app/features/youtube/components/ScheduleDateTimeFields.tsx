"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon } from "@/features/dashboard/icons";

interface ScheduleDateTimeFieldsProps {
  date: Date;
  time: string;
  onDateChange: (date: Date) => void;
  onTimeChange: (time: string) => void;
  minDate?: Date;
}

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);

export function ScheduleDateTimeFields({
  date,
  time,
  onDateChange,
  onTimeChange,
  minDate = new Date(),
}: ScheduleDateTimeFieldsProps) {
  const [rawHour = "18", rawMinute = "00"] = time.split(":");
  const hour24 = Number(rawHour);
  const hour12 = String(hour24 % 12 || 12);
  const period = hour24 >= 12 ? "PM" : "AM";
  const minute = MINUTES.includes(rawMinute) ? rawMinute : "00";

  const updateTime = (
    nextHour: string,
    nextMinute: string,
    nextPeriod: string,
  ) => {
    let nextHour24 = Number(nextHour) % 12;
    if (nextPeriod === "PM") nextHour24 += 12;
    onTimeChange(`${String(nextHour24).padStart(2, "0")}:${nextMinute}`);
  };

  return (
    <div className="grid gap-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Publication date
        </label>
        <Popover>
          <PopoverTrigger className="flex h-10 w-full items-center justify-start gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span>{format(date, "EEE, MMM d, yyyy")}</span>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--anchor-width)] min-w-[var(--anchor-width)] p-0"
            align="start"
          >
            <Calendar
              mode="single"
              selected={date}
              onSelect={(value) => value && onDateChange(value)}
              disabled={{ before: minDate }}
              className="w-full p-3"
              classNames={{
                root: "w-full",
                months: "w-full",
                month: "w-full",
                month_grid: "w-full",
                weekdays: "flex w-full",
                weekday:
                  "flex-1 text-center text-xs font-normal text-muted-foreground",
                week: "mt-1 flex w-full",
                day: "relative flex h-9 min-w-0 flex-1 items-center justify-center p-0 text-center",
                day_button: "mx-auto h-8 w-8 min-w-8 rounded-md p-0",
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Publication time
        </label>
        <div className="grid w-full grid-cols-[1fr_auto_1fr_1fr] items-center gap-2">
          <Select
            value={hour12}
            onValueChange={(value) => updateTime(String(value), minute, period)}
          >
            <SelectTrigger aria-label="Hour">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((hour) => (
                <SelectItem key={hour} value={hour}>
                  {hour}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select
            value={minute}
            onValueChange={(value) => updateTime(hour12, String(value), period)}
          >
            <SelectTrigger aria-label="Minute">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={period}
            onValueChange={(value) => updateTime(hour12, minute, String(value))}
          >
            <SelectTrigger aria-label="AM or PM">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
