import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }) {
  return (
    <div data-slot="table-container" className="relative w-full">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm border-separate border-spacing-0", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "sticky top-0 z-10 [&_th]:bg-background/95 [&_th]:backdrop-blur",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />
}

function TableRow({ className, ...props }) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group transition-colors hover:bg-accent/40 data-[state=selected]:bg-accent/60",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 border-b border-border whitespace-nowrap",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2.5 align-middle border-b border-border/60",
        className
      )}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
