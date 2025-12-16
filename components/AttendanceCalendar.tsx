"use client";

import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceRecord {
  _id: string;
  date: string;
  status?: "Present" | "Absent" | "WFH" | "OnDuty";
  punches?: Array<{ type: string; time: string }>;
  totalHours?: number;
}

interface AttendanceCalendarProps {
  attendance: AttendanceRecord[];
  month: string; // YYYY-MM format
  onDateClick?: (date: string) => void;
}

export default function AttendanceCalendar({
  attendance,
  month,
  onDateClick,
}: AttendanceCalendarProps) {
  // Create a map of date -> attendance record for quick lookup
  const attendanceMap = new Map<string, AttendanceRecord>();
  attendance.forEach((record) => {
    attendanceMap.set(record.date, record);
  });

  // Parse the month
  const [year, monthNum] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNum - 1, 1);
  const lastDay = new Date(year, monthNum, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Get all days in the month
  const days: Array<{ date: number; dateString: string; record?: AttendanceRecord }> = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push({ date: 0, dateString: "" });
  }

  // Add all days in the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const record = attendanceMap.get(dateString);
    days.push({ date: day, dateString, record });
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "Present":
        return "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
      case "Absent":
        return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
      case "WFH":
        return "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
      case "OnDuty":
        return "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "Present":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "Absent":
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full">
      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (day.date === 0) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const isToday =
            day.dateString === new Date().toISOString().slice(0, 10);
          const hasRecord = !!day.record;

          return (
            <div
              key={day.dateString}
              onClick={() => onDateClick?.(day.dateString)}
              className={cn(
                "aspect-square border rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105",
                getStatusColor(day.record?.status),
                isToday && "ring-2 ring-primary ring-offset-2",
                !hasRecord && "opacity-50"
              )}
            >
              <div className="text-sm font-semibold mb-1">{day.date}</div>
              {hasRecord && (
                <div className="flex flex-col items-center gap-0.5">
                  {getStatusIcon(day.record?.status)}
                  {day.record?.totalHours && (
                    <span className="text-xs font-medium">
                      {day.record.totalHours.toFixed(1)}h
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-800" />
          <span>Present</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-300 dark:bg-red-900/30 dark:border-red-800" />
          <span>Absent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300 dark:bg-blue-900/30 dark:border-blue-800" />
          <span>WFH</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-100 border border-purple-300 dark:bg-purple-900/30 dark:border-purple-800" />
          <span>On Duty</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted border border-border opacity-50" />
          <span>No Record</span>
        </div>
      </div>
    </div>
  );
}

