"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Filter,
  Calendar as CalendarIcon,
  X,
  Users,
  Upload,
} from "lucide-react";
import { format } from "date-fns";
import { Cluster } from "@/lib/api/clusters";

interface MediaFiltersProps {
  onFiltersChange: (filters: MediaFilterOptions) => void;
  totalMedia: number;
  filteredCount: number;
  clusters: Cluster[];
}

interface MediaFilterOptions {
  dateRange?: {
    from: Date;
    to: Date;
  };
  clusterId?: string;
  processed?: boolean;
  uploader?: string;
}

export function MediaFilters({
  onFiltersChange,
  totalMedia,
  filteredCount,
  clusters,
}: MediaFiltersProps) {
  const [filters, setFilters] = useState<MediaFilterOptions>({});
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const updateFilters = (newFilters: Partial<MediaFilterOptions>): void => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const clearFilters = (): void => {
    setFilters({});
    setDateRange({});
    onFiltersChange({});
  };

  const hasActiveFilters =
    Object.keys(filters).length > 0 || dateRange.from || dateRange.to;

  const handleDateSelect = (
    range: { from?: Date; to?: Date } | undefined
  ): void => {
    if (range?.from && range?.to) {
      setDateRange(range);
      updateFilters({ dateRange: { from: range.from, to: range.to } });
    } else {
      setDateRange({});
      // Create new object without dateRange property
      const filtersWithoutDate = { ...filters };
      delete filtersWithoutDate.dateRange;
      setFilters(filtersWithoutDate);
      onFiltersChange(filtersWithoutDate);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {filteredCount !== totalMedia && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {filteredCount} of {totalMedia} photos
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Person Filter */}
        <div>
          <label className="text-sm font-medium mb-2 block">Person</label>
          <Select
            value={filters.clusterId || "all"}
            onValueChange={(value) =>
              updateFilters({ clusterId: value === "all" ? undefined : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All people" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All people</SelectItem>
              {clusters.map((cluster) => (
                <SelectItem key={cluster.id} value={cluster.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{cluster.clusterName || "Unknown Person"}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {cluster.appearanceCount}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filter */}
        <div>
          <label className="text-sm font-medium mb-2 block">Date Range</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM dd")} -{" "}
                      {format(dateRange.to, "MMM dd, yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM dd, yyyy")
                  )
                ) : (
                  "Select date range"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={handleDateSelect}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Processing Status Filter */}
        <div>
          <label className="text-sm font-medium mb-2 block">Status</label>
          <Select
            value={
              filters.processed === undefined
                ? "all"
                : filters.processed.toString()
            }
            onValueChange={(value) =>
              updateFilters({
                processed: value === "all" ? undefined : value === "true",
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All photos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All photos</SelectItem>
              <SelectItem value="true">Processed</SelectItem>
              <SelectItem value="false">Processing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick Stats */}
        {hasActiveFilters && (
          <div className="pt-4 border-t space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                <Upload className="h-3 w-3" />
                <span>Showing</span>
              </div>
              <Badge variant="outline">
                {filteredCount} photo{filteredCount !== 1 ? "s" : ""}
              </Badge>
            </div>
            {filters.clusterId && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>Person</span>
                </div>
                <span className="text-xs text-gray-500">
                  {clusters.find((c) => c.id === filters.clusterId)
                    ?.clusterName || "Unknown"}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
